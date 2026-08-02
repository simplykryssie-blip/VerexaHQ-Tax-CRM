import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";

type DatabaseClient = ReturnType<typeof createClient>;
type JsonRecord = Record<string, unknown>;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function requireServiceRole(request: Request) {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("authorization");
  if (!serviceRoleKey || authorization !== `Bearer ${serviceRoleKey}`) {
    throw new Error("Service-role authorization required");
  }
  return serviceRoleKey;
}

async function sendEmail(row: JsonRecord) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = String(row.sender_address || Deno.env.get("RESEND_FROM_EMAIL") || "");
  if (!apiKey || !from) throw new Error("Resend is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [row.recipient_address],
      subject: row.subject || "Message from Verexa Tax Office",
      text: row.body_text || undefined,
      html: row.body_html || undefined,
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "Resend failed");
  return payload.id as string;
}

async function sendSms(row: JsonRecord) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = String(row.sender_address || Deno.env.get("TWILIO_FROM_NUMBER") || "");
  if (!accountSid || !authToken || !from) throw new Error("Twilio is not configured");
  const body = new URLSearchParams({
    To: String(row.recipient_address),
    From: from,
    Body: String(row.body_text || ""),
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "Twilio failed");
  return payload.sid as string;
}

async function deliverEngagementActivationPackage(db: DatabaseClient, job: JsonRecord) {
  const payload = job.payload as JsonRecord;
  const activationId = String(payload.activation_id || "");
  const clientId = String(payload.client_id || "");
  const engagementId = String(payload.engagement_id || "");
  const recipientEmail = String(payload.recipient_email || "");
  if (!activationId || !clientId || !engagementId || !recipientEmail) {
    throw new Error("Activation delivery job is missing required identifiers");
  }

  const { data: client, error: clientError } = await db
    .from("clients")
    .select("id, workspace_id, first_name, portal_user_id, portal_status")
    .eq("id", clientId)
    .single();
  if (clientError || !client) throw clientError || new Error("Client not found");

  const appUrl = (Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "").replace(/\/+$/, "");
  if (payload.invite_portal && !client.portal_user_id) {
    const { data: invited, error: inviteError } = await db.auth.admin.inviteUserByEmail(recipientEmail, {
      redirectTo: appUrl ? `${appUrl}/portal/reset-password` : undefined,
      data: { client_id: clientId, workspace_id: client.workspace_id },
    });
    if (inviteError || !invited.user) throw inviteError || new Error("Portal invitation failed");
    const { error: linkError } = await db
      .from("clients")
      .update({ portal_user_id: invited.user.id, portal_status: "invited" })
      .eq("id", clientId)
      .is("portal_user_id", null);
    if (linkError) throw linkError;
  }

  const messages = (payload.messages || {}) as JsonRecord;
  const portalUrl = appUrl ? `${appUrl}/portal/dashboard` : "the secure client portal";
  const idempotencyKey = `engagement_activation:${activationId}:package_email`;
  const { error: outboxError } = await db.from("communication_outbox").upsert({
    workspace_id: client.workspace_id,
    channel: "email",
    client_id: clientId,
    engagement_id: engagementId,
    recipient_address: recipientEmail,
    subject: messages.intake_subject || "Your tax engagement is ready",
    body_text: `Your tax engagement has been activated. Sign in at ${portalUrl} to review your engagement letter, complete your organizer, and upload requested documents.`,
    body_html: `<p>Your tax engagement has been activated.</p><p><a href="${portalUrl}">Open your secure client portal</a> to review your engagement letter, complete your organizer, and upload requested documents.</p>`,
    status: "queued",
    scheduled_for: new Date().toISOString(),
    idempotency_key: idempotencyKey,
    metadata: { activation_id: activationId, automation_job_id: job.id },
  }, { onConflict: "workspace_id,idempotency_key", ignoreDuplicates: true });
  if (outboxError) throw outboxError;

  const reminderSettings = (payload.reminders || {}) as JsonRecord;
  const offsets = Array.isArray(reminderSettings.intake_days) ? reminderSettings.intake_days : [];
  for (const rawOffset of offsets) {
    const days = Number(rawOffset);
    if (!Number.isFinite(days) || days < 1 || days > 120) continue;
    const scheduledFor = new Date(Date.now() + days * 86_400_000).toISOString();
    const { error: reminderError } = await db.from("reminders").upsert({
      workspace_id: client.workspace_id,
      client_id: clientId,
      engagement_id: engagementId,
      reminder_type: "engagement_intake_followup",
      channel: "email",
      scheduled_for: scheduledFor,
      status: "scheduled",
      recipient_address: recipientEmail,
      payload: {
        subject: "Reminder: complete your tax intake",
        body_text: `Please sign in at ${portalUrl} to complete your organizer and upload any requested documents.`,
        activation_id: activationId,
      },
      idempotency_key: `engagement_activation:${activationId}:intake_reminder:${days}`,
    }, { onConflict: "workspace_id,idempotency_key", ignoreDuplicates: true });
    if (reminderError) throw reminderError;
  }

  return { activation_id: activationId, portal_invite_processed: Boolean(payload.invite_portal), reminders_scheduled: offsets.length };
}

async function processAutomationJobs(db: DatabaseClient, workerId: string, summary: JsonRecord) {
  const { data: jobs, error } = await db.rpc("claim_due_automation_jobs", { p_worker_id: workerId, p_limit: 25 });
  if (error) throw error;
  for (const job of jobs || []) {
    try {
      let result: JsonRecord;
      if (job.job_type === "deliver_engagement_activation_package") {
        result = await deliverEngagementActivationPackage(db, job);
      } else {
        throw new Error(`Unsupported automation job type: ${job.job_type}`);
      }
      const { error: completionError } = await db.rpc("complete_automation_job", {
        p_job_id: job.id,
        p_worker_id: workerId,
        p_result: result,
      });
      if (completionError) throw completionError;
      summary.automation = Number(summary.automation || 0) + 1;
    } catch (error) {
      await db.rpc("fail_automation_job", {
        p_job_id: job.id,
        p_worker_id: workerId,
        p_error: errorMessage(error),
      });
      summary.failed = Number(summary.failed || 0) + 1;
    }
  }
}

Deno.serve(async (request) => {
  const summary: JsonRecord = { automation: 0, reminders: 0, email: 0, sms: 0, failed: 0 };
  try {
    const serviceRoleKey = requireServiceRole(request);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const workerId = `edge:${crypto.randomUUID()}`;

    await processAutomationJobs(db, workerId, summary);

    const { data: reminders, error: reminderClaimError } = await db.rpc("claim_due_reminders", { p_limit: 50 });
    if (reminderClaimError) throw reminderClaimError;
    for (const reminder of reminders || []) {
      try {
        if (!reminder.recipient_address) {
          await db.from("reminders").update({ status: "skipped", skipped_reason: "No recipient" }).eq("id", reminder.id);
          continue;
        }
        const { data: outbox, error } = await db.from("communication_outbox").insert({
          workspace_id: reminder.workspace_id,
          channel: reminder.channel,
          client_id: reminder.client_id,
          engagement_id: reminder.engagement_id,
          recipient_address: reminder.recipient_address,
          subject: reminder.payload?.subject,
          body_text: reminder.payload?.body_text || reminder.payload?.message || "",
          body_html: reminder.payload?.body_html,
          template_id: reminder.template_id,
          provider: reminder.channel === "sms" ? "twilio" : reminder.channel === "email" ? "resend" : null,
          metadata: { ...reminder.payload, reminder_id: reminder.id },
        }).select("id").single();
        if (error) throw error;
        await db.from("reminders").update({ status: "sent", outbox_id: outbox.id, sent_at: new Date().toISOString() }).eq("id", reminder.id);
        summary.reminders = Number(summary.reminders || 0) + 1;
      } catch (error) {
        await db.from("reminders").update({ status: "failed", error_message: errorMessage(error) }).eq("id", reminder.id);
        summary.failed = Number(summary.failed || 0) + 1;
      }
    }

    const { data: rows, error: outboxClaimError } = await db.rpc("claim_due_outbox", { p_limit: 25 });
    if (outboxClaimError) throw outboxClaimError;
    for (const row of rows || []) {
      try {
        let providerMessageId: string | null = null;
        if (row.channel === "email") {
          providerMessageId = await sendEmail(row);
          summary.email = Number(summary.email || 0) + 1;
        } else if (row.channel === "sms") {
          providerMessageId = await sendSms(row);
          summary.sms = Number(summary.sms || 0) + 1;
        }
        await db.from("communication_outbox").update({
          status: "sent",
          provider_message_id: providerMessageId,
          sent_at: new Date().toISOString(),
          error_message: null,
        }).eq("id", row.id);
        await db.from("communication_events").insert({
          workspace_id: row.workspace_id,
          outbox_id: row.id,
          provider: row.provider,
          provider_message_id: providerMessageId,
          event_type: "sent",
          payload: { processor: "process-backend-queues" },
        });
        const activationId = row.metadata?.activation_id;
        if (activationId) {
          await db.from("engagement_activation_runs").update({
            status: "sent",
            sent_at: new Date().toISOString(),
          }).eq("id", activationId);
        }
      } catch (error) {
        await db.rpc("finish_outbox_failure", { p_outbox_id: row.id, p_error: errorMessage(error) });
        summary.failed = Number(summary.failed || 0) + 1;
      }
    }

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const status = errorMessage(error) === "Service-role authorization required" ? 401 : 500;
    return new Response(JSON.stringify({ success: false, error: errorMessage(error), summary }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
});

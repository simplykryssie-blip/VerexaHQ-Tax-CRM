import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/errors";

// complete_signature's EXECUTE grant is authenticated/service_role only —
// an anonymous signer has no Supabase session, so this also has to run
// server-side. The token remains the credential here even though the
// earlier /redeem step already marked it "used" (that flag only tracks
// the one-time "viewed" transition) — we independently re-check hash,
// revocation, expiry, and that it maps to the signer being completed.
export async function POST(request: Request) {
  const { token, signerId, signatureData } = await request.json();
  if (!token || typeof token !== "string" || !signerId || typeof signerId !== "string") {
    return NextResponse.json({ error: "Missing signing token or signer." }, { status: 400 });
  }
  if (!signatureData || typeof signatureData !== "object") {
    return NextResponse.json({ error: "A signature is required." }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Signing isn't available in this environment (service role not configured)." }, { status: 503 });
  }
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { data: tokenRow } = await admin
    .from("signature_access_tokens")
    .select("id, signer_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .eq("signer_id", signerId)
    .maybeSingle();

  if (!tokenRow || tokenRow.revoked_at || new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "This signing link is invalid or has expired." }, { status: 400 });
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : undefined;
  const userAgent = request.headers.get("user-agent") ?? undefined;

  if (signatureData.type === "declined") {
    const declineReason = typeof signatureData.decline_reason === "string" ? signatureData.decline_reason.trim() : "";
    if (!declineReason) {
      return NextResponse.json({ error: "A reason is required to decline." }, { status: 400 });
    }
    const { data, error } = await admin.rpc("decline_signature", {
      p_signer_id: signerId,
      p_decline_reason: declineReason,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
    });
    if (error) {
      logServerError("portal sign decline", error);
      return NextResponse.json({ error: "Couldn't record your response. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, result: data });
  }

  const { data, error } = await admin.rpc("complete_signature", {
    p_signer_id: signerId,
    p_signature_data: signatureData,
    p_ip_address: ipAddress,
    p_user_agent: userAgent,
  });

  if (error) {
    logServerError("portal sign complete", error);
    return NextResponse.json({ error: "Couldn't record your signature. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: data });
}

import Link from "next/link";
import {
  Users,
  Briefcase,
  UserCog,
  Handshake,
  ClipboardCheck,
  FileText,
  PenTool,
  Receipt,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const QUICK_LINKS = [
  { label: "Add a client", href: "/clients", icon: Users, description: "Create and manage client records." },
  { label: "Start a tax engagement", href: "/engagements/new", icon: Briefcase, description: "Open a new return for a client." },
  { label: "Invite your team", href: "/team", icon: UserCog, description: "Add staff and assign roles." },
  { label: "Workspace relationships", href: "/relationships", icon: Handshake, description: "Link to an ERO or service bureau for oversight." },
  { label: "Send a return for ERO review", href: "/engagements", icon: ClipboardCheck, description: "Bulk or individually submit engagements for approval." },
  { label: "Review client intakes", href: "/intakes", icon: FileText, description: "Track organizers, missing answers, and review progress." },
  { label: "Request a signature", href: "/signatures/new", icon: PenTool, description: "Get e-signatures on engagement letters or 8879s." },
  { label: "Create an invoice", href: "/invoices/new", icon: Receipt, description: "Bill a client for completed work." },
];

const FAQS = [
  {
    q: "How does ERO oversight work?",
    a: "If your workspace is linked to an ERO or service bureau under Workspace Relationships, engagements you submit for review show up in their ERO Review inbox. A return can't be marked \"ready to transmit\" until it's approved there — if it's sent back, you'll see the reviewer's comment on the engagement's ERO review tab.",
  },
  {
    q: "Why can't I mark a return \"ready to transmit\"?",
    a: "If your workspace has an ERO or service bureau attached, that return needs their approval first. The e-file panel on the engagement page explains the current review status and blocks the option until it's approved.",
  },
  {
    q: "Where do I track bank products and payouts?",
    a: "Open a tax engagement and go to the Payouts tab. You can log a bank product (bank name, product type, fee) and record individual payouts with method, status, and reference number.",
  },
  {
    q: "How do staff roles and permissions work?",
    a: "Each staff member has a role (Owner, Admin, ERO, Preparer, Reviewer, and a few specialist roles) that controls what they can see and do. Manage roles from Team — only an Owner or Admin can invite staff or change roles.",
  },
  {
    q: "Can clients see their own documents and returns?",
    a: "Yes — invite a client to the portal from their client page. They get a separate sign-in where they can view requested documents, sign forms, message your office, and see completed returns once you release them.",
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Help &amp; support</h1>
        <p className="text-sm text-muted-foreground mt-1">Quick links to common tasks, answers to frequent questions, and how to reach us during the beta.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How work moves through Verexa</CardTitle>
          <CardDescription>The client record stores the person or business. Every service is managed as its own engagement.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 sm:grid-cols-2">
            {[
              ["1", "Create or qualify the lead", "Saving a lead sends nothing and does not create an engagement."],
              ["2", "Convert to an active client", "Choose Create active client to continue directly into engagement setup."],
              ["3", "Create each engagement", "Select the service, tax year, return type, jurisdictions, preparer, and reviewer."],
              ["4", "Confirm deadlines", "Verexa calculates supported statutory dates; staff enters internal and client targets."],
              ["5", "Choose activation", "Save draft, activate without sending, or activate and send the organizer."],
              ["6", "Collect intake and documents", "The client confirms saved basic information once and completes service-specific questions."],
              ["7", "Prepare outside Verexa", "Complete the tax return in your tax preparation software while tracking work here."],
              ["8", "Submit for review", "The assigned reviewer approves the work or returns it for corrections."],
              ["9", "Collect signature and payment", "Track authorization, invoice/payment, and filing readiness."],
              ["10", "File, confirm, and close", "Record filing and acceptance, complete the engagement, then archive it."],
            ].map(([number, title, description]) => (
              <li key={number} className="flex gap-3 rounded-lg border border-border p-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{number}</span>
                <div><p className="text-sm font-medium">{title}</p><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div>
              </li>
            ))}
          </ol>
          <div className="mt-5 rounded-lg bg-muted/40 p-4">
            <p className="text-sm font-medium">Daily staff routine</p>
            <p className="mt-1 text-sm text-muted-foreground">Open My Work, review assigned and overdue items, open the client card, check intake/messages/missing documents, complete tasks, update status, and submit prepared work to the assigned reviewer.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick links</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-accent transition-colors"
            >
              <link.icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <div className="text-sm font-medium">{link.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{link.description}</div>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Frequently asked questions</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {FAQS.map((faq) => (
            <div key={faq.q} className="py-3 first:pt-0 last:pb-0">
              <div className="text-sm font-medium">{faq.q}</div>
              <p className="text-sm text-muted-foreground mt-1">{faq.a}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Still need help?</CardTitle>
          <CardDescription>This is a private beta — reach out directly to whoever set up your Verexa workspace, or your workspace owner or admin, for anything not covered here.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

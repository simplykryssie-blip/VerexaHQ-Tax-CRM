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
  { label: "Assign an intake organizer", href: "/intake", icon: FileText, description: "Send a client the questions you need answered." },
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

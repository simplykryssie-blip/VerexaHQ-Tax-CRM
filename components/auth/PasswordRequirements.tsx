"use client";

import { Check, X } from "lucide-react";

const REQUIREMENTS = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { label: "At least one letter", test: (v: string) => /[A-Za-z]/.test(v) },
  { label: "At least one number", test: (v: string) => /[0-9]/.test(v) },
];

export function PasswordRequirements({ password }: { password: string }) {
  return (
    <ul className="space-y-1 text-xs">
      {REQUIREMENTS.map((req) => {
        const met = req.test(password);
        return (
          <li key={req.label} className={met ? "flex items-center gap-1.5 text-success" : "flex items-center gap-1.5 text-muted"}>
            {met ? <Check className="size-3.5" /> : <X className="size-3.5" />}
            {req.label}
          </li>
        );
      })}
    </ul>
  );
}

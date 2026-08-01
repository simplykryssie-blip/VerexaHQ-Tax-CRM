"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validation/auth";
import { forgotPasswordAction } from "@/lib/actions/auth";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { Button } from "@/components/ui/LegacyButton";

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  if (submitted) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-lg font-semibold text-foreground">Check your email</h1>
        <p className="text-sm text-muted">
          If an account exists for that email, we&apos;ve sent a link to reset your password.
        </p>
        <Link href="/login" className="text-sm text-accent-700 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  const onSubmit = async (data: ForgotPasswordInput) => {
    setFormError(null);
    const result = await forgotPasswordAction(data);
    if (result?.error) {
      setFormError(result.error);
      return;
    }
    setSubmitted(true);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
        <h1 className="text-lg font-semibold text-foreground">Reset your password</h1>
        <p className="mt-1 text-sm text-muted">
          We&apos;ll email you a link to set a new password.
        </p>
      </div>
      {formError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
      )}
      <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
        <input id="email" type="email" autoComplete="email" className={inputClassName} {...register("email")} />
      </FormField>

      <Button type="submit" className="w-full" loading={isSubmitting}>
        Send reset link
      </Button>

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="text-accent-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

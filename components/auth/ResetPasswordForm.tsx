"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validation/auth";
import { resetPasswordAction } from "@/lib/actions/auth";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { Button } from "@/components/ui/LegacyButton";

export function ResetPasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = async (data: ResetPasswordInput) => {
    setFormError(null);
    const result = await resetPasswordAction(data);
    if (result?.error) {
      setFormError(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Set a new password</h1>
        <p className="mt-1 text-sm text-muted">Choose a new password for your account.</p>
      </div>

      {formError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
      )}

      <FormField label="New password" htmlFor="password" error={errors.password?.message} required hint="At least 8 characters.">
        <input id="password" type="password" autoComplete="new-password" className={inputClassName} {...register("password")} />
      </FormField>

      <FormField label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword?.message} required>
        <input id="confirmPassword" type="password" autoComplete="new-password" className={inputClassName} {...register("confirmPassword")} />
      </FormField>

      <Button type="submit" className="w-full" loading={isSubmitting}>
        Update password
      </Button>
    </form>
  );
}

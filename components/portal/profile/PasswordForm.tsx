"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validation/auth";
import { updatePortalPasswordAction } from "@/lib/actions/portal-profile";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/Button";
import { FormField, inputClassName } from "@/components/ui/FormField";

export function PasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = async (data: ResetPasswordInput) => {
    const result = await updatePortalPasswordAction(data);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Password updated.");
    reset();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField label="New password" error={errors.password?.message} hint="At least 8 characters.">
        <input type="password" className={inputClassName} {...register("password")} />
      </FormField>
      <FormField label="Confirm new password" error={errors.confirmPassword?.message}>
        <input type="password" className={inputClassName} {...register("confirmPassword")} />
      </FormField>
      <Button type="submit" size="sm" loading={isSubmitting}>
        Update password
      </Button>
    </form>
  );
}

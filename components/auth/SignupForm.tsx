"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupInput } from "@/lib/validation/auth";
import { signUpAction } from "@/lib/actions/auth";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";

export function SignupForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  const onSubmit = async (data: SignupInput) => {
    setFormError(null);
    const result = await signUpAction(data);
    if (result?.error) {
      setFormError(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Create your account</h1>
        <p className="mt-1 text-sm text-muted">
          Set up staff access to your tax practice workspace.
        </p>
      </div>

      {formError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FormField label="First name" htmlFor="firstName" error={errors.firstName?.message} required>
          <input id="firstName" autoComplete="given-name" className={inputClassName} {...register("firstName")} />
        </FormField>
        <FormField label="Last name" htmlFor="lastName" error={errors.lastName?.message} required>
          <input id="lastName" autoComplete="family-name" className={inputClassName} {...register("lastName")} />
        </FormField>
      </div>

      <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
        <input id="email" type="email" autoComplete="email" className={inputClassName} {...register("email")} />
      </FormField>

      <FormField label="Password" htmlFor="password" error={errors.password?.message} required hint="At least 8 characters.">
        <input id="password" type="password" autoComplete="new-password" className={inputClassName} {...register("password")} />
      </FormField>

      <FormField label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message} required>
        <input id="confirmPassword" type="password" autoComplete="new-password" className={inputClassName} {...register("confirmPassword")} />
      </FormField>

      <Button type="submit" className="w-full" loading={isSubmitting}>
        Create account
      </Button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent-700 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

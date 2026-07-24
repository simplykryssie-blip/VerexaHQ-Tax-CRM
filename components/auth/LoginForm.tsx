"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { signInAction } from "@/lib/actions/auth";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginInput) => {
    setFormError(null);
    const result = await signInAction(data, redirectTo);
    if (result?.error) {
      setFormError(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Sign in</h1>
        <p className="mt-1 text-sm text-muted">
          Welcome back to your tax practice workspace.
        </p>
      </div>

      {formError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      )}

      <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className={inputClassName}
          {...register("email")}
        />
      </FormField>

      <FormField label="Password" htmlFor="password" error={errors.password?.message} required>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className={inputClassName}
          {...register("password")}
        />
      </FormField>

      <div className="flex items-center justify-end text-sm">
        <Link href="/forgot-password" className="text-accent-700 hover:underline">
          Forgot password?
        </Link>
      </div>

      <Button type="submit" className="w-full" loading={isSubmitting}>
        Sign in
      </Button>

      <p className="text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-accent-700 hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}

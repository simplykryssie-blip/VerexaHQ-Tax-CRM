"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveHomePath } from "@/lib/auth/portal";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
  type SignupInput,
} from "@/lib/validation/auth";

type ActionResult = { error?: string };

function friendlyAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) {
    return "Incorrect email or password.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Please confirm your email address before signing in.";
  }
  if (/user already registered/i.test(message)) {
    return "An account with this email already exists.";
  }
  if (/password should be at least/i.test(message)) {
    return "Password does not meet the minimum requirements.";
  }
  return "Something went wrong. Please try again.";
}

function friendlyPasswordUpdateError(message: string) {
  if (/auth session missing|session not found|jwt expired|refresh token/i.test(message)) {
    return "This password-reset link has expired. Please request a new email and try again.";
  }
  if (/password should be at least/i.test(message)) {
    return "Password does not meet the minimum requirements.";
  }
  return "We could not update your password. Please try again.";
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function signInAction(
  input: LoginInput,
  redirectTo?: string,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  redirect(isSafeRedirect(redirectTo) ? redirectTo! : await resolveHomePath());
}

export async function signUpAction(input: SignupInput): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { firstName, lastName, email, password } = parsed.data;
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });
  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  redirect("/login?checkEmail=1");
}

export async function forgotPasswordAction(
  input: ForgotPasswordInput,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const origin = getRequestOrigin(await headers());
  if (!origin) {
    return { error: "We could not send a recovery email. Please try again." };
  }

  const redirectTo = new URL("/auth/confirm", origin);
  redirectTo.searchParams.set("next", "/reset-password");
  const supabase = await createClient();
  // Deliberately ignore whether the email exists — never reveal account
  // existence through this form's response.
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: redirectTo.toString(),
  });
  if (error) {
    return { error: "We could not send a recovery email. Please try again." };
  }

  return {};
}

export async function resetPasswordAction(
  input: ResetPasswordInput,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { error: friendlyPasswordUpdateError(error.message) };
  }

  redirect("/login?passwordUpdated=1");
}

function getRequestOrigin(requestHeaders: Headers) {
  const origin = requestHeaders.get("origin");
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      return null;
    }
  }

  const host = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"))
    ?.split(",")[0]
    ?.trim();
  const protocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
  if (!host) return null;

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return null;
  }
}

function isSafeRedirect(path: string | undefined): path is string {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//"));
}

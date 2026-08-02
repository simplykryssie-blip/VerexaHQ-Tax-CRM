/**
 * Returns the origin that should receive browser-initiated auth redirects.
 *
 * Client-side flows use the current deployment origin so Vercel previews do
 * not redirect users to production. The public app URL remains the fallback
 * for non-browser callers, with localhost reserved for development.
 */
export function getAppOrigin(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

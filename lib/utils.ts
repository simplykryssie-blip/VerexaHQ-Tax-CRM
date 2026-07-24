import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const divisions: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "minute"],
    [24, "hour"],
    [30, "day"],
    [12, "month"],
    [Infinity, "year"],
  ];

  let duration = diffMinutes;
  let unit: Intl.RelativeTimeFormatUnit = "minute";
  for (const [amount, nextUnit] of divisions) {
    if (Math.abs(duration) < amount) {
      unit = nextUnit;
      break;
    }
    duration = Math.round(duration / amount);
    unit = nextUnit;
  }

  return rtf.format(duration, unit);
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function clientDisplayName(client: {
  display_name: string | null;
  preferred_name: string | null;
  first_name: string;
  last_name: string;
  company: string | null;
}) {
  return (
    client.display_name ||
    (client.preferred_name
      ? `${client.preferred_name} ${client.last_name}`
      : `${client.first_name} ${client.last_name}`) ||
    client.company ||
    "Unnamed client"
  );
}

export function maskLast4(last4: string | null | undefined) {
  if (!last4) return "—";
  return `•••-••-${last4}`;
}

export function titleCase(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

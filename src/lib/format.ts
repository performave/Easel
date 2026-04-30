import { format, formatDistanceToNowStrict, isSameYear, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";

export function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  try {
    const d = parseISO(iso);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function formatRelativeDate(iso: string | null | undefined): string {
  const d = parseDate(iso);
  if (!d) return "—";
  if (isToday(d)) return `Today at ${format(d, "p")}`;
  if (isTomorrow(d)) return `Tomorrow at ${format(d, "p")}`;
  if (isYesterday(d)) return `Yesterday at ${format(d, "p")}`;
  if (isSameYear(d, new Date())) return format(d, "MMM d 'at' p");
  return format(d, "MMM d, yyyy");
}

export function formatShortDate(iso: string | null | undefined): string {
  const d = parseDate(iso);
  if (!d) return "—";
  if (isSameYear(d, new Date())) return format(d, "MMM d");
  return format(d, "MMM d, yyyy");
}

export function formatRelative(iso: string | null | undefined): string {
  const d = parseDate(iso);
  if (!d) return "—";
  return `${formatDistanceToNowStrict(d, { addSuffix: true })}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

"use client";

import { formatDateTime, timeAgo } from "@/lib/utils";

/**
 * Horodatage affiché en heure de Paris, identique sur le serveur et dans le navigateur.
 * La forme relative (« il y a 5 min ») dépend de l’instant du rendu : le serveur et le client
 * peuvent différer d’une seconde, d’où `suppressHydrationWarning` sur la balise.
 */
export function LocalTime({
  date,
  relative = false,
  className,
}: {
  date: Date | string;
  relative?: boolean;
  className?: string;
}) {
  const value = new Date(date);
  return (
    <time dateTime={value.toISOString()} title={formatDateTime(value)} suppressHydrationWarning className={className}>
      {relative ? timeAgo(value) : formatDateTime(value)}
    </time>
  );
}

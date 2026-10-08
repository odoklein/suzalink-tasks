import { fromParisDateTimeInput } from "./time";

/**
 * Avant P1-05, `createDelivery` lisait « 2026-10-08T14:30 » (heure de Paris saisie dans le
 * navigateur) avec `new Date(...)` sur un serveur en UTC : l’instant enregistré était 14:30 UTC,
 * donc 16:30 à Paris. Les champs UTC de la date stockée contiennent donc l’heure voulue :
 * il suffit de les relire comme une heure de Paris.
 */
export function utcWallClockAsParis(stored: Date): Date {
  const pad = (n: number) => String(n).padStart(2, "0");
  const wall =
    `${stored.getUTCFullYear()}-${pad(stored.getUTCMonth() + 1)}-${pad(stored.getUTCDate())}` +
    `T${pad(stored.getUTCHours())}:${pad(stored.getUTCMinutes())}`;
  return fromParisDateTimeInput(wall);
}

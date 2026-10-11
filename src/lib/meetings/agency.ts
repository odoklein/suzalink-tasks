/**
 * Qui fait partie de l'agence, pour repérer les réunions internes et les
 * invités extérieurs. Un membre peut relier un agenda @gmail.com : on ne se
 * fie donc pas qu'au domaine. Module pur.
 */
export type Agency = {
  /** Domaine de l'agence (AGENCY_DOMAIN, suzaliconseil.com par défaut). */
  domain: string;
  /** Adresses des membres : comptes de l'outil et agendas Google reliés. */
  memberEmails: ReadonlySet<string>;
};

export const domainOf = (email: string) => email.slice(email.lastIndexOf("@") + 1).toLowerCase();

export function isAgencyEmail(email: string, agency: Agency): boolean {
  const value = email.trim().toLowerCase();
  return agency.memberEmails.has(value) || domainOf(value) === agency.domain.toLowerCase();
}

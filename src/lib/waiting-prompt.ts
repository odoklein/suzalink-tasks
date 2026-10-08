/**
 * Après un passage en « Chez le client », propose de noter ce qu'on attend et
 * quand relancer (P4-05). Simple événement navigateur : le tableau, la liste et
 * le tiroir l'émettent, <WaitingPrompt /> (monté une fois dans le layout) l'affiche.
 */
export const WAITING_PROMPT_EVENT = "suzali:waiting-prompt";

export type WaitingPromptDetail = { taskId: string; ref: string };

export function promptWaitingFor(detail: WaitingPromptDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<WaitingPromptDetail>(WAITING_PROMPT_EVENT, { detail }));
}

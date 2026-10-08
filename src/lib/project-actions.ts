/**
 * Actions de la page projet déclenchables d’ailleurs (palette, raccourcis) : la page projet
 * écoute cet événement et ouvre le dialogue correspondant.
 */
export const PROJECT_ACTION_EVENT = "suzali:project-action";

export type ProjectAction = "import" | "recap" | "delivery" | "note";

export function requestProjectAction(action: ProjectAction) {
  window.dispatchEvent(new CustomEvent<ProjectAction>(PROJECT_ACTION_EVENT, { detail: action }));
}

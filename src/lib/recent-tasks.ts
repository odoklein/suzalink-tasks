/** Tâches récemment consultées (8 au plus), propres à ce navigateur. */
const KEY = "suzali:recent-tasks";
const MAX = 8;

export type RecentTask = { id: string; ref: string; title: string };

export function readRecentTasks(): RecentTask[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((entry) => entry && typeof entry.id === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function rememberTask(task: RecentTask) {
  try {
    const next = [task, ...readRecentTasks().filter((entry) => entry.id !== task.id)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // navigation privée : on s’en passe
  }
}

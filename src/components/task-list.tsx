"use client";

import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { QuickAdd } from "@/components/quick-add";
import { TaskRow } from "@/components/task-row";
import { Checkbox } from "@/components/ui/checkbox";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Tooltip } from "@/components/ui/tooltip";
import { STATUS_BY_VALUE, TASK_STATUSES } from "@/lib/constants";
import type { TaskCard } from "@/lib/types";
import { cn } from "@/lib/utils";

type GroupBy = "zone" | "status";

/** Liste groupée par page (comme les tableaux de retours client) ou par statut. */
export function TaskList({ projectId, projectKey, tasks }: { projectId: string; projectKey: string; tasks: TaskCard[] }) {
  const [groupBy, setGroupBy] = useState<GroupBy>("zone");
  const [hideDone, setHideDone] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const visible = hideDone ? tasks.filter((task) => task.status !== "DONE") : tasks;

  const groups = useMemo(() => {
    if (groupBy === "status") {
      return TASK_STATUSES.map((status) => ({
        key: status.value,
        label: status.label,
        tasks: visible.filter((task) => task.status === status.value),
      })).filter((group) => group.tasks.length > 0);
    }
    const map = new Map<string, TaskCard[]>();
    for (const task of visible) {
      const zone = task.zone || "Sans page";
      map.set(zone, [...(map.get(zone) ?? []), task]);
    }
    const order = (status: string) => TASK_STATUSES.findIndex((s) => s.value === status);
    return [...map.entries()]
      .sort(([a], [b]) => (a === "Sans page" ? 1 : b === "Sans page" ? -1 : a.localeCompare(b, "fr")))
      .map(([zone, items]) => ({
        key: zone,
        label: zone,
        tasks: items.sort((a, b) => order(a.status) - order(b.status) || a.number - b.number),
      }));
  }, [groupBy, visible]);

  const toggle = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="mx-auto w-full max-w-[var(--page-medium)] px-4 sm:px-8 pb-10">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SegmentedControl
          label="Regrouper par"
          value={groupBy}
          onChange={setGroupBy}
          options={[
            { value: "zone", label: "Par page" },
            { value: "status", label: "Par statut" },
          ]}
        />
        <Checkbox
          checked={hideDone}
          onChange={(event) => setHideDone(event.target.checked)}
          label={<span className="text-xs text-muted">Masquer les tâches faites</span>}
        />
      </div>

      <QuickAdd projectId={projectId} placeholder="Nouvelle tâche…  @odo !haute #homepage demain $" />

      <div className="mt-4 space-y-4">
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.key);
          const doneCount = group.tasks.filter((task) => task.status === "DONE").length;
          return (
            <section key={group.key} className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
              <button
                type="button"
                onClick={() => toggle(group.key)}
                aria-expanded={!isCollapsed}
                className="flex w-full items-center gap-2 border-b border-line bg-surface-2 px-3 py-2 text-left"
              >
                <ChevronRight className={cn("size-3.5 text-muted transition-transform", !isCollapsed && "rotate-90")} />
                <h3 className="text-ui font-semibold">{group.label}</h3>
                <span className="tabular text-xs text-muted">
                  {groupBy === "zone" ? `${doneCount}/${group.tasks.length} faites` : group.tasks.length}
                </span>
                {groupBy === "zone" && (
                  <span className="ml-auto flex h-1.5 w-28 overflow-hidden rounded-full bg-sunken">
                    {TASK_STATUSES.map((status) => {
                      const count = group.tasks.filter((task) => task.status === status.value).length;
                      return count ? (
                        <Tooltip key={status.value} content={`${STATUS_BY_VALUE[status.value].label} : ${count}`}>
                          <span style={{ flex: count, backgroundColor: status.tone }} />
                        </Tooltip>
                      ) : null;
                    })}
                  </span>
                )}
              </button>
              {!isCollapsed && (
                <ul>
                  {group.tasks.map((task) => (
                    <TaskRow key={task.id} task={task} projectKey={projectKey} showZone={groupBy !== "zone"} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
        {groups.length === 0 && (
          <p className="rounded-lg border border-dashed border-line-strong px-4 py-10 text-center text-ui text-muted">
            Aucune tâche. Ajoutez-en une ci-dessus, ou importez un tableau de retours client.
          </p>
        )}
      </div>
    </div>
  );
}

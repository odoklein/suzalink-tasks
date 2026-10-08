import type { Metadata } from "next";
import Link from "next/link";

import { TemplateEditor } from "@/components/template-editor";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatTemplateTasks } from "@/lib/templates";

export const metadata: Metadata = { title: "Modèles de projet" };

export default async function TemplatesPage() {
  await verifySession();
  const templates = await db.projectTemplate.findMany({
    orderBy: { name: "asc" },
    include: { tasks: { orderBy: { position: "asc" } } },
  });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-[720px] px-4 py-6 sm:px-8 sm:py-8">
        <p className="text-[13px] text-muted">
          <Link href="/settings" className="hover:text-ink hover:underline">Paramètres</Link> › Modèles
        </p>
        <h1 className="mt-1 font-display text-[28px] font-semibold tracking-tight">Modèles de projet</h1>
        <p className="mt-1 text-[14px] text-muted">
          Jalons, pages et tâches de départ créés avec un nouveau projet. Une tâche par ligne :
          {" "}<span className="font-mono text-[12px]">Titre | Page | Jalon | J+3 | 2h</span>.
        </p>

        <ul className="mt-6 space-y-4">
          {templates.map((template) => (
            <li key={template.id}>
              <TemplateEditor
                template={{
                  id: template.id,
                  name: template.name,
                  type: template.type,
                  milestones: template.milestones.join("\n"),
                  zones: template.zones.join("\n"),
                  tasks: formatTemplateTasks(template.tasks),
                }}
              />
            </li>
          ))}
          <li>
            <TemplateEditor template={null} />
          </li>
        </ul>
      </div>
    </div>
  );
}

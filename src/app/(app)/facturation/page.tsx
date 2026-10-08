import type { Metadata } from "next";

import { BillingView, type BillingExtra } from "@/components/billing-view";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Facturation" };

export default async function FacturationPage() {
  await verifySession();

  const extras = await db.extra.findMany({
    where: { status: "APPROVED" },
    orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      number: true,
      title: true,
      amountCents: true,
      approvedAt: true,
      approvedBy: true,
      projectId: true,
      project: {
        select: {
          name: true,
          slug: true,
          key: true,
          client: { select: { name: true } },
        },
      },
    },
  });

  const rows: BillingExtra[] = extras.map((e) => ({
    id: e.id,
    projectId: e.projectId,
    projectSlug: e.project.slug,
    projectKey: e.project.key,
    project: e.project.name,
    client: e.project.client?.name ?? "Sans client",
    number: e.number,
    title: e.title,
    amountCents: e.amountCents,
    approvedAt: e.approvedAt,
    approvedBy: e.approvedBy,
  }));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
      <BillingView extras={rows} />
    </div>
  );
}

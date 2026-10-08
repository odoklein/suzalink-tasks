import Link from "next/link";

import { Kbd } from "@/components/primitives";

export default function ProjectNotFound() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-[420px] text-center">
        <h1 className="font-display text-[22px] font-semibold tracking-tight">Ce projet n’existe pas (ou plus)</h1>
        <p className="mt-2 text-[14px] text-muted">Il a peut-être été archivé, ou l’adresse contient une faute.</p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/projects"
            className="inline-flex items-center justify-center rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-bg transition-opacity hover:opacity-90"
          >
            Voir les projets
          </Link>
        </div>
        <p className="mt-5 text-[12.5px] text-muted">
          Astuce : <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> pour chercher un projet.
        </p>
      </div>
    </div>
  );
}

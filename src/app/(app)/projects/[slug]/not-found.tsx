import Link from "next/link";

import { Kbd } from "@/components/primitives";
import { buttonClass } from "@/components/ui/button";
import { NNBSP } from "@/lib/fr";

export default function ProjectNotFound() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-md text-center">
        <h1 className="font-display text-h2 font-semibold tracking-tight">Ce projet n’existe pas (ou plus)</h1>
        <p className="mt-2 text-body text-muted">Il a peut-être été archivé, ou l’adresse contient une faute.</p>
        <div className="mt-6 flex justify-center">
          <Link href="/projects" className={buttonClass({ variant: "primary" })}>
            Voir les projets
          </Link>
        </div>
        <p className="mt-5 text-xs text-muted">
          Astuce{NNBSP}: <Kbd keys="Mod+K" /> pour chercher un projet.
        </p>
      </div>
    </div>
  );
}

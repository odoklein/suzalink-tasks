import Link from "next/link";

import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-5 py-12">
      <div className="w-full max-w-md text-center">
        <p className="tabular font-mono text-ui text-muted">404</p>
        <h1 className="mt-1 font-display text-h2 font-semibold tracking-tight">Page introuvable</h1>
        <p className="mt-2 text-body text-muted">Cette adresse n’existe pas, ou elle a été déplacée.</p>
        <Link href="/" className={buttonClass({ variant: "primary", className: "mt-6" })}>
          Retour à Aujourd’hui
        </Link>
      </div>
    </main>
  );
}

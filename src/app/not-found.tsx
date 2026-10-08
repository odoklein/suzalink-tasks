import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-5 py-12">
      <div className="w-full max-w-[420px] text-center">
        <p className="tabular font-mono text-[13px] text-muted">404</p>
        <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tight">Page introuvable</h1>
        <p className="mt-2 text-[14px] text-muted">Cette adresse n’existe pas, ou elle a été déplacée.</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-bg transition-opacity hover:opacity-90"
        >
          Retour à Aujourd’hui
        </Link>
      </div>
    </main>
  );
}

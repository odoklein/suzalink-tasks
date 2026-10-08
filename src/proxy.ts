import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isPublicPath } from "@/lib/public-paths";
import { SESSION_COOKIE } from "@/lib/session-cookie";

// Vérification optimiste : présence du cookie seulement. Le proxy n'importe
// jamais le secret de session (Next.js l'intégrerait au bundle compilé) ;
// la signature est vérifiée dans lib/dal.ts et dans chaque Server Action.
// Les routes publiques (webhooks, cron, API, portail…) s'authentifient elles-mêmes.
export default function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const { pathname, search } = request.nextUrl;
  if (!hasSession && !isPublicPath(pathname)) {
    // Retour à la page demandée après connexion (chemin validé par l'action de connexion).
    const login = new URL("/login", request.nextUrl);
    if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

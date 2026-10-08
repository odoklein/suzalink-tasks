import { NextResponse, type NextRequest } from "next/server";

import { isPublicPath } from "@/lib/public-paths";
import { SESSION_COOKIE } from "@/lib/session-cookie";

// Vérification optimiste : présence du cookie seulement. Le proxy n'importe
// jamais le secret de session (Next.js l'intégrerait au bundle compilé) ;
// la signature est vérifiée dans lib/dal.ts et dans chaque Server Action.
// Les routes publiques (webhooks, cron, API, portail…) s'authentifient elles-mêmes.
export default function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession && !isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|webp|jpg)$).*)"],
};

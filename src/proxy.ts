import { NextResponse, type NextRequest } from "next/server";

import { decrypt, SESSION_COOKIE } from "@/lib/session";

// Vérification optimiste (cookie seulement) : la vraie vérification se fait
// dans la couche d'accès aux données (lib/dal.ts) et dans chaque Server Action.
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await decrypt(request.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = pathname === "/login";

  if (!session?.userId && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }
  if (session?.userId && isLogin) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|webp|jpg)$).*)"],
};

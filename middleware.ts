import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/client";

const ROLE_PREFIX: Record<string, string> = {
  owner: "/owner",
  witness: "/witness",
  leader: "/leader",
  admin: "/admin",
  beneficiary: "/beneficiary",
  legal: "/legal",
  auditor: "/auditor",
  executor: "/executor",
};

const PUBLIC_PATHS = ["/login", "/register", "/", "/verify", "/help", "/terms", "/privacy", "/handbook"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    PUBLIC_PATHS.some((p) => path === p) ||
    path.startsWith("/verify/") ||
    path.startsWith("/help") ||
    path.startsWith("/terms") ||
    path.startsWith("/privacy");

  if (!user) {
    if (isPublic) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // role/is_suspended are no longer selectable via a plain table read (column-level REVOKE
  // closes a real cross-user PII exposure) -- this RPC returns only the caller's own row.
  const { data: statusData } = await supabase.rpc("dfp_get_my_role_status");
  const profile = statusData as { role?: string; is_suspended?: boolean } | null;

  if (profile?.is_suspended) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("suspended", "1");
    return NextResponse.redirect(url);
  }

  // A missing profile row must never silently grant owner-level access — sign the
  // session out and send them back to login rather than guessing a role.
  if (!profile?.role) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("no_profile", "1");
    return NextResponse.redirect(url);
  }

  const role = profile.role;
  const homePrefix = ROLE_PREFIX[role] ?? "/owner";

  if (path === "/" || path === "/login" || path === "/register") {
    const url = request.nextUrl.clone();
    url.pathname = `${homePrefix}/dashboard`;
    return NextResponse.redirect(url);
  }

  const matchedPrefix = Object.values(ROLE_PREFIX).find((prefix) => path.startsWith(prefix));
  if (matchedPrefix && matchedPrefix !== homePrefix) {
    const url = request.nextUrl.clone();
    url.pathname = `${homePrefix}/dashboard`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Static files under /public (the national emblem, etc.) have no extension check here, so
  // without excluding common image/asset extensions the middleware treats them as protected
  // app routes and redirects unauthenticated requests for them to /login -- breaking every
  // <img> tag that points at a public asset for anyone who isn't logged in yet.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|avif)$).*)"],
};

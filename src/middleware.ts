import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// The app is local-first (per CLAUDE.md). Anyone can use it without an
// account; sign-in is offered post-first-entry so data can sync across
// devices. The middleware's only job is to bounce already-signed-in users
// away from /login back to the dashboard.
export async function middleware(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (pathname !== "/login") {
    return NextResponse.next();
  }

  const response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (data.user) {
    // Honour ?next=… when bouncing an already-signed-in visitor away
    // from /login. Deep-link flows (e.g. "Sign in to invite" on
    // /carers) encode the destination here so the click that started
    // the journey doesn't have to be repeated. Only same-origin
    // relative paths are allowed — never blindly redirect to an
    // attacker-supplied URL.
    const requestedNext = request.nextUrl.searchParams.get("next");
    const redirect = request.nextUrl.clone();
    if (requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//")) {
      const target = new URL(requestedNext, request.url);
      redirect.pathname = target.pathname;
      redirect.search = target.search;
      redirect.hash = target.hash;
    } else {
      redirect.pathname = "/";
      redirect.search = "";
    }
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: [
    // Run on all paths except static assets and images.
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

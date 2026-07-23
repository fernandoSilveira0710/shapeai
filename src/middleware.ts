import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresh session cookies when Supabase is configured.
 * App do aluno: NÃO hard-bloqueia — demo local continua sem login.
 * Painel B2B (/painel/*): hard-bloqueia — não existe "demo local" pra
 * dado de terceiro (aluno vinculado). `redirect()` dentro do layout do
 * painel NÃO funciona pra isso no Next 16: em contexto de streaming ele
 * vira meta-tag client-side e não aborta a renderização dos filhos (o
 * conteúdo da página ainda renderiza antes do refresh cliente rodar) —
 * guarda de auth real tem que estar aqui, que sempre emite um redirect
 * HTTP de verdade.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPainel = path === "/painel" || path.startsWith("/painel/");
  const isSignup = path === "/painel/signup";

  if (isPainel && !isSignup) {
    if (!user) {
      const dest = new URL("/login", request.url);
      dest.searchParams.set("next", "/painel/signup");
      return NextResponse.redirect(dest);
    }
    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!membership) {
      return NextResponse.redirect(new URL("/painel/signup", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PainelSignOut } from "./sign-out-button";

/**
 * Sidebar + busca dados de exibição. Guarda de auth/org real vive no
 * middleware.ts (redirect HTTP de verdade) — layout aqui NÃO pode fazer
 * essa checagem (ver comentário em middleware.ts sobre redirect() em
 * contexto de streaming no Next 16). /painel/signup não passa por este
 * layout (rota irmã, fora do grupo protegido).
 */
export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

  const { data: membership } = user
    ? await supabase!
        .from("org_members")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: org } = membership
    ? await supabase!
        .from("organizations")
        .select("name, primary_role")
        .eq("id", membership.org_id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="min-h-screen bg-canvas text-ink flex">
      <aside className="w-60 shrink-0 border-r border-border flex flex-col">
        <div className="p-5 border-b border-border">
          <div className="text-brand font-bold text-lg tracking-tight">
            SHAPE <span className="text-ink font-normal text-sm">painel</span>
          </div>
          <div className="text-xs text-muted mt-1 truncate">
            {org?.name ?? "—"}
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <Link
            href="/painel"
            className="block rounded-xl px-3 py-2.5 text-sm font-medium text-ink hover:bg-surface transition"
          >
            Dashboard
          </Link>
          <Link
            href="/painel/alunos"
            className="block rounded-xl px-3 py-2.5 text-sm font-medium text-ink hover:bg-surface transition"
          >
            Alunos
          </Link>
        </nav>
        <div className="p-3 border-t border-border">
          <PainelSignOut />
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="max-w-[1280px] mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}

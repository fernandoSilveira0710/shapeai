import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { InviteButton } from "./invite-button";

export default async function PainelDashboard() {
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

  const orgId = membership?.org_id;

  const { count: totalAlunos } = orgId
    ? await supabase!
        .from("student_links")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
    : { count: 0 };

  const { count: ativosCount } = orgId
    ? await supabase!
        .from("student_links")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "active")
    : { count: 0 };

  const hasAlunos = (totalAlunos ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted text-sm mt-1">
          A IA obedece as regras que você define aqui — ver
          {" "}
          <Link href="/painel/alunos" className="text-brand underline">
            Alunos
          </Link>{" "}
          pra configurar.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-2xl font-bold text-brand">{totalAlunos ?? 0}</div>
          <div className="text-xs text-muted mt-1">Alunos vinculados</div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-2xl font-bold">{ativosCount ?? 0}</div>
          <div className="text-xs text-muted mt-1">Ativos</div>
        </div>
      </div>

      {!hasAlunos && (
        <div className="rounded-2xl border border-border bg-surface p-6 max-w-md">
          <h2 className="font-semibold mb-1">Convide seu primeiro aluno</h2>
          <p className="text-sm text-muted mb-4">
            Gera um link, manda pro aluno. Ele vincula em 1 clique — teu
            histórico e o dele continuam separados até aí.
          </p>
          <InviteButton />
        </div>
      )}
    </div>
  );
}

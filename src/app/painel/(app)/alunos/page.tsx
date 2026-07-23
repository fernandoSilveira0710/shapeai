import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { InviteButton } from "../invite-button";

export default async function AlunosPage() {
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

  const { data: links } = orgId
    ? await supabase!
        .from("student_links")
        .select("id, user_id, status, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
    : { data: [] };

  const userIds = (links ?? []).map((l) => l.user_id);
  const { data: profiles } =
    userIds.length && orgId
      ? await supabase!.from("profiles").select("id, display_name").in("id", userIds)
      : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const STATUS_LABEL: Record<string, string> = {
    invited: "Convidado",
    onboarding: "Onboarding",
    active: "Ativo",
    paused: "Pausado",
    churned: "Saiu",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alunos</h1>
          <p className="text-muted text-sm mt-1">
            {(links ?? []).length} vinculado{(links ?? []).length === 1 ? "" : "s"}
          </p>
        </div>
        <InviteButton />
      </div>

      {!links?.length ? (
        <p className="text-sm text-muted">
          Ninguém vinculado ainda — gera um link acima e manda pro teu
          primeiro aluno.
        </p>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface text-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-4 py-3">Nome</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="text-left font-medium px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    {nameById.get(l.user_id) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {STATUS_LABEL[l.status] ?? l.status}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/painel/alunos/${l.id}`}
                      className="text-brand hover:underline"
                    >
                      Ver regras →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

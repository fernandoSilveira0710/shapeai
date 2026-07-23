import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ConstraintsEditor, type ConstraintRow } from "./constraints-editor";

const SCOPES_BY_ROLE: Record<string, ("treino" | "dieta" | "comportamento")[]> = {
  owner: ["treino", "dieta", "comportamento"],
  coach: ["treino", "comportamento"],
  nutritionist: ["dieta", "comportamento"],
  receptionist: [],
};

export default async function AlunoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  if (!supabase) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: link } = await supabase
    .from("student_links")
    .select("id, org_id, user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!link) notFound();

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", link.org_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) notFound();

  const { data: alunoProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", link.user_id)
    .maybeSingle();

  const { data: constraints } = await supabase
    .from("profile_constraints")
    .select(
      "scope, kcal_target, protein_target_g, banned_exercise_ids, banned_foods, fixed_training_days, tone_override, notes"
    )
    .eq("student_link_id", link.id);

  const allowedScopes = SCOPES_BY_ROLE[membership.role] ?? [];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/painel/alunos" className="text-sm text-muted hover:text-ink">
          ← Alunos
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-2">
          {alunoProfile?.display_name ?? "Aluno"}
        </h1>
        <p className="text-muted text-sm mt-1">
          Regras ativas — a IA obedece isso no chat dele a partir de agora.
        </p>
      </div>

      {allowedScopes.length === 0 ? (
        <p className="text-sm text-muted">Teu papel não edita regras aqui.</p>
      ) : (
        <ConstraintsEditor
          studentLinkId={link.id}
          allowedScopes={allowedScopes}
          initial={(constraints ?? []) as ConstraintRow[]}
        />
      )}
    </div>
  );
}

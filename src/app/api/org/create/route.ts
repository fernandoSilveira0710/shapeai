import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Cadastro do profissional — cria organization + org_members(owner) +
 * org_branding numa transação só (RPC create_org, security definer).
 * Ver 02-painel/CADASTRO-VINCULACAO.md.
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  if (!supabase) {
    return Response.json({ error: "supabase_not_configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    role,
    display_name,
    cref_crn,
    plan_b2b,
  }: {
    role?: string;
    display_name?: string;
    cref_crn?: string;
    plan_b2b?: string;
  } = body;

  if (!role || !["coach", "nutritionist", "academia"].includes(role)) {
    return Response.json({ error: "invalid_role" }, { status: 400 });
  }
  if (!display_name?.trim()) {
    return Response.json({ error: "display_name_required" }, { status: 400 });
  }

  const { data: orgId, error } = await supabase.rpc("create_org", {
    p_role: role === "academia" ? "owner" : role,
    p_display_name: display_name.trim(),
    p_cref_crn: cref_crn?.trim() || null,
    p_plan_b2b: plan_b2b ?? null,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  // primary_role guarda o tipo real escolhido (coach/nutritionist/academia)
  // pra UI do painel saber o que priorizar — create_org sempre grava
  // org_members.role='owner' (dono da relação comercial tem escopo cheio)
  await supabase.from("organizations").update({ primary_role: role }).eq("id", orgId);

  return Response.json({ org_id: orgId });
}

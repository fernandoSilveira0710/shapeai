import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Consome código de convite via RPC accept_invite (security definer) —
 * org_id nunca é aceito do client, só resolvido a partir do código
 * validado no banco. Ver 02-painel/CADASTRO-VINCULACAO.md.
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
  const { code }: { code?: string } = body;
  if (!code?.trim()) {
    return Response.json({ error: "code_required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .rpc("accept_invite", { p_code: code.trim() })
    .single();

  if (error) {
    const msg = error.message.includes("invite_invalid")
      ? "invite_invalid"
      : "unknown_error";
    return Response.json({ error: msg }, { status: 400 });
  }

  const result = data as { student_link_id: string; org_id: string };

  const { data: branding } = await supabase
    .from("org_branding")
    .select("display_name, primary_color")
    .eq("org_id", result.org_id)
    .maybeSingle();

  return Response.json({
    student_link_id: result.student_link_id,
    org_id: result.org_id,
    branding,
  });
}

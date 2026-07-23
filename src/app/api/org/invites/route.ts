import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Gera link de convite. Ver 02-painel/CADASTRO-VINCULACAO.md. */
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

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return Response.json({ error: "no_org" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    max_uses,
    expires_at,
  }: { max_uses?: number | null; expires_at?: string | null } = body;

  // código não sequencial, entropia suficiente (ver Segurança em CADASTRO-VINCULACAO.md)
  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 10);

  const { data, error } = await supabase
    .from("invite_codes")
    .insert({
      org_id: membership.org_id,
      code,
      coach_id: membership.role === "owner" ? null : user.id,
      max_uses: max_uses ?? 1,
      expires_at: expires_at ?? null,
    })
    .select("code")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({
    code: data.code,
    url: `${req.nextUrl.origin}/join/${data.code}`,
  });
}

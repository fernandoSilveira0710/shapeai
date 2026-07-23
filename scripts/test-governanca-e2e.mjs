import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// carrega .env.local manualmente (script roda fora do Next)
const envRaw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) {
  console.error("Sem env Supabase.");
  process.exit(1);
}

const rand = Math.random().toString(36).slice(2, 8);
const coachEmail = `shapeai.coach.${rand}@gmail.com`;
const alunoEmail = `shapeai.aluno.${rand}@gmail.com`;
const PASSWORD = "TesteShape123!";

function client() {
  return createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signUpAndSignIn(email) {
  const sb = client();
  const { data: signUpData, error: signUpErr } = await sb.auth.signUp({
    email,
    password: PASSWORD,
  });
  if (signUpErr) {
    console.log(`  signUp erro (${email}):`, signUpErr.message);
    return null;
  }
  if (signUpData.session) {
    console.log(`  ${email}: sessão imediata (sem confirmação de email)`);
    return sb;
  }
  // precisa confirmar email — tenta signIn direto (alguns projetos permitem sem confirmar)
  const { data: signInData, error: signInErr } = await sb.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInErr) {
    console.log(`  ${email}: precisa de confirmação de email — ${signInErr.message}`);
    return null;
  }
  console.log(`  ${email}: signIn ok`);
  return sb;
}

console.log("=== 1. Cadastro do profissional (coach) ===");
const coachSb = await signUpAndSignIn(coachEmail);
if (!coachSb) {
  console.log("\nSem confirmação de email automática neste projeto — não dá pra prosseguir via script.");
  console.log("Confirma no dashboard Supabase (Authentication > Providers > Email > 'Confirm email' = OFF) pra testes, ou eu sigo por outro caminho.");
  process.exit(1);
}

const { data: orgId, error: orgErr } = await coachSb.rpc("create_org", {
  p_role: "coach",
  p_display_name: "Personal Teste E2E",
  p_cref_crn: null,
  p_plan_b2b: null,
});
if (orgErr) {
  console.log("create_org falhou:", orgErr.message);
  process.exit(1);
}
console.log("org criada:", orgId);

console.log("\n=== 2. Gerar link de convite ===");
const {
  data: { user: coachUser },
} = await coachSb.auth.getUser();
const code = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
const { error: inviteErr } = await coachSb.from("invite_codes").insert({
  org_id: orgId,
  code,
  coach_id: coachUser.id,
  max_uses: 1,
});
if (inviteErr) {
  console.log("gerar invite falhou:", inviteErr.message);
  process.exit(1);
}
console.log("código:", code);

console.log("\n=== 3. Aluno se cadastra e aceita o convite ===");
const alunoSb = await signUpAndSignIn(alunoEmail);
if (!alunoSb) process.exit(1);

const { data: acceptData, error: acceptErr } = await alunoSb
  .rpc("accept_invite", { p_code: code })
  .single();
if (acceptErr) {
  console.log("accept_invite falhou:", acceptErr.message);
  process.exit(1);
}
console.log("student_link:", acceptData);

console.log("\n=== 4. Profissional define constraint (sem agachamento livre) ===");
const { error: constraintErr } = await coachSb.from("profile_constraints").upsert(
  {
    student_link_id: acceptData.student_link_id,
    scope: "treino",
    banned_exercise_ids: ["barbell-squat", "back-squat", "squat"],
    fixed_training_days: [1, 3, 5],
    notes: "Sem agachamento livre — histórico de dor no joelho. Prioriza posterior de coxa.",
  },
  { onConflict: "student_link_id,scope" }
);
if (constraintErr) {
  console.log("gravar constraint falhou:", constraintErr.message);
  process.exit(1);
}
console.log("constraint gravada.");

console.log("\n=== 5. Aluno tenta ler a própria constraint (RLS deve permitir, read-only) ===");
const { data: readBack, error: readErr } = await alunoSb
  .from("profile_constraints")
  .select("scope, notes, banned_exercise_ids")
  .eq("student_link_id", acceptData.student_link_id);
console.log(readErr ? `erro: ${readErr.message}` : JSON.stringify(readBack));

console.log("\n=== 6. Aluno tenta ESCREVER na própria constraint (RLS deve BLOQUEAR) ===");
const { error: writeBlockErr } = await alunoSb.from("profile_constraints").upsert(
  {
    student_link_id: acceptData.student_link_id,
    scope: "treino",
    notes: "hackeado pelo aluno",
  },
  { onConflict: "student_link_id,scope" }
);
console.log(
  writeBlockErr
    ? `bloqueado corretamente: ${writeBlockErr.message}`
    : "FALHA DE SEGURANÇA: aluno conseguiu escrever!"
);

console.log("\n=== Credenciais pro teste de chat (Puppeteer) ===");
console.log(JSON.stringify({ alunoEmail, PASSWORD, studentLinkId: acceptData.student_link_id }));

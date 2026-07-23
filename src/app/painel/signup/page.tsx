"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, Input, Label } from "@/components/ui";
import {
  createSupabaseBrowser,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";

const DRAFT_KEY = "shape-painel-signup-draft";

type Role = "coach" | "nutritionist" | "academia";

const ROLES: { id: Role; title: string; blurb: string }[] = [
  {
    id: "coach",
    title: "Personal trainer",
    blurb: "Acompanha treino dos teus alunos, define regras que a IA obedece.",
  },
  {
    id: "nutritionist",
    title: "Nutricionista",
    blurb: "Acompanha dieta dos teus pacientes, define metas e restrições.",
  },
  {
    id: "academia",
    title: "Dono de academia",
    blurb: "Gerencia a base de alunos, convida outros profissionais depois.",
  },
];

export default function PainelSignupPage() {
  const router = useRouter();
  const hasSupabase = isSupabaseConfigured();
  const [role, setRole] = useState<Role>("coach");
  const [displayName, setDisplayName] = useState("");
  const [crefCrn, setCrefCrn] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // volta autenticado (pós-OAuth) com rascunho salvo → completa o cadastro
  useEffect(() => {
    async function resume() {
      const supabase = createSupabaseBrowser();
      if (!supabase) {
        setCheckingSession(false);
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const raw = localStorage.getItem(DRAFT_KEY);
      if (session && raw) {
        localStorage.removeItem(DRAFT_KEY);
        const draft = JSON.parse(raw) as {
          role: Role;
          displayName: string;
          crefCrn: string;
        };
        setLoading(true);
        const res = await fetch("/api/org/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: draft.role,
            display_name: draft.displayName,
            cref_crn: draft.crefCrn || undefined,
          }),
        });
        if (res.ok) {
          router.replace("/painel");
          return;
        }
        const data = await res.json().catch(() => ({}));
        setError(data.error === "not_authenticated" ? "Sessão expirou, tenta de novo." : "Não rolou criar o cadastro. Tenta de novo.");
        setLoading(false);
      }
      setCheckingSession(false);
    }
    resume();
  }, [router]);

  async function startAuth(kind: "google" | "email", email?: string) {
    setError(null);
    if (!displayName.trim()) {
      setError("Como te chamamos / nome da tua marca?");
      return;
    }
    const supabase = createSupabaseBrowser();
    if (!supabase) {
      setError("Supabase ainda não configurado neste ambiente.");
      return;
    }
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ role, displayName: displayName.trim(), crefCrn: crefCrn.trim() })
    );
    setLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=/painel/signup`;
    if (kind === "google") {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (err) {
        setError(err.message);
        setLoading(false);
      }
      return;
    }
    if (!email?.trim() || !email.includes("@")) {
      setError("Manda um email válido.");
      setLoading(false);
      return;
    }
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setError(null);
    alert(`Link enviado pra ${email}. Abre o email nesse mesmo aparelho.`);
  }

  const [email, setEmail] = useState("");

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center text-muted text-sm">
        Carregando…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md space-y-6">
        <div>
          <div className="text-brand font-bold text-xl tracking-tight">
            SHAPE <span className="text-ink font-normal">painel</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-4">
            Cadastro profissional
          </h1>
          <p className="text-muted text-sm mt-1">
            Você define as regras, a IA executa com teus alunos.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Qual teu papel?</Label>
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRole(r.id)}
              className={`w-full text-left rounded-2xl border p-4 transition ${
                role === r.id ? "border-brand bg-brand/10" : "border-border bg-surface"
              }`}
            >
              <div className="font-semibold">{r.title}</div>
              <div className="text-sm text-muted mt-1">{r.blurb}</div>
            </button>
          ))}
        </div>

        <div>
          <Label>{role === "academia" ? "Nome da academia" : "Seu nome (aparece pro aluno)"}</Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={role === "academia" ? "Ex: IronBox Academia" : "Ex: Bruno Silva"}
          />
        </div>

        {role !== "academia" && (
          <div>
            <Label>CREF/CRN (opcional, mas passa confiança)</Label>
            <Input
              value={crefCrn}
              onChange={(e) => setCrefCrn(e.target.value)}
              placeholder="Ex: CREF 012345-G/SP"
            />
          </div>
        )}

        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full"
            variant={hasSupabase ? "primary" : "secondary"}
            disabled={!hasSupabase || loading}
            onClick={() => startAuth("google")}
          >
            {loading ? "Um momento…" : "Continuar com Google"}
          </Button>

          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            disabled={!hasSupabase || loading}
            autoComplete="email"
          />
          <Button
            className="w-full"
            variant="secondary"
            disabled={!hasSupabase || loading}
            onClick={() => startAuth("email", email)}
          >
            Entrar com email
          </Button>

          {error && <p className="text-sm text-danger">{error}</p>}
          {!hasSupabase && (
            <p className="text-xs text-warning leading-relaxed">
              Supabase não configurado neste ambiente — cadastro do painel
              precisa de auth real.
            </p>
          )}
        </div>

        <p className="text-center text-xs text-muted">
          Já tem cadastro?{" "}
          <button
            type="button"
            className="text-brand underline"
            onClick={() => router.push("/painel")}
          >
            Entrar
          </button>
        </p>
      </div>
    </div>
  );
}

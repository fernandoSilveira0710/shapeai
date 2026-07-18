"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";
import {
  createSupabaseBrowser,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";
import { useAppStore } from "@/store/app-store";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const profile = useAppStore((s) => s.profile);
  const authUserId = useAppStore((s) => s.authUserId);
  const [loading, setLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasSupabase = isSupabaseConfigured();

  useEffect(() => {
    if (params.get("error") === "auth") {
      setError("Não rolou autenticar. Tenta de novo.");
    }
  }, [params]);

  useEffect(() => {
    if (profile?.onboardingCompleted) {
      router.replace("/chat");
      return;
    }
    if (authUserId && !profile?.onboardingCompleted) {
      router.replace("/onboarding");
    }
  }, [profile, authUserId, router]);

  async function signInGoogle() {
    setError(null);
    const supabase = createSupabaseBrowser();
    if (!supabase) {
      setError("Supabase ainda não configurado neste ambiente.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function signInMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createSupabaseBrowser();
    if (!supabase) {
      setError("Supabase ainda não configurado.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Manda um email válido.");
      return;
    }
    setEmailLoading(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setEmailLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setEmailSent(true);
  }

  return (
    <div className="app-shell px-6 py-10 justify-between">
      <div className="pt-8">
        <Link href="/" className="text-sm text-muted hover:text-ink">
          ← Voltar
        </Link>
        <div className="mt-8 mb-2 text-brand font-bold text-2xl tracking-tight">
          SHAPE
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Entrar</h1>
        <p className="text-muted text-sm mt-2 leading-relaxed">
          {hasSupabase
            ? "Google ou magic link — progresso sincroniza na nuvem."
            : "Modo demo local. Configure Supabase pra auth real."}
        </p>

        <div className="mt-8 space-y-3">
          <Button
            size="lg"
            className="w-full"
            variant={hasSupabase ? "primary" : "secondary"}
            disabled={!hasSupabase || loading}
            onClick={signInGoogle}
          >
            {loading ? "Abrindo Google…" : "Continuar com Google"}
          </Button>

          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {emailSent ? (
            <div className="rounded-2xl border border-brand/30 bg-brand/10 p-4 text-sm">
              Link enviado pra <strong>{email}</strong>. Abre o email e toca no
              link pra entrar.
            </div>
          ) : (
            <form onSubmit={signInMagicLink} className="space-y-2">
              <Label>Email (magic link)</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                disabled={!hasSupabase || emailLoading}
                autoComplete="email"
              />
              <Button
                type="submit"
                size="lg"
                className="w-full"
                variant="secondary"
                disabled={!hasSupabase || emailLoading}
              >
                {emailLoading ? "Enviando…" : "Entrar com email"}
              </Button>
            </form>
          )}

          {!hasSupabase && (
            <p className="text-xs text-warning leading-relaxed">
              Defina <code className="text-ink">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
              <code className="text-ink">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> em{" "}
              <code className="text-ink">.env.local</code>, rode as migrations e
              ative Google + Email no painel Auth.
            </p>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </div>

      <div className="space-y-3 pb-4">
        <Link href="/onboarding" className="block">
          <Button size="lg" className="w-full" variant="primary">
            Continuar no modo demo (local)
          </Button>
        </Link>
        <p className="text-center text-xs text-muted">
          Ao continuar, você entende que não é serviço médico. Demo local fica
          só neste aparelho.
        </p>
      </div>
    </div>
  );
}

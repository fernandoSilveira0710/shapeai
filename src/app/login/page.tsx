"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  createSupabaseBrowser,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";
import { useAppStore } from "@/store/app-store";

export default function LoginPage() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasSupabase = isSupabaseConfigured();

  useEffect(() => {
    if (profile?.onboardingCompleted) router.replace("/chat");
  }, [profile, router]);

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

  return (
    <div className="app-shell px-6 py-10 justify-between">
      <div className="pt-8">
        <Link href="/" className="text-sm text-muted hover:text-ink">
          ← Voltar
        </Link>
        <h1 className="text-3xl font-bold mt-6 tracking-tight">Entrar</h1>
        <p className="text-muted text-sm mt-2 leading-relaxed">
          {hasSupabase
            ? "Continua com Google pra sincronizar teu progresso na nuvem."
            : "Modo demo local ativo. Google Auth liga quando você configurar Supabase."}
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
          {!hasSupabase && (
            <p className="text-xs text-warning leading-relaxed">
              Defina <code className="text-ink">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
              <code className="text-ink">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> em{" "}
              <code className="text-ink">.env.local</code>, rode a migration em{" "}
              <code className="text-ink">supabase/migrations</code> e ative
              Google no painel Auth.
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
          Demo salva só neste aparelho (localStorage).
        </p>
      </div>
    </div>
  );
}

"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  createSupabaseBrowser,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";
import { useAppStore } from "@/store/app-store";

type Status = "checking" | "needs_auth" | "accepting" | "done" | "error";

export default function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const hasSupabase = isSupabaseConfigured();
  const [status, setStatus] = useState<Status>("checking");
  const [orgName, setOrgName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function run() {
      const supabase = createSupabaseBrowser();
      if (!supabase) {
        setStatus("error");
        setErrorMsg("Supabase não configurado neste ambiente.");
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setStatus("needs_auth");
        return;
      }

      setStatus("accepting");
      const res = await fetch("/api/b2b/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(
          data.error === "invite_invalid"
            ? "Link expirado ou já usado — pede um novo pro teu personal/nutri."
            : "Não rolou vincular. Tenta de novo."
        );
        return;
      }
      setOrgName(data.branding?.display_name ?? null);
      setStatus("done");
    }
    run();
  }, [code]);

  async function startAuth(kind: "google" | "email", email?: string) {
    const supabase = createSupabaseBrowser();
    if (!supabase) return;
    setLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=/join/${code}`;
    if (kind === "google") {
      await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
      return;
    }
    if (!email?.trim()) {
      setLoading(false);
      return;
    }
    await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(false);
    alert(`Link enviado pra ${email}.`);
  }

  const [email, setEmail] = useState("");

  function goApp() {
    if (profile?.onboardingCompleted) {
      router.push("/chat");
    } else {
      router.push("/onboarding");
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm text-center space-y-5">
        <div className="text-brand font-bold text-xl tracking-tight">SHAPE</div>

        {status === "checking" && <p className="text-muted text-sm">Carregando…</p>}

        {status === "needs_auth" && (
          <div className="space-y-4 text-left">
            <p className="text-sm text-muted text-center">
              Entra pra vincular ao teu profissional.
            </p>
            <Button
              size="lg"
              className="w-full"
              variant={hasSupabase ? "primary" : "secondary"}
              disabled={!hasSupabase || loading}
              onClick={() => startAuth("google")}
            >
              Continuar com Google
            </Button>
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted">ou</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              className="w-full h-12 rounded-xl bg-surface border border-border px-4 text-sm outline-none focus:border-brand/60"
            />
            <Button
              className="w-full"
              variant="secondary"
              disabled={!hasSupabase || loading}
              onClick={() => startAuth("email", email)}
            >
              Entrar com email
            </Button>
          </div>
        )}

        {status === "accepting" && <p className="text-muted text-sm">Vinculando…</p>}

        {status === "done" && (
          <div className="space-y-4">
            <div className="size-14 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center mx-auto">
              <span className="text-2xl">✓</span>
            </div>
            <p className="text-sm">
              Vinculado{orgName ? ` a ${orgName}` : ""}! Teu personal/nutri já
              pode configurar tuas regras.
            </p>
            <Button size="lg" className="w-full" onClick={goApp}>
              {profile?.onboardingCompleted ? "Ir pro chat" : "Continuar cadastro"}
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <p className="text-sm text-danger">{errorMsg}</p>
            <Button variant="secondary" className="w-full" onClick={() => router.push("/")}>
              Voltar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

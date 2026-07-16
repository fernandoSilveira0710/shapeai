"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";
import { useAppStore } from "@/store/app-store";

export default function WelcomePage() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);

  useEffect(() => {
    if (profile?.onboardingCompleted) {
      router.replace("/chat");
    }
  }, [profile, router]);

  return (
    <div className="app-shell px-6 py-10 justify-between">
      <div className="pt-10 overflow-y-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted mb-8">
          <span className="size-1.5 rounded-full bg-brand animate-pulse-soft" />
          Personal de bolso · BR
        </div>
        <h1 className="text-4xl font-bold tracking-tight leading-[1.1]">
          Não é app de ficha.
          <br />
          <span className="text-brand">É teu personal no bolso.</span>
        </h1>
        <p className="mt-4 text-muted text-base leading-relaxed max-w-[34ch]">
          Treino, comida e cobrança no tom que você escolhe. A IA abre falando —
          com hora, contexto e zero menu frio.
        </p>

        <ul className="mt-8 space-y-3 text-sm text-ink/90">
          {[
            "Abertura contextual todo dia",
            "Modo treino com séries e descanso",
            "Dieta que cabe no bolso e na rotina",
            "Tom: brother, sargento, nutella ou low profile",
          ].map((item) => (
            <li key={item} className="flex gap-2 items-start">
              <span className="text-brand mt-0.5">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3 pb-4">
        <Link href="/onboarding" className="block">
          <Button className="w-full" size="lg">
            Começar agora
          </Button>
        </Link>
        <Link href="/login" className="block">
          <Button className="w-full" size="lg" variant="secondary">
            Já tenho conta / Google
          </Button>
        </Link>
        <p className="text-center text-xs text-muted">
          Demo local no aparelho · Google quando Supabase estiver configurado
        </p>
      </div>
    </div>
  );
}

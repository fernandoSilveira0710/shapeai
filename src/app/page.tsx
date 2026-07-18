"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui";
import { useAppStore } from "@/store/app-store";

const SPLASH_KEY = "shape-splash-seen";

export default function WelcomePage() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const [showVideo, setShowVideo] = useState(false);
  const [videoEnding, setVideoEnding] = useState(false);

  useEffect(() => {
    if (profile?.onboardingCompleted) {
      router.replace("/chat");
      return;
    }
    // vídeo de fundo só na primeira visita (e sem reduced-motion)
    const seen = localStorage.getItem(SPLASH_KEY);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!seen && !reduced) {
      setShowVideo(true);
      localStorage.setItem(SPLASH_KEY, "1");
    }
  }, [profile, router]);

  function endVideo() {
    // fade suave → remove
    setVideoEnding(true);
    setTimeout(() => setShowVideo(false), 700);
  }

  return (
    <div className="app-shell px-6 py-10 justify-between">
      {showVideo && (
        <div
          className={`absolute inset-0 z-0 transition-opacity duration-700 ${
            videoEnding ? "opacity-0" : "opacity-100"
          }`}
          aria-hidden="true"
        >
          <video
            src="/splash.mp4"
            poster="/splash-poster.jpg"
            autoPlay
            muted
            playsInline
            onEnded={endVideo}
            onError={endVideo}
            className="size-full object-cover"
          />
          {/* véu pro texto respirar em cima do vídeo */}
          <div className="absolute inset-0 bg-canvas/60" />
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-canvas to-transparent" />
        </div>
      )}
      <div className="pt-6 overflow-y-auto relative z-10">
        <div className="flex items-center mb-6 -ml-2">
          <Image
            src="/logo-mark.png"
            alt="Shape.ai"
            width={56}
            height={56}
            priority
            unoptimized
            className="select-none"
          />
          <span className="text-xl font-bold tracking-tight ml-1">
            Shape<span className="text-brand">.ai</span>
          </span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted mb-6">
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

      <div className="space-y-3 pb-4 relative z-10">
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

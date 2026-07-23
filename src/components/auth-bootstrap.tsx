"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  createSupabaseBrowser,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";
import { useAppStore } from "@/store/app-store";
import { SplashScreen } from "@/components/splash-screen";

/**
 * 1) Espera zustand rehydrate
 * 2) Se Supabase configurado, resolve sessão e puxa snapshot cloud
 * 3) Mostra splash no máximo ~2s
 *
 * Painel B2B (/painel, /join) não usa nada disso — é desktop-first,
 * sem app-shell mobile, sem estado de aluno pra hidratar. Pular direto
 * evita o flash do splash mobile-locked (.app-shell max-width 480px)
 * numa tela de admin que deveria usar a largura toda.
 */
export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPainelArea = pathname?.startsWith("/painel") || pathname?.startsWith("/join");
  const [ready, setReady] = useState(isPainelArea);
  const setAuthUserId = useAppStore((s) => s.setAuthUserId);
  const hydrateFromCloud = useAppStore((s) => s.hydrateFromCloud);

  useEffect(() => {
    if (isPainelArea) return;
    let cancelled = false;
    const minSplash = new Promise((r) => setTimeout(r, 700));

    async function boot() {
      try {
        if (isSupabaseConfigured()) {
          const supabase = createSupabaseBrowser();
          if (supabase) {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (!cancelled) {
              setAuthUserId(session?.user?.id ?? null);
              if (session?.user) {
                await hydrateFromCloud();
              }
            }
            supabase.auth.onAuthStateChange(async (event, sess) => {
              setAuthUserId(sess?.user?.id ?? null);
              if (event === "SIGNED_IN" && sess?.user) {
                await hydrateFromCloud();
              }
            });
          }
        }
      } catch (e) {
        console.warn("[auth bootstrap]", e);
      }
      await minSplash;
      if (!cancelled) setReady(true);
    }

    boot();
    // hard cap 2.5s
    const cap = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 2500);

    return () => {
      cancelled = true;
      clearTimeout(cap);
    };
  }, [setAuthUserId, hydrateFromCloud]);

  if (!ready) return <SplashScreen />;
  return <>{children}</>;
}

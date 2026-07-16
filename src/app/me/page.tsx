"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TabBar } from "@/components/tab-bar";
import { Button, Card, Chip } from "@/components/ui";
import { getExercise } from "@/data/exercises";
import { WEEKDAY_LABELS } from "@/lib/plan-generator";
import { TONE_META } from "@/lib/tone";
import type { SubscriptionPlan, Tone } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

export default function MePage() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const plan = useAppStore((s) => s.plan);
  const subscription = useAppStore((s) => s.subscription);
  const setSubscription = useAppStore((s) => s.setSubscription);
  const updateTone = useAppStore((s) => s.updateTone);
  const resetAll = useAppStore((s) => s.resetAll);
  const signOut = useAppStore((s) => s.signOut);
  const [pushStatus, setPushStatus] = useState<string>("");
  const [installHint, setInstallHint] = useState("");

  useEffect(() => {
    if (!profile?.onboardingCompleted) router.replace("/");
  }, [profile, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS
      window.navigator.standalone === true;
    setInstallHint(
      standalone
        ? "App instalado ✓"
        : "No celular: menu do browser → Adicionar à tela inicial"
    );
    if ("Notification" in window) {
      setPushStatus(
        Notification.permission === "granted"
          ? "Notificações ativas"
          : Notification.permission === "denied"
            ? "Notificações bloqueadas"
            : "Notificações desligadas"
      );
    }
  }, []);

  if (!profile || !plan) return null;

  function logout() {
    if (!confirm("Sair da conta? Os dados locais serão apagados deste aparelho.")) return;
    signOut().then(() => router.replace("/"));
  }

  async function enablePush() {
    if (!("Notification" in window)) {
      setPushStatus("Browser sem suporte a notificação");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setPushStatus("Notificações ativas");
      new Notification("Shape.ai", {
        body: "Fechou. Eu te cobro na hora do treino (local, por enquanto).",
        icon: "/icons/icon-192.png",
      });
    } else {
      setPushStatus(perm === "denied" ? "Notificações bloqueadas" : "Notificações desligadas");
    }
  }

  return (
    <div className="app-shell">
      <header className="px-5 pt-6 pb-3 border-b border-border">
        <h1 className="text-xl font-bold">{profile.displayName}</h1>
        <p className="text-xs text-muted mt-1">
          {profile.goal} · {profile.weightKg} kg · {profile.heightCm} cm
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        <Card>
          <h2 className="font-semibold mb-2">Assinatura (demo)</h2>
          <p className="text-sm text-muted mb-3">
            Simula gate. <strong className="text-ink">Pro</strong> libera câmera do
            prato (Vision se tiver API key).
          </p>
          <div className="flex flex-wrap gap-2">
            {(["free", "basic", "pro"] as SubscriptionPlan[]).map((p) => (
              <Chip
                key={p}
                active={subscription === p}
                onClick={() => setSubscription(p)}
              >
                {p}
              </Chip>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold mb-2">Tom</h2>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TONE_META) as Tone[]).map((t) => (
              <Chip key={t} active={profile.tone === t} onClick={() => updateTone(t)}>
                {TONE_META[t].label}
              </Chip>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold mb-2">App no bolso</h2>
          <p className="text-sm text-muted mb-3">{installHint}</p>
          <p className="text-sm text-muted mb-3">{pushStatus || "—"}</p>
          <Button variant="secondary" className="w-full" onClick={enablePush}>
            Ativar lembretes locais
          </Button>
        </Card>

        <Card>
          <h2 className="font-semibold mb-3">Plano de treino v{plan.version}</h2>
          <ul className="space-y-3 text-sm">
            {plan.workoutDays
              .filter((d) => !d.isRest)
              .map((d) => (
                <li key={d.weekday}>
                  <div className="font-medium text-brand">
                    {WEEKDAY_LABELS[d.weekday]} · {d.label}
                  </div>
                  <ul className="mt-1 text-muted space-y-0.5">
                    {d.exercises.map((e) => (
                      <li key={e.exerciseId}>
                        {getExercise(e.exerciseId)?.namePt} — {e.sets}×{e.reps}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
          </ul>
        </Card>

        <Card>
          <h2 className="font-semibold mb-2">Nutrição</h2>
          <p className="text-sm">
            ~{plan.nutrition.kcal} kcal · P{plan.nutrition.proteinG} C
            {plan.nutrition.carbsG} G{plan.nutrition.fatG}
          </p>
          <ul className="mt-2 text-sm text-muted space-y-1">
            {plan.nutrition.meals.map((m) => (
              <li key={m.slot}>
                <span className="text-ink">{m.title}:</span> {m.items[0]}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted mt-3">{plan.nutrition.notes}</p>
          <div className="mt-3">
            <div className="text-xs font-semibold text-muted mb-1">Compras</div>
            <p className="text-xs text-muted">{plan.nutrition.groceryList.join(" · ")}</p>
          </div>
        </Card>

        <Button variant="danger" className="w-full" onClick={logout}>
          Sair da conta
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => { resetAll(); router.replace("/"); }}>
          Sair (modo demo — apagar dados locais)
        </Button>
        <p className="text-[11px] text-center text-muted pb-4">
          Shape.ai MVP · dados só neste browser (localStorage)
        </p>
      </div>

      <TabBar />
    </div>
  );
}

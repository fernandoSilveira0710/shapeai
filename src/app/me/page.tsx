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
  const authUserId = useAppStore((s) => s.authUserId);
  const dailyLlmCount = useAppStore((s) => s.dailyLlmCount);
  const syncToCloud = useAppStore((s) => s.syncToCloud);
  const [pushStatus, setPushStatus] = useState<string>("");
  const [installHint, setInstallHint] = useState("");
  const [syncMsg, setSyncMsg] = useState("");

  useEffect(() => {
    if (!profile?.onboardingCompleted) {
      router.replace("/");
      return;
    }
    if (!profile.intakeCompleted || !plan?.approvedAt) router.replace("/chat");
  }, [profile, plan, router]);

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
    signOut().then(() => router.replace(authUserId ? "/login" : "/"));
  }

  async function handleSync() {
    setSyncMsg("Sincronizando…");
    await syncToCloud();
    setSyncMsg(
      authUserId
        ? "Snapshot enviado (precisa da migration app_snapshots)."
        : "Faça login Supabase pra sync na nuvem."
    );
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
            <strong className="text-ink">Free</strong>: 15 msgs IA/dia ·{" "}
            <strong className="text-ink">Básico</strong>: chat solto ·{" "}
            <strong className="text-ink">Pro</strong>: Vision foto.
          </p>
          {subscription === "free" && (
            <p className="text-xs text-muted mb-2">
              Hoje: {dailyLlmCount}/15 mensagens IA
            </p>
          )}
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
          <h2 className="font-semibold mb-2">Conta & nuvem</h2>
          <p className="text-sm text-muted mb-3">
            {authUserId
              ? `Logado · id ${authUserId.slice(0, 8)}…`
              : "Demo local (sem Supabase session)"}
          </p>
          <div className="flex flex-col gap-2">
            <Button variant="secondary" className="w-full" onClick={handleSync}>
              Sync agora
            </Button>
            {!authUserId && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => router.push("/login")}
              >
                Entrar com Google / email
              </Button>
            )}
            {syncMsg && <p className="text-xs text-muted">{syncMsg}</p>}
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
          <h2 className="font-semibold mb-2">Dossiê (pro personal)</h2>
          {profile.intakeCompleted === false ? (
            <p className="text-sm text-muted">
              Ainda em conversa no chat — a IA está aprofundando teu perfil.
            </p>
          ) : !profile.intakeNotes?.length ? (
            <p className="text-sm text-muted">
              Sem notas de intake (conta antiga). Refaz o onboarding pra gerar dossiê.
            </p>
          ) : (
            <ul className="space-y-3">
              {profile.intakeNotes.map((n) => (
                <li key={n.key + n.at} className="text-sm border-b border-border/50 pb-2">
                  <div className="text-[11px] text-brand font-medium">
                    {n.metricLabel || n.key}
                  </div>
                  <div className="text-muted text-xs mt-0.5 line-clamp-2">{n.question}</div>
                  <div className="mt-1 text-ink">{n.answer}</div>
                </li>
              ))}
            </ul>
          )}
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

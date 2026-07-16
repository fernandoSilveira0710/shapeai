"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TabBar } from "@/components/tab-bar";
import { Button, Card, Sheet } from "@/components/ui";
import { dayKey, vibrate } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

export default function EvolutionPage() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const sessions = useAppStore((s) => s.sessions);
  const mealLogs = useAppStore((s) => s.mealLogs);
  const metrics = useAppStore((s) => s.metrics);
  const logWeight = useAppStore((s) => s.logWeight);

  const [weightSheet, setWeightSheet] = useState(false);
  const [weightInput, setWeightInput] = useState("");

  useEffect(() => {
    if (!profile?.onboardingCompleted) router.replace("/");
  }, [profile, router]);

  const completed = sessions.filter((s) => s.status === "completed" || s.status === "partial");
  const weights = metrics.filter((m) => m.kind === "weight");
  const lastWeight = weights[weights.length - 1];
  const firstWeight = weights[0];
  const delta =
    lastWeight && firstWeight ? (lastWeight.value - firstWeight.value).toFixed(1) : null;

  const streak = useMemo(() => {
    // dias consecutivos com treino (hoje pode faltar sem quebrar) — TZ São Paulo
    const days = new Set(completed.map((s) => s.date));
    let s = 0;
    for (let i = 0; i < 60; i++) {
      const key = dayKey(-i);
      if (days.has(key)) s++;
      else if (i > 0) break;
    }
    return s;
  }, [completed]);

  const insights: string[] = [];
  if (completed.length >= 1) {
    insights.push(`Você já fechou ${completed.length} sessão(ões) de treino no Shape.`);
  }
  if (mealLogs.length >= 3) {
    insights.push(`${mealLogs.length} refeições logadas — disciplina de comida aparecendo.`);
  }
  if (delta !== null) {
    const n = Number(delta);
    insights.push(
      n === 0
        ? "Peso estável desde o início."
        : n < 0
          ? `Peso ${delta} kg desde o primeiro registro.`
          : `Peso +${delta} kg desde o primeiro registro.`
    );
  }
  if (completed.some((s) => s.skippedExercises.length > 0)) {
    insights.push("Teve exercício pulado — vale olhar se foi dor ou preguiça.");
  }
  if (!insights.length) {
    insights.push("Treina uma semana que o gráfico acorda.");
  }

  function saveWeight() {
    const n = Number(weightInput.replace(",", "."));
    if (n >= 30 && n <= 250) {
      logWeight(n);
      vibrate(15);
      setWeightSheet(false);
      setWeightInput("");
    }
  }

  if (!profile) return null;

  const maxW = Math.max(...weights.map((w) => w.value), profile.weightKg);
  const minW = Math.min(...weights.map((w) => w.value), profile.weightKg);

  return (
    <div className="app-shell">
      <header className="px-5 pt-6 pb-3 border-b border-border">
        <h1 className="text-xl font-bold">Evolução</h1>
        <p className="text-xs text-muted mt-1">Números com história — não lab frio.</p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Card className="text-center py-3">
            <div className="text-2xl font-bold text-brand">{streak}</div>
            <div className="text-[11px] text-muted mt-1">Streak</div>
          </Card>
          <Card className="text-center py-3">
            <div className="text-2xl font-bold">{completed.length}</div>
            <div className="text-[11px] text-muted mt-1">Treinos</div>
          </Card>
          <Card className="text-center py-3">
            <div className="text-2xl font-bold">{mealLogs.length}</div>
            <div className="text-[11px] text-muted mt-1">Refeições</div>
          </Card>
        </div>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Peso</h2>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setWeightInput(String(lastWeight?.value ?? profile.weightKg));
                setWeightSheet(true);
              }}
            >
              + Registrar
            </Button>
          </div>
          {weights.length === 0 ? (
            <p className="text-sm text-muted">
              Ainda sem registro. Segunda = balança (ou quando quiser).
            </p>
          ) : (
            <>
              <div className="flex items-end gap-1 h-24">
                {weights.slice(-12).map((w) => {
                  const range = maxW - minW || 1;
                  const h = 20 + ((w.value - minW) / range) * 70;
                  return (
                    <div
                      key={w.id}
                      className="flex-1 rounded-t bg-brand/80 min-w-[8px]"
                      style={{ height: `${h}%` }}
                      title={`${w.value} kg`}
                    />
                  );
                })}
              </div>
              <p className="text-sm mt-3">
                Atual: <strong>{lastWeight?.value} kg</strong>
                {delta !== null && (
                  <span className="text-muted">
                    {" "}
                    · desde o início: {Number(delta) > 0 ? "+" : ""}
                    {delta} kg
                  </span>
                )}
              </p>
            </>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold mb-3">Insights</h2>
          <ul className="space-y-2">
            {insights.map((i) => (
              <li key={i} className="text-sm text-muted flex gap-2">
                <span className="text-brand">•</span>
                <span>{i}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="font-semibold mb-3">Últimos treinos</h2>
          {completed.length === 0 ? (
            <p className="text-sm text-muted">Nenhum ainda. O chat te chama na hora.</p>
          ) : (
            <ul className="space-y-2">
              {[...completed].reverse().slice(0, 8).map((s) => (
                <li
                  key={s.id}
                  className="flex justify-between text-sm border-b border-border/50 pb-2"
                >
                  <span>
                    {s.label}{" "}
                    <span className="text-muted">
                      · {s.sets.filter((x) => x.status === "completed").length} séries
                    </span>
                  </span>
                  <span className="text-muted text-xs">{s.date}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Sheet
        open={weightSheet}
        onClose={() => setWeightSheet(false)}
        title="Peso de hoje"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveWeight();
          }}
        >
          <div className="flex items-center gap-3">
            <input
              type="number"
              inputMode="decimal"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              autoFocus
              className="flex-1 h-14 rounded-xl bg-surface border border-border px-4 text-2xl font-bold text-center tabular-nums outline-none focus:border-brand/60"
            />
            <span className="text-muted font-medium">kg</span>
          </div>
          <Button type="submit" size="lg" className="w-full mt-4">
            Salvar
          </Button>
        </form>
      </Sheet>

      <TabBar />
    </div>
  );
}

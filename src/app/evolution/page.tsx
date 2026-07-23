"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingDown, TrendingUp } from "lucide-react";
import { TabBar } from "@/components/tab-bar";
import { DesktopSidebar } from "@/components/desktop-sidebar";
import { Button, Card, Sheet } from "@/components/ui";
import { getExercise } from "@/data/exercises";
import { dayKey, vibrate } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

const WD = ["D", "S", "T", "Q", "Q", "S", "S"];

type DayStatus = "trained" | "missed" | "rest" | "future" | "before";

export default function EvolutionPage() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const plan = useAppStore((s) => s.plan);
  const sessions = useAppStore((s) => s.sessions);
  const mealLogs = useAppStore((s) => s.mealLogs);
  const metrics = useAppStore((s) => s.metrics);
  const logWeight = useAppStore((s) => s.logWeight);

  const [weightSheet, setWeightSheet] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [daySheet, setDaySheet] = useState<string | null>(null); // YYYY-MM-DD

  useEffect(() => {
    if (!profile?.onboardingCompleted) {
      router.replace("/");
      return;
    }
    // aba só libera com dossiê fechado + plano aprovado — bate URL direto não pula a fila
    if (!profile.intakeCompleted || !plan?.approvedAt) router.replace("/chat");
  }, [profile, plan, router]);

  const completed = useMemo(
    () =>
      sessions.filter((s) => s.status === "completed" || s.status === "partial"),
    [sessions]
  );
  const weights = useMemo(
    () => metrics.filter((m) => m.kind === "weight"),
    [metrics]
  );
  const lastWeight = weights[weights.length - 1];
  const firstWeight = weights[0];
  const delta =
    lastWeight && firstWeight
      ? (lastWeight.value - firstWeight.value).toFixed(1)
      : null;

  const streak = useMemo(() => {
    const days = new Set(completed.map((s) => s.date));
    let s = 0;
    for (let i = 0; i < 60; i++) {
      const key = dayKey(-i);
      if (days.has(key)) s++;
      else if (i > 0) break;
    }
    return s;
  }, [completed]);

  // ——— calendário do mês ———
  const calendar = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const nDays = new Date(y, m + 1, 0).getDate();
    const startWd = new Date(y, m, 1).getDay();
    const today = dayKey(0);
    const signupKey = profile?.createdAt.slice(0, 10) ?? "0000";
    const trainedSet = new Set(completed.map((s) => s.date));
    const offSet = new Set(
      mealLogs.filter((l) => l.adherence === "off").map((l) => l.loggedAt.slice(0, 10))
    );

    const mealSlots = plan?.nutrition.meals.map((mm) => mm.slot) ?? [];

    const cells: {
      key: string;
      dayNum: number;
      status: DayStatus;
      offPlan: boolean;
    }[] = [];
    let mealGapCount = 0;
    for (let d = 1; d <= nDays; d++) {
      const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const wd = new Date(y, m, d).getDay();
      const planDay = plan?.workoutDays.find((x) => x.weekday === wd);
      let status: DayStatus;
      if (key > today) status = "future";
      else if (key < signupKey) status = "before";
      else if (trainedSet.has(key)) status = "trained";
      else if (planDay && !planDay.isRest && key < today) status = "missed";
      else if (planDay && !planDay.isRest && key === today) status = "future";
      else status = "rest";
      cells.push({ key, dayNum: d, status, offPlan: offSet.has(key) });

      // refeição furada: dia já fechado (antes de hoje, dentro do app) com
      // pelo menos 1 dos slots do plano sem nenhum log
      if (key >= signupKey && key < today && mealSlots.length > 0) {
        const loggedSlots = new Set(
          mealLogs.filter((l) => l.loggedAt.startsWith(key)).map((l) => l.slot)
        );
        if (mealSlots.some((slot) => !loggedSlots.has(slot))) mealGapCount++;
      }
    }
    const missedCount = cells.filter((c) => c.status === "missed").length;
    const monthLabel = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(now);
    return { cells, startWd, missedCount, monthLabel, mealGapCount };
  }, [completed, mealLogs, plan, profile]);

  const offPlanCount = useMemo(() => {
    const monthPrefix = dayKey(0).slice(0, 7);
    return mealLogs.filter(
      (l) => l.adherence === "off" && l.loggedAt.startsWith(monthPrefix)
    ).length;
  }, [mealLogs]);

  // ——— progressão de carga: exercícios mais frequentes ———
  const loadProgress = useMemo(() => {
    const byEx = new Map<string, { date: string; top: number }[]>();
    for (const s of completed) {
      const perEx = new Map<string, number>();
      for (const set of s.sets) {
        if (set.status !== "completed" || !set.weightKg) continue;
        perEx.set(set.exerciseId, Math.max(perEx.get(set.exerciseId) ?? 0, set.weightKg));
      }
      for (const [ex, top] of perEx) {
        const arr = byEx.get(ex) ?? [];
        arr.push({ date: s.date, top });
        byEx.set(ex, arr);
      }
    }
    return [...byEx.entries()]
      .filter(([, arr]) => arr.length >= 2)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3)
      .map(([exId, arr]) => {
        const sorted = arr.sort((a, b) => a.date.localeCompare(b.date));
        const first = sorted[0].top;
        const last = sorted[sorted.length - 1].top;
        return {
          exId,
          name: getExercise(exId)?.namePt ?? exId,
          first,
          last,
          diff: last - first,
          sessions: sorted.length,
        };
      });
  }, [completed]);

  // ——— medidas (cintura etc.) ———
  const measures = useMemo(() => {
    const kinds: { kind: string; label: string }[] = [
      { kind: "waist", label: "Cintura" },
      { kind: "chest", label: "Peito" },
      { kind: "arm", label: "Braço" },
      { kind: "thigh", label: "Coxa" },
    ];
    return kinds
      .map(({ kind, label }) => {
        const arr = metrics.filter((m) => m.kind === kind);
        if (!arr.length) return null;
        const last = arr[arr.length - 1];
        const prev = arr.length > 1 ? arr[arr.length - 2] : null;
        return {
          label,
          value: last.value,
          diff: prev ? Math.round((last.value - prev.value) * 10) / 10 : null,
        };
      })
      .filter(Boolean) as { label: string; value: number; diff: number | null }[];
  }, [metrics]);

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

  const hasTreino = profile.modules.includes("treino");
  const hasDieta = profile.modules.includes("dieta");

  const maxW = Math.max(...weights.map((w) => w.value), profile.weightKg);
  const minW = Math.min(...weights.map((w) => w.value), profile.weightKg);

  // detalhes do dia selecionado
  const dayDetail = daySheet
    ? {
        sessions: sessions.filter((s) => s.date === daySheet),
        meals: mealLogs.filter((l) => l.loggedAt.startsWith(daySheet)),
        weight: metrics.find(
          (m) => m.kind === "weight" && m.measuredAt.startsWith(daySheet)
        ),
      }
    : null;

  return (
    <div className="app-shell-responsive">
      <DesktopSidebar />
      <div className="flex-1 flex flex-col min-h-0 lg:mx-auto lg:w-full lg:max-w-[900px]">
      <header className="px-5 pt-6 pb-3 border-b border-border">
        <h1 className="text-xl font-bold">Evolução</h1>
        <p className="text-xs text-muted mt-1">Números com história — não lab frio.</p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {hasTreino && (
            <Card className="text-center py-3 px-1">
              <div className="text-2xl font-bold text-brand">{streak}</div>
              <div className="text-[11px] text-muted mt-1">Streak</div>
            </Card>
          )}
          {hasTreino && (
            <Card className="text-center py-3 px-1">
              <div className="text-2xl font-bold">{completed.length}</div>
              <div className="text-[11px] text-muted mt-1">Treinos</div>
            </Card>
          )}
          {hasTreino && (
            <Card className="text-center py-3 px-1">
              <div className="text-2xl font-bold">{calendar.missedCount}</div>
              <div className="text-[11px] text-muted mt-1">Furos/mês</div>
            </Card>
          )}
          {hasDieta && (
            <Card className="text-center py-3 px-1">
              <div className="text-2xl font-bold">{offPlanCount}</div>
              <div className="text-[11px] text-muted mt-1">Fora do plano</div>
            </Card>
          )}
          {hasDieta && (
            <Card className="text-center py-3 px-1">
              <div className="text-2xl font-bold">{calendar.mealGapCount}</div>
              <div className="text-[11px] text-muted mt-1">Refeições furadas</div>
            </Card>
          )}
        </div>

        {/* ——— calendário ——— */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold capitalize">{calendar.monthLabel}</h2>
            <div className="flex items-center gap-2 text-[10px] text-muted">
              <span className="size-2 rounded-full bg-brand inline-block" /> treinou
              <span className="size-2 rounded-full bg-danger/70 inline-block" /> furou
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WD.map((w, i) => (
              <span key={i} className="text-[10px] text-muted py-1">
                {w}
              </span>
            ))}
            {Array.from({ length: calendar.startWd }).map((_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {calendar.cells.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  if (c.status === "trained" || c.status === "missed") {
                    vibrate(8);
                    setDaySheet(c.key);
                  }
                }}
                className={[
                  "relative aspect-square rounded-lg text-xs font-medium flex items-center justify-center transition",
                  c.status === "trained"
                    ? "bg-brand text-brand-fg font-bold active:scale-95"
                    : c.status === "missed"
                      ? "bg-danger/15 text-danger border border-danger/30 active:scale-95"
                      : c.status === "future"
                        ? "text-muted/40"
                        : c.status === "before"
                          ? "text-muted/25"
                          : "text-muted bg-surface/50",
                  c.key === dayKey(0) ? "ring-1 ring-brand/60" : "",
                ].join(" ")}
              >
                {c.dayNum}
                {c.offPlan && (
                  <span className="absolute bottom-0.5 size-1 rounded-full bg-warning" />
                )}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted mt-2">
            Toca num dia pra ver o detalhe · ponto amarelo = comeu fora do plano
          </p>
        </Card>

        {/* ——— peso ——— */}
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

        {/* ——— progressão de carga ——— */}
        {hasTreino && (
        <Card>
          <h2 className="font-semibold mb-3">Progressão de carga</h2>
          {loadProgress.length === 0 ? (
            <p className="text-sm text-muted">
              Treina 2+ vezes o mesmo exercício que a curva aparece aqui.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {loadProgress.map((p) => (
                <li key={p.exId} className="flex items-center gap-2.5">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{p.name}</span>
                    <span className="block text-[11px] text-muted">
                      {p.sessions} sessões
                    </span>
                  </span>
                  <span className="text-sm tabular-nums text-muted">
                    {p.first}kg → <strong className="text-ink">{p.last}kg</strong>
                  </span>
                  {p.diff !== 0 && (
                    <span
                      className={[
                        "flex items-center gap-0.5 text-xs font-semibold rounded-full px-2 py-0.5",
                        p.diff > 0
                          ? "bg-brand/15 text-brand"
                          : "bg-danger/15 text-danger",
                      ].join(" ")}
                    >
                      {p.diff > 0 ? (
                        <TrendingUp className="size-3" />
                      ) : (
                        <TrendingDown className="size-3" />
                      )}
                      {p.diff > 0 ? "+" : ""}
                      {p.diff}kg
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        )}

        {/* ——— medidas ——— */}
        {measures.length > 0 && (
          <Card>
            <h2 className="font-semibold mb-3">Medidas</h2>
            <div className="grid grid-cols-2 gap-2">
              {measures.map((m) => (
                <div
                  key={m.label}
                  className="rounded-xl bg-surface border border-border p-2.5 text-center"
                >
                  <div className="text-lg font-bold tabular-nums">
                    {m.value}
                    <span className="text-xs text-muted">cm</span>
                  </div>
                  <div className="text-[11px] text-muted">
                    {m.label}
                    {m.diff !== null && m.diff !== 0 && (
                      <span className={m.diff < 0 ? "text-brand" : "text-warning"}>
                        {" "}
                        ({m.diff > 0 ? "+" : ""}
                        {m.diff})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
      </div>

      {/* ——— detalhe do dia ——— */}
      <Sheet
        open={!!daySheet}
        onClose={() => setDaySheet(null)}
        title={
          daySheet
            ? new Intl.DateTimeFormat("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(new Date(`${daySheet}T12:00:00`))
            : undefined
        }
      >
        {dayDetail && (
          <div className="space-y-3 max-h-[55dvh] overflow-y-auto">
            {dayDetail.sessions.length > 0 ? (
              dayDetail.sessions.map((s) => {
                const doneSets = s.sets.filter((x) => x.status === "completed");
                const vol = doneSets.reduce((a, x) => a + x.reps * x.weightKg, 0);
                const t = (iso?: string) =>
                  iso
                    ? new Date(iso).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—";
                return (
                  <div
                    key={s.id}
                    className="rounded-xl bg-surface border border-border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">🏋️ {s.label}</span>
                      <span className="text-[11px] text-muted">
                        {t(s.startedAt)} – {t(s.endedAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-1">
                      {doneSets.length} séries
                      {vol > 0 ? ` · ${(vol / 1000).toFixed(1)}k kg volume` : ""}
                      {s.status === "partial" ? " · parcial" : ""}
                    </p>
                    {s.feedback && (
                      <p className="text-xs mt-1.5 text-ink/80">“{s.feedback}”</p>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl bg-danger/10 border border-danger/30 p-3">
                <p className="text-sm text-danger font-medium">Treino furado</p>
                <p className="text-xs text-muted mt-1">
                  Fez por fora e esqueceu de marcar? Fala no chat: “treinei nesse
                  dia” que eu registro.
                </p>
              </div>
            )}

            {hasDieta && dayDetail.meals.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted font-medium">Refeições:</p>
                {dayDetail.meals.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center gap-2 rounded-xl bg-surface border border-border px-3 py-2"
                  >
                    <span className="text-sm flex-1 min-w-0 truncate">
                      {l.description}
                    </span>
                    <span
                      className={[
                        "text-[10px] rounded-full px-2 py-0.5 shrink-0",
                        l.adherence === "on_plan"
                          ? "bg-brand/15 text-brand"
                          : l.adherence === "off"
                            ? "bg-warning/15 text-warning"
                            : "bg-surface text-muted border border-border",
                      ].join(" ")}
                    >
                      {l.adherence === "on_plan"
                        ? "no plano"
                        : l.adherence === "off"
                          ? "fora"
                          : "ok"}
                    </span>
                    <span className="text-[10px] text-muted shrink-0">
                      {new Date(l.loggedAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {dayDetail.weight && (
              <p className="text-xs text-muted">
                ⚖️ Peso registrado: <strong>{dayDetail.weight.value} kg</strong>
              </p>
            )}
          </div>
        )}
      </Sheet>

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

      <TabBar className="lg:hidden" />
    </div>
  );
}

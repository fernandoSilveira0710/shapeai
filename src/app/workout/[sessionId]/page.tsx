"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { X, Droplets, SkipForward } from "lucide-react";
import { ExerciseMedia } from "@/components/exercise-media";
import { Button } from "@/components/ui";
import { getExercise } from "@/data/exercises";
import { formatTime, vibrate } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

export default function WorkoutPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const plan = useAppStore((s) => s.plan);
  const sessions = useAppStore((s) => s.sessions);
  const completeSet = useAppStore((s) => s.completeSet);
  const skipExercise = useAppStore((s) => s.skipExercise);
  const finishWorkout = useAppStore((s) => s.finishWorkout);
  const profile = useAppStore((s) => s.profile);

  const session = sessions.find((s) => s.id === sessionId);
  // usa o dia do plano da SESSÃO (não o de hoje) — sessão retomada não troca de treino
  const day = plan?.workoutDays.find((d) => d.weekday === session?.planDayWeekday);
  const exercises = useMemo(() => day?.exercises ?? [], [day]);

  // retomada: deriva posição inicial dos sets já logados (refresh não duplica série)
  const [{ exIndex, setIndex }, setPos] = useState(() => {
    if (!session) return { exIndex: 0, setIndex: 0 };
    for (let i = 0; i < exercises.length; i++) {
      const pe = exercises[i];
      if (session.skippedExercises.includes(pe.exerciseId)) continue;
      const done = session.sets.filter(
        (x) => x.exerciseId === pe.exerciseId && x.status === "completed"
      ).length;
      if (done < pe.sets) return { exIndex: i, setIndex: done };
    }
    return { exIndex: Math.max(0, exercises.length - 1), setIndex: 0 };
  });

  // timers baseados em relógio — sobrevivem a background/tela apagada
  const [now, setNow] = useState(() => Date.now());
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(90);
  const [done, setDone] = useState(false);
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(20);
  const restFiredRef = useRef(false);

  const current = exercises[exIndex];
  const exercise = current ? getExercise(current.exerciseId) : undefined;

  const startedAtMs = session ? new Date(session.startedAt).getTime() : Date.now();
  const elapsed = Math.max(0, Math.floor((now - startedAtMs) / 1000));
  const restLeft =
    restEndsAt !== null ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : null;

  useEffect(() => {
    if (!session || !plan) router.replace("/chat");
  }, [session, plan, router]);

  // tick único (250ms) pra elapsed + descanso
  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [done]);

  // fim do descanso: vibração dupla + fecha overlay
  useEffect(() => {
    if (restEndsAt !== null && restLeft === 0 && !restFiredRef.current) {
      restFiredRef.current = true;
      vibrate([60, 80, 60]);
      setRestEndsAt(null);
    }
  }, [restLeft, restEndsAt]);

  // wake lock: tela não apaga no meio da série
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    async function request() {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        /* sem suporte, segue o jogo */
      }
    }
    request();
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  // pré-preenche reps/carga: última série logada do mesmo exercício > sugestão do plano
  useEffect(() => {
    if (!current || !session) return;
    const lastSet = [...session.sets]
      .reverse()
      .find((x) => x.exerciseId === current.exerciseId && x.status === "completed");
    if (lastSet) {
      setReps(lastSet.reps);
      setWeight(lastSet.weightKg);
    } else {
      const n = Number(String(current.reps).split("-")[0]) || 10;
      setReps(n);
      setWeight(current.suggestedWeightKg ?? 12);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.exerciseId]);

  const progress = useMemo(() => {
    if (!exercises.length) return 0;
    return ((exIndex + (setIndex + 1) / (current?.sets || 1)) / exercises.length) * 100;
  }, [exIndex, setIndex, exercises.length, current?.sets]);

  function startRest(sec: number) {
    restFiredRef.current = false;
    setRestTotal(sec);
    setRestEndsAt(Date.now() + sec * 1000);
  }

  function onCompleteSet() {
    if (!current) return;
    vibrate(20);
    completeSet({
      exerciseId: current.exerciseId,
      setIndex,
      reps,
      weightKg: weight,
      status: "completed",
      completedAt: new Date().toISOString(),
    });

    const lastSet = setIndex + 1 >= current.sets;
    if (!lastSet) {
      setPos({ exIndex, setIndex: setIndex + 1 });
      startRest(current.restSec);
      return;
    }

    if (exIndex + 1 >= exercises.length) {
      finishWorkout("completed");
      vibrate([40, 60, 40, 60, 80]);
      setDone(true);
      return;
    }
    setPos({ exIndex: exIndex + 1, setIndex: 0 });
    startRest(45);
  }

  function onSkipExercise() {
    if (!current) return;
    skipExercise(current.exerciseId);
    if (exIndex + 1 >= exercises.length) {
      finishWorkout("partial");
      setDone(true);
      return;
    }
    setPos({ exIndex: exIndex + 1, setIndex: 0 });
    setRestEndsAt(null);
  }

  function exit() {
    if (!done) {
      const anyDone = (session?.sets.length ?? 0) > 0;
      finishWorkout(anyDone ? "partial" : "abandoned");
    }
    router.replace("/chat");
  }

  if (!session || (!done && (!current || !exercise))) {
    return (
      <div className="app-shell items-center justify-center text-muted text-sm">
        Preparando treino…
      </div>
    );
  }

  if (done) {
    const skipped = session.skippedExercises.length;
    const doneSets = session.sets.filter((s) => s.status === "completed").length;
    const volume = session.sets
      .filter((s) => s.status === "completed")
      .reduce((acc, s) => acc + s.reps * s.weightKg, 0);
    return (
      <div className="app-shell px-6 py-10 justify-center space-y-6">
        <div className="animate-rise">
          <p className="text-brand text-sm font-semibold mb-2">Treino fechado</p>
          <h1 className="text-3xl font-bold">
            {profile?.tone === "sargento" ? "MISSÃO CUMPRIDA." : "Boa. Corpo trabalhou."}
          </h1>
          <p className="text-muted mt-3">
            {formatTime(elapsed)} · {doneSets} séries
            {volume > 0 ? ` · ${(volume / 1000).toFixed(1)}k kg volume` : ""}
            {skipped > 0 ? ` · ${skipped} exercício(s) pulado(s)` : ""}
          </p>
          {skipped > 0 && (
            <p className="text-warning text-sm mt-2">
              {profile?.tone === "sargento"
                ? "PULOU EXERCÍCIO. REGISTRADO."
                : "Pulou alguma coisa — amanhã a gente olha se foi dor ou preguiça."}
            </p>
          )}
        </div>
        <Button size="lg" className="w-full" onClick={() => router.replace("/chat")}>
          Voltar pro chat
        </Button>
      </div>
    );
  }

  return (
    <div className="app-shell relative">
      <header className="px-4 pt-4 pb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={exit}
          className="size-10 rounded-xl bg-surface border border-border flex items-center justify-center text-muted"
          aria-label="Sair"
        >
          <X className="size-5" />
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold">{day?.label}</div>
          <div className="text-xs text-muted tabular-nums">
            {exIndex + 1}/{exercises.length} · {formatTime(elapsed)}
          </div>
        </div>
        <div className="w-10" />
      </header>

      <div className="px-4">
        <div className="h-1 rounded-full bg-border overflow-hidden">
          <div
            className="h-full bg-brand transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
        <ExerciseMedia
          exerciseId={current!.exerciseId}
          emoji={exercise?.emoji ?? "💪"}
          muscle={exercise?.muscleGroup}
        />

        <div>
          <h1 className="text-2xl font-bold leading-tight">{exercise?.namePt}</h1>
          <p className="text-sm text-muted mt-2">{exercise?.instructionsShort}</p>
          {current?.notes && (
            <p className="text-xs text-warning mt-1">{current.notes}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-surface border border-border p-3 text-center">
            <div className="text-[11px] text-muted mb-1">Série</div>
            <div className="text-xl font-bold">
              {setIndex + 1}/{current?.sets}
            </div>
          </div>
          <label className="rounded-2xl bg-surface border border-border p-3 text-center">
            <div className="text-[11px] text-muted mb-1">Reps</div>
            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(Number(e.target.value))}
              className="w-full bg-transparent text-center text-xl font-bold outline-none"
            />
          </label>
          <label className="rounded-2xl bg-surface border border-border p-3 text-center">
            <div className="text-[11px] text-muted mb-1">Carga kg</div>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="w-full bg-transparent text-center text-xl font-bold outline-none"
            />
          </label>
        </div>
      </div>

      <footer className="p-5 space-y-2 border-t border-border pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <Button
          size="lg"
          className="w-full active:scale-[0.97] transition-transform"
          onClick={onCompleteSet}
        >
          ✓ Concluir série
        </Button>
        <button
          type="button"
          onClick={onSkipExercise}
          className="w-full text-sm text-muted flex items-center justify-center gap-1 py-2"
        >
          <SkipForward className="size-4" /> Pular exercício
        </button>
      </footer>

      {restLeft !== null && restEndsAt !== null && (
        <div className="absolute inset-0 z-30 bg-canvas/95 backdrop-blur-sm flex flex-col items-center justify-center px-8 animate-fade-in">
          <p className="text-muted text-sm mb-2 tracking-widest">DESCANSO</p>
          <div
            className={
              restLeft <= 3
                ? "text-7xl font-bold tabular-nums text-brand animate-rest-pulse"
                : "text-7xl font-bold tabular-nums text-brand"
            }
          >
            {formatTime(restLeft)}
          </div>
          <div className="w-full max-w-xs h-2 rounded-full bg-border mt-6 overflow-hidden">
            <div
              className="h-full bg-brand transition-all duration-300"
              style={{ width: `${((restTotal - restLeft) / restTotal) * 100}%` }}
            />
          </div>
          <p className="text-sm text-muted mt-6 flex items-center gap-2">
            <Droplets className="size-4 text-brand" /> Bebe água.
          </p>
          <p className="text-xs text-muted mt-2">
            Próximo: série {Math.min(setIndex + 1, current?.sets ?? 1)} ·{" "}
            {exercise?.namePt}
          </p>
          <div className="flex gap-2 mt-8">
            <Button
              variant="secondary"
              onClick={() => setRestEndsAt((t) => (t ?? Date.now()) + 15_000)}
            >
              +15s
            </Button>
            <Button onClick={() => setRestEndsAt(null)}>Pular descanso</Button>
          </div>
        </div>
      )}
    </div>
  );
}

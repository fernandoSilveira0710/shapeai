"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Camera,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  LogOut,
  Moon,
  Send,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { getExercise } from "@/data/exercises";
import { getExerciseMedia } from "@/data/exercise-media";
import { ExerciseMedia } from "@/components/exercise-media";
import { WEEKDAY_LABELS } from "@/lib/plan-generator";
import { TabBar } from "@/components/tab-bar";
import { Button, Chip, Sheet, TypingDots } from "@/components/ui";
import { TONE_META } from "@/lib/tone";
import { planDayForDate } from "@/lib/plan-generator";
import { intakeChips } from "@/lib/first-contact";
import { cn, dayKey, nowParts, vibrate } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import type { ChatMessage, RichCard } from "@/lib/types";
import type {
  DayMealPayload,
  DayWorkoutPayload,
  DietPlanPayload,
  TechReadPayload,
  WeekPlanPayload,
} from "@/lib/plan-cards";

const GROUP_GAP_MS = 60_000;

function dayOf(m: ChatMessage) {
  return m.createdAt.slice(0, 10);
}

function dayLabel(key: string) {
  if (key === dayKey(0)) return "Hoje";
  if (key === dayKey(-1)) return "Ontem";
  const d = new Date(`${key}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" }).format(d);
}

function timeOf(m: ChatMessage) {
  return new Date(m.createdAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Revela o texto progressivamente (só pra mensagens novas da IA) */
function Typewriter({
  text,
  animate,
  onTick,
}: {
  text: string;
  animate: boolean;
  onTick: () => void;
}) {
  const [shown, setShown] = useState(animate ? 0 : text.length);
  const doneRef = useRef(!animate);

  useEffect(() => {
    if (!animate || doneRef.current) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(text.length);
      doneRef.current = true;
      return;
    }
    let i = 0;
    // revela em ~0.8s independente do tamanho
    const step = Math.max(1, Math.ceil(text.length / 50));
    const t = setInterval(() => {
      i += step;
      setShown(Math.min(i, text.length));
      onTick();
      if (i >= text.length) {
        doneRef.current = true;
        clearInterval(t);
      }
    }, 16);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, text]);

  const typing = animate && shown < text.length;
  return (
    <span className={typing ? "typewriter-caret" : undefined}>
      {text.slice(0, shown)}
    </span>
  );
}

/** Comprime imagem pra data URL leve (max 512px, jpeg) */
async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

export default function ChatPage() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const plan = useAppStore((s) => s.plan);
  const messages = useAppStore((s) => s.messages);
  const typing = useAppStore((s) => s.typing);
  const streamingId = useAppStore((s) => s.streamingId);
  const subscription = useAppStore((s) => s.subscription);
  const hydrateOpening = useAppStore((s) => s.hydrateOpening);
  const sendUserMessage = useAppStore((s) => s.sendUserMessage);
  const sendImageMessage = useAppStore((s) => s.sendImageMessage);
  const startWorkout = useAppStore((s) => s.startWorkout);
  const addMessage = useAppStore((s) => s.addMessage);
  const logWeight = useAppStore((s) => s.logWeight);
  const logMeal = useAppStore((s) => s.logMeal);
  const signOut = useAppStore((s) => s.signOut);
  const approvePlan = useAppStore((s) => s.approvePlan);
  const showPlanCards = useAppStore((s) => s.showPlanCards);
  const sessions = useAppStore((s) => s.sessions);
  const intakeQueue = useAppStore((s) => s.intakeQueue);
  const intakeIndex = useAppStore((s) => s.intakeIndex);

  const [text, setText] = useState("");
  const [weightSheet, setWeightSheet] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [planSheet, setPlanSheet] = useState<
    null | { kind: "day"; weekday: number } | { kind: "meal"; slot: string }
  >(null);
  /** exercício em preview dentro do sheet do dia (GIF + detalhes) */
  const [exPreview, setExPreview] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (!profile?.onboardingCompleted) {
      router.replace("/");
      return;
    }
    hydrateOpening();
  }, [profile, router, hydrateOpening]);

  function scrollToBottom(force = false) {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    if (force || nearBottom) el.scrollTop = el.scrollHeight;
  }

  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length, typing, messages[messages.length - 1]?.content]);

  // autogrow textarea (max 4 linhas)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 4 * 22 + 20)}px`;
  }, [text]);

  async function handleSend(raw?: string) {
    const value = (raw ?? text).trim();
    if (!value) return;
    setText("");
    vibrate(8);
    const result = await sendUserMessage(value);
    if (result.navigateToWorkout) {
      router.push(`/workout/${result.navigateToWorkout}`);
    }
  }

  /** Inicia o treino de verdade — usado pelo card genérico e pelo day_workout */
  function tryStartWorkout() {
    const id = startWorkout();
    if (id) {
      addMessage({ role: "user", content: "bora" });
      addMessage({
        role: "assistant",
        content: "Treino aberto. Bora série por série.",
      });
      vibrate(15);
      router.push(`/workout/${id}`);
      return;
    }
    // não abriu: ou já treinou hoje, ou é dia de descanso — nunca fica em silêncio
    if (workoutDoneToday) {
      addMessage({
        role: "assistant",
        content:
          "Hoje já foi, campeão — músculo cresce no descanso. Amanhã a gente repete a dose. Treinou algo por fora? Me conta que eu registro.",
      });
    } else {
      addMessage({
        role: "assistant",
        content:
          "Hoje é descanso no teu plano — treino de verdade só amanhã. Treinou por fora? Me fala que eu registro.",
      });
    }
  }

  function handleCardCta(type: string) {
    if (type === "workout") tryStartWorkout();
    if (type === "meal_check") handleSend("já comi");
    if (type === "paywall") router.push("/me");
  }

  async function handlePickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      sendImageMessage(dataUrl, text.trim() || undefined);
      setText("");
    } catch {
      addMessage({
        role: "assistant",
        content: "Não consegui ler essa imagem. Tenta outra?",
      });
    }
  }

  /** fecha o sheet e deixa a pergunta pronta no composer — user completa e envia */
  function askInComposer(prefill: string) {
    setPlanSheet(null);
    setText(prefill);
    setTimeout(() => textareaRef.current?.focus(), 80);
  }

  function handleCameraClick() {
    if (subscription !== "pro") {
      handleSend("quero mandar foto do prato");
      return;
    }
    fileInputRef.current?.click();
  }

  function saveWeight() {
    const n = Number(weightInput.replace(",", "."));
    if (n >= 30 && n <= 250) {
      logWeight(n);
      addMessage({ role: "user", content: `${n} kg` });
      addMessage({
        role: "assistant",
        content: `${n} kg anotado. A gente olha a tendência, não um dia só.`,
      });
      vibrate(15);
      setWeightSheet(false);
      setWeightInput("");
    }
  }

  const grouped = useMemo(() => {
    return messages.map((m, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const gapPrev = prev
        ? new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime()
        : Infinity;
      const gapNext = next
        ? new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime()
        : Infinity;
      return {
        m,
        newDay: !prev || dayOf(prev) !== dayOf(m),
        firstOfGroup: !prev || prev.role !== m.role || gapPrev > GROUP_GAP_MS,
        lastOfGroup: !next || next.role !== m.role || gapNext > GROUP_GAP_MS,
      };
    });
  }, [messages]);

  if (!profile) {
    return (
      <div className="app-shell items-center justify-center text-muted text-sm">
        Carregando…
      </div>
    );
  }

  const { time } = nowParts();
  const day = plan ? planDayForDate(plan) : null;
  const workoutDoneToday = sessions.some(
    (s) =>
      s.date === dayKey(0) && (s.status === "completed" || s.status === "partial")
  );
  const intakeOpen = profile.intakeCompleted === false;
  const currentIntakeKey = intakeOpen ? intakeQueue[intakeIndex] ?? null : null;
  // dossiê fechado mas plano ainda não aprovado: nada de "Bora treinar" etc,
  // o card approve_plan já tem os botões — chips ficam neutros
  const planPending = !intakeOpen && !plan?.approvedAt;
  const unlocked = !intakeOpen && !!plan?.approvedAt;
  const chips = intakeOpen
    ? [...intakeChips(currentIntakeKey), "Depois a gente fala"]
    : planPending
      ? ["Pode perguntar", "Quero ajustar"]
      : ([
          day && !day.isRest && !workoutDoneToday ? "Bora treinar" : null,
          "Treino hoje",
          "Dieta hoje",
          "Já almocei",
          "Registrar peso",
          "Como estou?",
          "Treino semana",
          "Dieta semana",
        ].filter(Boolean) as string[]);

  return (
    <div className="app-shell">
      <header className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-3">
        <div className="size-10 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center">
          <Sparkles className="size-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold leading-tight">Shape</div>
          <div className="text-xs text-muted truncate">
            {typing ? (
              <span className="text-brand">digitando…</span>
            ) : intakeOpen ? (
              <>
                {TONE_META[profile.tone].label} · montando teu dossiê
                {intakeQueue.length
                  ? ` · ${Math.min(intakeIndex + 1, intakeQueue.length)}/${intakeQueue.length}`
                  : ""}
              </>
            ) : (
              <>
                {TONE_META[profile.tone].label} · {time}
                {day && !day.isRest ? ` · ${day.label}` : " · rest"}
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => signOut().then(() => router.replace("/"))}
          className="size-9 rounded-lg flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition active:scale-90"
          aria-label="Sair"
        >
          <LogOut className="size-4" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll px-3 py-4">
        {grouped.map(({ m, newDay, firstOfGroup, lastOfGroup }) => {
          const isUser = m.role === "user";
          const isSystem = m.role === "system";
          const isStreaming = m.id === streamingId;
          const isNew =
            m.role === "assistant" &&
            !isStreaming &&
            new Date(m.createdAt).getTime() > mountedAt.current - 300;

          return (
            <div key={m.id}>
              {newDay && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-border/60" />
                  <span className="text-[11px] text-muted font-medium">
                    {dayLabel(dayOf(m))}
                  </span>
                  <div className="flex-1 h-px bg-border/60" />
                </div>
              )}

              {isSystem ? (
                <div className="mx-auto text-center text-xs text-muted my-2 animate-rise">
                  {m.content}
                </div>
              ) : (
                <div
                  className={cn(
                    "flex w-full animate-rise",
                    isUser ? "justify-end" : "justify-start",
                    firstOfGroup ? "mt-3" : "mt-1"
                  )}
                >
                  {!isUser && (
                    <div className="mr-2 flex w-7 shrink-0 items-end">
                      {lastOfGroup && (
                        <div className="size-7 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center">
                          <Sparkles className="size-3.5 text-brand" />
                        </div>
                      )}
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex max-w-[85%] flex-col",
                      isUser ? "items-end" : "items-start"
                    )}
                  >
                    {(m.content.trim() || m.imageDataUrl || isStreaming) && (
                      <div
                        className={cn(
                          "px-3.5 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words",
                          isUser
                            ? "bg-brand text-brand-fg"
                            : "bg-surface border border-border",
                          isUser
                            ? lastOfGroup
                              ? "rounded-[16px_16px_4px_16px]"
                              : "rounded-[16px_4px_4px_16px]"
                            : lastOfGroup
                              ? "rounded-[16px_16px_16px_4px]"
                              : "rounded-[4px_16px_16px_4px]"
                        )}
                      >
                        {m.imageDataUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.imageDataUrl}
                            alt="Foto enviada"
                            className="mb-2 max-h-52 w-full rounded-xl object-cover"
                          />
                        )}
                        {m.role === "assistant" ? (
                          isStreaming ? (
                            m.content ? (
                              <span className="typewriter-caret">{m.content}</span>
                            ) : (
                              <TypingDots />
                            )
                          ) : (
                            <Typewriter
                              text={m.content}
                              animate={isNew}
                              onTick={() => scrollToBottom()}
                            />
                          )
                        ) : (
                          m.content
                        )}
                      </div>
                    )}

                    {m.rich &&
                      (m.rich.type === "week_plan" ? (
                        <WeekPlanCard
                          card={m.rich}
                          onOpenDay={(wd) => {
                            vibrate(8);
                            setPlanSheet({ kind: "day", weekday: wd });
                          }}
                        />
                      ) : m.rich.type === "diet_plan" ? (
                        <DietPlanCard
                          card={m.rich}
                          onOpenMeal={(slot) => {
                            vibrate(8);
                            setPlanSheet({ kind: "meal", slot });
                          }}
                        />
                      ) : m.rich.type === "tech_read" ? (
                        <TechReadCard card={m.rich} />
                      ) : m.rich.type === "day_workout" ? (
                        <DayWorkoutCard card={m.rich} onStart={tryStartWorkout} />
                      ) : m.rich.type === "day_meal" ? (
                        <DayMealCard
                          card={m.rich}
                          onLogOption={(slot, option) => {
                            vibrate(10);
                            logMeal(slot, option, "on_plan", "chip");
                            addMessage({ role: "user", content: `Já comi: ${option}` });
                            addMessage({
                              role: "assistant",
                              content: "Fechou. Anotado.",
                            });
                          }}
                          onLogOther={() => askInComposer("Já comi, mas foi: ")}
                        />
                      ) : m.rich.type === "approve_plan" ? (
                        <div className="mt-1.5 w-full min-w-[240px] rounded-2xl border border-brand/40 bg-brand/5 p-3.5 animate-rise">
                          <div className="text-sm font-semibold mb-3">
                            {m.rich.title}
                          </div>
                          {plan?.approvedAt ? (
                            <p className="text-xs text-muted">
                              ✅ Aprovado — agora é execução.
                            </p>
                          ) : (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  vibrate(20);
                                  approvePlan();
                                }}
                              >
                                ✓ Fechou, aprovo
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="flex-1"
                                onClick={() =>
                                  askInComposer("Quero ajustar uma coisa: ")
                                }
                              >
                                Quero ajustar
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "mt-1.5 w-full min-w-[220px] rounded-2xl border p-3 animate-rise",
                            m.rich.type === "paywall"
                              ? "border-warning/40 bg-warning/10"
                              : "border-border bg-elevated"
                          )}
                        >
                          <div className="text-sm font-semibold">{m.rich.title}</div>
                          {m.rich.body && (
                            <p className="text-xs text-muted mt-1">{m.rich.body}</p>
                          )}
                          {m.rich.cta && (
                            <Button
                              size="sm"
                              className="mt-3"
                              onClick={() => handleCardCta(m.rich!.type)}
                            >
                              {m.rich.cta}
                            </Button>
                          )}
                        </div>
                      ))}

                    {lastOfGroup && (
                      <span className="mt-1 px-1 text-[10px] text-muted/70">
                        {timeOf(m)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* dots só quando NÃO há bolha de streaming — senão vira indicador duplo */}
        {typing && !streamingId && (
          <div className="flex w-full justify-start mt-3 animate-rise">
            <div className="mr-2 flex w-7 shrink-0 items-end">
              <div className="size-7 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center">
                <Sparkles className="size-3.5 text-brand" />
              </div>
            </div>
            <div className="rounded-[16px_16px_16px_4px] bg-surface border border-border px-4 py-3">
              <TypingDots />
            </div>
          </div>
        )}
      </div>

      <div className="px-3 pb-2 space-y-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {chips.map((c, i) => (
            <Chip
              key={c}
              className="shrink-0 animate-chip-in"
              style={{ animationDelay: `${i * 45}ms` }}
              onClick={() => {
                vibrate(8);
                if (c === "Registrar peso") {
                  setWeightInput(String(profile.weightKg));
                  setWeightSheet(true);
                  return;
                }
                if (c === "Treino semana") {
                  showPlanCards("week");
                  return;
                }
                if (c === "Dieta semana") {
                  showPlanCards("diet");
                  return;
                }
                if (c === "Treino hoje") {
                  showPlanCards("day-workout");
                  return;
                }
                if (c === "Dieta hoje") {
                  showPlanCards("day-meal");
                  return;
                }
                handleSend(c === "Bora treinar" ? "bora" : c);
              }}
            >
              {c}
            </Chip>
          ))}
        </div>
        <form
          className="flex gap-2 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <button
            type="button"
            onClick={handleCameraClick}
            aria-label={
              subscription === "pro" ? "Enviar foto do prato" : "Foto do prato (Pro)"
            }
            className={cn(
              "size-11 shrink-0 rounded-xl border flex items-center justify-center transition active:scale-95",
              subscription === "pro"
                ? "bg-surface border-border text-muted hover:text-ink"
                : "bg-surface border-border text-muted/50"
            )}
          >
            <Camera className="size-[18px]" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePickImage}
            hidden
            className="hidden"
            style={{ display: "none" }}
            aria-hidden="true"
            tabIndex={-1}
          />
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder="Fala com teu personal…"
            className="flex-1 min-h-11 max-h-28 resize-none rounded-xl bg-surface border border-border px-3 py-2.5 text-[15px] outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/15 transition-colors"
          />
          <Button
            type="submit"
            className="size-11 p-0 shrink-0 active:scale-90 transition-transform"
            aria-label="Enviar"
            disabled={!text.trim()}
          >
            <Send className="size-4" />
          </Button>
        </form>
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
          <p className="text-xs text-muted mt-2">
            Mesmo horário, mesma balança — a tendência é o que importa.
          </p>
          <Button type="submit" size="lg" className="w-full mt-4">
            Salvar
          </Button>
        </form>
      </Sheet>

      {/* Sheet de detalhe: dia de treino ou refeição — sai do "perdido no chat" */}
      <Sheet
        open={!!planSheet}
        onClose={() => {
          setPlanSheet(null);
          setExPreview(null);
        }}
        title={
          planSheet?.kind === "day"
            ? exPreview
              ? (getExercise(exPreview)?.namePt ?? "Exercício")
              : `${WEEKDAY_LABELS[planSheet.weekday]} · ${
                  plan?.workoutDays.find((d) => d.weekday === planSheet.weekday)?.label ?? ""
                }`
            : planSheet?.kind === "meal"
              ? (plan?.nutrition.meals.find((m) => m.slot === planSheet.slot)?.title ?? "Refeição")
              : undefined
        }
      >
        {planSheet?.kind === "day" &&
          plan &&
          (() => {
            const d = plan.workoutDays.find((x) => x.weekday === planSheet.weekday);
            if (!d || d.isRest) return <p className="text-sm text-muted">Dia de descanso.</p>;

            // ——— preview do exercício: GIF + séries + instrução ———
            if (exPreview) {
              const pe = d.exercises.find((e) => e.exerciseId === exPreview);
              const ex = getExercise(exPreview);
              if (!pe || !ex) return null;
              return (
                <div className="space-y-3 max-h-[62dvh] overflow-y-auto">
                  <ExerciseMedia
                    exerciseId={exPreview}
                    emoji={ex.emoji}
                    muscle={ex.muscleGroup}
                  />
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-surface border border-border p-2">
                      <div className="text-lg font-bold">{pe.sets}</div>
                      <div className="text-[10px] text-muted">séries</div>
                    </div>
                    <div className="rounded-xl bg-surface border border-border p-2">
                      <div className="text-lg font-bold">{pe.reps}</div>
                      <div className="text-[10px] text-muted">reps</div>
                    </div>
                    <div className="rounded-xl bg-surface border border-border p-2">
                      <div className="text-lg font-bold">{pe.restSec}s</div>
                      <div className="text-[10px] text-muted">descanso</div>
                    </div>
                  </div>
                  <p className="text-sm text-muted">{ex.instructionsShort}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => setExPreview(null)}
                    >
                      ← Voltar
                    </Button>
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() =>
                        askInComposer(`Não tenho como fazer ${ex.namePt}, o que uso no lugar? `)
                      }
                    >
                      Trocar esse
                    </Button>
                  </div>
                </div>
              );
            }

            // ——— lista com thumbnail — tap abre o preview ———
            return (
              <div className="space-y-1.5 max-h-[55dvh] overflow-y-auto">
                {d.exercises.map((e, i) => {
                  const ex = getExercise(e.exerciseId);
                  const media = getExerciseMedia(e.exerciseId);
                  return (
                    <button
                      key={`${e.exerciseId}-${i}`}
                      type="button"
                      onClick={() => {
                        vibrate(8);
                        setExPreview(e.exerciseId);
                      }}
                      className="w-full flex items-center gap-3 rounded-xl bg-surface border border-border px-3 py-2.5 text-left transition hover:border-brand/40 active:scale-[0.99]"
                    >
                      {media ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={media.thumbUrl}
                          alt=""
                          loading="lazy"
                          className="size-11 shrink-0 rounded-lg object-cover bg-elevated"
                        />
                      ) : (
                        <span className="size-11 shrink-0 rounded-lg bg-elevated flex items-center justify-center text-xl">
                          {ex?.emoji ?? "🏋️"}
                        </span>
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate">
                          {ex?.namePt ?? e.exerciseId}
                        </span>
                        <span className="block text-[11px] text-muted">
                          {e.sets}×{e.reps} · descanso {e.restSec}s
                        </span>
                      </span>
                      <ChevronRight className="size-4 text-muted shrink-0" />
                    </button>
                  );
                })}
                <Button
                  variant="secondary"
                  className="w-full mt-2"
                  onClick={() =>
                    askInComposer("Não tenho o aparelho de um exercício desse treino: ")
                  }
                >
                  Não tenho um aparelho — perguntar
                </Button>
              </div>
            );
          })()}

        {planSheet?.kind === "meal" &&
          plan &&
          (() => {
            const meal = plan.nutrition.meals.find((m) => m.slot === planSheet.slot);
            if (!meal) return null;
            return (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <p className="text-xs text-muted font-medium">
                    Opções — alterna entre elas na semana:
                  </p>
                  {meal.items.map((op, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-xl bg-surface border border-border px-3 py-2.5"
                    >
                      <span className="mt-0.5 size-5 shrink-0 rounded-full bg-brand/15 text-brand text-[11px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-sm">{op}</span>
                    </div>
                  ))}
                </div>
                {meal.swaps && meal.swaps.length > 0 && (
                  <div>
                    <p className="text-xs text-muted font-medium mb-1">Trocas rápidas:</p>
                    {meal.swaps.map((sw) => (
                      <p key={sw} className="text-xs text-muted">
                        • {sw}
                      </p>
                    ))}
                  </div>
                )}
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => askInComposer("Acabou um ingrediente, posso trocar por ")}
                >
                  Pedir troca — a IA remonta
                </Button>
              </div>
            );
          })()}
      </Sheet>

      <TabBar />
    </div>
  );
}

/* ——— Quadros visuais pós-dossiê (semana, dieta, leitura técnica) ——— */

function WeekPlanCard({
  card,
  onOpenDay,
}: {
  card: RichCard;
  onOpenDay: (weekday: number) => void;
}) {
  const p = card.payload as WeekPlanPayload;
  if (!p?.rows) return null;
  return (
    <div className="mt-1.5 w-full min-w-[250px] rounded-2xl border border-border bg-elevated overflow-hidden animate-rise">
      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-brand/10 border-b border-brand/20">
        <Dumbbell className="size-4 text-brand" />
        <span className="text-sm font-semibold">{card.title}</span>
      </div>
      <div className="p-2">
        {p.rows.map((r) => (
          <button
            key={r.weekday}
            type="button"
            onClick={() => onOpenDay(r.weekday)}
            className="w-full flex items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-surface active:scale-[0.99]"
          >
            <span className="w-10 shrink-0 rounded-lg bg-brand text-brand-fg text-center text-xs font-bold py-1.5">
              {r.day}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium truncate">{r.label}</span>
              <span className="block text-[11px] text-muted">
                {r.time ? `${r.time} · ` : ""}
                {r.exercises} exercícios · ~{r.durationMin}min
              </span>
            </span>
            <ChevronRight className="size-4 text-muted shrink-0" />
          </button>
        ))}
        {p.restDays && (
          <p className="text-[11px] text-muted px-2 pt-1.5 pb-1">
            Descanso: {p.restDays}
          </p>
        )}
      </div>
    </div>
  );
}

function DietPlanCard({
  card,
  onOpenMeal,
}: {
  card: RichCard;
  onOpenMeal: (slot: string) => void;
}) {
  const p = card.payload as DietPlanPayload;
  if (!p?.meals) return null;
  return (
    <div className="mt-1.5 w-full min-w-[250px] rounded-2xl border border-border bg-elevated overflow-hidden animate-rise">
      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-brand/10 border-b border-brand/20">
        <UtensilsCrossed className="size-4 text-brand" />
        <span className="flex-1 text-sm font-semibold">{card.title}</span>
        <span className="text-[10px] text-muted">
          P{p.proteinG} C{p.carbsG} G{p.fatG}
        </span>
      </div>
      <div className="p-2">
        {p.meals.map((m) => (
          <button
            key={m.slot}
            type="button"
            onClick={() => onOpenMeal(m.slot)}
            className="w-full flex items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-surface active:scale-[0.99]"
          >
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium">{m.title}</span>
              <span className="block text-[11px] text-muted truncate">
                {m.options[0]}
              </span>
            </span>
            {m.options.length > 1 && (
              <span className="shrink-0 rounded-full bg-brand/15 text-brand text-[10px] font-semibold px-2 py-0.5">
                +{m.options.length - 1} opções
              </span>
            )}
            <ChevronRight className="size-4 text-muted shrink-0" />
          </button>
        ))}
        <div className="mx-2 mt-1.5 pt-2 border-t border-border/60 space-y-1 pb-1">
          <p className="text-[11px]">
            <span className="text-brand font-medium">Pré-treino:</span>{" "}
            <span className="text-muted">{p.preWorkout}</span>
          </p>
          <p className="text-[11px]">
            <span className="text-brand font-medium">Pós-treino:</span>{" "}
            <span className="text-muted">{p.postWorkout}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function TechReadCard({ card }: { card: RichCard }) {
  const p = card.payload as TechReadPayload;
  if (!p?.imc) return null;
  return (
    <div className="mt-1.5 w-full min-w-[250px] rounded-2xl border border-border bg-elevated overflow-hidden animate-rise">
      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-brand/10 border-b border-brand/20">
        <Activity className="size-4 text-brand" />
        <span className="text-sm font-semibold">{card.title}</span>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-surface border border-border p-2.5">
            <div className="text-xl font-bold tabular-nums text-brand">{p.imc}</div>
            <div className="text-[10px] text-muted mt-0.5">IMC</div>
          </div>
          <div className="rounded-xl bg-surface border border-border p-2.5">
            <div className="text-xl font-bold tabular-nums text-brand">
              {p.targetKcal}
            </div>
            <div className="text-[10px] text-muted mt-0.5">kcal alvo</div>
          </div>
          <div className="rounded-xl bg-surface border border-border p-2.5">
            <div className="text-xl font-bold tabular-nums text-brand">
              {p.proteinG}g
            </div>
            <div className="text-[10px] text-muted mt-0.5">proteína/dia</div>
          </div>
        </div>
        <p className="text-[11px] text-muted mt-2.5">
          IMC: {p.imcLabel} · TDEE ~{p.tdee} kcal · {p.goalNote}
        </p>
      </div>
    </div>
  );
}

/* ——— Cards de HOJE (distintos dos cards de semana) ——— */

function DayWorkoutCard({
  card,
  onStart,
}: {
  card: RichCard;
  onStart: () => void;
}) {
  const p = card.payload as DayWorkoutPayload;
  if (!p) return null;

  if (p.status === "rest") {
    return (
      <div className="mt-1.5 w-full min-w-[240px] rounded-2xl border border-border bg-elevated overflow-hidden animate-rise">
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-surface border-b border-border">
          <Moon className="size-4 text-muted" />
          <span className="text-sm font-semibold">{card.title}</span>
        </div>
        <div className="p-3.5">
          <p className="text-sm text-muted">
            Descanso — corpo recupera pro próximo treino. Se treinou algo por
            fora, é só me contar que eu registro.
          </p>
        </div>
      </div>
    );
  }

  if (p.status === "done") {
    const d = p.doneSummary;
    return (
      <div className="mt-1.5 w-full min-w-[240px] rounded-2xl border border-brand/30 bg-elevated overflow-hidden animate-rise">
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-brand/10 border-b border-brand/20">
          <CheckCircle2 className="size-4 text-brand" />
          <span className="text-sm font-semibold">{card.title} · {p.label}</span>
        </div>
        <div className="p-3.5">
          <p className="text-sm text-muted">
            Concluído ✅ {d ? `${d.sets} séries` : ""}
            {d && d.volumeKg > 0 ? ` · ${(d.volumeKg / 1000).toFixed(1)}k kg volume` : ""}
            {d && d.minutes > 0 ? ` · ${d.minutes}min` : ""}
          </p>
        </div>
      </div>
    );
  }

  // pending: treino do dia ainda não feito
  return (
    <div className="mt-1.5 w-full min-w-[240px] rounded-2xl border border-border bg-elevated overflow-hidden animate-rise">
      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-brand/10 border-b border-brand/20">
        <Dumbbell className="size-4 text-brand" />
        <span className="flex-1 text-sm font-semibold">{card.title} · {p.label}</span>
        <span className="text-[10px] text-muted">
          {p.time ? `${p.time} · ` : ""}~{p.durationMin}min
        </span>
      </div>
      <div className="p-2">
        {p.exercises.map((e) => (
          <div
            key={e.exerciseId}
            className="flex items-center gap-2.5 rounded-xl px-2 py-1.5"
          >
            <span className="flex-1 min-w-0 text-sm truncate">{e.name}</span>
            <span className="text-[11px] text-muted shrink-0">
              {e.sets}×{e.reps}
            </span>
          </div>
        ))}
        <Button size="sm" className="w-full mt-2" onClick={onStart}>
          Iniciar treino
        </Button>
      </div>
    </div>
  );
}

function DayMealCard({
  card,
  onLogOption,
  onLogOther,
}: {
  card: RichCard;
  onLogOption: (slot: string, option: string) => void;
  onLogOther: () => void;
}) {
  const p = card.payload as DayMealPayload;
  if (!p) return null;
  return (
    <div className="mt-1.5 w-full min-w-[240px] rounded-2xl border border-border bg-elevated overflow-hidden animate-rise">
      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-brand/10 border-b border-brand/20">
        <UtensilsCrossed className="size-4 text-brand" />
        <span className="text-sm font-semibold">{card.title}</span>
      </div>
      <div className="p-2.5 space-y-1.5">
        {p.loggedAlready && (
          <p className="text-[11px] text-brand px-1 pb-0.5">
            ✓ já registrado hoje — pode logar de novo se comeu outra coisa
          </p>
        )}
        {p.options.map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => onLogOption(p.slot, op)}
            className="w-full flex items-center gap-2.5 rounded-xl bg-surface border border-border px-3 py-2.5 text-left text-sm transition hover:border-brand/40 active:scale-[0.99]"
          >
            {op}
          </button>
        ))}
        <button
          type="button"
          onClick={onLogOther}
          className="w-full text-center text-xs text-muted py-1.5"
        >
          Comi outra coisa — escrever
        </button>
      </div>
    </div>
  );
}

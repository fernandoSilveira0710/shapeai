"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  generatePlan,
  patchPlan,
  planDayForDate,
  WEEKDAY_LABELS,
  type PatchResult,
} from "@/lib/plan-generator";
import type {
  AppState,
  BodyMetric,
  ChatMessage,
  MealLog,
  Plan,
  PlanChangeLogEntry,
  RichCard,
  SubscriptionPlan,
  UserProfile,
  WorkoutSession,
  WorkoutSetLog,
} from "@/lib/types";
import { buildOpening, coachReply } from "@/lib/tone";
import {
  buildIntakeQueue,
  buildIntroMessage,
  intakeClosing,
} from "@/lib/first-contact";
import { streamLlmReply } from "@/lib/llm-client";
import type { ChatAction } from "@/app/api/chat/route";
import { tryVisionMeal } from "@/lib/vision-client";
import { dayKey, todayKey, weekdayOfKey } from "@/lib/utils";
import { getExercise } from "@/data/exercises";
import { computePendings } from "@/lib/pendings";
import { requestReminderPermission } from "@/lib/reminders";
import {
  buildDietCard,
  buildTechReadCard,
  buildWeekPlanCard,
} from "@/lib/plan-cards";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { pullSnapshot, pushSnapshot, type SnapshotPayload } from "@/lib/supabase/sync";

const FREE_DAILY_LIMIT = 15;

function uid() {
  return crypto.randomUUID();
}

/** Ack curto no tom + próxima pergunta (intake) */
/** Mensagem de liberação — plano aprovado, explica o que destrancou */
/**
 * Trilha de mudanças do plano — hoje só log local, amanhã é o que o
 * painel do personal vai ler (fase 3). Barato: schema pronto, sem UI.
 */
function withChangeLog(
  plan: Plan,
  entry: Omit<PlanChangeLogEntry, "at">
): Plan {
  const log = [...(plan.changeLog ?? []), { ...entry, at: new Date().toISOString() }];
  return { ...plan, changeLog: log.slice(-30) };
}

function unlockMessage(tone: UserProfile["tone"], name: string) {
  const n = name.split(" ")[0] || "campeão";
  switch (tone) {
    case "sargento":
      return `PLANO SELADO, ${n.toUpperCase()}. A PARTIR DE AGORA:\n\n• "BORA" ABRE O TREINO DO DIA\n• REPORTA REFEIÇÃO E PESO QUANDO EU PEDIR\n• ABA EVOLUÇÃO: HISTÓRICO, CALENDÁRIO, PROGRESSÃO DE CARGA\n• ABA EU: PERFIL, TOM, ASSINATURA\n\nQUER REVER TREINO OU DIETA? BOTÕES AÍ EMBAIXO. EXECUÇÃO COMEÇA JÁ.`;
    case "nutella":
      return `Fechado com muito carinho, ${n}! 💛 A partir de agora:\n\n• Quando quiser treinar, é só me chamar com um "bora"\n• Vou te perguntar de refeição e peso no dia a dia\n• A aba Evolução guarda teu progresso — peso, calendário, cargas\n• A aba Eu é teu cantinho: perfil, tom, assinatura\n\nSe quiser rever o treino ou a dieta, os botões estão logo abaixo. Vamos juntos! ✨`;
    case "low_profile":
      return `Plano fechado, ${n}. Liberado:\n\n• "bora" abre o treino do dia\n• Registro de refeição e peso quando eu pedir\n• Aba Evolução: histórico e progressão\n• Aba Eu: perfil e assinatura\n\nBotões "Ver treino"/"Ver dieta" abaixo pra rever quando quiser.`;
    default:
      return `Fechou, ${n}! 🤝 A partir de agora:\n\n• Chama "bora" que eu abro o treino do dia\n• Vou te cobrar refeição e peso na hora certa\n• Aba Evolução: teu histórico, calendário, progressão de carga\n• Aba Eu: perfil, tom, assinatura\n\nQuer rever o treino ou a dieta? Os botões aí embaixo abrem na hora. Bora nessa!`;
  }
}

function sayAckThenAsk(tone: UserProfile["tone"], userAnswer: string, nextAsk: string) {
  const short =
    userAnswer.length > 80 ? userAnswer.slice(0, 77) + "…" : userAnswer;
  const ack =
    tone === "sargento"
      ? `REGISTRADO: “${short}”.`
      : tone === "nutella"
        ? `Anotei: “${short}” 💛`
        : tone === "low_profile"
          ? `Ok — “${short}”.`
          : `Beleza, anotei: “${short}”.`;
  return `${ack}\n\n${nextAsk}`;
}

function msg(
  role: ChatMessage["role"],
  content: string,
  rich?: ChatMessage["rich"]
): ChatMessage {
  return {
    id: uid(),
    role,
    content,
    createdAt: new Date().toISOString(),
    rich,
  };
}

type Actions = {
  hydrateOpening: () => void;
  setSubscription: (p: SubscriptionPlan) => void;
  completeOnboarding: (profile: UserProfile, plan: Plan) => void;
  updatePlan: (plan: Plan) => void;
  redesignPlan: (instruction: string) => PatchResult | null;
  addMessage: (m: Omit<ChatMessage, "id" | "createdAt"> & { id?: string }) => void;
  patchMessage: (id: string, patch: Partial<ChatMessage>) => void;
  sendUserMessage: (text: string) => Promise<{ navigateToWorkout?: string }>;
  sendImageMessage: (dataUrl: string, caption?: string) => void;
  startWorkout: () => string | null;
  completeSet: (set: WorkoutSetLog) => void;
  addWorkoutNote: (text: string) => void;
  skipExercise: (exerciseId: string) => void;
  finishWorkout: (status?: WorkoutSession["status"]) => void;
  logMeal: (
    slot: string,
    description: string,
    adherence: MealLog["adherence"],
    source?: MealLog["source"]
  ) => void;
  logWeight: (kg: number) => void;
  approvePlan: () => void;
  showPlanCards: (kind: "week" | "diet") => void;
  resetAll: () => void;
  signOut: () => Promise<void>;
  updateTone: (tone: UserProfile["tone"]) => void;
  applyCloudSnapshot: (payload: SnapshotPayload) => void;
  syncToCloud: () => Promise<void>;
  hydrateFromCloud: () => Promise<void>;
  setAuthUserId: (id: string | null) => void;
};

const initial: AppState = {
  profile: null,
  plan: null,
  messages: [],
  sessions: [],
  mealLogs: [],
  metrics: [],
  subscription: "basic",
  activeWorkoutId: null,
  lastOpenDate: null,
  typing: false,
  streamingId: null,
  dailyLlmCount: 0,
  dailyLlmDate: null,
  authUserId: null,
  intakeQueue: [],
  intakeIndex: 0,
  awaitingFeedbackId: null,
};

function missedYesterday(
  sessions: WorkoutSession[],
  plan: Plan | null,
  profile: UserProfile | null
) {
  if (!plan || !profile) return false;
  const yKey = dayKey(-1);
  if (yKey < profile.createdAt.slice(0, 10)) return false;
  const day = plan.workoutDays.find((d) => d.weekday === weekdayOfKey(yKey));
  if (!day || day.isRest) return false;
  return !sessions.some(
    (s) => s.date === yKey && (s.status === "completed" || s.status === "partial")
  );
}

function rollDailyCounter(s: AppState): Pick<AppState, "dailyLlmCount" | "dailyLlmDate"> {
  const today = todayKey();
  if (s.dailyLlmDate !== today) return { dailyLlmCount: 0, dailyLlmDate: today };
  return { dailyLlmCount: s.dailyLlmCount, dailyLlmDate: s.dailyLlmDate };
}

export const useAppStore = create<AppState & Actions>()(
  persist(
    (set, get) => {
      function reply(content: string, rich?: RichCard, delayMs?: number) {
        const delay = delayMs ?? 400 + Math.random() * 350;
        set({ typing: true });
        setTimeout(() => {
          set({ typing: false });
          get().addMessage({ role: "assistant", content, rich });
          void get().syncToCloud();
        }, delay);
      }

      /** remove cards de plano obsoletos do chat — só o quadro atual fica visível */
      function pruneOldPlanCards(kinds: string[]) {
        set((st) => ({
          messages: st.messages.filter(
            (m) => !(m.rich && kinds.includes(m.rich.type))
          ),
        }));
      }

      function applyActions(actions: ChatAction[]): { navigateToWorkout?: string; rich?: RichCard } {
        let navigateToWorkout: string | undefined;
        let rich: RichCard | undefined;
        for (const a of actions) {
          if (a.type === "open_workout") {
            const id = get().startWorkout();
            if (id) navigateToWorkout = id;
          } else if (a.type === "log_weight") {
            get().logWeight(a.kg);
          } else if (a.type === "log_meal") {
            get().logMeal(
              a.slot,
              a.description,
              (a.adherence as MealLog["adherence"]) || "partial"
            );
          } else if (a.type === "redesign_plan") {
            const result = get().redesignPlan(a.instruction);
            if (result?.changed) {
              const withLog = withChangeLog(result.plan, {
                trigger: a.instruction.slice(0, 200),
                summary: result.summary,
                tool: "redesign_plan",
              });
              set({ plan: withLog });
              rich = {
                type: "plan_summary",
                title: `Plano v${withLog.version}`,
                body: `${withLog.nutrition.kcal} kcal · P${withLog.nutrition.proteinG}g`,
              };
              // quadro velho confunde — some; o novo entra com pedido de aprovação
              pruneOldPlanCards(["week_plan", "diet_plan", "approve_plan"]);
              const prof = get().profile;
              if (prof) {
                setTimeout(() => {
                  get().addMessage({
                    role: "assistant",
                    content: "Semana remontada:",
                    rich: buildWeekPlanCard(prof, withLog),
                  });
                  get().addMessage({
                    role: "assistant",
                    content: "",
                    rich: {
                      type: "approve_plan",
                      title: `Fechou assim? (plano v${withLog.version})`,
                    },
                  });
                  void get().syncToCloud();
                }, 800);
              }
            } else {
              // patchPlan não reconheceu o pedido — NADA mudou, avisa em vez de fingir
              setTimeout(() => {
                get().addMessage({
                  role: "assistant",
                  content:
                    "Não consegui aplicar esse ajuste automaticamente ainda. Me fala de novo, mais específico (ex.: qual exercício, qual dia) que eu resolvo na hora.",
                });
                void get().syncToCloud();
              }, 500);
            }
          } else if (a.type === "add_exercise") {
            const plan = get().plan;
            const ex = plan ? getExercise(a.exerciseId) : undefined;
            if (plan && ex) {
              const days = plan.workoutDays.map((d) => ({ ...d }));
              const day = days.find((d) => d.weekday === a.weekday);
              const already = day?.exercises.some((e) => e.exerciseId === a.exerciseId);
              if (day && !day.isRest && !already) {
                day.exercises = [
                  ...day.exercises,
                  {
                    exerciseId: a.exerciseId,
                    sets: a.sets ?? 3,
                    reps: a.reps ?? "8-12",
                    restSec: ex.defaultRestSec,
                  },
                ];
                const nextPlan = withChangeLog(
                  { ...plan, workoutDays: days, version: plan.version + 1, source: "ai" as const, approvedAt: undefined },
                  {
                    trigger: `adicionar ${ex.namePt}`,
                    summary: `${ex.namePt} adicionado no dia`,
                    tool: "add_exercise",
                  }
                );
                set({ plan: nextPlan });
                pruneOldPlanCards(["week_plan", "approve_plan"]);
                const prof = get().profile;
                if (prof) {
                  setTimeout(() => {
                    get().addMessage({
                      role: "assistant",
                      content: "Treino ajustado — ficou assim:",
                      rich: buildWeekPlanCard(prof, nextPlan),
                    });
                    get().addMessage({
                      role: "assistant",
                      content: "",
                      rich: {
                        type: "approve_plan",
                        title: `Fechou assim? (plano v${nextPlan.version})`,
                      },
                    });
                    void get().syncToCloud();
                  }, 700);
                }
              }
            }
          } else if (a.type === "remove_exercise") {
            const plan = get().plan;
            if (plan) {
              const days = plan.workoutDays.map((d) => ({ ...d }));
              const day = days.find((d) => d.weekday === a.weekday);
              const had = day?.exercises.some((e) => e.exerciseId === a.exerciseId);
              if (day && had) {
                const ex = getExercise(a.exerciseId);
                day.exercises = day.exercises.filter((e) => e.exerciseId !== a.exerciseId);
                const nextPlan = withChangeLog(
                  { ...plan, workoutDays: days, version: plan.version + 1, source: "ai" as const, approvedAt: undefined },
                  {
                    trigger: `remover ${ex?.namePt ?? a.exerciseId}`,
                    summary: `${ex?.namePt ?? a.exerciseId} removido do dia`,
                    tool: "remove_exercise",
                  }
                );
                set({ plan: nextPlan });
                pruneOldPlanCards(["week_plan", "approve_plan"]);
                const prof = get().profile;
                if (prof) {
                  setTimeout(() => {
                    get().addMessage({
                      role: "assistant",
                      content: "Treino ajustado — ficou assim:",
                      rich: buildWeekPlanCard(prof, nextPlan),
                    });
                    get().addMessage({
                      role: "assistant",
                      content: "",
                      rich: {
                        type: "approve_plan",
                        title: `Fechou assim? (plano v${nextPlan.version})`,
                      },
                    });
                    void get().syncToCloud();
                  }, 700);
                }
              }
            }
          } else if (a.type === "swap_workout_day") {
            const plan = get().plan;
            if (plan) {
              const todayWd = new Date().getDay();
              const days = plan.workoutDays.map((d) => ({ ...d }));
              const a1 = days.find((d) => d.weekday === todayWd);
              const b1 = days.find((d) => d.weekday === a.withWeekday);
              if (a1 && b1) {
                const tmp = {
                  label: a1.label,
                  exercises: a1.exercises,
                  durationMin: a1.durationMin,
                  isRest: a1.isRest,
                };
                Object.assign(a1, {
                  label: b1.label,
                  exercises: b1.exercises,
                  durationMin: b1.durationMin,
                  isRest: b1.isRest,
                });
                Object.assign(b1, tmp);
                const nextPlan = withChangeLog(
                  { ...plan, workoutDays: days, version: plan.version + 1 },
                  {
                    trigger: `trocar treino de hoje pelo de ${WEEKDAY_LABELS[a.withWeekday]}`,
                    summary: `${WEEKDAY_LABELS[todayWd]} e ${WEEKDAY_LABELS[a.withWeekday]} trocaram de treino`,
                    tool: "swap_workout_day",
                  }
                );
                set({ plan: nextPlan });
              }
            }
          } else if (a.type === "swap_exercise") {
            const plan = get().plan;
            const toEx = plan ? getExercise(a.toExerciseId) : undefined;
            if (plan && toEx) {
              const days = plan.workoutDays.map((d) => ({ ...d }));
              const day = days.find((d) => d.weekday === a.weekday);
              const idx = day?.exercises.findIndex(
                (e) => e.exerciseId === a.fromExerciseId
              );
              if (day && idx !== undefined && idx !== -1) {
                const old = day.exercises[idx];
                day.exercises = [...day.exercises];
                day.exercises[idx] = {
                  ...old,
                  exerciseId: a.toExerciseId,
                  restSec: toEx.defaultRestSec,
                  notes: "Substituído a pedido.",
                };
                const nextPlan = withChangeLog(
                  {
                    ...plan,
                    workoutDays: days,
                    version: plan.version + 1,
                    source: "ai" as const,
                    approvedAt: undefined,
                  },
                  {
                    trigger: `trocar ${getExercise(a.fromExerciseId)?.namePt ?? a.fromExerciseId} por ${toEx.namePt}`,
                    summary: `${toEx.namePt} entrou no lugar de ${getExercise(a.fromExerciseId)?.namePt ?? a.fromExerciseId}`,
                    tool: "swap_exercise",
                  }
                );
                set({ plan: nextPlan });
                // re-mostra o quadro atualizado + pede aprovação de novo
                pruneOldPlanCards(["week_plan", "approve_plan"]);
                const prof = get().profile;
                if (prof) {
                  setTimeout(() => {
                    get().addMessage({
                      role: "assistant",
                      content: "Treino ajustado — ficou assim:",
                      rich: buildWeekPlanCard(prof, nextPlan),
                    });
                    get().addMessage({
                      role: "assistant",
                      content: "",
                      rich: {
                        type: "approve_plan",
                        title: `Fechou assim? (plano v${nextPlan.version})`,
                      },
                    });
                    void get().syncToCloud();
                  }, 700);
                }
              }
            }
          } else if (a.type === "log_past_workout") {
            const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(a.date);
            if (dateOk && a.date <= todayKey()) {
              const wd = new Date(`${a.date}T12:00:00`).getDay();
              set((st) => ({
                sessions: [
                  ...st.sessions,
                  {
                    id: uid(),
                    date: a.date,
                    label: a.note?.slice(0, 40) || "Treino avulso",
                    status: "completed" as const,
                    startedAt: `${a.date}T12:00:00.000Z`,
                    endedAt: `${a.date}T13:00:00.000Z`,
                    sets: [],
                    skippedExercises: [],
                    planDayWeekday: wd,
                    feedback: a.note,
                    feedbackAt: new Date().toISOString(),
                  },
                ],
              }));
            }
          } else if (a.type === "swap_food") {
            const plan = get().plan;
            if (plan) {
              const rx = new RegExp(
                a.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[eé]/gi, "[eé]"),
                "gi"
              );
              let touched = false;
              const meals = plan.nutrition.meals.map((meal) => {
                const items = meal.items.map((op) => {
                  if (rx.test(op)) {
                    touched = true;
                    return op.replace(rx, a.to);
                  }
                  return op;
                });
                return { ...meal, items };
              });
              if (touched) {
                set({
                  plan: withChangeLog(
                    {
                      ...plan,
                      nutrition: { ...plan.nutrition, meals },
                      version: plan.version + 1,
                      source: "ai",
                      approvedAt: undefined,
                    },
                    {
                      trigger: `trocar ${a.from} por ${a.to}`,
                      summary: `${a.to} entrou no lugar de ${a.from} na dieta`,
                      tool: "swap_food",
                    }
                  ),
                });
                // re-mostra o quadro atualizado + pede aprovação de novo
                pruneOldPlanCards(["diet_plan", "approve_plan"]);
                const prof = get().profile;
                const updated = get().plan;
                if (prof && updated) {
                  setTimeout(() => {
                    get().addMessage({
                      role: "assistant",
                      content: "Ajustei — ficou assim:",
                      rich: buildDietCard(prof, updated),
                    });
                    get().addMessage({
                      role: "assistant",
                      content: "",
                      rich: {
                        type: "approve_plan",
                        title: `Fechou assim? (plano v${updated.version})`,
                      },
                    });
                    void get().syncToCloud();
                  }, 700);
                }
              }
            }
          } else if (a.type === "set_schedule") {
            const p = get().profile;
            if (p) {
              set({
                profile: {
                  ...p,
                  trainTime: a.trainTime ?? p.trainTime,
                  wantsReminders: a.wantsReminders ?? p.wantsReminders,
                },
              });
              // disse "sim" pro lembrete → pede permissão do browser na hora
              if (a.wantsReminders) {
                void requestReminderPermission().then((status) => {
                  const prof = get().profile;
                  const time = prof?.trainTime ? ` ${prof.trainTime}` : "";
                  if (status === "granted") {
                    get().addMessage({
                      role: "system",
                      content: `🔔 Lembretes ativados —${time} nos dias de treino`,
                    });
                  } else if (status === "denied") {
                    get().addMessage({
                      role: "assistant",
                      content:
                        "Teu navegador bloqueou as notificações. Libera no cadeado da barra de endereço que eu passo a te cutucar no horário.",
                    });
                  }
                  void get().syncToCloud();
                });
              }
            }
          } else if (a.type === "finish_intake") {
            const p = get().profile;
            if (p && !p.intakeCompleted) {
              set({
                profile: { ...p, intakeCompleted: true },
                intakeIndex: get().intakeQueue.length,
              });
              // quadros visuais de aprovação: semana → dieta → leitura técnica
              const prof = get().profile!;
              const plan = get().plan;
              if (plan) {
                setTimeout(() => {
                  get().addMessage({
                    role: "assistant",
                    content: "Bate o olho em como fica tua semana:",
                    rich: buildWeekPlanCard(prof, plan),
                  });
                }, 600);
                setTimeout(() => {
                  get().addMessage({
                    role: "assistant",
                    content: "",
                    rich: buildDietCard(prof, plan),
                  });
                }, 1300);
                setTimeout(() => {
                  get().addMessage({
                    role: "assistant",
                    content:
                      "Se algum dia, horário ou refeição não encaixa na tua real, fala que eu remonto na hora.",
                    rich: buildTechReadCard(prof, plan),
                  });
                }, 2100);
                setTimeout(() => {
                  get().addMessage({
                    role: "assistant",
                    content: "",
                    rich: {
                      type: "approve_plan",
                      title: `Fechou assim? (plano v${plan.version})`,
                    },
                  });
                  void get().syncToCloud();
                }, 2800);
              }
            }
          } else if (a.type === "log_skip") {
            // skip só narrativa por enquanto
          }
        }
        return { navigateToWorkout, rich };
      }

      async function runLlmPipeline(
        tone: UserProfile["tone"],
        fallbackFn?: () => { content: string; rich?: RichCard }
      ): Promise<{ navigateToWorkout?: string }> {
        const rolled = rollDailyCounter(get());
        set(rolled);

        if (get().subscription === "free" && rolled.dailyLlmCount >= FREE_DAILY_LIMIT) {
          reply(
            coachReply(
              tone,
              "",
              "generic",
              `No Free são ${FREE_DAILY_LIMIT} mensagens de IA por dia. Amanhã reseta — ou sobe pro Básico em Eu.`
            ),
            { type: "paywall", title: "Shape Básico", body: "Chat ilimitado + nutri diária", cta: "Ver planos" }
          );
          return {};
        }

        const assistantId = uid();
        set({ typing: true, streamingId: assistantId });
        get().addMessage({
          id: assistantId,
          role: "assistant",
          content: "",
        });

        let acc = "";
        const state = get();
        const result = await streamLlmReply(
          {
            ...state,
            dailyLlmCount: rolled.dailyLlmCount,
            dailyLlmDate: rolled.dailyLlmDate,
          },
          (chunk) => {
            // ignora pedaços do marker
            if (chunk.includes("[[SHAPE_ACTIONS]]")) {
              const part = chunk.split("[[SHAPE_ACTIONS]]")[0];
              if (part) {
                acc += part;
                get().patchMessage(assistantId, { content: acc.replace(/\n\[\[SHAPE_ACTIONS\]\][\s\S]*$/, "") });
              }
              return;
            }
            acc += chunk;
            const clean = acc.split("\n[[SHAPE_ACTIONS]]")[0];
            get().patchMessage(assistantId, { content: clean });
          }
        );

        set({
          typing: false,
          streamingId: null,
          dailyLlmCount: rolled.dailyLlmCount + (result.fallback && !result.text ? 0 : 1),
          dailyLlmDate: rolled.dailyLlmDate ?? todayKey(),
        });

        let navigateToWorkout: string | undefined;
        let rich: RichCard | undefined;

        if (result.actions?.length) {
          const applied = applyActions(result.actions);
          navigateToWorkout = applied.navigateToWorkout;
          rich = applied.rich;
        }

        if (result.text || acc) {
          const finalText = (result.text || acc.split("\n[[SHAPE_ACTIONS]]")[0]).trim();
          get().patchMessage(assistantId, { content: finalText, rich });
        } else if (result.fallback) {
          // fallback custom (ex.: roteiro de intake) ou rule-based genérico
          if (fallbackFn) {
            const fb = fallbackFn();
            get().patchMessage(assistantId, { content: fb.content, rich: fb.rich });
          } else {
            const s = get();
            const content = coachReply(tone, "", "generic");
            const fallbackRich: RichCard | undefined =
              rich ||
              (s.plan && !planDayForDate(s.plan)?.isRest
                ? {
                    type: "workout",
                    title: `Hoje: ${planDayForDate(s.plan)?.label}`,
                    body: "Se for treino, é só mandar bora.",
                    cta: "Iniciar treino",
                  }
                : {
                    type: "meal_check",
                    title: "Check-in de refeição",
                    body: "Já comeu? Me conta o prato.",
                    cta: "Já comi",
                  });
            get().patchMessage(assistantId, { content, rich: fallbackRich });
          }
        }

        void get().syncToCloud();
        return { navigateToWorkout };
      }

      return {
        ...initial,

        setSubscription: (p) => set({ subscription: p }),
        setAuthUserId: (id) => set({ authUserId: id }),

        applyCloudSnapshot: (payload) => {
          const p = payload.profile;
          const queue = p && !p.intakeCompleted ? buildIntakeQueue(p).map((q) => q.key) : [];
          set({
            profile: payload.profile ?? null,
            plan: payload.plan ?? null,
            messages: payload.messages ?? [],
            sessions: payload.sessions ?? [],
            mealLogs: payload.mealLogs ?? [],
            metrics: payload.metrics ?? [],
            subscription: payload.subscription ?? "basic",
            activeWorkoutId: payload.activeWorkoutId ?? null,
            lastOpenDate: payload.lastOpenDate ?? null,
            dailyLlmCount: payload.dailyLlmCount ?? 0,
            dailyLlmDate: payload.dailyLlmDate ?? null,
            intakeQueue: queue,
            intakeIndex: p?.intakeNotes?.length ?? 0,
          });
        },

        syncToCloud: async () => {
          const s = get();
          if (!s.authUserId && !createSupabaseBrowser()) return;
          await pushSnapshot({
            profile: s.profile,
            plan: s.plan,
            messages: s.messages,
            sessions: s.sessions,
            mealLogs: s.mealLogs,
            metrics: s.metrics,
            subscription: s.subscription,
            activeWorkoutId: s.activeWorkoutId,
            lastOpenDate: s.lastOpenDate,
            dailyLlmCount: s.dailyLlmCount,
            dailyLlmDate: s.dailyLlmDate,
          });
        },

        hydrateFromCloud: async () => {
          const snap = await pullSnapshot();
          if (snap?.profile) {
            get().applyCloudSnapshot(snap);
          }
        },

        completeOnboarding: (profile, plan) => {
          const queue = buildIntakeQueue(profile);
          // primeiro contato = UMA intro curta que já termina em pergunta.
          // O cadastro inteiro vira memória (context pack), não fala.
          set({
            profile: {
              ...profile,
              intakeCompleted: false,
              intakeNotes: [],
            },
            plan,
            messages: [msg("assistant", buildIntroMessage(profile))],
            lastOpenDate: todayKey(),
            intakeQueue: queue.map((q) => q.key),
            intakeIndex: 0,
          });
          void get().syncToCloud();
        },

        updatePlan: (plan) => set({ plan }),

        redesignPlan: (instruction) => {
          const { plan, profile } = get();
          if (!plan || !profile) return null;
          // não seta o plano aqui — o caller (applyActions) decide com base
          // em `changed` e adiciona o changeLog antes de persistir
          return patchPlan(plan, instruction, profile);
        },

        addMessage: (m) =>
          set((s) => ({
            messages: [
              ...s.messages,
              {
                id: m.id ?? uid(),
                role: m.role,
                content: m.content,
                rich: m.rich,
                imageDataUrl: m.imageDataUrl,
                createdAt: new Date().toISOString(),
              },
            ],
          })),

        patchMessage: (id, patch) =>
          set((s) => ({
            messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
          })),

        hydrateOpening: () => {
          const s = get();
          if (!s.profile || !s.plan) return;
          const today = todayKey();
          if (s.lastOpenDate === today && s.messages.length > 0) return;

          // intake incompleto: não spamma "JANELA DE TREINO" — retoma dossiê
          if (!s.profile.intakeCompleted) {
            const queue = buildIntakeQueue(s.profile);
            const idx = Math.min(
              s.profile.intakeNotes?.length ?? s.intakeIndex ?? 0,
              queue.length
            );
            const q = queue[idx];
            const name = s.profile.displayName.split(" ")[0] || "campeão";
            const resume = q
              ? [
                  msg(
                    "assistant",
                    coachReply(
                      s.profile.tone,
                      "",
                      "generic",
                      `Bora retomar teu dossiê, ${name}. Ainda falta eu te entender melhor.`
                    )
                  ),
                  msg("assistant", q.ask(s.profile.tone, name)),
                ]
              : [
                  msg(
                    "assistant",
                    intakeClosing(s.profile.tone, s.profile.displayName)
                  ),
                ];
            set({
              messages: [...s.messages, ...resume],
              lastOpenDate: today,
              intakeQueue: queue.map((x) => x.key),
              intakeIndex: idx,
              profile: q
                ? s.profile
                : { ...s.profile, intakeCompleted: true },
            });
            return;
          }

          const day = planDayForDate(s.plan);
          const workoutDoneToday = s.sessions.some(
            (x) =>
              x.date === today &&
              (x.status === "completed" || x.status === "partial")
          );

          // pendências do "personal vivo": feedback > peso 7d > medidas 14d > refeição
          const pendings = computePendings(s);
          const feedbackPending = pendings.find(
            (p) => p.type === "post_workout_feedback"
          );
          const weightPending = pendings.some((p) => p.type === "weight_due");
          const measuresPending = pendings.some((p) => p.type === "measures_due");

          const opening = buildOpening({
            name: s.profile.displayName,
            tone: s.profile.tone,
            hasWorkoutToday: !!day && !day.isRest,
            workoutLabel: day?.label,
            workoutDoneToday,
            missedYesterday: missedYesterday(s.sessions, s.plan, s.profile),
            pendingWeight: weightPending,
            pendingFeedbackLabel:
              feedbackPending?.type === "post_workout_feedback"
                ? feedbackPending.session.label
                : undefined,
            pendingMeasures: !weightPending && measuresPending,
          });

          const cards: ChatMessage[] = [msg("assistant", opening)];
          // se abertura é puxada de feedback, não empilha card de treino junto
          if (!feedbackPending && day && !day.isRest && !workoutDoneToday) {
            cards.push(
              msg("assistant", "Quando quiser, a gente começa:", {
                type: "workout",
                title: `Hoje: ${day.label}`,
                body: `${day.exercises.length} exercícios · ~${day.durationMin} min`,
                cta: "Iniciar treino",
              })
            );
          }

          set({
            messages: [...s.messages, ...cards],
            lastOpenDate: today,
            awaitingFeedbackId:
              feedbackPending?.type === "post_workout_feedback"
                ? feedbackPending.session.id
                : s.awaitingFeedbackId,
          });
        },

        sendUserMessage: async (text) => {
          const trimmed = text.trim();
          if (!trimmed) return {};
          const s0 = get();
          const tone = s0.profile?.tone ?? "brother";
          get().addMessage({ role: "user", content: trimmed });

          const lower = trimmed.toLowerCase();

          // ——— INTAKE (primeiro contato): diálogo real, 1 pergunta por vez ———
          // A resposta do user vira nota do SOUL (dossiê vivo). O LLM conduz;
          // sem LLM, cai no roteiro (uma pergunta por vez, nunca despejo).
          const profile = get().profile;
          if (profile && !profile.intakeCompleted) {
            const queue = buildIntakeQueue(profile);
            const idx = get().intakeIndex;

            // escape: treinar agora / deixar pra depois
            if (
              /\bbora\b|vamos treinar|iniciar treino|pular entrevista|depois a gente fala/.test(
                lower
              )
            ) {
              set({
                profile: { ...profile, intakeCompleted: true },
                intakeIndex: queue.length,
              });
              if (/\bbora\b|vamos treinar|iniciar treino/.test(lower)) {
                const id = get().startWorkout();
                reply(
                  intakeClosing(tone, profile.displayName) +
                    "\n\n" +
                    coachReply(tone, trimmed, "start_workout"),
                  undefined,
                  400
                );
                return { navigateToWorkout: id ?? undefined };
              }
              reply(intakeClosing(tone, profile.displayName), undefined, 400);
              return {};
            }

            // resposta → nota do SOUL (pergunta = última fala da IA)
            const lastAssistant = [...get().messages]
              .reverse()
              .find((m) => m.role === "assistant" && m.content.trim());
            const notes = [
              ...(profile.intakeNotes ?? []),
              {
                key: `soul_${(profile.intakeNotes?.length ?? 0) + 1}`,
                question: (lastAssistant?.content ?? "").slice(0, 200),
                answer: trimmed,
                at: new Date().toISOString(),
                metricLabel: "Dossiê (SOUL)",
              },
            ];
            set({ profile: { ...profile, intakeNotes: notes } });

            // LLM conduz a entrevista (reage + próxima pergunta + finish_intake).
            // Fallback: roteiro escrito, uma pergunta por vez.
            return runLlmPipeline(tone, () => {
              const nextIdx = idx + 1;
              const nextQ = queue[nextIdx];
              if (nextQ) {
                set({ intakeIndex: nextIdx });
                return {
                  content: sayAckThenAsk(
                    tone,
                    trimmed,
                    nextQ.ask(tone, profile.displayName.split(" ")[0] || "campeão")
                  ),
                };
              }
              set({
                profile: { ...get().profile!, intakeCompleted: true },
                intakeIndex: queue.length,
              });
              return {
                content: intakeClosing(tone, profile.displayName),
                rich: {
                  type: "workout",
                  title: "Dossiê fechado",
                  body: "Agora é execução. Pode treinar ou ajustar o plano no chat.",
                  cta: "Iniciar treino",
                },
              };
            });
          }

          // 0) feedback pós-treino: guarda a resposta e deixa o LLM conversar em cima
          const awaitingId = get().awaitingFeedbackId;
          if (
            awaitingId &&
            !/\bbora\b|iniciar treino|^\d/.test(lower)
          ) {
            set((st) => ({
              awaitingFeedbackId: null,
              sessions: st.sessions.map((sess) =>
                sess.id === awaitingId
                  ? { ...sess, feedback: trimmed, feedbackAt: new Date().toISOString() }
                  : sess
              ),
            }));
            // segue pro LLM — histórico tem a pergunta + resposta, ele conversa natural.
            // Fallback sem LLM: ack no tom.
          }

          // 0.5) medidas — "cintura 84, braço 36" etc.
          const measureRe =
            /(cintura|peito|bra[cç]o|coxa)\s*:?\s*(\d{2,3}(?:[.,]\d)?)/g;
          const found = [...lower.matchAll(measureRe)];
          if (found.length >= 1 && !/kg/.test(lower)) {
            const kindMap: Record<string, BodyMetric["kind"]> = {
              cintura: "waist",
              peito: "chest",
              braco: "arm",
              braço: "arm",
              coxa: "thigh",
            };
            const saved: string[] = [];
            for (const m of found) {
              const kind = kindMap[m[1]];
              const value = Number(m[2].replace(",", "."));
              if (kind && value >= 15 && value <= 220) {
                set((st) => ({
                  metrics: [
                    ...st.metrics,
                    { id: uid(), kind, value, measuredAt: new Date().toISOString() },
                  ],
                }));
                saved.push(`${m[1]} ${value}cm`);
              }
            }
            if (saved.length) {
              reply(
                coachReply(
                  tone,
                  trimmed,
                  "generic",
                  `Medidas salvas: ${saved.join(", ")}. Daqui 2 semanas a gente compara — é aí que o shape aparece.`
                )
              );
              void get().syncToCloud();
              return {};
            }
          }

          // 1) peso puro — caminho rápido
          const weightOnly = lower.match(/^\s*(\d{2,3}(?:[.,]\d)?)\s*(?:kg)?\s*$/);
          if (weightOnly) {
            const kg = Number(weightOnly[1].replace(",", "."));
            if (kg >= 30 && kg <= 250) {
              get().logWeight(kg);
              reply(coachReply(tone, trimmed, "weight", String(kg)));
              return {};
            }
          }

          // 2) bora explícito — abre treino na hora (ou segura se já treinou)
          if (
            /\bbora\b|vamos treinar|iniciar treino|come[cç]ar treino|partiu treino|^iniciar$|^treinar$/.test(
              lower
            )
          ) {
            const doneToday = s0.sessions.find(
              (x) =>
                x.date === todayKey() &&
                (x.status === "completed" || x.status === "partial")
            );
            if (doneToday) {
              const nextTime = s0.profile?.trainTime ?? "no horário de sempre";
              reply(
                coachReply(
                  tone,
                  trimmed,
                  "generic",
                  `Treino de hoje (${doneToday.label}) já foi — músculo cresce no DESCANSO. Amanhã ${nextTime} a gente repete a dose. Se treinou outra coisa por fora, me conta que eu registro.`
                )
              );
              return {};
            }
            const id = get().startWorkout();
            reply(coachReply(tone, trimmed, "start_workout"), undefined, 280);
            return { navigateToWorkout: id ?? undefined };
          }

          // 3) paywall vision menção
          if (/foto|imagem|vision/.test(lower) && get().subscription !== "pro") {
            reply(coachReply(tone, trimmed, "paywall_vision"), {
              type: "paywall",
              title: "Shape Pro",
              body: "Foto do prato com análise por IA",
              cta: "Ver planos",
            });
            return {};
          }

          // 4) resto → LLM-first com stream + tools (fallback rule-based)
          return runLlmPipeline(tone);
        },

        sendImageMessage: (dataUrl, caption) => {
          const s = get();
          const tone = s.profile?.tone ?? "brother";
          get().addMessage({
            role: "user",
            content: caption?.trim() || "📷 Foto do prato",
            imageDataUrl: dataUrl,
          });

          if (s.subscription !== "pro") {
            reply(coachReply(tone, caption ?? "", "paywall_vision"), {
              type: "paywall",
              title: "Shape Pro",
              body: "Foto do prato com análise por IA",
              cta: "Ver planos",
            });
            return;
          }

          get().logMeal(
            "foto",
            caption?.trim() || "foto do prato",
            "partial",
            "photo"
          );
          set({ typing: true });
          void (async () => {
            const vision = await tryVisionMeal(dataUrl, get(), caption);
            set({ typing: false });
            if (vision) {
              get().addMessage({ role: "assistant", content: vision });
              void get().syncToCloud();
              return;
            }
            get().addMessage({
              role: "assistant",
              content: coachReply(
                tone,
                caption ?? "",
                "ack_meal",
                caption?.trim()
                  ? `Foto + legenda anotadas. (${caption.trim()}) Configure OPENAI_API_KEY pro Vision completo.`
                  : "Foto salva. Descreve o prato em 1 linha — ou configura Vision no servidor."
              ),
            });
            void get().syncToCloud();
          })();
        },

        startWorkout: () => {
          const { plan, activeWorkoutId, sessions } = get();
          if (activeWorkoutId) return activeWorkoutId;
          if (!plan) return null;
          // já fechou treino hoje → corpo precisa de descanso, não de bis
          const doneToday = sessions.some(
            (s) =>
              s.date === todayKey() &&
              (s.status === "completed" || s.status === "partial")
          );
          if (doneToday) return null;
          const day = planDayForDate(plan);
          if (!day || day.isRest) return null;
          const session: WorkoutSession = {
            id: uid(),
            date: todayKey(),
            label: day.label,
            status: "in_progress",
            startedAt: new Date().toISOString(),
            sets: [],
            skippedExercises: [],
            planDayWeekday: day.weekday,
          };
          set((st) => ({
            sessions: [...st.sessions, session],
            activeWorkoutId: session.id,
          }));
          return session.id;
        },

        completeSet: (setLog) => {
          const { activeWorkoutId } = get();
          if (!activeWorkoutId) return;
          set((st) => ({
            sessions: st.sessions.map((sess) =>
              sess.id === activeWorkoutId
                ? { ...sess, sets: [...sess.sets, setLog] }
                : sess
            ),
          }));
        },

        addWorkoutNote: (text) => {
          const { activeWorkoutId } = get();
          const trimmed = text.trim();
          if (!activeWorkoutId || !trimmed) return;
          set((st) => ({
            sessions: st.sessions.map((sess) =>
              sess.id === activeWorkoutId
                ? {
                    ...sess,
                    notes: [
                      ...(sess.notes ?? []),
                      { text: trimmed.slice(0, 200), at: new Date().toISOString() },
                    ],
                  }
                : sess
            ),
          }));
        },

        skipExercise: (exerciseId) => {
          const { activeWorkoutId } = get();
          if (!activeWorkoutId) return;
          set((st) => ({
            sessions: st.sessions.map((sess) =>
              sess.id === activeWorkoutId
                ? {
                    ...sess,
                    skippedExercises: [...sess.skippedExercises, exerciseId],
                  }
                : sess
            ),
          }));
        },

        finishWorkout: (status = "completed") => {
          const { activeWorkoutId, profile, sessions } = get();
          if (!activeWorkoutId) return;
          const session = sessions.find((x) => x.id === activeWorkoutId);
          set((st) => ({
            activeWorkoutId: null,
            sessions: st.sessions.map((sess) =>
              sess.id === activeWorkoutId
                ? {
                    ...sess,
                    status,
                    endedAt: new Date().toISOString(),
                  }
                : sess
            ),
          }));
          const tone = profile?.tone ?? "brother";
          if (status === "abandoned") {
            get().addMessage({
              role: "assistant",
              content: coachReply(tone, "", "skip", "Treino ficou pra depois. Me chama quando voltar."),
            });
            void get().syncToCloud();
            return;
          }
          const skipped = session?.skippedExercises.length ?? 0;
          const doneSets = session?.sets.filter((x) => x.status === "completed").length ?? 0;
          const extra =
            skipped > 0
              ? `${doneSets} séries · ${skipped} exercício(s) pulado(s).`
              : `${doneSets} séries fechadas.`;
          get().addMessage({
            role: "assistant",
            content: coachReply(tone, "", "workout_done", extra),
          });

          // personal vivo: marca feedback pendente e, se app aberto, puxa assunto em ~25min
          if (doneSets > 0 && session) {
            const sid = session.id;
            set({ awaitingFeedbackId: sid });
            setTimeout(
              () => {
                const st = get();
                if (st.awaitingFeedbackId !== sid || !st.profile) return;
                const name = st.profile.displayName.split(" ")[0] || "campeão";
                const t = st.profile.tone;
                get().addMessage({
                  role: "assistant",
                  content:
                    t === "sargento"
                      ? `${name.toUpperCase()}. RELATÓRIO PÓS-TREINO: COMO O CORPO RESPONDEU? DOR? ENERGIA?`
                      : t === "nutella"
                        ? `${name}, e aí — como você tá se sentindo depois do treino? 💛 Dolorido bom ou cansaço demais?`
                        : t === "low_profile"
                          ? `${name}. Pós-treino: como foi? Alguma dor?`
                          : `E aí ${name}, já baixou a poeira — deu bom o treino? Como o corpo respondeu?`,
                });
                void get().syncToCloud();
              },
              25 * 60 * 1000
            );
          }
          void get().syncToCloud();
        },

        logMeal: (slot, description, adherence, source = "text") => {
          const log: MealLog = {
            id: uid(),
            slot,
            description,
            adherence,
            loggedAt: new Date().toISOString(),
            source,
          };
          set((st) => ({ mealLogs: [...st.mealLogs, log] }));
        },

        logWeight: (kg) => {
          const m: BodyMetric = {
            id: uid(),
            kind: "weight",
            value: kg,
            measuredAt: new Date().toISOString(),
          };
          set((st) => ({ metrics: [...st.metrics, m] }));
        },

        approvePlan: () => {
          const { plan, profile } = get();
          if (!plan || !profile) return;
          const approved: Plan = { ...plan, approvedAt: new Date().toISOString() };
          set({ plan: approved });
          // aprovação fecha o card pendente — some do chat, não fica card morto
          pruneOldPlanCards(["approve_plan"]);
          get().addMessage({ role: "user", content: "Fechou, aprovo ✅" });
          get().addMessage({
            role: "system",
            content: `Plano v${plan.version} aprovado`,
          });
          setTimeout(() => {
            get().addMessage({
              role: "assistant",
              content: "Fica assim, oficialmente:",
              rich: buildWeekPlanCard(profile, approved),
            });
          }, 500);
          setTimeout(() => {
            get().addMessage({
              role: "assistant",
              content: "",
              rich: buildDietCard(profile, approved),
            });
          }, 1100);
          setTimeout(() => {
            get().addMessage({
              role: "assistant",
              content: unlockMessage(profile.tone, profile.displayName),
            });
            void get().syncToCloud();
          }, 1800);
        },

        showPlanCards: (kind) => {
          const { plan, profile } = get();
          if (!plan || !profile) return;
          get().addMessage({
            role: "user",
            content: kind === "week" ? "Ver treino" : "Ver dieta",
          });
          reply(
            "",
            kind === "week" ? buildWeekPlanCard(profile, plan) : buildDietCard(profile, plan),
            350
          );
        },

        updateTone: (tone) => {
          set((st) => (st.profile ? { profile: { ...st.profile, tone } } : {}));
          void get().syncToCloud();
        },

        resetAll: () =>
          set({
            ...initial,
            messages: [],
            sessions: [],
            mealLogs: [],
            metrics: [],
          }),

        signOut: async () => {
          const supabase = createSupabaseBrowser();
          if (supabase) {
            await supabase.auth.signOut().catch(() => {});
          }
          set({
            ...initial,
            messages: [],
            sessions: [],
            mealLogs: [],
            metrics: [],
          });
        },
      };
    },
    {
      name: "shape-ai-v1",
      partialize: (s) => ({
        profile: s.profile,
        plan: s.plan,
        messages: s.messages.slice(-200).map((m, i, arr) =>
          m.imageDataUrl && i < arr.length - 10 ? { ...m, imageDataUrl: undefined } : m
        ),
        sessions: s.sessions.slice(-120),
        mealLogs: s.mealLogs.slice(-300),
        metrics: s.metrics.slice(-200),
        subscription: s.subscription,
        activeWorkoutId: s.activeWorkoutId,
        lastOpenDate: s.lastOpenDate,
        dailyLlmCount: s.dailyLlmCount,
        dailyLlmDate: s.dailyLlmDate,
        authUserId: s.authUserId,
        intakeQueue: s.intakeQueue,
        intakeIndex: s.intakeIndex,
        awaitingFeedbackId: s.awaitingFeedbackId,
      }),
    }
  )
);

export function generatePlanFromProfile(profile: UserProfile) {
  return generatePlan(profile);
}

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generatePlan, patchPlan, planDayForDate } from "@/lib/plan-generator";
import type {
  AppState,
  BodyMetric,
  ChatMessage,
  MealLog,
  Plan,
  RichCard,
  SubscriptionPlan,
  UserProfile,
  WorkoutSession,
  WorkoutSetLog,
} from "@/lib/types";
import { buildOpening, coachReply } from "@/lib/tone";
import { tryLlmReply } from "@/lib/llm-client";
import { tryVisionMeal } from "@/lib/vision-client";
import { dayKey, todayKey, weekdayOfKey } from "@/lib/utils";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

function uid() {
  return crypto.randomUUID();
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
  redesignPlan: (instruction: string) => Plan | null;
  addMessage: (m: Omit<ChatMessage, "id" | "createdAt"> & { id?: string }) => void;
  sendUserMessage: (text: string) => { navigateToWorkout?: string };
  sendImageMessage: (dataUrl: string, caption?: string) => void;
  startWorkout: () => string | null;
  completeSet: (set: WorkoutSetLog) => void;
  skipExercise: (exerciseId: string) => void;
  finishWorkout: (status?: WorkoutSession["status"]) => void;
  logMeal: (
    slot: string,
    description: string,
    adherence: MealLog["adherence"],
    source?: MealLog["source"]
  ) => void;
  logWeight: (kg: number) => void;
  resetAll: () => void;
  signOut: () => Promise<void>;
  updateTone: (tone: UserProfile["tone"]) => void;
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
};

function missedYesterday(
  sessions: WorkoutSession[],
  plan: Plan | null,
  profile: UserProfile | null
) {
  if (!plan || !profile) return false;
  const yKey = dayKey(-1);
  // não cobra falta anterior ao cadastro (usuário novo não "furou ontem")
  if (yKey < profile.createdAt.slice(0, 10)) return false;
  const day = plan.workoutDays.find((d) => d.weekday === weekdayOfKey(yKey));
  if (!day || day.isRest) return false;
  return !sessions.some(
    (s) => s.date === yKey && (s.status === "completed" || s.status === "partial")
  );
}

export const useAppStore = create<AppState & Actions>()(
  persist(
    (set, get) => {
      /** Resposta da IA com delay humano + indicador "digitando" */
      function reply(content: string, rich?: RichCard, delayMs?: number) {
        const delay = delayMs ?? 550 + Math.random() * 500;
        set({ typing: true });
        setTimeout(() => {
          set({ typing: false });
          get().addMessage({ role: "assistant", content, rich });
        }, delay);
      }

      return {
        ...initial,

        setSubscription: (p) => set({ subscription: p }),

        completeOnboarding: (profile, plan) => {
          const opening = buildOpening({
            name: profile.displayName,
            tone: profile.tone,
            hasWorkoutToday: !planDayForDate(plan)?.isRest,
            workoutLabel: planDayForDate(plan)?.label,
            workoutDoneToday: false,
            missedYesterday: false,
            pendingWeight: true,
          });
          set({
            profile,
            plan,
            messages: [
              msg("assistant", opening, {
                type: "plan_summary",
                title: "Plano ativo",
                body: `${plan.workoutDays.filter((d) => !d.isRest).length} dias de treino · ${plan.nutrition.kcal} kcal`,
                cta: "Ver no perfil",
              }),
            ],
            lastOpenDate: todayKey(),
          });
        },

        updatePlan: (plan) => set({ plan }),

        redesignPlan: (instruction) => {
          const { plan, profile } = get();
          if (!plan || !profile) return null;
          const next = patchPlan(plan, instruction, profile);
          set({ plan: next });
          return next;
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

        hydrateOpening: () => {
          const s = get();
          if (!s.profile || !s.plan) return;
          const today = todayKey();
          if (s.lastOpenDate === today && s.messages.length > 0) return;

          const day = planDayForDate(s.plan);
          const workoutDoneToday = s.sessions.some(
            (x) => x.date === today && x.status === "completed"
          );
          const lastWeight = s.metrics
            .filter((m) => m.kind === "weight")
            .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0];
          const pendingWeight =
            !lastWeight ||
            Date.now() - new Date(lastWeight.measuredAt).getTime() >
              6 * 24 * 3600 * 1000;

          const opening = buildOpening({
            name: s.profile.displayName,
            tone: s.profile.tone,
            hasWorkoutToday: !!day && !day.isRest,
            workoutLabel: day?.label,
            workoutDoneToday,
            missedYesterday: missedYesterday(s.sessions, s.plan, s.profile),
            pendingWeight,
          });

          const cards: ChatMessage[] = [msg("assistant", opening)];
          if (day && !day.isRest && !workoutDoneToday) {
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
          });
        },

        sendUserMessage: (text) => {
          const trimmed = text.trim();
          if (!trimmed) return {};
          const s = get();
          const tone = s.profile?.tone ?? "brother";
          get().addMessage({ role: "user", content: trimmed });

          const lower = trimmed.toLowerCase();
          let navigateToWorkout: string | undefined;

          // 1) peso — só se a mensagem for APENAS um número (+kg opcional).
          //    Evita logar "fiz 100kg no leg press" como peso corporal.
          const weightOnly = lower.match(/^\s*(\d{2,3}(?:[.,]\d)?)\s*(?:kg)?\s*$/);
          if (weightOnly) {
            const kg = Number(weightOnly[1].replace(",", "."));
            if (kg >= 30 && kg <= 250) {
              get().logWeight(kg);
              reply(coachReply(tone, trimmed, "weight", String(kg)));
              return {};
            }
          }

          // 2) redesign — ANTES do intent de treino ("ajusta o treino" é redesign, não start)
          if (
            /sem ricota|sou pobre|barato|orçamento|orcamento|sem agach|odeio|troca (o|a)|enjoei|não posso|nao posso|muda (o plano|o treino|a dieta)|ajusta|redesenha/.test(
              lower
            )
          ) {
            const next = get().redesignPlan(trimmed);
            reply(
              coachReply(
                tone,
                trimmed,
                "generic",
                next
                  ? `Redesenhei o plano (v${next.version}). Olha se fechou — se não, a gente itera de novo.`
                  : "Não consegui ajustar agora."
              ),
              next
                ? {
                    type: "plan_summary",
                    title: `Plano v${next.version}`,
                    body: `${next.nutrition.kcal} kcal · proteína ${next.nutrition.proteinG}g`,
                  }
                : undefined
            );
            return {};
          }

          // 3) skip
          if (/pulei|não vou treinar|nao vou treinar|hoje não|hoje nao|\bskip\b|desisto/.test(lower)) {
            reply(coachReply(tone, trimmed, "skip", "Amanhã a gente retoma sem drama."));
            return {};
          }

          // 4) foto / vision paywall (menção por texto)
          if (/foto|imagem/.test(lower) && s.subscription !== "pro") {
            reply(coachReply(tone, trimmed, "paywall_vision"), {
              type: "paywall",
              title: "Shape Pro",
              body: "Foto do prato com análise por IA",
              cta: "Ver planos",
            });
            return {};
          }

          // 5) refeição
          if (/almocei|jantei|comi|café|cafe da|já comi|ja comi/.test(lower)) {
            const slot = /jant/.test(lower) ? "janta" : /caf[eé]/.test(lower) ? "cafe" : "almoco";
            get().logMeal(slot, trimmed, "partial");
            reply(
              coachReply(
                tone,
                trimmed,
                "ack_meal",
                "Se quiser ser mais preciso, manda o prato em uma linha."
              )
            );
            return {};
          }

          // 6) iniciar treino — só comando explícito ("que treino é hoje?" não inicia)
          if (
            /\bbora\b|vamos treinar|iniciar treino|come[cç]ar treino|partiu treino|^iniciar$|^treinar$/.test(
              lower
            )
          ) {
            const id = get().startWorkout();
            reply(coachReply(tone, trimmed, "start_workout"), undefined, 350);
            if (id) navigateToWorkout = id;
            return { navigateToWorkout };
          }

          // 7) saudação curta — resposta no tom, não menu frio
          if (
            /^(oi+|ol[aá]|opa|salve|eae|ea[ií]|e a[ií]|bom dia|boa tarde|boa noite|fala)\b/.test(lower) &&
            lower.length < 24
          ) {
            const day = s.plan ? planDayForDate(s.plan) : null;
            const dayNote = day
              ? day.isRest
                ? "Hoje é descanso."
                : `Hoje tem ${day.label}.`
              : "";
            // com LLM configurado, deixa ele responder; senão greeting no tom
            set({ typing: true });
            void (async () => {
              const llm = await tryLlmReply(trimmed, s);
              set({ typing: false });
              get().addMessage({
                role: "assistant",
                content: llm ?? coachReply(tone, trimmed, "greeting", dayNote),
              });
            })();
            return {};
          }

          // 8) como estou
          if (/como estou|evolução|evolucao|progresso|resumo/.test(lower)) {
            const sessions = s.sessions.filter((x) => x.status === "completed").length;
            const lastW = s.metrics[s.metrics.length - 1];
            reply(
              coachReply(
                tone,
                trimmed,
                "generic",
                `Resumo: ${sessions} treino(s) logado(s). ${
                  lastW ? `Último peso ${lastW.value} kg.` : "Ainda sem peso registrado."
                } Abre a aba Evolução pro gráfico.`
              ),
              {
                type: "insight",
                title: "Seu pulso",
                body: `${sessions} treinos · ${s.mealLogs.length} refeições logadas`,
              }
            );
            return {};
          }

          // fallback: tenta LLM real; sem key/erro → rule-based com card contextual
          set({ typing: true });
          void (async () => {
            const llm = await tryLlmReply(trimmed, s);
            set({ typing: false });
            if (llm) {
              get().addMessage({ role: "assistant", content: llm });
              return;
            }
            get().addMessage({
              role: "assistant",
              content: coachReply(tone, trimmed, "generic"),
              rich:
                s.plan && !planDayForDate(s.plan)?.isRest
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
                    },
            });
          })();
          return { navigateToWorkout };
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
              return;
            }
            // sem key LLM: resposta demo no tom (ainda registra a foto)
            get().addMessage({
              role: "assistant",
              content: coachReply(
                tone,
                caption ?? "",
                "ack_meal",
                caption?.trim()
                  ? `Foto + legenda anotadas. (${caption.trim()}) Pra análise visual de verdade, configura OPENAI_API_KEY no servidor.`
                  : "Foto salva. Me manda em texto o que tem no prato (arroz, frango…) que eu julgo — ou configura Vision no servidor."
              ),
            });
          })();
        },

        startWorkout: () => {
          const { plan, activeWorkoutId } = get();
          if (activeWorkoutId) return activeWorkoutId;
          if (!plan) return null;
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
          set((s) => ({
            sessions: [...s.sessions, session],
            activeWorkoutId: session.id,
          }));
          return session.id;
        },

        completeSet: (setLog) => {
          const { activeWorkoutId } = get();
          if (!activeWorkoutId) return;
          set((s) => ({
            sessions: s.sessions.map((sess) =>
              sess.id === activeWorkoutId
                ? { ...sess, sets: [...sess.sets, setLog] }
                : sess
            ),
          }));
        },

        skipExercise: (exerciseId) => {
          const { activeWorkoutId } = get();
          if (!activeWorkoutId) return;
          set((s) => ({
            sessions: s.sessions.map((sess) =>
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
          set((s) => ({
            activeWorkoutId: null,
            sessions: s.sessions.map((sess) =>
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
          set((s) => ({ mealLogs: [...s.mealLogs, log] }));
        },

        logWeight: (kg) => {
          const m: BodyMetric = {
            id: uid(),
            kind: "weight",
            value: kg,
            measuredAt: new Date().toISOString(),
          };
          set((s) => ({ metrics: [...s.metrics, m] }));
        },

        updateTone: (tone) => {
          set((s) => (s.profile ? { profile: { ...s.profile, tone } } : {}));
        },

        resetAll: () =>
          set({ ...initial, messages: [], sessions: [], mealLogs: [], metrics: [] }),

        signOut: async () => {
          const supabase = createSupabaseBrowser();
          if (supabase) {
            await supabase.auth.signOut().catch(() => {});
          }
          set({ ...initial, messages: [], sessions: [], mealLogs: [], metrics: [] });
        },
      };
    },
    {
      name: "shape-ai-v1",
      partialize: (s) => ({
        profile: s.profile,
        plan: s.plan,
        // cap: não deixa o localStorage crescer sem limite; imagem só nas 10 últimas
        messages: s.messages.slice(-200).map((m, i, arr) =>
          m.imageDataUrl && i < arr.length - 10 ? { ...m, imageDataUrl: undefined } : m
        ),
        sessions: s.sessions.slice(-120),
        mealLogs: s.mealLogs.slice(-300),
        metrics: s.metrics.slice(-200),
        subscription: s.subscription,
        activeWorkoutId: s.activeWorkoutId,
        lastOpenDate: s.lastOpenDate,
      }),
    }
  )
);

export function generatePlanFromProfile(profile: UserProfile) {
  return generatePlan(profile);
}

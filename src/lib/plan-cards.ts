import type { MealLog, Plan, RichCard, UserProfile, WorkoutSession } from "@/lib/types";
import { WEEKDAY_LABELS } from "@/lib/plan-generator";
import { getExercise } from "@/data/exercises";
import { dayKey, weekdayOfKey } from "@/lib/utils";

export type WeekPlanPayload = {
  rows: {
    weekday: number;
    day: string;
    label: string;
    time?: string;
    durationMin: number;
    exercises: number;
  }[];
  restDays: string;
};

export type DietPlanPayload = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  meals: { slot: string; title: string; options: string[] }[];
  preWorkout: string;
  postWorkout: string;
};

export type TechReadPayload = {
  imc: number;
  imcLabel: string;
  tdee: number;
  targetKcal: number;
  proteinG: number;
  goalNote: string;
};

/** Quadro visual da semana de treino (aprovação pós-dossiê) */
export function buildWeekPlanCard(profile: UserProfile, plan: Plan): RichCard {
  const training = plan.workoutDays.filter((d) => !d.isRest);
  const rest = plan.workoutDays.filter((d) => d.isRest);
  const payload: WeekPlanPayload = {
    rows: training.map((d) => ({
      weekday: d.weekday,
      day: WEEKDAY_LABELS[d.weekday],
      label: d.label,
      time: profile.trainTime,
      durationMin: d.durationMin,
      exercises: d.exercises.length,
    })),
    restDays: rest.map((d) => WEEKDAY_LABELS[d.weekday]).join(" · "),
  };
  return {
    type: "week_plan",
    title: `Tua semana · ${training.length} treinos`,
    payload,
  };
}

/** Quadro visual da base alimentar */
export function buildDietCard(profile: UserProfile, plan: Plan): RichCard {
  const n = plan.nutrition;
  const cheap = profile.budgetFood === "apertado";
  const payload: DietPlanPayload = {
    kcal: n.kcal,
    proteinG: n.proteinG,
    carbsG: n.carbsG,
    fatG: n.fatG,
    meals: n.meals.map((m) => ({
      slot: m.slot,
      title: m.title,
      options: m.items,
    })),
    preWorkout:
      profile.trainTime && profile.trainTime < "09"
        ? cheap
          ? "Banana + café 20–30min antes (leve, treino cedo)"
          : "Banana + café ou iogurte 20–30min antes"
        : cheap
          ? "Fruta + café ~40min antes"
          : "Fruta + café, ou lanche do plano ~40min antes",
    postWorkout:
      profile.goal === "hipertrofia"
        ? "Refeição com proteína até ~1h depois (café reforçado / almoço)"
        : "Próxima refeição do plano normal — proteína presente",
  };
  return {
    type: "diet_plan",
    title: `Base alimentar · ~${n.kcal} kcal/dia`,
    payload,
  };
}

export type DayWorkoutPayload = {
  status: "rest" | "done" | "pending";
  weekday: number;
  dayLabel: string;
  label: string;
  time?: string;
  durationMin: number;
  exercises: { exerciseId: string; name: string; sets: number; reps: string }[];
  doneSummary?: { sets: number; volumeKg: number; minutes: number };
};

/** Card acionável do TREINO DE HOJE — distinto do resumo da semana. */
export function buildDayWorkoutCard(
  profile: UserProfile,
  plan: Plan,
  sessions: WorkoutSession[]
): RichCard {
  const today = dayKey(0);
  const wd = weekdayOfKey(today);
  const day = plan.workoutDays.find((d) => d.weekday === wd);
  const dayLabel = WEEKDAY_LABELS[wd];

  if (!day || day.isRest) {
    const payload: DayWorkoutPayload = {
      status: "rest",
      weekday: wd,
      dayLabel,
      label: "Descanso",
      durationMin: 0,
      exercises: [],
    };
    return { type: "day_workout", title: `Hoje · ${dayLabel}`, payload };
  }

  const doneSession = sessions.find(
    (s) => s.date === today && (s.status === "completed" || s.status === "partial")
  );
  if (doneSession) {
    const doneSets = doneSession.sets.filter((x) => x.status === "completed");
    const volumeKg = doneSets.reduce((acc, x) => acc + x.reps * x.weightKg, 0);
    const minutes = doneSession.endedAt
      ? Math.round(
          (new Date(doneSession.endedAt).getTime() -
            new Date(doneSession.startedAt).getTime()) /
            60000
        )
      : 0;
    const payload: DayWorkoutPayload = {
      status: "done",
      weekday: wd,
      dayLabel,
      label: day.label,
      time: profile.trainTime,
      durationMin: day.durationMin,
      exercises: [],
      doneSummary: { sets: doneSets.length, volumeKg, minutes },
    };
    return { type: "day_workout", title: `Hoje · ${dayLabel}`, payload };
  }

  const payload: DayWorkoutPayload = {
    status: "pending",
    weekday: wd,
    dayLabel,
    label: day.label,
    time: profile.trainTime,
    durationMin: day.durationMin,
    exercises: day.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      name: getExercise(e.exerciseId)?.namePt ?? e.exerciseId,
      sets: e.sets,
      reps: e.reps,
    })),
  };
  return { type: "day_workout", title: `Hoje · ${dayLabel}`, payload };
}

export type DayMealPayload = {
  slot: string;
  slotLabel: string;
  options: string[];
  loggedAlready: boolean;
};

const SLOT_LABELS: Record<string, string> = {
  cafe: "Café da manhã",
  almoco: "Almoço",
  lanche: "Lanche",
  janta: "Janta",
};

/** Slot de refeição relevante AGORA, pela hora do dia */
function currentMealSlot(hour: number): string {
  if (hour < 10) return "cafe";
  if (hour < 15) return "almoco";
  if (hour < 19) return "lanche";
  return "janta";
}

/** Card acionável da REFEIÇÃO DE AGORA — distinto do resumo semanal da dieta. */
export function buildDayMealCard(
  profile: UserProfile,
  plan: Plan,
  mealLogs: MealLog[]
): RichCard {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    }).format(new Date())
  );
  const slot = currentMealSlot(hour);
  const meal = plan.nutrition.meals.find((m) => m.slot === slot);
  const today = dayKey(0);
  const loggedAlready = mealLogs.some(
    (l) => l.slot === slot && l.loggedAt.startsWith(today)
  );

  const payload: DayMealPayload = {
    slot,
    slotLabel: meal?.title ?? SLOT_LABELS[slot] ?? slot,
    options: meal?.items ?? [],
    loggedAlready,
  };
  return {
    type: "day_meal",
    title: `Hoje · ${payload.slotLabel}`,
    payload,
  };
}

/** Leitura técnica de largada: IMC, TDEE, alvo */
export function buildTechReadCard(profile: UserProfile, plan: Plan): RichCard {
  const h = profile.heightCm / 100;
  const imc = profile.weightKg / (h * h);
  const imcLabel =
    imc < 18.5
      ? "abaixo do peso"
      : imc < 25
        ? "faixa saudável"
        : imc < 30
          ? "sobrepeso"
          : "obesidade";
  const bmr =
    10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + 5;
  const tdee = Math.round(bmr * 1.45);
  const goalNote =
    profile.goal === "hipertrofia"
      ? `superávit leve: alvo ${plan.nutrition.kcal} kcal (+${plan.nutrition.kcal - tdee})`
      : profile.goal === "emagrecimento"
        ? `déficit controlado: alvo ${plan.nutrition.kcal} kcal (${plan.nutrition.kcal - tdee})`
        : `manutenção ajustada: alvo ${plan.nutrition.kcal} kcal`;
  const payload: TechReadPayload = {
    imc: Math.round(imc * 10) / 10,
    imcLabel,
    tdee,
    targetKcal: plan.nutrition.kcal,
    proteinG: plan.nutrition.proteinG,
    goalNote,
  };
  return {
    type: "tech_read",
    title: "Leitura técnica de largada",
    payload,
  };
}

import type { Plan, RichCard, UserProfile } from "@/lib/types";
import { WEEKDAY_LABELS } from "@/lib/plan-generator";

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

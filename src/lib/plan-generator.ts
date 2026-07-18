import { exercisesForEquipment, getExercise } from "@/data/exercises";
import type {
  Equipment,
  ExperienceLevel,
  Goal,
  NutritionPlan,
  Plan,
  PlanDay,
  PlanExercise,
  UserProfile,
} from "@/lib/types";

function pickExercises(
  muscles: string[],
  equipment: Equipment[],
  experience: ExperienceLevel
): PlanExercise[] {
  const sets = experience === "iniciante" ? 3 : experience === "avancado" ? 4 : 3;
  const reps =
    experience === "iniciante" ? "10-12" : experience === "avancado" ? "6-10" : "8-12";

  const result: PlanExercise[] = [];
  for (const m of muscles) {
    const list = exercisesForEquipment(equipment, m);
    if (!list.length) continue;
    const ex = list[result.length % list.length];
    result.push({
      exerciseId: ex.id,
      sets: m === "core" ? 3 : sets,
      reps: m === "core" ? "30-45s" : reps,
      restSec: ex.defaultRestSec,
      suggestedWeightKg:
        experience === "iniciante" ? undefined : m === "pernas" || m === "peito" ? 40 : 12,
    });
  }
  // always add core if missing
  if (!result.some((r) => getExercise(r.exerciseId)?.muscleGroup === "core")) {
    const core = exercisesForEquipment(equipment, "core")[0];
    if (core) {
      result.push({
        exerciseId: core.id,
        sets: 3,
        reps: "30-45s",
        restSec: core.defaultRestSec,
      });
    }
  }
  return result.slice(0, 6);
}

const SPLITS: Record<string, { label: string; muscles: string[] }[]> = {
  2: [
    { label: "Full body A", muscles: ["peito", "costas", "pernas", "ombros", "core"] },
    { label: "Full body B", muscles: ["pernas", "costas", "peito", "biceps", "core"] },
  ],
  3: [
    { label: "Push", muscles: ["peito", "ombros", "triceps", "core"] },
    { label: "Pull", muscles: ["costas", "biceps", "core"] },
    { label: "Legs", muscles: ["pernas", "posterior", "gluteo", "panturrilha", "core"] },
  ],
  4: [
    { label: "Peito + tríceps", muscles: ["peito", "triceps", "ombros", "core"] },
    { label: "Costas + bíceps", muscles: ["costas", "biceps", "core"] },
    { label: "Perna", muscles: ["pernas", "posterior", "panturrilha", "core"] },
    { label: "Ombro + braço", muscles: ["ombros", "biceps", "triceps", "core"] },
  ],
  5: [
    { label: "Peito", muscles: ["peito", "triceps", "core"] },
    { label: "Costas", muscles: ["costas", "biceps", "core"] },
    { label: "Perna", muscles: ["pernas", "posterior", "panturrilha"] },
    { label: "Ombros", muscles: ["ombros", "triceps", "core"] },
    { label: "Upper (reforço)", muscles: ["costas", "peito", "biceps", "core"] },
  ],
  6: [
    { label: "Push", muscles: ["peito", "ombros", "triceps"] },
    { label: "Pull", muscles: ["costas", "biceps"] },
    { label: "Legs", muscles: ["pernas", "posterior", "panturrilha"] },
    { label: "Push 2", muscles: ["peito", "ombros", "triceps", "core"] },
    { label: "Pull 2", muscles: ["costas", "biceps", "core"] },
    { label: "Legs 2", muscles: ["pernas", "gluteo", "core"] },
  ],
};

function goalCalories(profile: Pick<UserProfile, "weightKg" | "heightCm" | "age" | "goal">) {
  // Mifflin rough male default (MVP)
  const bmr = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + 5;
  const tdee = bmr * 1.45;
  switch (profile.goal) {
    case "emagrecimento":
      return Math.round(tdee - 400);
    case "hipertrofia":
      return Math.round(tdee + 250);
    case "definicao":
      return Math.round(tdee - 200);
    default:
      return Math.round(tdee);
  }
}

function buildNutrition(
  profile: Pick<
    UserProfile,
    "weightKg" | "heightCm" | "age" | "goal" | "budgetFood" | "dietRestrictions" | "cooksAtHome"
  >
): NutritionPlan {
  const kcal = goalCalories(profile);
  const proteinG = Math.round(profile.weightKg * (profile.goal === "hipertrofia" ? 2.0 : 1.8));
  const fatG = Math.round((kcal * 0.25) / 9);
  const carbsG = Math.round((kcal - proteinG * 4 - fatG * 9) / 4);

  const cheap = profile.budgetFood === "apertado";
  const noLactose = profile.dietRestrictions.some((r) =>
    /lactose|leite/i.test(r)
  );

  // porções em gramas escaladas pelo alvo calórico (base ~2800 kcal)
  const f = Math.min(1.4, Math.max(0.7, kcal / 2800));
  const g = (base: number) => `${Math.round((base * f) / 5) * 5}g`;

  // 2-3 opções por refeição — usuário alterna, não come igual todo dia
  const breakfastOptions = noLactose
    ? [
        `Ovos mexidos (3) + pão (${g(50)})`,
        `Tapioca (${g(60)}) + ovo (2) + café`,
        `Banana (1) + pasta de amendoim (${g(20)}) + café`,
      ]
    : cheap
      ? [
          `Ovos (2) + aveia (${g(40)}) com leite`,
          `Pão francês (1) + ovo (2) + café`,
          `Vitamina: banana + aveia (${g(40)}) + leite`,
        ]
      : [
          `Iogurte grego (${g(170)}) + aveia (${g(40)}) + banana`,
          `Ovos mexidos (3) + pão (${g(50)}) + fruta`,
          `Tapioca (${g(60)}) + ovo (2) + café`,
        ];

  const lunchOptions = cheap
    ? [
        `Arroz (${g(150)}), feijão (${g(100)}), frango desfiado (${g(120)}), salada`,
        `Arroz (${g(150)}), feijão (${g(100)}), ovos (3), legumes`,
        `Macarrão (${g(120)}) + atum (1 lata) + salada`,
      ]
    : [
        `Arroz (${g(150)}), feijão (${g(100)}), patinho ou frango (${g(150)}), legumes`,
        `Arroz (${g(150)}), feijão (${g(100)}), peixe grelhado (${g(170)}), salada`,
        `Arroz (${g(150)}), frango desfiado (${g(150)}), batata (${g(120)}), legumes`,
      ];

  const dinnerOptions = cheap
    ? [
        `Batata doce (${g(200)}) ou arroz + ovos (2-3)/atum + salada`,
        `Sopa de legumes + frango desfiado (${g(120)})`,
        `Cuscuz (${g(100)}) + ovo (2) + queijo (se rolar)`,
      ]
    : [
        `Macarrão integral (${g(120)}) + frango (${g(150)}) + legumes`,
        `Omelete (3 ovos) + arroz (${g(100)}) + salada`,
        `Peixe (${g(170)}) + batata (${g(150)}) + legumes`,
      ];

  const snackOptions = noLactose
    ? [`Banana + pasta de amendoim (${g(20)}) + café`, `Mix de castanhas (${g(30)}) + fruta`]
    : cheap
      ? [`Pão (1) com ovo (2)`, `Iogurte (1) + banana`, `Fruta + café`]
      : [`Whey (30g) + fruta`, `Iogurte grego (${g(170)}) + granola (${g(30)})`, `Sanduíche natural`];

  const meals = [
    {
      slot: "cafe",
      title: "Café da manhã",
      items: breakfastOptions,
      swaps: cheap
        ? ["Sem ovo → atum enlatado", "Sem aveia → pão francês + ovo"]
        : ["Sem iogurte → cottage ou ovos"],
    },
    {
      slot: "almoco",
      title: "Almoço",
      items: lunchOptions,
      swaps: [
        "Sem frango → ovo, atum ou lentilha + ovo",
        "Acabou a proteína → peixe, carne moída ou ovos na mesma medida",
      ],
    },
    {
      slot: "lanche",
      title: "Lanche",
      items: snackOptions,
      swaps: ["Fora de casa → sanduíche natural ou marmita"],
    },
    {
      slot: "janta",
      title: "Janta",
      items: dinnerOptions,
      swaps: cheap
        ? ["Delivery → monta prato com arroz + proteína + salada"]
        : ["Restaurante → prioriza grelhado + salada + arroz"],
    },
  ];

  const groceryList = cheap
    ? [
        "Ovos (2 dúzias)",
        "Frango (1–2 kg)",
        "Arroz",
        "Feijão",
        "Banana",
        "Aveia",
        "Pão",
        "Atum enlatado",
        "Salada (alface/tomate)",
        "Batata ou batata doce",
        "Pasta de amendoim",
      ]
    : [
        "Frango / patinho",
        "Ovos",
        "Arroz",
        "Feijão",
        "Iogurte grego",
        "Aveia",
        "Banana / frutas",
        "Legumes da estação",
        "Azeite",
        "Whey (opcional)",
      ];

  const notes = [
    profile.goal === "hipertrofia"
      ? "Foco em bater proteína todo dia. Se não ganhar peso em 2 semanas, sobe ~150 kcal."
      : profile.goal === "emagrecimento"
        ? "Déficit leve. Não corta carb totalmente nos dias de treino."
        : "Consistência > perfeição. 80% no plano já muda o jogo.",
    cheap
      ? "Montado pro bolso: mercado BR, sem firula de influencer."
      : "Ajustamos se enjoar — é só falar no chat.",
    !profile.cooksAtHome
      ? "Como você come fora, as trocas no restaurante importam mais que receita gourmet."
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { kcal, proteinG, carbsG, fatG, meals, groceryList, notes };
}

export function generatePlan(profile: UserProfile): Plan {
  const nDays = Math.min(6, Math.max(2, profile.trainDays.length || 3));
  const splitKey = String(
    nDays >= 6 ? 6 : nDays === 5 ? 5 : nDays === 4 ? 4 : nDays === 2 ? 2 : 3
  );
  const templates = SPLITS[splitKey];

  const trainWeekdays = [...profile.trainDays].sort((a, b) => a - b);
  // fill if empty
  const days =
    trainWeekdays.length >= 2
      ? trainWeekdays.slice(0, templates.length)
      : [1, 3, 5].slice(0, templates.length);

  const workoutDays: PlanDay[] = [];
  for (let wd = 0; wd < 7; wd++) {
    const idx = days.indexOf(wd);
    if (idx === -1) {
      workoutDays.push({
        weekday: wd,
        label: "Descanso",
        durationMin: 0,
        exercises: [],
        isRest: true,
      });
      continue;
    }
    const t = templates[idx % templates.length];
    workoutDays.push({
      weekday: wd,
      label: t.label,
      durationMin: profile.trainDurationMin,
      exercises: pickExercises(t.muscles, profile.equipment, profile.experience),
      isRest: false,
    });
  }

  return {
    id: crypto.randomUUID(),
    version: 1,
    workoutDays,
    nutrition: buildNutrition(profile),
    createdAt: new Date().toISOString(),
    source: "ai",
  };
}

/** Redesign simples por instrução do usuário */
export function patchPlan(plan: Plan, instruction: string, profile: UserProfile): Plan {
  const lower = instruction.toLowerCase();
  const next = structuredClone(plan);
  next.version += 1;
  next.createdAt = new Date().toISOString();
  next.source = "user";

  if (/ricota|whey|caro|pobre|barato|orçamento|apertado/.test(lower)) {
    next.nutrition = buildNutrition({ ...profile, budgetFood: "apertado" });
    next.nutrition.notes +=
      " Ajuste: priorizamos opções baratas e removemos itens caros que você citou.";
  }

  if (/sem agachamento|odeio agach|joelho/.test(lower)) {
    for (const day of next.workoutDays) {
      day.exercises = day.exercises.map((ex) => {
        if (ex.exerciseId.includes("squat")) {
          return {
            ...ex,
            exerciseId: profile.equipment.includes("academia")
              ? "leg-press"
              : "lunges",
            notes: "Substituído a pedido (joelho/preferência).",
          };
        }
        return ex;
      });
    }
  }

  if (/sem sexta|n[aã]o posso .*sexta|n[aã]o (treino|vou) .*sexta|tira .*sexta/.test(lower)) {
    const friday = next.workoutDays.find((d) => d.weekday === 5);
    if (friday && !friday.isRest) {
      // move pro primeiro dia de descanso disponível (sáb → dom → qui...), sem sobrescrever treino existente
      const candidates = [6, 0, 4, 3, 2, 1];
      const target = next.workoutDays.find(
        (d) => candidates.includes(d.weekday) && d.isRest
      );
      if (target) {
        target.label = friday.label;
        target.exercises = friday.exercises;
        target.durationMin = friday.durationMin;
        target.isRest = false;
        friday.isRest = true;
        friday.label = "Descanso";
        friday.exercises = [];
        friday.durationMin = 0;
      }
    }
  }

  if (/jantar|janta/.test(lower) && /troca|enjo|muda|outro/.test(lower)) {
    const janta = next.nutrition.meals.find((m) => m.slot === "janta");
    if (janta) {
      janta.items = ["Omelete com legumes + arroz ou batata", "Sopa de lentilha + pão"];
      janta.swaps = ["Cansado → sanduíche de frango + fruta"];
    }
  }

  return next;
}

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function planDayForDate(plan: Plan, date = new Date()): PlanDay | undefined {
  const wd = date.getDay();
  return plan.workoutDays.find((d) => d.weekday === wd);
}

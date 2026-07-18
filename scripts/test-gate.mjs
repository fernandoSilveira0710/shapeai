import puppeteer from "puppeteer-core";

const now = new Date();
const wd = now.getDay();

function mkPlan(days) {
  return Array.from({ length: 7 }, (_, i) => ({
    weekday: i,
    label: days.includes(i) ? "Ombro + braço" : "Descanso",
    durationMin: 45,
    exercises: days.includes(i)
      ? [
          { exerciseId: "overhead-press", sets: 3, reps: "8-10", restSec: 90 },
          { exerciseId: "barbell-curl", sets: 3, reps: "8-10", restSec: 60 },
        ]
      : [],
    isRest: !days.includes(i),
  }));
}

const baseProfile = {
  id: "u1",
  displayName: "Jão",
  email: "d@s.ai",
  weightKg: 92,
  heightCm: 176,
  age: 24,
  goal: "hipertrofia",
  experience: "iniciante",
  equipment: ["academia"],
  injuries: "Nenhuma",
  workType: "presencial",
  budgetFood: "ok",
  dietRestrictions: [],
  cooksAtHome: true,
  trainDays: [wd],
  trainDurationMin: 45,
  tone: "brother",
  onboardingCompleted: true,
  createdAt: now.toISOString(),
  intakeCompleted: true,
  intakeNotes: [],
};

const basePlan = {
  id: "p1",
  version: 1,
  workoutDays: mkPlan([wd]),
  nutrition: {
    kcal: 3000,
    proteinG: 180,
    carbsG: 340,
    fatG: 84,
    meals: [
      { slot: "cafe", title: "Café da manhã", items: ["Ovos + aveia"], swaps: [] },
    ],
    groceryList: [],
    notes: "",
  },
  createdAt: now.toISOString(),
  source: "ai",
};

function seedWith(planOverrides) {
  return {
    state: {
      profile: baseProfile,
      plan: { ...basePlan, ...planOverrides },
      messages: [
        {
          id: "m1",
          role: "assistant",
          content: "",
          createdAt: now.toISOString(),
          rich: { title: "Fechou assim? (plano v1)", type: "approve_plan" },
        },
      ],
      sessions: [],
      mealLogs: [],
      metrics: [],
      subscription: "basic",
      activeWorkoutId: null,
      lastOpenDate: now.toISOString().slice(0, 10),
      dailyLlmCount: 0,
      dailyLlmDate: null,
      intakeQueue: [],
      intakeIndex: 0,
      awaitingFeedbackId: null,
    },
    version: 0,
  };
}

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 850 });

// ── ESTADO 1: plano NÃO aprovado ──
await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await page.evaluate((s) => localStorage.setItem("shape-ai-v1", JSON.stringify(s)), seedWith({}));
await page.goto("http://localhost:3000/chat", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1000));

const pendingState = await page.evaluate(() => {
  const chips = [...document.querySelectorAll("button")].map((b) => b.innerText.trim());
  return {
    hasBoraTreinar: chips.includes("Bora treinar"),
    hasJaAlmocei: chips.includes("Já almocei"),
    hasVerTreino: chips.includes("Ver treino"),
    hasPodePerguntar: chips.includes("Pode perguntar"),
    tabBarText: document.querySelector("nav")?.innerText ?? "",
  };
});
console.log("PENDING (não aprovado):", JSON.stringify(pendingState, null, 1));
await page.screenshot({ path: process.env.SHOT_LOCKED });

// tenta acessar /evolution direto por URL — deve voltar pro /chat
await page.goto("http://localhost:3000/evolution", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 800));
console.log("URL após tentar /evolution bloqueada:", page.url());

// ── ESTADO 2: plano APROVADO ──
await page.evaluate((s) => localStorage.setItem("shape-ai-v1", JSON.stringify(s)), seedWith({ approvedAt: now.toISOString() }));
await page.goto("http://localhost:3000/chat", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1000));

const unlockedState = await page.evaluate(() => {
  const chips = [...document.querySelectorAll("button")].map((b) => b.innerText.trim());
  return {
    hasBoraTreinar: chips.includes("Bora treinar"),
    hasVerTreino: chips.includes("Ver treino"),
    hasVerDieta: chips.includes("Ver dieta"),
    tabBarText: document.querySelector("nav")?.innerText ?? "",
  };
});
console.log("UNLOCKED (aprovado):", JSON.stringify(unlockedState, null, 1));

await page.goto("http://localhost:3000/evolution", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 800));
console.log("URL após tentar /evolution liberada:", page.url());

await page.screenshot({ path: process.env.SHOT });
await browser.close();

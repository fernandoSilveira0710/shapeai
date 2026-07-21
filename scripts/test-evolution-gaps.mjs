import puppeteer from "puppeteer-core";

const S = process.env.SCRATCH || ".";
const now = new Date();

function dayKeyLocal(offsetDays) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

function baseProfile(modules) {
  return {
    id: "u1", displayName: "Jão", email: "d@s.ai", weightKg: 92, heightCm: 176, age: 24,
    goal: "hipertrofia", experience: "intermediario", equipment: ["academia"],
    injuries: "Nenhuma", workType: "presencial", budgetFood: "ok",
    dietRestrictions: [], cooksAtHome: true, trainDays: [1, 3, 5], trainDurationMin: 75,
    tone: "brother", onboardingCompleted: true,
    createdAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
    intakeCompleted: true, intakeNotes: [], trainTime: "06:00",
    modules, modulesSource: "self",
  };
}

function basePlan() {
  return {
    id: "p1", version: 1,
    workoutDays: Array.from({ length: 7 }, (_, i) => ({
      weekday: i, label: [1, 3, 5].includes(i) ? "Peito + tríceps" : "Descanso", durationMin: 75,
      exercises: [1, 3, 5].includes(i) ? [{ exerciseId: "bench-press", sets: 3, reps: "8-12", restSec: 90 }] : [],
      isRest: ![1, 3, 5].includes(i),
    })),
    nutrition: {
      kcal: 3201, proteinG: 208, carbsG: 392, fatG: 89,
      meals: [
        { slot: "cafe", title: "Café da manhã", items: ["Ovos + aveia"], swaps: [] },
        { slot: "almoco", title: "Almoço", items: ["Arroz, feijão, frango"], swaps: [] },
        { slot: "lanche", title: "Lanche", items: ["Whey + fruta"], swaps: [] },
        { slot: "janta", title: "Janta", items: ["Macarrão + frango"], swaps: [] },
      ],
      groceryList: [], notes: "",
    },
    createdAt: now.toISOString(), source: "ai", approvedAt: now.toISOString(),
  };
}

// só 2 dos 4 slots logados nos últimos 5 dias → cada um vira "refeição furada"
const mealLogs = [];
for (let i = 1; i <= 5; i++) {
  const k = dayKeyLocal(-i);
  mealLogs.push({ id: `c${i}`, slot: "cafe", description: "Ovos", adherence: "on_plan", loggedAt: `${k}T08:00:00.000Z`, source: "chip" });
  mealLogs.push({ id: `a${i}`, slot: "almoco", description: "Arroz", adherence: "on_plan", loggedAt: `${k}T12:00:00.000Z`, source: "chip" });
  // lanche e janta ficam sem log de propósito
}

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox"],
});

async function checkEvolution(modules, label) {
  const page = await browser.newPage();
  await page.setViewport({ width: 400, height: 850 });
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await page.evaluate((s) => localStorage.setItem("shape-ai-v1", JSON.stringify(s)), {
    state: {
      profile: baseProfile(modules),
      plan: basePlan(),
      messages: [],
      sessions: [],
      mealLogs,
      metrics: [{ id: "w1", kind: "weight", value: 92, measuredAt: now.toISOString() }],
      subscription: "basic",
      activeWorkoutId: null,
      lastOpenDate: dayKeyLocal(0),
      dailyLlmCount: 0,
      dailyLlmDate: null,
      intakeQueue: [],
      intakeIndex: 0,
      awaitingFeedbackId: null,
    },
    version: 0,
  });
  await page.goto("http://localhost:3000/evolution", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 700));

  const gapStat = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("div")];
    const label = cards.find((d) => d.textContent?.trim() === "Refeições furadas");
    return label?.previousElementSibling?.textContent ?? null;
  });
  const hasProgressao = await page.evaluate(() =>
    [...document.querySelectorAll("h2")].some((h) => h.textContent?.includes("Progressão de carga"))
  );
  console.log(`\n=== ${label} ===`);
  console.log("Stat 'Refeições furadas':", gapStat);
  console.log("Bloco 'Progressão de carga' presente:", hasProgressao);
  await page.screenshot({ path: `${S}/evolution-${label}.png` });
  await page.close();
}

await checkEvolution(["treino", "dieta"], "ambos");
await checkEvolution(["dieta"], "so-dieta");
await checkEvolution(["treino"], "so-treino");

await browser.close();

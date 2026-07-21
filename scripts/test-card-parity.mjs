import puppeteer from "puppeteer-core";

const now = new Date();

const seed = {
  state: {
    profile: {
      id: "u1", displayName: "Jão", email: "d@s.ai", weightKg: 92, heightCm: 176, age: 24,
      goal: "hipertrofia", experience: "intermediario", equipment: ["academia"],
      injuries: "Nenhuma", workType: "presencial", budgetFood: "ok",
      dietRestrictions: [], cooksAtHome: true, trainDays: [1, 3, 5], trainDurationMin: 75,
      tone: "brother", onboardingCompleted: true, createdAt: now.toISOString(),
      intakeCompleted: true, intakeNotes: [], trainTime: "06:00",
    },
    plan: {
      id: "p1", version: 1,
      workoutDays: Array.from({ length: 7 }, (_, i) => ({
        weekday: i, label: [1, 3, 5].includes(i) ? "Peito + tríceps" : "Descanso", durationMin: 75,
        exercises: [1, 3, 5].includes(i)
          ? [{ exerciseId: "bench-press", sets: 3, reps: "8-12", restSec: 90 }]
          : [],
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
    },
    messages: [], sessions: [], mealLogs: [{
      id: "m0", slot: "almoco", description: "Arroz, feijão, frango", adherence: "on_plan",
      loggedAt: now.toISOString(), source: "chip",
    }], metrics: [
      { id: "w1", kind: "weight", value: 93, measuredAt: new Date(Date.now() - 8*86400000).toISOString() },
      { id: "w2", kind: "weight", value: 92, measuredAt: now.toISOString() },
    ],
    subscription: "basic",
    activeWorkoutId: null, lastOpenDate: now.toISOString().slice(0, 10),
    dailyLlmCount: 0, dailyLlmDate: null, intakeQueue: [], intakeIndex: 0, awaitingFeedbackId: null,
  },
  version: 0,
};

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new", args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 850 });
await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await page.evaluate((s) => localStorage.setItem("shape-ai-v1", JSON.stringify(s)), seed);
await page.goto("http://localhost:3000/chat", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 800));

async function ask(text, waitMs = 16000) {
  await page.focus("textarea");
  await page.type("textarea", text, { delay: 5 });
  await page.keyboard.press("Enter");
  await new Promise((r) => setTimeout(r, waitMs));
  const bubbles = await page.evaluate(() =>
    [...document.querySelectorAll(".animate-rise")].slice(-2).map((n) => n.innerText.slice(0, 300))
  );
  console.log(`\n>>> "${text}"`);
  console.log(JSON.stringify(bubbles, null, 1));
  return bubbles;
}

console.log("=== TESTE 1: 'me dá a dieta da semana' (texto) — deve trazer card week_diet ===");
const r1 = await ask("me dá a dieta da semana");
const hasCard1 = await page.evaluate(() => {
  const last = [...document.querySelectorAll(".animate-rise")].slice(-1)[0];
  return last?.innerText.includes("kcal/dia") || false;
});
console.log("Tem card de dieta?", hasCard1);

console.log("\n=== TESTE 2: 'como estou' (texto) — deve trazer card progress ===");
const r2 = await ask("como estou");
const hasCard2 = await page.evaluate(() => {
  const last = [...document.querySelectorAll(".animate-rise")].slice(-1)[0];
  return last?.innerText.includes("streak") || last?.innerText.includes("treinos/7d") || false;
});
console.log("Tem card de progresso?", hasCard2);

console.log("\n=== TESTE 3: 'comi uma bolacha agora' — deve logar + reagir, sem pedir permissão ===");
const before3 = await page.evaluate(() => JSON.parse(localStorage.getItem("shape-ai-v1")).state.mealLogs.length);
const r3 = await ask("comi uma bolacha agora, fora de hora");
const after3 = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("shape-ai-v1")).state;
  return { count: s.mealLogs.length, last: s.mealLogs[s.mealLogs.length - 1] };
});
console.log("mealLogs antes/depois:", before3, "->", JSON.stringify(after3));

console.log("\n=== TESTE 4: 'quero registrar meu peso' sem número — deve abrir sheet ===");
await ask("quero registrar meu peso", 12000);
const sheetOpen = await page.evaluate(() => {
  const heading = [...document.querySelectorAll("h2")].find((h) => h.innerText.includes("Peso de hoje"));
  return !!heading;
});
console.log("Sheet de peso aberto?", sheetOpen);

await page.screenshot({ path: process.env.SHOT });
await browser.close();

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

// hoje precisa ser dia de descanso — senão o branch de "janela de treino"
// tem prioridade sobre peso na abertura (buildOpening), e o teste não isola
// o guardrail de peso corretamente
const todayWd = new Date(
  `${dayKeyLocal(0)}T12:00:00`
).getDay();
const trainDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== todayWd).slice(0, 3);

const profile = {
  id: "u1", displayName: "Jão", email: "d@s.ai", weightKg: 92, heightCm: 176, age: 24,
  goal: "hipertrofia", experience: "intermediario", equipment: ["academia"],
  injuries: "Nenhuma", workType: "presencial", budgetFood: "ok",
  dietRestrictions: [], cooksAtHome: true, trainDays, trainDurationMin: 75,
  tone: "brother", onboardingCompleted: true,
  createdAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
  intakeCompleted: true, intakeNotes: [], trainTime: "06:00",
  modules: ["treino", "dieta"], modulesSource: "self",
};

const plan = {
  id: "p1", version: 1,
  workoutDays: Array.from({ length: 7 }, (_, i) => ({
    weekday: i, label: trainDays.includes(i) ? "Peito + tríceps" : "Descanso", durationMin: 75,
    exercises: trainDays.includes(i) ? [{ exerciseId: "bench-press", sets: 3, reps: "8-12", restSec: 90 }] : [],
    isRest: !trainDays.includes(i),
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

// meses logados fartos pra não disparar meal_gap_yesterday/meal_check e poluir o teste —
// só queremos isolar o guardrail de peso (weight_due, nunca registrado)
const mealLogs = [];
for (let i = 0; i <= 3; i++) {
  const k = dayKeyLocal(-i);
  for (const slot of ["cafe", "almoco", "lanche", "janta"]) {
    mealLogs.push({ id: `${slot}${i}`, slot, description: "ok", adherence: "on_plan", loggedAt: `${k}T09:00:00.000Z`, source: "chip" });
  }
}

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 850 });

await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await page.evaluate((s) => localStorage.setItem("shape-ai-v1", JSON.stringify(s)), {
  state: {
    profile, plan, messages: [], sessions: [], mealLogs,
    metrics: [], // sem peso NUNCA registrado → weight_due dispara
    subscription: "basic", activeWorkoutId: null,
    lastOpenDate: dayKeyLocal(-2), // dia anterior → hydrateOpening roda
    dailyLlmCount: 0, dailyLlmDate: null,
    intakeQueue: [], intakeIndex: 0, awaitingFeedbackId: null, nudgedToday: null,
  },
  version: 0,
});
await page.goto("http://localhost:3000/chat", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 900));

const opening = await page.evaluate(() => {
  const bubbles = [...document.querySelectorAll(".chat-scroll .animate-rise")];
  return bubbles[0]?.innerText ?? "(nenhuma)";
});
console.log("=== Abertura ===");
console.log(opening);
const mentionsPeso = /peso|balan[cç]a/i.test(opening);
console.log("Menciona peso/balança (esperado true):", mentionsPeso);

const nudged = await page.evaluate(
  () => JSON.parse(localStorage.getItem("shape-ai-v1")).state.nudgedToday
);
console.log("nudgedToday salvo:", JSON.stringify(nudged));
console.log("kind === weight_due (esperado true):", nudged?.kind === "weight_due");

console.log("\n=== Mensagem neutra, mesma sessão ===");
await page.focus("textarea");
await page.type("textarea", "e ai, tudo certo por ai?", { delay: 5 });
await page.keyboard.press("Enter");
await new Promise((r) => setTimeout(r, 15000));

const reply = await page.evaluate(() => {
  const bubbles = [...document.querySelectorAll(".chat-scroll .animate-rise")];
  return bubbles[bubbles.length - 1]?.innerText ?? "(nenhuma)";
});
console.log("Resposta:", reply);
const repeatsPeso = /peso|balan[cç]a|pesar/i.test(reply);
console.log("Repetiu cobrança de peso (esperado false):", repeatsPeso);

await page.screenshot({ path: `${S}/anti-repeticao.png` });
await browser.close();

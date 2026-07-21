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
      nutrition: { kcal: 3201, proteinG: 208, carbsG: 392, fatG: 89, meals: [], groceryList: [], notes: "" },
      createdAt: now.toISOString(), source: "ai", approvedAt: now.toISOString(),
    },
    messages: [], sessions: [], mealLogs: [], metrics: [], subscription: "basic",
    activeWorkoutId: null, lastOpenDate: now.toISOString().slice(0, 10),
    dailyLlmCount: 0, dailyLlmDate: null, intakeQueue: [], intakeIndex: 0, awaitingFeedbackId: null,
  },
  version: 0,
};

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 850 });
await page.setCacheEnabled(false);
page.on("console", (m) => console.log("[browser]", m.text()));

await page.evaluateOnNewDocument((fixedTime) => {
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(fixedTime);
      else super(...args);
    }
    static now() {
      return fixedTime;
    }
  }
  window.Date = FakeDate;
}, new Date(2026, 6, 19, 8, 0, 0).getTime()); // 2026-07-19 é domingo

await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
const swCheck = await page.evaluate(async () => {
  if (!navigator.serviceWorker) return "unsupported";
  const regs = await navigator.serviceWorker.getRegistrations();
  return regs.map((r) => r.scope);
});
console.log("Service workers registrados:", JSON.stringify(swCheck));
await page.evaluate((s) => localStorage.setItem("shape-ai-v1", JSON.stringify(s)), seed);
await page.goto("http://localhost:3000/chat", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1200));

console.log("--- ABERTURA (hydrateOpening) ---");
const opening = await page.evaluate(() =>
  [...document.querySelectorAll(".animate-rise")].map((n) => n.innerText.slice(0, 200))
);
console.log(JSON.stringify(opening, null, 1));

const stateBefore = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("shape-ai-v1")).state;
  return { activeWorkoutId: s.activeWorkoutId, sessions: s.sessions.length, plan_wd_today: s.plan.workoutDays[0] };
});
console.log("\nEstado antes do 'bora':", JSON.stringify(stateBefore, null, 1));

const dbg = await page.evaluate(() => ({
  nowIso: new Date().toString(),
  getDay: new Date().getDay(),
  dateNow: Date.now(),
}));
console.log("DEBUG Date no browser:", JSON.stringify(dbg, null, 1));

await page.focus("textarea");
await page.type("textarea", "bora", { delay: 5 });
await page.keyboard.press("Enter");
await new Promise((r) => setTimeout(r, 1200));

console.log("\n--- APÓS 'bora' ---");
const after = await page.evaluate(() =>
  [...document.querySelectorAll(".animate-rise")].map((n) => n.innerText.slice(0, 200))
);
console.log(JSON.stringify(after, null, 1));

const rawMessages = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("shape-ai-v1")).state;
  return s.messages.map((m) => ({ role: m.role, content: m.content.slice(0, 80), richType: m.rich?.type }));
});
console.log("\nMENSAGENS BRUTAS NO STORE:", JSON.stringify(rawMessages, null, 1));

const stateAfter = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("shape-ai-v1")).state;
  return { activeWorkoutId: s.activeWorkoutId, sessions: s.sessions.length };
});
console.log("\nEstado após 'bora':", JSON.stringify(stateAfter, null, 1));
console.log("URL:", page.url());

await browser.close();

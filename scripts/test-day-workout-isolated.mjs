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
page.on("console", (m) => { if (/error/i.test(m.type())) console.log("[console:err]", m.text()); });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

// segunda-feira 07:00 fixo (2026-07-20 é segunda)
await page.evaluateOnNewDocument((fixedTime) => {
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(fixedTime);
      else super(...args);
    }
    static now() { return fixedTime; }
  }
  window.Date = FakeDate;
}, new Date(2026, 6, 20, 7, 0, 0).getTime());

await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await page.evaluate((s) => localStorage.setItem("shape-ai-v1", JSON.stringify(s)), seed);
await page.goto("http://localhost:3000/chat", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1000));

const dbg = await page.evaluate(() => ({ getDay: new Date().getDay(), iso: new Date().toString() }));
console.log("Data travada:", JSON.stringify(dbg));

const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Treino hoje");
  if (!btn) return false;
  btn.click();
  return true;
});
console.log("Clicou chip 'Treino hoje'?", clicked);
await new Promise((r) => setTimeout(r, 800));

const cardText = await page.evaluate(() =>
  [...document.querySelectorAll(".animate-rise")].slice(-1)[0]?.innerText.slice(0, 300)
);
console.log("Card:", cardText);

const startBtn = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Iniciar treino");
  if (!btn) return false;
  btn.click();
  return true;
});
console.log("Clicou 'Iniciar treino'?", startBtn);
await new Promise((r) => setTimeout(r, 1000));
console.log("URL final:", page.url());

const state = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("shape-ai-v1")).state;
  return { activeWorkoutId: s.activeWorkoutId, sessions: s.sessions.length };
});
console.log("Estado final:", JSON.stringify(state));
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: process.env.SHOT });

await browser.close();

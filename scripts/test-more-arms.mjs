import puppeteer from "puppeteer-core";

const now = new Date();

const seed = {
  state: {
    profile: {
      id: "u1", displayName: "Jão", email: "d@s.ai", weightKg: 92, heightCm: 176, age: 24,
      goal: "hipertrofia", experience: "intermediario", equipment: ["academia"],
      injuries: "Nenhuma", workType: "presencial", budgetFood: "ok",
      dietRestrictions: [], cooksAtHome: true, trainDays: [1, 3, 5, 6], trainDurationMin: 75,
      tone: "brother", onboardingCompleted: true, createdAt: now.toISOString(),
      intakeCompleted: true, intakeNotes: [], trainTime: "06:00",
    },
    plan: {
      id: "p1", version: 1,
      workoutDays: [
        { weekday: 0, label: "Descanso", durationMin: 0, exercises: [], isRest: true },
        { weekday: 1, label: "Peito + tríceps", durationMin: 75, isRest: false,
          exercises: [
            { exerciseId: "bench-press", sets: 3, reps: "8-12", restSec: 90 },
            { exerciseId: "incline-dumbbell-press", sets: 3, reps: "8-12", restSec: 90 },
            { exerciseId: "triceps-pushdown", sets: 3, reps: "8-12", restSec: 60 },
          ] },
        { weekday: 2, label: "Descanso", durationMin: 0, exercises: [], isRest: true },
        { weekday: 3, label: "Costas + bíceps", durationMin: 75, isRest: false,
          exercises: [
            { exerciseId: "lat-pulldown", sets: 3, reps: "8-12", restSec: 90 },
            { exerciseId: "barbell-row", sets: 3, reps: "8-12", restSec: 90 },
            { exerciseId: "barbell-curl", sets: 3, reps: "8-12", restSec: 60 },
          ] },
        { weekday: 4, label: "Descanso", durationMin: 0, exercises: [], isRest: true },
        { weekday: 5, label: "Perna", durationMin: 75, isRest: false,
          exercises: [
            { exerciseId: "squat", sets: 3, reps: "8-12", restSec: 120 },
            { exerciseId: "leg-press", sets: 3, reps: "8-12", restSec: 100 },
          ] },
        { weekday: 6, label: "Ombro + braço", durationMin: 75, isRest: false,
          exercises: [
            { exerciseId: "overhead-press", sets: 3, reps: "8-12", restSec: 90 },
            { exerciseId: "barbell-curl", sets: 3, reps: "8-12", restSec: 60 },
            { exerciseId: "triceps-pushdown", sets: 3, reps: "8-12", restSec: 60 },
          ] },
      ],
      nutrition: { kcal: 3201, proteinG: 208, carbsG: 392, fatG: 89,
        meals: [{ slot: "cafe", title: "Café da manhã", items: ["Ovos + aveia"], swaps: [] }],
        groceryList: [], notes: "" },
      createdAt: now.toISOString(), source: "ai", approvedAt: now.toISOString(),
    },
    messages: [
      { id: "m1", role: "assistant", content: "", createdAt: now.toISOString(),
        rich: { title: "Fechou assim? (plano v1)", type: "week_plan", payload: {} } },
    ],
    sessions: [], mealLogs: [], metrics: [], subscription: "basic",
    activeWorkoutId: null, lastOpenDate: now.toISOString().slice(0,10),
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
await new Promise((r) => setTimeout(r, 1000));

// pedido EXATO do usuário
await page.focus("textarea");
await page.type("textarea", "eu queria mais exercicios de braço", { delay: 5 });
await page.keyboard.press("Enter");
await new Promise((r) => setTimeout(r, 20000));

const before = await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("shape-ai-v1")).state;
  return { version: raw.plan.version, days: raw.plan.workoutDays.filter(d=>!d.isRest).map(d=>({wd:d.weekday,label:d.label,ex:d.exercises.map(e=>e.exerciseId)})) };
});
console.log("PLANO REAL APÓS PEDIDO:", JSON.stringify(before, null, 1));

const bubbles = await page.evaluate(() =>
  [...document.querySelectorAll(".animate-rise")].slice(-6).map((n) => n.innerText.slice(0, 200))
);
console.log("\nCHAT:", JSON.stringify(bubbles, null, 1));

const changeLog = await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("shape-ai-v1")).state;
  return raw.plan.changeLog;
});
console.log("\nCHANGE LOG:", JSON.stringify(changeLog, null, 1));

await page.screenshot({ path: process.env.SHOT });
await browser.close();

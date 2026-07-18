import puppeteer from "puppeteer-core";
const now = Date.now();
const daysAgo = (n) => new Date(now - n * 86400000);
const mkSession = (n, weight, reps) => ({
  id: `s${n}`, date: daysAgo(n).toISOString().slice(0, 10), label: "Ombro + braço",
  status: "completed", startedAt: daysAgo(n).toISOString(), endedAt: daysAgo(n).toISOString(),
  sets: [
    { exerciseId: "barbell-curl", setIndex: 0, reps, weightKg: weight, status: "completed", completedAt: daysAgo(n).toISOString() },
    { exerciseId: "barbell-curl", setIndex: 1, reps, weightKg: weight, status: "completed", completedAt: daysAgo(n).toISOString() },
    { exerciseId: "barbell-curl", setIndex: 2, reps: reps - 1, weightKg: weight, status: "completed", completedAt: daysAgo(n).toISOString() },
  ],
  skippedExercises: [], planDayWeekday: new Date(now).getDay(),
});
const seed = {
  state: {
    profile: {
      id: "u1", displayName: "Jão", email: "d@s.ai", weightKg: 92, heightCm: 176, age: 24,
      goal: "hipertrofia", experience: "intermediario", equipment: ["academia"],
      injuries: "Nenhuma", workType: "presencial", budgetFood: "ok",
      dietRestrictions: [], cooksAtHome: true, trainDays: [new Date(now).getDay()], trainDurationMin: 60,
      tone: "brother", onboardingCompleted: true, createdAt: daysAgo(30).toISOString(),
      intakeCompleted: true, intakeNotes: [],
    },
    plan: {
      id: "p1", version: 1,
      workoutDays: Array.from({ length: 7 }, (_, wd) => ({
        weekday: wd, label: "Ombro + braço", durationMin: 60,
        exercises: [{ exerciseId: "barbell-curl", sets: 3, reps: "8-10", restSec: 60 }],
        isRest: wd !== new Date(now).getDay(),
      })),
      nutrition: { kcal: 3000, proteinG: 180, carbsG: 340, fatG: 84, meals: [], groceryList: [], notes: "" },
      createdAt: daysAgo(30).toISOString(), source: "ai",
    },
    messages: [], mealLogs: [], metrics: [],
    sessions: [
      mkSession(9, 10, 8), mkSession(5, 12, 8), mkSession(2, 12, 10),
      { id: "cur", date: new Date(now).toISOString().slice(0,10), label: "Ombro + braço",
        status: "in_progress", startedAt: new Date(now).toISOString(),
        sets: [], skippedExercises: [], planDayWeekday: new Date(now).getDay() },
    ],
    subscription: "basic", activeWorkoutId: "cur",
    lastOpenDate: new Date(now).toISOString().slice(0,10),
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
await page.goto("http://localhost:3000/workout/cur", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: process.env.SHOT });
// diminui carga → vermelho
await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input[type=number]')];
  const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  nativeSet.call(inputs[1], '10');
  inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: process.env.SHOT_RED });
// conclui série → overlay descanso com caixinha
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.innerText.includes('Concluir série'))?.click();
});
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: process.env.SHOT_REST });
console.log('ok');
await browser.close();

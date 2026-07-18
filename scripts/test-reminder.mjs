import puppeteer from "puppeteer-core";
// simula: wantsReminders + trainTime = agora → notificação deve disparar
const now = new Date();
const hh = String(now.getHours()).padStart(2, "0");
const mm = String(now.getMinutes()).padStart(2, "0");
const wd = now.getDay();
const seed = {
  state: {
    profile: {
      id: "u1", displayName: "Jão", email: "d@s.ai", weightKg: 92, heightCm: 176, age: 24,
      goal: "hipertrofia", experience: "iniciante", equipment: ["academia"],
      injuries: "Nenhuma", workType: "presencial", budgetFood: "ok",
      dietRestrictions: [], cooksAtHome: true, trainDays: [wd], trainDurationMin: 45,
      tone: "brother", onboardingCompleted: true, createdAt: new Date().toISOString(),
      intakeCompleted: true, intakeNotes: [], trainTime: `${hh}:${mm}`, wantsReminders: true,
    },
    plan: {
      id: "p1", version: 1,
      workoutDays: Array.from({ length: 7 }, (_, i) => ({
        weekday: i, label: "Push", durationMin: 45,
        exercises: [{ exerciseId: "bench-press", sets: 3, reps: "10", restSec: 60 }],
        isRest: i !== wd,
      })),
      nutrition: { kcal: 3000, proteinG: 180, carbsG: 340, fatG: 84, meals: [], groceryList: [], notes: "" },
      createdAt: new Date().toISOString(), source: "ai",
    },
    messages: [], sessions: [], mealLogs: [], metrics: [], subscription: "basic",
    activeWorkoutId: null, lastOpenDate: new Date().toISOString().slice(0,10),
    dailyLlmCount: 0, dailyLlmDate: null, intakeQueue: [], intakeIndex: 0, awaitingFeedbackId: null,
  },
  version: 0,
};
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox"],
});
const ctx = browser.defaultBrowserContext();
await ctx.overridePermissions("http://localhost:3000", ["notifications"]);
const page = await browser.newPage();
const notifications = [];
await page.exposeFunction("__notify", (t, b) => notifications.push({ t, b }));
await page.evaluateOnNewDocument(() => {
  const Orig = window.Notification;
  function Fake(title, opts) { window.__notify(title, opts?.body ?? ""); }
  Fake.permission = "granted";
  Fake.requestPermission = () => Promise.resolve("granted");
  window.Notification = Fake;
  void Orig;
});
await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await page.evaluate((s) => localStorage.setItem("shape-ai-v1", JSON.stringify(s)), seed);
await page.goto("http://localhost:3000/chat", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 3000));
console.log("NOTIFICAÇÕES DISPARADAS:", JSON.stringify(notifications));
const firedFlag = await page.evaluate(() => localStorage.getItem("shape-reminder-fired"));
console.log("flag 1x/dia:", firedFlag);
await browser.close();

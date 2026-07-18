import puppeteer from "puppeteer-core";

const now = new Date();
const wd = now.getDay();

const seed = {
  state: {
    profile: {
      id: "u1", displayName: "Jão", email: "d@s.ai", weightKg: 92, heightCm: 176, age: 24,
      goal: "hipertrofia", experience: "iniciante", equipment: ["academia"],
      injuries: "Nenhuma", workType: "presencial", budgetFood: "ok",
      dietRestrictions: [], cooksAtHome: true, trainDays: [wd], trainDurationMin: 45,
      tone: "brother", onboardingCompleted: true, createdAt: now.toISOString(),
      intakeCompleted: true, intakeNotes: [],
    },
    plan: {
      id: "p1", version: 1,
      workoutDays: Array.from({ length: 7 }, (_, i) => ({
        weekday: i, label: i === wd ? "Ombro + braço" : "Descanso", durationMin: 45,
        exercises: i === wd ? [
          { exerciseId: "overhead-press", sets: 3, reps: "8-10", restSec: 90 },
          { exerciseId: "barbell-curl", sets: 3, reps: "8-10", restSec: 60 },
        ] : [],
        isRest: i !== wd,
      })),
      nutrition: { kcal: 3000, proteinG: 180, carbsG: 340, fatG: 84,
        meals: [{ slot: "cafe", title: "Café da manhã", items: ["Ovos + aveia"], swaps: [] }],
        groceryList: [], notes: "" },
      createdAt: now.toISOString(), source: "ai",
    },
    messages: [
      { id: "m1", role: "assistant", content: "", createdAt: now.toISOString(),
        rich: { title: "Fechou assim? (plano v1)", type: "approve_plan" } },
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

// clica "Fechou, aprovo"
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Fechou,"))?.click();
});
await new Promise((r) => setTimeout(r, 2500));

const state1 = await page.evaluate(() => {
  const bubbles = [...document.querySelectorAll(".animate-rise")].map((n) => n.innerText.slice(0, 120));
  const tabBar = document.querySelector("nav")?.innerText ?? "";
  return { bubbles: bubbles.slice(-6), tabBar };
});
console.log("APÓS APROVAR:", JSON.stringify(state1, null, 1));

// swap_exercise: pede pra trocar por falta de aparelho
await page.focus("textarea");
await page.type("textarea", "não tenho a máquina de desenvolvimento militar, o que eu uso?", { delay: 5 });
await page.keyboard.press("Enter");
await new Promise((r) => setTimeout(r, 15000));

const lastMsgs = await page.evaluate(() =>
  [...document.querySelectorAll(".animate-rise")].slice(-4).map((n) => n.innerText.slice(0, 250))
);
console.log("APÓS PEDIR TROCA:", JSON.stringify(lastMsgs, null, 1));

const finalChips = await page.evaluate(() =>
  [...document.querySelectorAll("button")].map((b) => b.innerText.trim())
);
console.log("CHIPS FINAIS:", JSON.stringify(finalChips.filter((c) => c && c.length < 20)));

await page.screenshot({ path: process.env.SHOT });
await browser.close();

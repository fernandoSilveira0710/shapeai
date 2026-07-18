import puppeteer from "puppeteer-core";
const seed = {
  state: {
    profile: {
      id: "u1", displayName: "Rafa", email: "d@s.ai", weightKg: 78, heightCm: 175, age: 28,
      goal: "hipertrofia", experience: "intermediario", equipment: ["academia"],
      injuries: "ombro esquerdo estala", workType: "presencial", budgetFood: "apertado",
      dietRestrictions: [], cooksAtHome: true, trainDays: [1, 3, 5], trainDurationMin: 60,
      tone: "brother", onboardingCompleted: true, createdAt: new Date().toISOString(),
      intakeCompleted: false, intakeNotes: [],
    },
    plan: {
      id: "p1", version: 1,
      workoutDays: Array.from({ length: 7 }, (_, wd) => ({
        weekday: wd, label: [1,3,5].includes(wd) ? "Push" : "Descanso", durationMin: 60,
        exercises: [1,3,5].includes(wd) ? [{ exerciseId: "bench-press", sets: 3, reps: "8-10", restSec: 60 }] : [],
        isRest: ![1,3,5].includes(wd),
      })),
      nutrition: { kcal: 2900, proteinG: 160, carbsG: 330, fatG: 80, meals: [], groceryList: [], notes: "" },
      createdAt: new Date().toISOString(), source: "ai",
    },
    messages: [{ id: "m1", role: "assistant", content: "E aí Rafa! Primeira vez por aqui. Começa me contando: o que te trouxe aqui agora?", createdAt: new Date().toISOString() }],
    sessions: [], mealLogs: [], metrics: [], subscription: "basic",
    activeWorkoutId: null, lastOpenDate: new Date().toISOString().slice(0,10),
    dailyLlmCount: 0, dailyLlmDate: null, intakeQueue: [], intakeIndex: 0,
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
await new Promise((r) => setTimeout(r, 1200));

async function send(text, wait = 14000) {
  await page.focus("textarea");
  await page.type("textarea", text, { delay: 5 });
  await page.keyboard.press("Enter");
  await new Promise((r) => setTimeout(r, wait));
  const last = await page.evaluate(() => {
    const els = [...document.querySelectorAll(".animate-rise")];
    return els.slice(-1)[0]?.innerText ?? "(nada)";
  });
  console.log(`\n>>> USER: ${text}\n<<< IA: ${last.slice(0, 400)}`);
}

await send("cansei de me sentir fraco, quero ganhar massa de verdade");
await send("já treinei uns 2 anos atrás, larguei quando comecei a trabalhar");
await send("penso em ir às 19h depois do trampo, e pode me cobrar sim kk");
await page.screenshot({ path: process.env.SHOT });
await browser.close();

import puppeteer from "puppeteer-core";
const mkDays = (days) => Array.from({ length: 7 }, (_, wd) => ({
  weekday: wd, label: days.includes(wd) ? "Full body" : "Descanso", durationMin: 45,
  exercises: days.includes(wd) ? [{ exerciseId: "bench-press", sets: 3, reps: "10-12", restSec: 60 }] : [],
  isRest: !days.includes(wd),
}));
const seed = {
  state: {
    profile: {
      id: "u1", displayName: "Jão", email: "d@s.ai", weightKg: 92, heightCm: 176, age: 24,
      goal: "hipertrofia", experience: "iniciante", equipment: ["academia"],
      injuries: "Nenhuma", workType: "presencial", budgetFood: "folgado",
      dietRestrictions: [], cooksAtHome: true, trainDays: [0,1,2,3,4,5,6], trainDurationMin: 60,
      tone: "brother", onboardingCompleted: true, createdAt: new Date().toISOString(),
      intakeCompleted: false, intakeNotes: [
        { key: "soul_1", question: "o que te trouxe?", answer: "quero ganhar músculo, cansei de me sentir fraco", at: new Date().toISOString(), metricLabel: "Dossiê (SOUL)" },
        { key: "soul_2", question: "já treinou?", answer: "nunca puxei ferro na vida", at: new Date().toISOString(), metricLabel: "Dossiê (SOUL)" },
        { key: "soul_3", question: "horário?", answer: "6h da manhã antes do trampo, pode me cobrar", at: new Date().toISOString(), metricLabel: "Dossiê (SOUL)" },
        { key: "soul_4", question: "trampo?", answer: "mercado, seg a sábado 7:30-17h em pé", at: new Date().toISOString(), metricLabel: "Dossiê (SOUL)" },
        { key: "soul_5", question: "comida?", answer: "dinheiro de sobra, café e janta em casa, marmita no almoço", at: new Date().toISOString(), metricLabel: "Dossiê (SOUL)" },
        { key: "soul_6", question: "sono?", answer: "durmo umas 6h, bebo só no sábado", at: new Date().toISOString(), metricLabel: "Dossiê (SOUL)" },
      ],
    },
    plan: {
      id: "p1", version: 1, workoutDays: mkDays([0,1,2,3,4,5,6]),
      nutrition: { kcal: 3100, proteinG: 184, carbsG: 360, fatG: 86,
        meals: [
          { slot: "cafe", title: "Café", items: ["Ovos + aveia + banana"] },
          { slot: "almoco", title: "Almoço", items: ["Marmita: arroz, feijão, frango"] },
          { slot: "janta", title: "Janta", items: ["Macarrão + frango + legumes"] },
        ], groceryList: [], notes: "" },
      createdAt: new Date().toISOString(), source: "ai",
    },
    messages: [{ id: "m1", role: "assistant", content: "E o sono, como tá? Bebe com frequência?", createdAt: new Date().toISOString() }],
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

// resposta 7 → deve fechar dossiê (finish_intake) + quadros
await page.focus("textarea");
await page.type("textarea", "durmo 6h e bebo umas cervejas no sábado só", { delay: 5 });
await page.keyboard.press("Enter");
await new Promise((r) => setTimeout(r, 22000));

const out = await page.evaluate(() => {
  const els = [...document.querySelectorAll(".animate-rise")];
  return els.slice(-6).map((n) => n.innerText.slice(0, 260));
});
console.log(JSON.stringify(out, null, 1));
await page.screenshot({ path: process.env.SHOT, fullPage: false });
await browser.close();

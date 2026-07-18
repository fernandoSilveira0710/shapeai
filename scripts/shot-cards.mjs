import puppeteer from "puppeteer-core";
const mkDays = (days) => Array.from({ length: 7 }, (_, wd) => ({
  weekday: wd, label: days.includes(wd) ? ["Push","Pull","Legs"][days.indexOf(wd) % 3] : "Descanso",
  durationMin: 45,
  exercises: days.includes(wd) ? [
    { exerciseId: "bench-press", sets: 3, reps: "10-12", restSec: 90 },
    { exerciseId: "incline-dumbbell-press", sets: 3, reps: "10-12", restSec: 90 },
    { exerciseId: "push-up", sets: 3, reps: "12-15", restSec: 60 },
  ] : [],
  isRest: !days.includes(wd),
}));
const seed = {
  state: {
    profile: {
      id: "u1", displayName: "Jão", email: "d@s.ai", weightKg: 92, heightCm: 176, age: 24,
      goal: "hipertrofia", experience: "iniciante", equipment: ["academia"],
      injuries: "Nenhuma", workType: "presencial", budgetFood: "folgado",
      dietRestrictions: [], cooksAtHome: true, trainDays: [1,3,5], trainDurationMin: 45,
      tone: "brother", onboardingCompleted: true, createdAt: new Date().toISOString(),
      intakeCompleted: true, intakeNotes: [], trainTime: "06:00",
    },
    plan: {
      id: "p1", version: 1, workoutDays: mkDays([1,3,5]),
      nutrition: { kcal: 3100, proteinG: 184, carbsG: 360, fatG: 86,
        meals: [
          { slot: "cafe", title: "Café da manhã", items: ["Iogurte grego + aveia + banana","Ovos mexidos + pão + fruta","Tapioca + ovo + café"], swaps: ["Sem iogurte → cottage ou ovos"] },
          { slot: "almoco", title: "Almoço", items: ["Arroz, feijão, patinho ou frango, legumes","Arroz, feijão, peixe grelhado, salada"], swaps: ["Sem frango → ovo, atum"] },
          { slot: "janta", title: "Janta", items: ["Macarrão integral + frango + legumes","Omelete + arroz + salada","Peixe + purê"], swaps: [] },
        ], groceryList: [], notes: "" },
      createdAt: new Date().toISOString(), source: "ai",
    },
    messages: [
      { id: "w1", role: "assistant", content: "Bate o olho em como fica tua semana:", createdAt: new Date().toISOString(),
        rich: { type: "week_plan", title: "Tua semana · 3 treinos", payload: {
          rows: [
            { weekday: 1, day: "Seg", label: "Push", time: "06:00", durationMin: 45, exercises: 3 },
            { weekday: 3, day: "Qua", label: "Pull", time: "06:00", durationMin: 45, exercises: 3 },
            { weekday: 5, day: "Sex", label: "Legs", time: "06:00", durationMin: 45, exercises: 3 },
          ], restDays: "Dom · Ter · Qui · Sáb" } } },
      { id: "w2", role: "assistant", content: "", createdAt: new Date().toISOString(),
        rich: { type: "diet_plan", title: "Base alimentar · ~3100 kcal/dia", payload: {
          kcal: 3100, proteinG: 184, carbsG: 360, fatG: 86,
          meals: [
            { slot: "cafe", title: "Café da manhã", options: ["Iogurte grego + aveia + banana","Ovos mexidos + pão + fruta","Tapioca + ovo + café"] },
            { slot: "almoco", title: "Almoço", options: ["Arroz, feijão, patinho ou frango, legumes","Arroz, feijão, peixe grelhado, salada"] },
            { slot: "janta", title: "Janta", options: ["Macarrão integral + frango + legumes","Omelete + arroz + salada","Peixe + purê"] },
          ],
          preWorkout: "Banana + café 20–30min antes (leve, treino cedo)",
          postWorkout: "Refeição com proteína até ~1h depois" } } },
      { id: "w3", role: "assistant", content: "Se algo não encaixa, fala que eu remonto.", createdAt: new Date().toISOString(),
        rich: { type: "tech_read", title: "Leitura técnica de largada", payload: {
          imc: 29.7, imcLabel: "sobrepeso", tdee: 2762, targetKcal: 3100, proteinG: 184,
          goalNote: "superávit leve: alvo 3100 kcal (+338)" } } },
    ],
    sessions: [], mealLogs: [], metrics: [], subscription: "basic",
    activeWorkoutId: null, lastOpenDate: new Date().toISOString().slice(0,10),
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
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => { const el = document.querySelector(".chat-scroll"); if (el) el.scrollTop = 0; });
await page.screenshot({ path: process.env.SHOT1 });
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")];
  btns.find((b) => b.innerText.includes("Push") || b.innerText.includes("Seg"))?.click();
});
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: process.env.SHOT2 });
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  btns.find((b) => b.innerText.includes('Supino'))?.click();
});
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: process.env.SHOT3 });
console.log('shots ok');
await browser.close();

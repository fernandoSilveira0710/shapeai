import puppeteer from "puppeteer-core";

const S = process.env.SCRATCH || ".";
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
      modules: ["treino", "dieta"], modulesSource: "self",
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
    },
    messages: [
      { id: "m1", role: "assistant", content: "E aí Jão, bora treinar hoje?", createdAt: now.toISOString() },
      { id: "m2", role: "user", content: "bora sim", createdAt: now.toISOString() },
    ],
    sessions: [], mealLogs: [{
      id: "m0", slot: "almoco", description: "Arroz, feijão, frango", adherence: "on_plan",
      loggedAt: now.toISOString(), source: "chip",
    }], metrics: [
      { id: "w1", kind: "weight", value: 92, measuredAt: now.toISOString() },
    ],
    subscription: "basic",
    activeWorkoutId: null, lastOpenDate: now.toISOString().slice(0, 10),
    dailyLlmCount: 0, dailyLlmDate: null, intakeQueue: [], intakeIndex: 0,
    awaitingFeedbackId: null, nudgedToday: null,
  },
  version: 0,
};

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox"],
});

async function seededPage(viewport) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await page.evaluate((s) => localStorage.setItem("shape-ai-v1", JSON.stringify(s)), seed);
  return page;
}

for (const path of ["chat", "evolution", "me"]) {
  // mobile — precisa continuar idêntico
  let page = await seededPage({ width: 390, height: 844 });
  await page.goto(`http://localhost:3000/${path}`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 700));
  const hasTabBarMobile = await page.evaluate(() => !!document.querySelector("nav"));
  const hasSidebarMobile = await page.evaluate(() =>
    Array.from(document.querySelectorAll("aside")).some((a) => a.offsetWidth > 0)
  );
  console.log(`[mobile] /${path}: TabBar visível=${hasTabBarMobile} sidebar visível=${hasSidebarMobile}`);
  await page.screenshot({ path: `${S}/responsive-${path}-mobile.png` });
  await page.close();

  // desktop — layout novo
  page = await seededPage({ width: 1440, height: 900 });
  await page.goto(`http://localhost:3000/${path}`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 700));
  const sidebarVisibleDesktop = await page.evaluate(() => {
    const a = document.querySelector("aside");
    return a ? a.offsetWidth > 0 : false;
  });
  const tabBarHiddenDesktop = await page.evaluate(() => {
    const nav = document.querySelector("nav.lg\\:hidden, nav[class*='lg:hidden']");
    if (!nav) return null;
    return getComputedStyle(nav).display === "none";
  });
  console.log(
    `[desktop] /${path}: sidebar visível=${sidebarVisibleDesktop} tabbar escondida=${tabBarHiddenDesktop}`
  );
  await page.screenshot({ path: `${S}/responsive-${path}-desktop.png` });
  await page.close();
}

await browser.close();

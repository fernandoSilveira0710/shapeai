import puppeteer from "puppeteer-core";

const BASE = "http://localhost:3111";

const seed = {
  state: {
    profile: {
      id: "u1",
      displayName: "Rafa",
      email: "demo@shape.ai",
      weightKg: 78,
      heightCm: 175,
      age: 28,
      goal: "hipertrofia",
      experience: "intermediario",
      equipment: ["academia"],
      injuries: "Nenhuma",
      workType: "presencial",
      budgetFood: "ok",
      dietRestrictions: [],
      cooksAtHome: true,
      trainDays: [1, 2, 3, 4, 5, 6, 0],
      trainDurationMin: 60,
      tone: "brother",
      onboardingCompleted: true,
      createdAt: "2026-07-10T10:00:00.000Z",
    },
    plan: {
      id: "p1",
      version: 1,
      workoutDays: Array.from({ length: 7 }, (_, wd) => ({
        weekday: wd,
        label: "Push",
        durationMin: 60,
        exercises: [
          { exerciseId: "bench-press", sets: 3, reps: "8-10", restSec: 5 },
        ],
        isRest: false,
      })),
      nutrition: {
        kcal: 2600, proteinG: 156, carbsG: 300, fatG: 72,
        meals: [], groceryList: [], notes: "",
      },
      createdAt: "2026-07-10T10:00:00.000Z",
      source: "ai",
    },
    messages: [],
    sessions: [],
    mealLogs: [],
    metrics: [],
    subscription: "basic",
    activeWorkoutId: null,
    lastOpenDate: null,
  },
  version: 0,
};

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox", "--window-size=420,900"],
});
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 850 });

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + e.message));

// seed localStorage no origin certo
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.evaluate((s) => {
  localStorage.setItem("shape-ai-v1", JSON.stringify(s));
}, seed);

await page.goto(BASE + "/chat", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1500));

const before = await page.evaluate(() => ({
  textareaVisible: !!document.querySelector("textarea") &&
    document.querySelector("textarea").offsetParent !== null,
  bubbles: document.querySelectorAll(".animate-rise").length,
  bodyLen: document.body.innerText.length,
}));
console.log("BEFORE:", JSON.stringify(before));

// digita e dá Enter
await page.focus("textarea");
await page.type("textarea", "como estou?", { delay: 30 });
const typed = await page.evaluate(() => document.querySelector("textarea").value);
console.log("TYPED VALUE:", JSON.stringify(typed));
await page.keyboard.press("Enter");
await new Promise((r) => setTimeout(r, 300));

const justAfter = await page.evaluate(() => ({
  textareaExists: !!document.querySelector("textarea"),
  textareaVisible: !!document.querySelector("textarea") &&
    document.querySelector("textarea").offsetParent !== null,
  textareaValue: document.querySelector("textarea")?.value ?? "(gone)",
  textareaRect: document.querySelector("textarea")?.getBoundingClientRect().toJSON() ?? null,
  userBubbleText: [...document.querySelectorAll(".animate-rise")].map((n) => n.innerText).slice(-4),
}));
console.log("JUST AFTER ENTER:", JSON.stringify(justAfter, null, 1));

// espera resposta da IA (typing delay ~1s + typewriter)
await new Promise((r) => setTimeout(r, 2500));
const after = await page.evaluate(() => ({
  textareaVisible: !!document.querySelector("textarea") &&
    document.querySelector("textarea").offsetParent !== null,
  lastTexts: [...document.querySelectorAll(".animate-rise")].map((n) => n.innerText).slice(-4),
}));
console.log("AFTER REPLY:", JSON.stringify(after, null, 1));

// enche o chat: composer tem que ficar FIXO no rodapé, só a lista rola
for (let i = 0; i < 7; i++) {
  await page.focus("textarea");
  await page.type("textarea", `mensagem de teste ${i}`, { delay: 5 });
  await page.keyboard.press("Enter");
  await new Promise((r) => setTimeout(r, 900));
}
const layout = await page.evaluate(() => {
  const ta = document.querySelector("textarea");
  const rect = ta.getBoundingClientRect();
  const scroller = document.querySelector(".chat-scroll");
  return {
    viewportH: window.innerHeight,
    composerBottom: Math.round(rect.bottom),
    composerVisible: rect.bottom <= window.innerHeight && rect.top > 0,
    pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 2,
    chatScrolls: scroller.scrollHeight > scroller.clientHeight,
    bubbles: document.querySelectorAll(".animate-rise").length,
  };
});
console.log("LAYOUT (chat cheio):", JSON.stringify(layout, null, 1));
if (!layout.composerVisible || layout.pageScrolls || !layout.chatScrolls) {
  console.log("❌ LAYOUT FALHOU: composer deve ser fixo, página não rola, chat rola");
  process.exitCode = 1;
} else {
  console.log("✅ composer fixo · página não rola · só o chat rola");
}

await page.screenshot({ path: process.env.SHOT || "chat-after.png" });
console.log("CONSOLE ERRORS:", JSON.stringify(consoleErrors, null, 1));

await browser.close();

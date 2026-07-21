import puppeteer from "puppeteer-core";

const S = process.env.SCRATCH || ".";
const now = new Date();

function dayKeyLocal(offsetDays) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

const today = dayKeyLocal(0);
const yesterday = dayKeyLocal(-1);
const twoDaysAgo = dayKeyLocal(-2);

function baseProfile(modules) {
  return {
    id: "u1",
    displayName: "Jão",
    email: "d@s.ai",
    weightKg: 92,
    heightCm: 176,
    age: 24,
    goal: "hipertrofia",
    experience: "intermediario",
    equipment: ["academia"],
    injuries: "Nenhuma",
    workType: "presencial",
    budgetFood: "ok",
    dietRestrictions: [],
    cooksAtHome: true,
    trainDays: [1, 3, 5],
    trainDurationMin: 75,
    tone: "brother",
    onboardingCompleted: true,
    createdAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    intakeCompleted: true,
    intakeNotes: [],
    trainTime: "06:00",
    modules,
    modulesSource: "self",
  };
}

function basePlan() {
  return {
    id: "p1",
    version: 1,
    workoutDays: Array.from({ length: 7 }, (_, i) => ({
      weekday: i,
      label: [1, 3, 5].includes(i) ? "Peito + tríceps" : "Descanso",
      durationMin: 75,
      exercises: [1, 3, 5].includes(i)
        ? [{ exerciseId: "bench-press", sets: 3, reps: "8-12", restSec: 90 }]
        : [],
      isRest: ![1, 3, 5].includes(i),
    })),
    nutrition: {
      kcal: 3201,
      proteinG: 208,
      carbsG: 392,
      fatG: 89,
      meals: [
        { slot: "cafe", title: "Café da manhã", items: ["Ovos + aveia"], swaps: [] },
        { slot: "almoco", title: "Almoço", items: ["Arroz, feijão, frango"], swaps: [] },
        { slot: "lanche", title: "Lanche", items: ["Whey + fruta"], swaps: [] },
        { slot: "janta", title: "Janta", items: ["Macarrão + frango"], swaps: [] },
      ],
      groceryList: [],
      notes: "",
    },
    createdAt: now.toISOString(),
    source: "ai",
    approvedAt: now.toISOString(),
  };
}

async function newPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 400, height: 850 });
  return page;
}

async function seedAndGoto(page, state) {
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await page.evaluate((s) => localStorage.setItem("shape-ai-v1", JSON.stringify(s)), {
    state,
    version: 0,
  });
  await page.goto("http://localhost:3000/chat", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 900));
}

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox"],
});

// ============================================================
// TESTE 1: módulo só treino — sem chips de dieta, sem câmera
// ============================================================
console.log("=== TESTE 1: módulo só treino ===");
{
  const page = await newPage(browser);
  await seedAndGoto(page, {
    profile: baseProfile(["treino"]),
    plan: basePlan(),
    messages: [],
    sessions: [],
    mealLogs: [],
    metrics: [{ id: "w1", kind: "weight", value: 92, measuredAt: now.toISOString() }],
    subscription: "pro",
    activeWorkoutId: null,
    lastOpenDate: today,
    dailyLlmCount: 0,
    dailyLlmDate: null,
    intakeQueue: [],
    intakeIndex: 0,
    awaitingFeedbackId: null,
  });
  const chips = await page.evaluate(() =>
    [...document.querySelectorAll("button")].map((b) => b.textContent?.trim()).filter(Boolean)
  );
  const cameraPresent = await page.evaluate(
    () => !!document.querySelector('button[aria-label*="prato"]')
  );
  console.log("chips:", JSON.stringify(chips));
  console.log("Tem 'Dieta hoje'/'Dieta semana' (esperado false):", chips.some((c) => ["Dieta hoje", "Dieta semana", "Já almocei"].includes(c)));
  console.log("Tem 'Treino hoje' (esperado true):", chips.includes("Treino hoje"));
  console.log("Tem 'Ativar dieta' (esperado true):", chips.includes("Ativar dieta"));
  console.log("Câmera presente (esperado false, sem módulo dieta mesmo em Pro):", cameraPresent);
  await page.close();
}

// ============================================================
// TESTE 2: módulo só dieta — sem chips de treino
// ============================================================
console.log("\n=== TESTE 2: módulo só dieta ===");
{
  const page = await newPage(browser);
  await seedAndGoto(page, {
    profile: baseProfile(["dieta"]),
    plan: basePlan(),
    messages: [],
    sessions: [],
    mealLogs: [],
    metrics: [{ id: "w1", kind: "weight", value: 92, measuredAt: now.toISOString() }],
    subscription: "basic",
    activeWorkoutId: null,
    lastOpenDate: today,
    dailyLlmCount: 0,
    dailyLlmDate: null,
    intakeQueue: [],
    intakeIndex: 0,
    awaitingFeedbackId: null,
  });
  const chips = await page.evaluate(() =>
    [...document.querySelectorAll("button")].map((b) => b.textContent?.trim()).filter(Boolean)
  );
  console.log("chips:", JSON.stringify(chips));
  console.log("Tem 'Treino hoje'/'Bora treinar' (esperado false):", chips.some((c) => ["Treino hoje", "Treino semana", "Bora treinar"].includes(c)));
  console.log("Tem 'Dieta hoje' (esperado true):", chips.includes("Dieta hoje"));
  console.log("Tem 'Ativar treino' (esperado true):", chips.includes("Ativar treino"));
  await page.close();
}

// ============================================================
// TESTE 3: reconciliação — ontem faltou lanche/janta, hoje abre app
// ============================================================
console.log("\n=== TESTE 3: abertura do dia cobra refeição de ontem ===");
{
  const page = await newPage(browser);
  await seedAndGoto(page, {
    profile: baseProfile(["treino", "dieta"]),
    plan: basePlan(),
    messages: [],
    sessions: [],
    mealLogs: [
      { id: "m1", slot: "cafe", description: "Ovos + aveia", adherence: "on_plan", loggedAt: `${yesterday}T08:00:00.000Z`, source: "chip" },
      { id: "m2", slot: "almoco", description: "Arroz, feijão, frango", adherence: "on_plan", loggedAt: `${yesterday}T12:30:00.000Z`, source: "chip" },
    ],
    metrics: [{ id: "w1", kind: "weight", value: 92, measuredAt: now.toISOString() }],
    subscription: "basic",
    activeWorkoutId: null,
    lastOpenDate: yesterday,
    dailyLlmCount: 0,
    dailyLlmDate: null,
    intakeQueue: [],
    intakeIndex: 0,
    awaitingFeedbackId: null,
  });
  const opening = await page.evaluate(() => {
    const bubbles = [...document.querySelectorAll(".animate-rise")];
    return bubbles[0]?.innerText ?? "(nenhuma mensagem)";
  });
  console.log("Mensagem de abertura:", JSON.stringify(opening));
  const mentionsGap = /lanche/i.test(opening) && /janta/i.test(opening);
  console.log("Menciona lanche E janta faltando (esperado true):", mentionsGap);
  await page.screenshot({ path: `${S}/reconciliacao-abertura.png` });

  // responde com o que comeu no almoço, e nada na janta
  await page.focus("textarea");
  await page.type("textarea", "no almoço comi arroz com frango mesmo, mas na janta não comi nada ontem", { delay: 5 });
  await page.keyboard.press("Enter");
  await new Promise((r) => setTimeout(r, 16000));
  const afterReply = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("shape-ai-v1")).state;
    return s.mealLogs;
  });
  console.log("mealLogs depois da resposta:", JSON.stringify(afterReply, null, 1));
  const gotPastLog = afterReply.some((l) => l.loggedAt.startsWith(yesterday) && l.slot === "almoco" && l.id !== "m2");
  console.log("Criou log retroativo de ontem pro almoço (esperado true):", gotPastLog);
  await page.close();
}

// ============================================================
// TESTE 4: justificativa fraca — não deve inventar log
// ============================================================
console.log("\n=== TESTE 4: 'esqueci mesmo' — não deve criar log falso ===");
{
  const page = await newPage(browser);
  await seedAndGoto(page, {
    profile: baseProfile(["treino", "dieta"]),
    plan: basePlan(),
    messages: [],
    sessions: [],
    mealLogs: [
      { id: "m1", slot: "cafe", description: "Ovos + aveia", adherence: "on_plan", loggedAt: `${yesterday}T08:00:00.000Z`, source: "chip" },
    ],
    metrics: [{ id: "w1", kind: "weight", value: 92, measuredAt: now.toISOString() }],
    subscription: "basic",
    activeWorkoutId: null,
    lastOpenDate: yesterday,
    dailyLlmCount: 0,
    dailyLlmDate: null,
    intakeQueue: [],
    intakeIndex: 0,
    awaitingFeedbackId: null,
  });
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem("shape-ai-v1")).state.mealLogs.length
  );
  await page.focus("textarea");
  await page.type("textarea", "esqueci mesmo, foi correria ontem", { delay: 5 });
  await page.keyboard.press("Enter");
  await new Promise((r) => setTimeout(r, 14000));
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem("shape-ai-v1")).state.mealLogs.length
  );
  console.log("mealLogs antes/depois (esperado igual):", before, "->", after);
  await page.close();
}

await browser.close();

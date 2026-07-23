import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";

const envRaw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const [, , alunoEmail, password] = process.argv;
if (!alunoEmail || !password) {
  console.error("uso: node test-governanca-chat.mjs <email> <senha>");
  process.exit(1);
}

const S = process.env.SCRATCH || ".";
const now = new Date();

const profile = {
  id: "u1", displayName: "Aluno Teste", email: alunoEmail, weightKg: 80, heightCm: 175, age: 25,
  goal: "hipertrofia", experience: "intermediario", equipment: ["academia"],
  injuries: "Nenhuma", workType: "presencial", budgetFood: "ok",
  dietRestrictions: [], cooksAtHome: true, trainDays: [1, 3, 5], trainDurationMin: 60,
  tone: "brother", onboardingCompleted: true,
  createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  intakeCompleted: true, intakeNotes: [], trainTime: "07:00",
  modules: ["treino", "dieta"], modulesSource: "self",
};

const plan = {
  id: "p1", version: 1,
  workoutDays: Array.from({ length: 7 }, (_, i) => ({
    weekday: i, label: [1, 3, 5].includes(i) ? "Perna" : "Descanso", durationMin: 60,
    exercises: [1, 3, 5].includes(i)
      ? [{ exerciseId: "leg-press", sets: 3, reps: "8-12", restSec: 90 }]
      : [],
    isRest: ![1, 3, 5].includes(i),
  })),
  nutrition: {
    kcal: 2800, proteinG: 180, carbsG: 320, fatG: 78,
    meals: [
      { slot: "cafe", title: "Café da manhã", items: ["Ovos + aveia"], swaps: [] },
      { slot: "almoco", title: "Almoço", items: ["Arroz, feijão, frango"], swaps: [] },
      { slot: "lanche", title: "Lanche", items: ["Whey + fruta"], swaps: [] },
      { slot: "janta", title: "Janta", items: ["Macarrão + frango"], swaps: [] },
    ],
    groceryList: [], notes: "",
  },
  createdAt: now.toISOString(), source: "ai", approvedAt: now.toISOString(),
};

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 850 });

await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });

console.log("=== Autenticando sessão REAL Supabase no browser ===");
const authResult = await page.evaluate(
  async (url, key, email, pw) => {
    const mod = await import("https://esm.sh/@supabase/ssr@0.12.3");
    const sb = mod.createBrowserClient(url, key);
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
    return { error: error?.message, hasSession: !!data?.session };
  },
  SUPA_URL,
  SUPA_KEY,
  alunoEmail,
  password
);
console.log(JSON.stringify(authResult));
if (authResult.error) {
  console.error("Falha ao autenticar no browser:", authResult.error);
  await browser.close();
  process.exit(1);
}

const cookies = await page.cookies();
console.log(
  "cookies sb-*:",
  cookies.filter((c) => c.name.startsWith("sb-")).map((c) => c.name)
);

await page.evaluate((s) => localStorage.setItem("shape-ai-v1", JSON.stringify(s)), {
  state: {
    profile, plan, messages: [], sessions: [], mealLogs: [],
    metrics: [{ id: "w1", kind: "weight", value: 80, measuredAt: now.toISOString() }],
    subscription: "basic", activeWorkoutId: null, lastOpenDate: now.toISOString().slice(0, 10),
    dailyLlmCount: 0, dailyLlmDate: null, intakeQueue: [], intakeIndex: 0,
    awaitingFeedbackId: null, nudgedToday: null,
  },
  version: 0,
});

await page.goto("http://localhost:3000/chat", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 800));

console.log("\n=== Pedindo pra trocar treino incluindo agachamento livre (banido pela constraint) ===");
await page.focus("textarea");
await page.type(
  "textarea",
  "troca meu treino de perna pra incluir agachamento livre, quero focar nisso",
  { delay: 5 }
);
await page.keyboard.press("Enter");
await new Promise((r) => setTimeout(r, 18000));

const lastMsgs = await page.evaluate(() =>
  [...document.querySelectorAll(".animate-rise")].slice(-2).map((n) => n.innerText)
);
console.log("Resposta da IA:");
console.log(JSON.stringify(lastMsgs, null, 1));

const mentionsRule = lastMsgs.some((m) => /personal|profissional|não posso|regra/i.test(m));
console.log("\nMenciona a regra do profissional (esperado true):", mentionsRule);

await page.screenshot({ path: `${S}/governanca-chat-recusa.png` });
await browser.close();

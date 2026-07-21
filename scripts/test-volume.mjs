import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 850 });

// onboarding real até gerar o plano (4 dias, intermediário, academia)
await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.goto("http://localhost:3000/onboarding", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 500));

await page.type("input", "Testador", { delay: 5 });
await page.click("input[type=checkbox]");
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Continuar")?.click();
});
await new Promise((r) => setTimeout(r, 300));

// step 1 corpo — deixa defaults (78/175/28), continuar
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Continuar")?.click();
});
await new Promise((r) => setTimeout(r, 300));

// step 2 objetivo — deixa hipertrofia default, continuar
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Continuar")?.click();
});
await new Promise((r) => setTimeout(r, 300));

// step 3 experiência/equipamento — deixa intermediário/academia default, continuar
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Continuar")?.click();
});
await new Promise((r) => setTimeout(r, 300));

// step 4 rotina — continuar
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Continuar")?.click();
});
await new Promise((r) => setTimeout(r, 300));

// step 5 grade de treino — default já é Seg/Qua/Sex; só adiciona Sáb (4 dias)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Sáb");
  btn?.click();
});
await new Promise((r) => setTimeout(r, 200));
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Continuar")?.click();
});
await new Promise((r) => setTimeout(r, 300));

const stepCheck = await page.evaluate(() => document.querySelector("h1")?.innerText);
console.log("Chegou no step:", stepCheck);

// step 6 tom — brother default, "Gerar meu plano"
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Gerar meu plano"))?.click();
});
await new Promise((r) => setTimeout(r, 2500));

const afterGen = await page.evaluate(() => document.body.innerText.slice(0, 150));
console.log("Após gerar:", afterGen);

// step final: "Ok, vamos conversar" — só aí completeOnboarding() salva o plano no store
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.innerText.includes("vamos conversar"))?.click();
});
await new Promise((r) => setTimeout(r, 1000));

const planData = await page.evaluate(() => {
  const raw = localStorage.getItem("shape-ai-v1");
  if (!raw) return null;
  const s = JSON.parse(raw).state;
  return s?.plan;
});

if (!planData) {
  console.log("FALHOU: sem plano gerado");
} else {
  console.log("Dias marcados (trainDays não exposto aqui, ver workoutDays):");
  for (const d of planData.workoutDays) {
    if (d.isRest) continue;
    const muscles = d.exercises.map((e) => e.exerciseId);
    console.log(`  weekday=${d.weekday} ${d.label}: ${d.exercises.length} exercícios — ${muscles.join(", ")}`);
  }
  // volume semanal por muscleGroup (recalcula client-side via fetch do catálogo não disponível aqui;
  // reporta só ids, contamos manualmente abaixo)
  const allIds = planData.workoutDays.flatMap((d) => d.exercises.map((e) => e.exerciseId));
  const bicepsCount = allIds.filter((id) => id.includes("curl")).length;
  const tricepsCount = allIds.filter((id) => id.includes("triceps")).length;
  console.log(`\nTotal exercícios na semana: ${allIds.length}`);
  console.log(`Exercícios com "curl" (bíceps): ${bicepsCount}`);
  console.log(`Exercícios com "triceps": ${tricepsCount}`);
}

await browser.close();

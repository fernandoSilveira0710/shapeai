import puppeteer from "puppeteer-core";

const S = process.env.SCRATCH || ".";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 850 });

async function clickByText(text) {
  const found = await page.evaluate((t) => {
    const btns = [...document.querySelectorAll("button")];
    const btn = btns.find((b) => b.textContent?.trim().startsWith(t));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }, text);
  if (!found) throw new Error(`Botão não encontrado: "${text}"`);
  await new Promise((r) => setTimeout(r, 250));
}

await page.goto("http://localhost:3000/onboarding", { waitUntil: "networkidle0" });
await page.waitForSelector('input[placeholder="Ex: Rafa"]', { timeout: 15000 });

// step 0: nome + consentimento
await page.type('input[placeholder="Ex: Rafa"]', "Teste GLP1");
await page.click('input[type="checkbox"]');
await clickByText("Continuar");

// step 1: módulos — escolhe "Só dieta"
await new Promise((r) => setTimeout(r, 200));
await page.screenshot({ path: `${S}/onboarding-step-modulos.png` });
await clickByText("Só dieta");
await new Promise((r) => setTimeout(r, 150));
await clickByText("Continuar");

// step 2: corpo (defaults válidos)
await clickByText("Continuar");
// step 3: objetivo (default hipertrofia)
await clickByText("Continuar");
// step 4: experiência/equipamento/lesões (defaults válidos)
await clickByText("Continuar");

// step 5: saúde/substância — ativa GLP-1
await new Promise((r) => setTimeout(r, 200));
await clickByText("GLP-1");
await new Promise((r) => setTimeout(r, 150));
await page.screenshot({ path: `${S}/onboarding-step-substancia.png` });
await clickByText("Continuar");

// step 6: rotina
await clickByText("Continuar");
// step 7: grade (defaults trainDays [1,3,5])
await clickByText("Continuar");
// step 8: tom (default brother) → gerar plano
await clickByText("Gerar meu plano");
await new Promise((r) => setTimeout(r, 1400));
// step 9: final
await clickByText("Ok, vamos conversar");
await new Promise((r) => setTimeout(r, 800));

const url = page.url();
console.log("URL final:", url);

const seeded = await page.evaluate(() => {
  const raw = localStorage.getItem("shape-ai-v1");
  return raw ? JSON.parse(raw).state : null;
});

console.log("\n=== Perfil salvo ===");
console.log("modules:", seeded?.profile?.modules);
console.log("substances:", JSON.stringify(seeded?.profile?.substances));
console.log(
  "plan.nutrition.notes contém GLP-1?",
  (seeded?.plan?.nutrition?.notes || "").includes("GLP-1")
);

// chips no chat: sem treino, com dieta
const chipsText = await page.evaluate(() =>
  [...document.querySelectorAll(".chat-scroll ~ div button, form ~ * button")]
    .map((b) => b.textContent?.trim())
    .filter(Boolean)
);
// fallback: pega todos os chips visíveis na barra
const allChips = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll("button")];
  return nodes.map((b) => b.textContent?.trim()).filter(Boolean);
});
console.log("\nBotões visíveis na tela de chat:", JSON.stringify(allChips));

const hasTreinoChip = allChips.some((c) =>
  ["Treino hoje", "Treino semana", "Bora treinar"].includes(c)
);
const hasAtivarTreino = allChips.includes("Ativar treino");
const cameraPresent = await page.evaluate(
  () => !!document.querySelector('button[aria-label*="prato"]')
);

console.log("\n=== Resultado ===");
console.log("Chip de treino presente (esperado false):", hasTreinoChip);
console.log("Chip 'Ativar treino' presente (esperado true):", hasAtivarTreino);
console.log("Botão de câmera presente (esperado true, módulo dieta ativo):", cameraPresent);

await page.screenshot({ path: `${S}/onboarding-resultado-chat.png` });
await browser.close();

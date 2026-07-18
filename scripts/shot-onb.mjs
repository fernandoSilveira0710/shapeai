import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new", args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 850 });
await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.goto("http://localhost:3000/onboarding", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 800));
await page.type("input", "Jão", { delay: 10 });
await page.click("input[type=checkbox]");
for (let i = 0; i < 6; i++) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /Continuar|Gerar meu plano/.test(x.innerText) && !x.disabled);
    b?.click();
  });
  await new Promise((r) => setTimeout(r, 500));
}
// step 6: gerar
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /Gerar meu plano/.test(x.innerText));
  b?.click();
});
await new Promise((r) => setTimeout(r, 2000));
await page.screenshot({ path: process.env.SHOT });
const txt = await page.evaluate(() => document.body.innerText.slice(0, 200));
console.log(txt);
await browser.close();

import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 850 });
// primeira visita: sem flag
await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.removeItem("shape-splash-seen"));
await page.reload({ waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 2500));
const mid = await page.evaluate(() => {
  const v = document.querySelector("video");
  return v ? { playing: !v.paused, t: v.currentTime.toFixed(1) } : null;
});
console.log("VIDEO 1a visita:", JSON.stringify(mid));
await page.screenshot({ path: process.env.SHOT });
// espera acabar (10s) + fade
await new Promise((r) => setTimeout(r, 10000));
const after = await page.evaluate(() => !!document.querySelector("video"));
console.log("video removido após fim:", !after);
// 2a visita: não deve ter vídeo
await page.reload({ waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 800));
const second = await page.evaluate(() => !!document.querySelector("video"));
console.log("2a visita tem vídeo?", second);
await browser.close();

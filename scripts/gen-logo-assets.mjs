import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC_TRANSPARENT = "../logo/logo-transparent.png";
const SRC_FULL = "../logo/logo.png";

mkdirSync("public/icons", { recursive: true });

// hero da welcome — crop central (S + glow próximo), sem a moldura vazia
await sharp(SRC_TRANSPARENT)
  .extract({ left: 232, top: 232, width: 560, height: 560 })
  .resize(360, 360)
  .png({ compressionLevel: 9 })
  .toFile("public/logo-mark.png");

// ícones PWA (fundo cheio pra maskable)
await sharp(SRC_FULL).resize(192, 192).png({ compressionLevel: 9 }).toFile("public/icons/icon-192.png");
await sharp(SRC_FULL).resize(512, 512).png({ compressionLevel: 9 }).toFile("public/icons/icon-512.png");

// apple touch
await sharp(SRC_FULL).resize(180, 180).png({ compressionLevel: 9 }).toFile("public/icons/apple-touch-icon.png");

const { size } = await sharp("public/logo-mark.png").metadata().then(async (m) => {
  const { statSync } = await import("node:fs");
  return { size: statSync("public/logo-mark.png").size, m };
});
console.log("logo-mark.png:", (size / 1024).toFixed(0) + "kb");
console.log("done");

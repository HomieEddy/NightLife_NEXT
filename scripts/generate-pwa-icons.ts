import sharp from "sharp";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourceFile = resolve(__dirname, "..", "public", "brand", "n-mark.png");
const outDir = resolve(__dirname, "..", "public", "icons");

const SIZES: { size: number; name: string }[] = [
  { size: 192, name: "icon-192x192.png" },
  { size: 512, name: "icon-512x512.png" },
];

async function main() {
  for (const { size, name } of SIZES) {
    const out = resolve(outDir, name);
    await sharp(sourceFile).resize(size, size).png().toFile(out);
    console.log(`Generated ${out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

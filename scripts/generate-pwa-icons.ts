import sharp from "sharp";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "..", "public", "icons");

const SIZES: { size: number; name: string }[] = [
  { size: 192, name: "icon-192x192.png" },
  { size: 512, name: "icon-512x512.png" },
];

const svg = `\
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="80" fill="#1a1410"/>
  <rect x="40" y="40" width="432" height="432" rx="60" fill="none" stroke="#d4a45a" stroke-width="8"/>
  <text x="256" y="180" text-anchor="middle" fill="#d4a45a" font-family="sans-serif" font-size="96" font-weight="bold">NL</text>
  <text x="256" y="330" text-anchor="middle" fill="#d4a45a" font-family="sans-serif" font-size="48">Night</text>
  <text x="256" y="390" text-anchor="middle" fill="#d4a45a" font-family="sans-serif" font-size="48">Life</text>
</svg>`;

async function main() {
  for (const { size, name } of SIZES) {
    const out = resolve(outDir, name);
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
    console.log(`Generated ${out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

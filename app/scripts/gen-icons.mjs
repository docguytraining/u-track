// One-off: rasterize icon-src.svg into the PWA PNG sizes. Run: node scripts/gen-icons.mjs
import sharp from 'sharp';

const src = new URL('../icon-src.svg', import.meta.url);
const out = (name) => new URL(`../public/${name}`, import.meta.url);
const jobs = [
  [512, 'icon-512.png'],
  [192, 'icon-192.png'],
  [180, 'apple-touch-icon.png'],
];

for (const [size, name] of jobs) {
  await sharp(src.pathname, { density: 384 }).resize(size, size).png().toFile(out(name).pathname);
  console.log('wrote', name);
}

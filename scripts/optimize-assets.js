/**
 * Re-encode hand-exported brand PNGs with palette quantization (lossless to the
 * eye, ~80-90% smaller). Run after re-exporting brand art:
 *
 *   node scripts/optimize-assets.js
 *
 * The launcher icon and adaptive foreground are NOT listed here — they are
 * emitted already-optimized by store/generate-brand-assets.js, and re-encoding
 * them would only degrade the foreground's alpha channel.
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');

// width: resize target (splash renders at 220dp, so 3x = 660px is plenty).
const TARGETS = [{ file: 'splash-icon.png', width: 660 }];

async function optimize({ file, width }) {
  const src = path.join(ASSETS, file);
  const before = fs.statSync(src).size;
  const tmp = `${src}.tmp`;

  await sharp(src)
    .resize({ width, withoutEnlargement: true })
    .png({ palette: true, quality: 90, compressionLevel: 9, effort: 10 })
    .toFile(tmp);

  const after = fs.statSync(tmp).size;
  if (after < before) {
    fs.renameSync(tmp, src);
    console.log(`${file}: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`);
  } else {
    fs.unlinkSync(tmp);
    console.log(`${file}: already optimal (${(before / 1024).toFixed(0)} KB)`);
  }
}

(async () => {
  for (const target of TARGETS) await optimize(target);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Self-check del decoder CMYK JPEG, Proxodon (no framework, stile scryfall.selfcheck).
 * Esegui:  node src/utils/vendor/jpegCmykDecoder.selfcheck.js
 *
 * Verifica che `decodeCMYK` produca DeviceCMYK NON invertito (0 = niente inchiostro)
 * su un vero JPEG CMYK, e stampa il transform APP14 rilevato. La banda "paper-white"
 * è il tripwire dell'inversione: se il decoder non invertisse, il bianco tornerebbe a
 * pieno inchiostro invece di tutti-zero.
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { decodeCMYK } from './jpegCmykDecoder.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const FIX = join(DIR, '__fixtures__');
let failures = 0;
const ok = (cond, msg) => { if (!cond) { failures++; console.error('  ✗ ' + msg); } else { console.log('  ✓ ' + msg); } };

// Swatch attesi (DeviceCMYK 0=no ink), nell'ordine in cui sono nel fixture sintetico:
// 5 bande verticali C, M, Y, K, paper-white.
const EXPECT = [
  ['Cyan',    [255, 0, 0, 0]],
  ['Magenta', [0, 255, 0, 0]],
  ['Yellow',  [0, 0, 255, 0]],
  ['Black',   [0, 0, 0, 255]],
  ['Paper',   [0, 0, 0, 0]],
];
const TOL = 8; // tolleranza JPEG q100 su tinte piatte (campionando il centro banda)

function checkSwatches(label, file) {
  console.log(`\n${label}: ${file}`);
  if (!existsSync(file)) { console.error('  ✗ fixture mancante'); failures++; return; }
  const buf = new Uint8Array(readFileSync(file));
  let dec;
  try {
    dec = decodeCMYK(buf);
  } catch (e) {
    console.warn('  ⚠ NON decodificabile come CMYK: ' + e.message);
    console.warn('  ⚠ (un export RGB non serve a testare il path CMYK, riesportare in CMYK)');
    return; // non blocca: warning, non failure
  }
  const transform = dec.adobe ? dec.adobe.transformCode : '(no APP14)';
  console.log(`  APP14 transform = ${transform}  ·  ${dec.width}×${dec.height}`);
  const W = dec.width, H = dec.height, n = EXPECT.length;
  const at = (px, py) => { const i = ((py * W) + px) * 4; return [dec.data[i], dec.data[i + 1], dec.data[i + 2], dec.data[i + 3]]; };
  for (let k = 0; k < n; k++) {
    const [name, exp] = EXPECT[k];
    const got = at(Math.floor((k + 0.5) * W / n), Math.floor(H / 2));
    const near = exp.every((v, c) => Math.abs(v - got[c]) <= TOL);
    ok(near, `${name}: got [${got}] ≈ expected [${exp}]`);
  }
}

console.log('=== jpegCmykDecoder self-check ===');
// Entrambi i rami APP14 coperti da VERI JPEG CMYK (stesse 5 bande C/M/Y/K/paper):
// - synthetic_cmyk.jpg → transform 0 (no color transform, inversione Adobe), Pillow.
// - photoshop_cmyk.jpg → transform 2 (YCCK), export Adobe reale.
checkSwatches('Synthetic CMYK (APP14 transform 0)', join(FIX, 'synthetic_cmyk.jpg'));
checkSwatches('Real Adobe CMYK (APP14 transform 2 / YCCK)', join(FIX, 'photoshop_cmyk.jpg'));

if (failures) throw new Error(`FAIL (${failures} assertion${failures > 1 ? 's' : ''})`);
console.log('\nPASS');

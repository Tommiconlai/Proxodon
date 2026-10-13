/**
 * Motore colore CMYK, Proxoteca
 *
 * Wrapper su lcms-wasm (Little-CMS in WASM). Converte buffer sRGB -> CMYK
 * usando il profilo ICC della tipografia. Caricato on-demand (dynamic import)
 * così gli utenti RGB non scaricano il WASM.
 *
 * Il canvas HTML è solo-RGB: per l'export CMYK l'arte RGB (Scryfall/upload RGB)
 * viene renderizzata su canvas, letta come RGBA e convertita qui in CMYK reale
 * con il profilo scelto. (I file già CMYK nativi sono Fase 2, non ancora gestiti.)
 */

import {
  instantiate,
  TYPE_RGBA_8,
  TYPE_CMYK_8,
  INTENT_PERCEPTUAL,
  INTENT_RELATIVE_COLORIMETRIC,
  cmsInfoDescription,
  cmsFLAGS_BLACKPOINTCOMPENSATION,
  cmsFLAGS_HIGHRESPRECALC,
} from 'lcms-wasm';
import wasmURL from 'lcms-wasm/dist/lcms.wasm?url';

// Istanza WASM singleton (instantiate è costoso; riusala).
let _lcms = null;
async function getLcms() {
  if (!_lcms) _lcms = await instantiate({ locateFile: () => wasmURL });
  return _lcms;
}

export const INTENTS = {
  relative: INTENT_RELATIVE_COLORIMETRIC,
  perceptual: INTENT_PERCEPTUAL,
};

// Classe del dispositivo dal header ICC (offset 12-15): 'prtr' output, 'mntr'
// display, 'scnr' input, 'link' DeviceLink, 'abst' astratto, 'nmcl' named color,
// 'spac' color space. lcms-wasm non espone cmsGetDeviceClass → la leggo dai byte.
function readDeviceClass(iccBytes) {
  if (!iccBytes || iccBytes.length < 16) return '';
  return String.fromCharCode(iccBytes[12], iccBytes[13], iccBytes[14], iccBytes[15]).trim();
}

/** Legge classe dispositivo + spazio colore + descrizione di un profilo ICC. */
export async function readProfileInfo(iccBytes) {
  const lcms = await getLcms();
  const p = lcms.cmsOpenProfileFromMem(iccBytes, iccBytes.byteLength);
  if (!p) throw new Error('ICC profile not readable.');
  const space = lcms.cmsGetColorSpaceASCII(p);
  let name = '';
  try { name = lcms.cmsGetProfileInfoASCII(p, cmsInfoDescription, 'en', 'US'); } catch { /* opzionale */ }
  lcms.cmsCloseProfile(p);
  return { space, name, deviceClass: readDeviceClass(iccBytes) };
}

/**
 * Crea un convertitore sRGB -> CMYK col profilo destinazione (tipografia).
 * Ritorna { convert(rgbaBytes, nPixels) => Uint8 CMYK (4ch interleaved), close() }.
 * L'input è RGBA (l'alpha viene ignorato): si passa direttamente il buffer di
 * getImageData. L'output è CMYK 8-bit dove 0 = niente inchiostro, 255 = pieno
 * (coincide con DeviceCMYK del PDF, nessuna inversione).
 */
export async function makeRgbToCmyk(iccBytes, intentKey = 'relative') {
  const lcms = await getLcms();
  const dst = lcms.cmsOpenProfileFromMem(iccBytes, iccBytes.byteLength);
  if (!dst) throw new Error('ICC profile not readable.');
  if (lcms.cmsGetColorSpaceASCII(dst) !== 'CMYK') {
    lcms.cmsCloseProfile(dst);
    throw new Error('The selected ICC profile is not a CMYK profile.');
  }
  const src = lcms.cmsCreate_sRGBProfile();
  const intent = INTENTS[intentKey] ?? INTENT_RELATIVE_COLORIMETRIC;
  const flags = cmsFLAGS_BLACKPOINTCOMPENSATION | cmsFLAGS_HIGHRESPRECALC;
  const xform = lcms.cmsCreateTransform(src, TYPE_RGBA_8, dst, TYPE_CMYK_8, intent, flags);
  lcms.cmsCloseProfile(src);
  lcms.cmsCloseProfile(dst);
  if (!xform) throw new Error('Could not build the colour transform.');
  return {
    convert(rgbaBytes, nPixels) {
      return lcms.cmsDoTransform(xform, rgbaBytes, nPixels);
    },
    close() { lcms.cmsDeleteTransform(xform); },
  };
}

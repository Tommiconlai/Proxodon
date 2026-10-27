/**
 * Profili ICC inclusi (ECI), Proxodon
 *
 * Profili di destinazione/output dell'ECI (eci.org), © Heidelberger Druckmaschinen AG, non liberi: il tag cprt dei
 * PSO v3 li lascia usare e incorporare (nei PDF) senza limiti, non distribuire senza il permesso scritto dell'ECI;
 * ISO Coated v2 dice solo "All Rights Reserved". Crediti in third-party-notices.txt. Servono perché
 * l'export CMYK abbia un default pronto all'uso senza upload. Importati come asset
 * URL (?url): emessi sotto la base relativa e scaricati on-demand (NON inlinati
 * nel bundle principale), stesso meccanismo di lcms.wasm.
 */

import isoCoatedUrl from '../assets/icc/ISOcoated_v2_eci.icc?url';
import psoCoatedUrl from '../assets/icc/PSOcoated_v3.icc?url';
import psoUncoatedUrl from '../assets/icc/PSOuncoated_v3_FOGRA52.icc?url';

// id · label (visibile → inglese) · url asset · condition (OutputConditionIdentifier
// nel PDF) · info (descrizione, va nel campo Info dell'OutputIntent).
// info = descrizione ESATTA letta da lcms (coincide col campo desc del profilo):
// così l'avviso di mismatch (§2) confronta come uguali un file nativo che incorpora
// lo stesso profilo ECI, e il campo Info dell'OutputIntent è coerente col profilo.
export const BUNDLED_PROFILES = [
  { id: 'fogra39', label: 'Coated FOGRA39 (ISO Coated v2)', url: isoCoatedUrl, condition: 'FOGRA39', info: 'ISO Coated v2 (ECI)' },
  { id: 'fogra51', label: 'Coated FOGRA51 (PSO Coated v3)', url: psoCoatedUrl, condition: 'FOGRA51', info: 'PSO Coated v3' },
  { id: 'fogra52', label: 'Uncoated FOGRA52 (PSO Uncoated v3)', url: psoUncoatedUrl, condition: 'FOGRA52', info: 'PSO Uncoated v3 (FOGRA52)' },
];

export const DEFAULT_PROFILE_ID = 'fogra39';
export const UPLOAD_ID = 'upload';

export const getProfileMeta = (id) => BUNDLED_PROFILES.find((p) => p.id === id) || null;

// Scarica (e cache) i byte di un profilo incluso. Fetch lazy: i file .icc (~2 MB
// l'uno) non entrano nel bundle, si scaricano solo alla prima generazione.
const _cache = new Map();
export async function loadBundledProfileBytes(id) {
  const meta = getProfileMeta(id);
  if (!meta) throw new Error('Unknown bundled profile.');
  if (!_cache.has(id)) {
    const res = await fetch(meta.url);
    // Senza questo controllo una pagina d'errore (404) diventerebbe il profilo e lcms fallirebbe più avanti, oscuro.
    if (!res.ok) throw new Error(`Could not load the ${meta.info} profile (${res.status}). Check your connection and try again.`);
    const buf = await res.arrayBuffer();
    _cache.set(id, new Uint8Array(buf));
  }
  return _cache.get(id);
}

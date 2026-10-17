import { Capacitor } from '@capacitor/core';

const CHUNK = 3 * 1024 * 1024; // byte per scrittura nativa: niente stringa base64 gigante per un PDF da decine di MB

const toBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result.slice(r.result.indexOf(',') + 1));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

// Salva un file. Web: link temporaneo con download. App Android (dove <a download> non salva nulla): lo
// scrive a pezzi nella cache dell'app e apre il foglio di condivisione (apri, salva in File o Drive, invia).
// ponytail: i file restano nella cache, Android la svuota da solo quando serve spazio.
export async function saveFile(filename, blob) {
  if (!Capacitor.isNativePlatform()) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    return;
  }
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'), import('@capacitor/share'),
  ]);
  const file = { path: `exports/${filename}`, directory: Directory.Cache };
  let at = 0;
  do {
    const data = await toBase64(blob.slice(at, at + CHUNK)); // senza encoding il plugin decodifica il base64
    if (at === 0) await Filesystem.writeFile({ ...file, data, recursive: true });
    else await Filesystem.appendFile({ ...file, data });
    at += CHUNK;
  } while (at < blob.size);
  const { uri } = await Filesystem.getUri(file);
  try {
    await Share.share({ title: filename, files: [uri] });
  } catch (e) {
    if (!/cancel/i.test(e?.message ?? '')) throw e; // foglio chiuso senza scelta = nessun errore
  }
}

// Scarica un testo come file (export del mazzo, backup dei mazzi, lista della stampa).
export const downloadText = (filename, text, type = 'text/plain') => saveFile(filename, new Blob([text], { type }));

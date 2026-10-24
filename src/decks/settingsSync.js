import { onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { prefsDoc } from './deckStore';
import { getSettings, applySettings, onLocalChange } from '../utils/settings';

// Impostazioni sull'account: users/{uid}/settings/prefs = { s: tutte le impostazioni, at: ora del server }, solo del
// proprietario (regole). C'è il documento = le impostazioni dell'account prendono il posto di quelle del dispositivo
// (anche quando cambiano su un altro dispositivo); il server dice che non c'è = si salvano quelle del dispositivo. Ogni
// cambio fatto qui va su 800 ms dopo l'ultimo; finché un cambio aspetta o viaggia, gli snapshot non lo sovrascrivono.
// La avvia useAccount (una sola per account, chiamarla di nuovo con lo stesso uid non fa nulla); null la ferma.
let active = null; // { uid, stop }

export function syncSettings(uid) {
  if (active?.uid === uid) return;
  active?.stop();
  active = null;
  if (!uid) return;
  let timer = null;
  let flying = 0;
  let checked = false; // il server ha già risposto: un documento che sparisce dopo (Delete account) non si ricrea
  const push = () => {
    timer = null;
    flying += 1;
    setDoc(prefsDoc(uid), { s: getSettings(), at: serverTimestamp() }).catch(() => {}).finally(() => { flying -= 1; });
  };
  const offLocal = onLocalChange(() => { clearTimeout(timer); timer = setTimeout(push, 800); });
  const offSnap = onSnapshot(prefsDoc(uid), (snap) => {
    const first = !checked && !snap.metadata.fromCache;
    if (!snap.metadata.fromCache) checked = true;
    if (snap.metadata.hasPendingWrites || timer || flying) return;
    if (snap.exists()) applySettings(snap.data().s);
    else if (first) push();
  }, () => { /* regole non pubblicate o offline: restano quelle del dispositivo */ });
  active = { uid, stop: () => { offSnap(); offLocal(); clearTimeout(timer); } };
}

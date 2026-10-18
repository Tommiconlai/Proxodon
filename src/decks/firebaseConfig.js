// Config pubblica del progetto Firebase: non è un segreto. L'accesso ai dati lo proteggono le
// regole Firestore (firestore.rules) e i domini autorizzati di Authentication.
// ponytail: niente Analytics (measurementId omesso), servirebbe il consenso cookie.
// L'id del progetto resta 'proxoteca' anche dopo il cambio di nome in Proxodon: Firebase non lo rinomina.
export const firebaseConfig = {
  apiKey: 'AIzaSyDET0Re655vDKOmQehd3kuRRVXsZqNDk8A',
  authDomain: 'proxoteca.firebaseapp.com',
  projectId: 'proxoteca',
  storageBucket: 'proxoteca.firebasestorage.app',
  messagingSenderId: '43667971625',
  appId: '1:43667971625:web:33cbf783d7d72cd6460638',
};

// Login Google nativo dell'app Android: il client OAuth "Web" del progetto (Authentication > Google >
// Web SDK configuration; è il client_id che Firebase usa anche per il redirect Google del web), pubblico come
// il resto. Il client Android lo crea Firebase dallo SHA-1 della chiave di firma.
export const googleWebClientId = '43667971625-vs4bpugk1rdptel5a5lhg5dsk57nchmj.apps.googleusercontent.com';

// App Check: chiave del sito reCAPTCHA (pubblica anche lei), da Google Cloud > Security > reCAPTCHA, con i domini
// tommiconlai.github.io e localhost (dev e app Android). Vuota = App Check spento.
export const appCheckSiteKey = '';

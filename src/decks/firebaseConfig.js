// Config pubblica del progetto Firebase: non è un segreto. L'accesso ai dati lo proteggono le
// regole Firestore (firestore.rules) e i domini autorizzati di Authentication.
// Niente Analytics (measurementId omesso), servirebbe il consenso cookie.
// L'id del progetto resta 'proxoteca' anche dopo il cambio di nome in Proxodon: Firebase non lo rinomina.
export const firebaseConfig = {
  apiKey: 'AIzaSyDET0Re655vDKOmQehd3kuRRVXsZqNDk8A',
  authDomain: 'proxoteca.firebaseapp.com',
  projectId: 'proxoteca',
  storageBucket: 'proxoteca.firebasestorage.app',
  messagingSenderId: '43667971625',
  appId: '1:43667971625:web:33cbf783d7d72cd6460638',
};

// App Check: chiave del sito reCAPTCHA (pubblica anche lei), da Google Cloud > Security > reCAPTCHA, con i domini
// tommiconlai.github.io e localhost (dev). Vuota = App Check spento.
export const appCheckSiteKey = '';

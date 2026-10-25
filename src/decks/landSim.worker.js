import { simulate } from './landSim.js';

// Worker della simulazione terre: { input, params } → { progress } (al massimo ogni 100 ms) e poi { result } o { error }.
// Per fermarla il LandPanel chiude il worker (terminate): il ciclo è sincrono e un messaggio di stop non arriverebbe.
self.onmessage = ({ data }) => {
  let last = 0;
  try {
    const result = simulate(data.input, data.params, (done, total) => {
      const now = Date.now();
      if (now - last > 100) {
        last = now;
        self.postMessage({ progress: done / total });
      }
    });
    self.postMessage({ result });
  } catch (e) {
    self.postMessage({ error: e.message });
  }
};

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBackClose } from '../hooks/useBackClose';
import { IconArrowLeft, IconArrowRight, IconCheck, IconReplay, IconX } from '../components/icons';

// Tutorial guidato. Sopra la pagina vera, che resta montata ma inerte (#root inert: niente click, tasti o screen
// reader, quindi le carte e i mazzi dell'utente non si toccano), una pagina demo (tour.Stage, dati finti in memoria),
// il velo scuro con il buco sulla zona del passo e la scheda del passo (dialog). Un passo può mostrare il suo gesto
// con un cursore finto (play): click, tocco, selezione ad area, trascinamento, menu, pressione lunga.
// Esc chiude, ← → cambiano passo, Tab resta nella scheda; il back del sistema chiude.
// tour = { label, Stage, steps: [{ target, title, text, play? }] }. Stage({ apiRef, step, mobile }) si rimonta a ogni
// passo e a ogni Replay (riparte dai dati demo) e mette le sue azioni in apiRef.current, che play usa dopo il gesto.
// play(g) riceve il kit dei gesti (makeKit) ed è async: cambiare passo o chiudere lo interrompe.
export default function Tutorial({ tour, mobile, onClose }) {
  const { steps, Stage, label } = tour;
  const [i, setI] = useState(0);
  const [run, setRun] = useState(0); // Replay: rimonta la demo e ripete il gesto
  const [menu, setMenu] = useState(null); // menu finto aperto dal gesto: { x, y, title, items }
  const [top, setTop] = useState(headerBottom);
  const step = steps[i];
  const last = i === steps.length - 1;
  const api = useRef({});
  const stageRef = useRef(null);
  const spotRef = useRef(null);
  const cardRef = useRef(null);
  const nextRef = useRef(null);
  const fx = useRef({}); // nodi del cursore e degli effetti
  const focus = useRef(null); // zona del buco spostata dal gesto (g.spot), al posto di step.target
  const pos = useRef({ x: window.innerWidth * 0.7, y: window.innerHeight * 0.85 }); // il cursore riparte da dov'era
  const titleId = useId();
  const textId = useId();

  const next = useCallback(() => (last ? onClose() : setI((n) => n + 1)), [last, onClose]);
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);
  useBackClose(true, onClose);

  // Pagina vera inerte finché il tutorial è aperto; alla chiusura il focus torna al ? da cui è partito.
  useEffect(() => {
    const root = document.getElementById('root');
    const opener = document.querySelector('.app-header .help-btn, .mobile-header .help-btn');
    if (root) root.inert = true;
    nextRef.current?.focus();
    return () => {
      if (root) root.inert = false;
      opener?.focus();
    };
  }, []);

  // La demo sta sotto l'header dell'app (resta visibile, oscurata): segue i ridimensionamenti.
  useEffect(() => {
    const onResize = () => setTop(headerBottom());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Tastiera: in cattura sulla finestra, così le scorciatoie della pagina sotto (Canc, Ctrl+A, Esc) non partono.
  useEffect(() => {
    const onKey = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowRight' && !e.altKey) { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' && !e.altKey) { e.preventDefault(); back(); }
      else if (e.key === 'Tab') {
        const els = [...cardRef.current.querySelectorAll('button')];
        const at = els.indexOf(document.activeElement);
        e.preventDefault();
        els[(at + (e.shiftKey ? -1 : 1) + els.length) % els.length]?.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [next, back, onClose]);

  // Cambiando passo il pulsante col focus può sparire (Replay su un passo senza gesto): il focus torna su Avanti.
  useEffect(() => {
    if (!cardRef.current.contains(document.activeElement)) nextRef.current?.focus();
  }, [step]);

  // Il gesto del passo, dopo che la demo si è montata e misurata.
  useEffect(() => {
    const ctrl = new AbortController();
    const reset = () => {
      setMenu(null);
      focus.current = null;
      const f = fx.current;
      [f.ghost, f.box, f.drop, f.label].forEach((n) => { if (n) n.hidden = true; });
      f.cursor?.classList.remove('down');
      if (f.cursor) f.cursor.hidden = !step.play;
    };
    reset();
    const t = step.play && setTimeout(() => {
      fx.current.cursor.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px)`;
      step.play(makeKit({ stage: stageRef.current, fx: fx.current, pos: pos.current, api, setMenu, focus, signal: ctrl.signal }))
        .catch((e) => { if (e?.name !== 'AbortError') console.error(e); })
        .finally(() => { if (!ctrl.signal.aborted) fx.current.label.hidden = true; });
    }, 450);
    return () => { clearTimeout(t); ctrl.abort(); reset(); };
  }, [step, run]);

  // Buco sulla zona del passo e scheda accanto, ricalcolati a ogni frame (la demo carica immagini e si
  // ridimensiona): stile scritto sui nodi, niente render.
  useLayoutEffect(() => {
    let raf = 0;
    let prev = '';
    const tick = () => {
      const sel = focus.current || step.target;
      const el = sel && (stageRef.current?.querySelector(sel) || document.querySelector(sel));
      const r = el?.getBoundingClientRect();
      const card = cardRef.current;
      const key = `${r ? [r.left, r.top, r.width, r.height].map(Math.round) : '-'}|${card.offsetHeight}|${window.innerWidth}x${window.innerHeight}`;
      if (key !== prev) {
        prev = key;
        place(spotRef.current, card, r, mobile, step.side);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [step, mobile]);

  return createPortal(
    <div className={`tut${mobile ? ' is-mobile' : ''}`}>
      <div className="tut-stage" ref={stageRef} style={{ top }} inert aria-hidden="true">
        <Stage key={`${i}.${run}`} apiRef={api} step={step} mobile={mobile} />
      </div>
      <div className="tut-spot" ref={spotRef} aria-hidden="true" />
      <div className="tut-fx" ref={(n) => { fx.current.root = n; }} inert aria-hidden="true">
        <div className="tut-drop" ref={(n) => { fx.current.drop = n; }} hidden />
        <div className="marquee tut-box" ref={(n) => { fx.current.box = n; }} hidden />
        {menu && <FxMenu {...menu} avoid={mobile ? cardRef : null} />}
        <div className="tut-ghost" ref={(n) => { fx.current.ghost = n; }} hidden />
        <div className={`tut-cursor${mobile ? ' touch' : ''}`} ref={(n) => { fx.current.cursor = n; }} hidden>
          {!mobile && (
            <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 2.5 19.5 12l-7 1.6L9 20.5Z" />
            </svg>
          )}
          <span className="tut-label" ref={(n) => { fx.current.label = n; }} hidden />
        </div>
      </div>
      <div className="tut-card" ref={cardRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={textId}>
        <div aria-live="polite">
          <p className="tut-count"><span>{label}</span> <span>{i + 1} / {steps.length}</span></p>
          <h2 className="tut-title" id={titleId}>{step.title}</h2>
          <p className="tut-text" id={textId}>{step.text}</p>
        </div>
        <div className="tut-dots" aria-hidden="true">{steps.map((s, k) => <span key={k} className={k === i ? 'on' : k < i ? 'done' : undefined} />)}</div>
        <div className="tut-nav">
          <button type="button" className="btn-secondary deck-icon-btn" onClick={onClose} aria-label="Close tutorial" title="Close tutorial (Esc)"><IconX size={18} /></button>
          {step.play && (
            <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setRun((n) => n + 1)} aria-label="Show the gesture again" title="Show the gesture again"><IconReplay size={18} /></button>
          )}
          <span className="tut-nav-gap" />
          {/* aria-disabled, non disabled: al primo passo il focus resta qui invece di perdersi. */}
          <button type="button" className="btn-secondary deck-icon-btn" onClick={back} aria-disabled={i === 0 || undefined} aria-label="Previous step" title="Previous step (←)"><IconArrowLeft size={18} /></button>
          <button type="button" className="btn-add deck-icon-btn" ref={nextRef} onClick={next}
            aria-label={last ? 'Finish tutorial' : 'Next step'} title={last ? 'Finish tutorial' : 'Next step (→)'}>
            {last ? <IconCheck size={18} /> : <IconArrowRight size={18} />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const headerBottom = () => Math.round(document.querySelector('.app-header, .mobile-header')?.getBoundingClientRect().bottom || 0);
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion');
const abort = () => new DOMException('Tutorial step changed', 'AbortError');

// Buco (spot) sulla zona, ritagliata allo schermo, e scheda del passo dove c'è posto: accanto se la zona è alta,
// sotto o sopra se è larga, altrimenti nell'angolo in basso a destra (side = lato preferito, es. 'left' quando sotto
// la zona si apre una tendina). Telefono: in basso, o in alto se la zona sta giù.
function place(spot, card, r, mobile, side) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const m = 16;
  if (r) {
    const pad = 6;
    const left = Math.max(2, r.left - pad);
    const top = Math.max(2, r.top - pad);
    const right = Math.min(W - 2, r.right + pad);
    const bottom = Math.min(H - 2, r.bottom + pad);
    Object.assign(spot.style, { left: `${left}px`, top: `${top}px`, width: `${Math.max(0, right - left)}px`, height: `${Math.max(0, bottom - top)}px` });
    spot.classList.remove('none');
  } else spot.classList.add('none');
  const cw = card.offsetWidth;
  const ch = card.offsetHeight;
  let x = W - cw - m;
  let y = H - ch - m;
  if (mobile || W < 640) {
    x = (W - cw) / 2;
    y = r && r.top + r.height / 2 > H * 0.55 ? Math.max(m, headerBottom() + 8) : H - ch - m;
  } else if (!r) {
    x = (W - cw) / 2;
    y = (H - ch) / 2;
  } else {
    const clampX = (v) => Math.min(Math.max(m, v), W - cw - m);
    const clampY = (v) => Math.min(Math.max(m, v), H - ch - m);
    const options = [
      ['right', r.right + 18 + cw <= W - m, r.right + 18, clampY(r.top)],
      ['left', r.left - 18 - cw >= m, r.left - 18 - cw, clampY(r.top)],
      ['below', r.bottom + 18 + ch <= H - m, clampX(r.left), r.bottom + 18],
      ['above', r.top - 18 - ch >= m, clampX(r.left), r.top - 18 - ch],
    ];
    const first = options.findIndex((o) => o[0] === side);
    const order = [...new Set([...(first >= 0 ? [first] : []), ...(r.width > r.height ? [2, 3, 0, 1] : [0, 1, 2, 3])])];
    const hit = order.map((k) => options[k]).find((o) => o[1]);
    if (hit) [, , x, y] = hit;
  }
  card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

// Interpolazione con easing su requestAnimationFrame; ms 0 (Reduce motion) = subito alla fine.
function tween(ms, fn, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abort()); return; }
    if (!ms) { fn?.(1); resolve(); return; }
    const t0 = performance.now();
    let raf = 0;
    const stop = () => { cancelAnimationFrame(raf); reject(abort()); };
    const frame = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      fn?.(p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2);
      if (p < 1) raf = requestAnimationFrame(frame);
      else { signal.removeEventListener('abort', stop); resolve(); }
    };
    signal.addEventListener('abort', stop, { once: true });
    raf = requestAnimationFrame(frame);
  });
}

// Kit dei gesti per play: bersagli = selettore nella demo, elemento o punto { x, y }. Ogni gesto muove il
// cursore, lo preme (cerchio che si allarga), mostra l'etichetta del gesto e poi chiama effect, che cambia la demo
// (di solito con le azioni di api o un click vero sugli elementi della demo, mai fuori dalla demo).
function makeKit({ stage, fx, pos, api, setMenu, focus, signal }) {
  const fast = reduced();
  const wait = (ms) => tween(fast ? 0 : ms, null, signal);
  const find = (t) => (typeof t === 'string' ? stage.querySelector(t) : t);
  const isPoint = (t) => typeof t === 'object' && !(t instanceof Element);
  const at = (t, fx0 = 0.5, fy0 = 0.5) => {
    if (isPoint(t)) return t;
    const el = find(t);
    if (!el) throw new Error(`Tutorial: nothing at ${t}`);
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); // dentro una colonna che scorre (sidebar, mazzo)
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width * fx0, y: r.top + r.height * fy0 };
  };
  const draw = () => { fx.cursor.style.transform = `translate(${pos.x}px, ${pos.y}px)`; };
  const move = async (t, ms = 650, onFrame) => {
    const p = at(t);
    const x0 = pos.x;
    const y0 = pos.y;
    await tween(fast ? 0 : ms, (k) => { pos.x = x0 + (p.x - x0) * k; pos.y = y0 + (p.y - y0) * k; draw(); onFrame?.(); }, signal);
  };
  const say = (text) => { fx.label.textContent = text || ''; fx.label.hidden = !text; };
  const ripple = (kind = '') => {
    const r = document.createElement('span');
    r.className = `tut-ripple ${kind}`;
    r.style.left = `${pos.x}px`;
    r.style.top = `${pos.y}px`;
    fx.root.append(r);
    setTimeout(() => r.remove(), 900);
  };
  const press = async (kind, ms = 170) => {
    fx.cursor.classList.add('down');
    ripple(kind);
    await wait(ms);
    fx.cursor.classList.remove('down');
  };
  const glow = (el) => {
    const r = el.getBoundingClientRect();
    Object.assign(fx.drop.style, { left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 8}px`, height: `${r.height + 8}px` });
    fx.drop.hidden = false;
  };
  return {
    api: api.current,
    el: find,
    els: (s) => [...stage.querySelectorAll(s)],
    at,
    wait,
    say,
    move,
    hideMenu: () => setMenu(null),
    // Sposta il buco su un'altra zona della demo (null = torna a quella del passo).
    spot: (sel) => { focus.current = sel; },
    async click(t, text, effect) {
      say(text);
      await move(t);
      await press();
      effect?.(find(t));
      await wait(380);
    },
    // Menu finto (copia di CardMenu) dove si è premuto, dopo effect (es. la carta che si seleziona);
    // spec = { title, items: [[Icon, label, danger?]] }; hold = pressione lunga (telefono).
    async menu(t, spec, { text = 'Right-click', hold, effect } = {}) {
      say(text);
      await move(t);
      if (hold) {
        fx.cursor.classList.add('down');
        ripple('hold');
        await wait(650);
        fx.cursor.classList.remove('down');
      } else await press('alt');
      effect?.(find(t));
      say('');
      setMenu({ ...spec, x: pos.x, y: pos.y });
      await wait(1800);
    },
    // Trascina: ghost = nodo da clonare sotto il cursore; da = punto di partenza (anche fuori dalla demo, i file).
    async drag(from, to, { text = 'Drag', ghost, effect, over } = {}) {
      say(text);
      await move(from);
      fx.cursor.classList.add('down');
      await wait(200);
      const g = fx.ghost;
      g.replaceChildren(...(ghost ? [ghost.cloneNode(true)] : []));
      g.hidden = false;
      const follow = () => { g.style.transform = `translate(${pos.x}px, ${pos.y}px)`; };
      follow();
      over?.(true);
      await move(to, 1150, follow);
      const target = !isPoint(to) && find(to);
      if (target) glow(target);
      await wait(380);
      fx.cursor.classList.remove('down');
      ripple();
      g.hidden = true;
      fx.drop.hidden = true;
      over?.(false);
      effect?.();
      await wait(500);
    },
    // Selezione ad area da a a b: il rettangolo segue il cursore; effect(rect) alla fine.
    async marquee(a, b, { text = 'Drag on an empty spot', effect } = {}) {
      say(text);
      const p = at(a);
      const q = at(b);
      await move(p);
      fx.cursor.classList.add('down');
      await wait(160);
      const box = fx.box;
      const rect = () => ({ left: Math.min(p.x, pos.x), top: Math.min(p.y, pos.y), right: Math.max(p.x, pos.x), bottom: Math.max(p.y, pos.y) });
      const paint = () => {
        const r = rect();
        Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.right - r.left}px`, height: `${r.bottom - r.top}px` });
      };
      paint();
      box.hidden = false;
      await move(q, 1300, paint);
      effect?.(rect());
      await wait(350);
      fx.cursor.classList.remove('down');
      box.hidden = true;
      await wait(450);
    },
    // Scrive in un campo della demo, un carattere alla volta (set = setter dello stato demo).
    async type(t, text, set) {
      say('');
      await move(t);
      await press();
      for (let k = 1; k <= text.length; k += 1) {
        set(text.slice(0, k));
        await wait(110);
      }
    },
  };
}

// Copia del menu delle carte (CardMenu) senza focus né ascolti: solo da guardare. avoid = la scheda del passo
// (telefono, in alto o in basso): il menu resta nello spazio libero, sopra il dito se sotto non ci sta.
function FxMenu({ x, y, title, items, avoid }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const r = el.getBoundingClientRect();
    const c = avoid?.current?.getBoundingClientRect();
    let lo = 8;
    let hi = window.innerHeight - 8;
    if (c && c.top > window.innerHeight / 2) hi = Math.min(hi, c.top - 8);
    else if (c) lo = Math.max(lo, c.bottom + 8);
    const top = y + 6 + r.height > hi ? y - r.height - 6 : y + 6;
    el.style.left = `${Math.max(8, Math.min(x + 6, window.innerWidth - r.width - 8))}px`;
    el.style.top = `${Math.max(lo, Math.min(top, hi - r.height))}px`;
  }, [x, y, avoid]);
  return (
    <div className="card-menu" ref={ref}>
      <div className="card-menu-title">{title}</div>
      {items.map((it) => {
        const [Icon, text, danger] = it;
        return <button key={text} type="button" tabIndex={-1} className={danger ? 'danger' : undefined}><Icon size={15} /> {text}</button>;
      })}
    </div>
  );
}

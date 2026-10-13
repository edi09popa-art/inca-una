/* Încă Una · the bar that loads as you scroll, the rail, the three reps, the form. Plain JS, no build step. */
(() => {
  'use strict';
  const doc = document;
  const $ = (s, r = doc) => r.querySelector(s);
  const $$ = (s, r = doc) => Array.from(r.querySelectorAll(s));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const smoothstep = (p, e0, e1) => { const t = clamp((p - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const ease5 = t => t * t * t * (t * (t * 6 - 15) + 10);
  const rng = seed => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
  const onMQ = (m, fn) => (m.addEventListener ? m.addEventListener('change', fn) : m.addListener(fn));

  /* The static-hero gates. These strings match the CSS media queries exactly. */
  const GATES = [
    '(prefers-reduced-motion: reduce)',
    '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)'
  ];
  const MQLS = GATES.map(q => matchMedia(q));
  const RM = MQLS[0];
  const NARROW = matchMedia('(max-width: 820px)');

  /* split a headline into words and letters once, so the scroll can assemble it */
  function splitEl(el) {
    const text = el.textContent.trim(), mode = el.dataset.fx;
    const sr = doc.createElement('span'); sr.className = 'sr-only'; sr.textContent = text;
    const vis = doc.createElement('span'); vis.className = 'vis'; vis.setAttribute('aria-hidden', 'true');
    const words = text.split(/\s+/);
    const total = text.replace(/\s+/g, '').length, mid = (total - 1) / 2;
    let ci = 0;
    words.forEach((w, wi) => {
      const ws = doc.createElement('span'); ws.className = 'w';
      if (mode === 'rise') {
        ws.style.setProperty('--th', (words.length > 1 ? (wi / (words.length - 1)) * 0.4 : 0).toFixed(3));
        ws.textContent = w;
      } else {
        /* letters nearest the middle land first, the outer ones travel furthest: plates sliding in from both ends */
        for (const ch of w) {
          const c = doc.createElement('span'); c.className = 'c'; c.textContent = ch;
          const dn = mid > 0 ? Math.abs(ci - mid) / mid : 0, sg = ci < mid ? -1 : 1;
          c.style.cssText = `--th:${(dn * 0.5).toFixed(3)};--jx:${(sg * (24 + dn * 66)).toFixed(1)}px`;
          ws.appendChild(c); ci++;
        }
      }
      vis.appendChild(ws);
      if (wi < words.length - 1) vis.appendChild(doc.createTextNode(' '));
    });
    el.textContent = '';
    el.append(sr, vis);
  }

  /* ---------------- hero scene ---------------- */
  const hero = $('#top'), stage = $('.stage'), canvas = $('#scene');
  let ctx = null;
  try { ctx = canvas.getContext('2d'); } catch (e) { ctx = null; }
  if (!ctx) stage.classList.add('scene-failed');

  /* The four plates, indexed like the bits of a counter: 1,25 · 2,5 · 5 · 10 kg per side.
     Week n carries (n - 1) × 1,25 kg per side, so the stack is that number written in binary. */
  const BITS = [
    { d: 0.42, t: 0.068, top: '#F26A50', mid: '#D63A22', bot: '#8E2313', label: '1,25' },
    { d: 0.54, t: 0.084, top: '#FFFFFF', mid: '#E4E6DF', bot: '#9A9E98', label: '2,5' },
    { d: 0.70, t: 0.108, top: '#B7C2D1', mid: '#8794A6', bot: '#4C5665', label: '5' },
    { d: 1.00, t: 0.170, top: '#7A8493', mid: '#454D59', bot: '#22262D', label: '10' }
  ];
  const P0 = 0.12, P1 = 0.80, STEPS = 11, NB = 12;
  const lowZero = i => { let z = 0; while (i & (1 << z)) z++; return z; };
  /* when each new plate lands: as a fraction of its step, and in scroll progress */
  const TL = [], PL = [];
  for (let j = 0; j < STEPS; j++) {
    const tl = lowZero(j) > 0 ? 0.86 : 0.74;
    TL.push(tl); PL.push(P0 + ((j + tl) / STEPS) * (P1 - P0));
  }

  const FIG = window.IUFig || null;
  let G = null, burst = null, liftDust = null, dust = [], fontsReady = false, h1Ratio = 0, figBuf = null, figCtx = null;

  function fitH1() {
    const h1 = $('.b4 h1');
    if (!h1 || !G) return;
    if (!h1Ratio) {
      const m = doc.createElement('span');
      m.textContent = 'Încă una.';
      m.style.cssText = `position:absolute;left:-9999px;visibility:hidden;white-space:nowrap;font:900 100px/1 ${getComputedStyle(h1).fontFamily};font-stretch:125%;letter-spacing:-.035em`;
      doc.body.appendChild(m);
      h1Ratio = m.getBoundingClientRect().width / 100 || 5;
      m.remove();
    }
    const target = G.narrow ? Math.min(G.W - 44, 380) : G.half * 2 * 0.94 - G.hgap;
    /* never taller than the room between the nav and the bar */
    const room = G.y0 - G.lift - (G.narrow ? G.D / 2 + 14 : 24) - 104;
    stage.style.setProperty('--h1', clamp(Math.min(target / h1Ratio, room / 0.9), 34, 190).toFixed(1) + 'px');
    /* on wide screens the lifter's head sits between the two words, so the gap has to land on the middle of the bar */
    const ws = $$('.w', h1);
    stage.style.setProperty('--hgap', G.hgap.toFixed(1) + 'px');
    stage.style.setProperty('--hshift', (G.hgap && ws.length === 2 ? (ws[1].offsetWidth - ws[0].offsetWidth) / 2 : 0).toFixed(1) + 'px');
  }

  function buildScene() {
    const W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) return;
    const narrow = NARROW.matches;
    const L = narrow ? W * 0.94 : Math.min(W * 0.86, 1320);
    const D = narrow ? clamp(L * 0.26, 90, 132) : Math.min(L * 0.22, H * 0.33);
    const sleeve = L * (narrow ? 0.2 : 0.17), collar = Math.max(5, D * 0.05);
    const half = L / 2 - sleeve - collar;
    const y0 = H * (narrow ? 0.53 : 0.56), lift = H * 0.035;
    const barT = Math.max(5, D * 0.062);
    const S = D * 3.889;                                   /* the lifter's height, to the same scale as the plates */
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    G = { W, H, narrow, L, D, sleeve, collar, half, cx: W / 2, y0, lift, barT, sleeveT: barT * 1.75, gap: Math.max(1, D * 0.009), S, dpr, hgap: !narrow && FIG && ctx ? S * 0.15 : 0, hook: narrow ? 0.95 : 0.84 };
    stage.style.setProperty('--bar-y0', y0.toFixed(1) + 'px');
    stage.style.setProperty('--bar-y', (y0 - lift).toFixed(1) + 'px');
    stage.style.setProperty('--shaft', (half * 2).toFixed(1) + 'px');
    stage.style.setProperty('--d', D.toFixed(1) + 'px');
    fitH1();
    if (!ctx) return;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = rng(20261010);
    burst = new Float32Array(STEPS * NB * 4);
    for (let i = 0; i < burst.length; i++) burst[i] = r();
    liftDust = new Float32Array(44 * 4);
    for (let i = 0; i < liftDust.length; i++) liftDust[i] = r();
    dust = Array.from({ length: narrow ? 18 : 34 }, () => ({
      x: r(), y: r(), s: 0.6 + r() * 1.1, a: (0.05 + r() * 0.12).toFixed(3), vx: (r() - 0.5) * 0.008, vy: 0.003 + r() * 0.007
    }));
  }

  /* the lifter steps under the loaded bar near the end and stands up with it.
     Drawn on its own layer first, because limbs cut thin clear lines around themselves. */
  function drawLifter(p, yC, liftU) {
    const a = smoothstep(p, 0.73, 0.81);
    if (!FIG || a < 0.01) return;
    const { H, cx, S, dpr } = G;
    const drop = (G.lift * (1 - ease5(liftU))) / S + (1 - a) * 0.05;
    const feet = G.y0 - G.lift + 0.838 * S;
    const bw = Math.ceil(S * 0.72), top = Math.floor(G.y0 - G.lift - S * 0.21), bh = Math.ceil(Math.min(H - top, S * 1.1));
    if (!figBuf) { figBuf = doc.createElement('canvas'); figCtx = figBuf.getContext('2d'); }
    const pw = Math.round(bw * dpr), phh = Math.round(bh * dpr);
    if (figBuf.width !== pw || figBuf.height !== phh) { figBuf.width = pw; figBuf.height = phh; }
    figCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    figCtx.clearRect(0, 0, bw, bh);
    FIG.drawFront(figCtx, bw / 2, feet - top, S, FIG.BUILDS.fit, { arms: 'bar', barY: yC - top, drop }, FIG.STYLES.statue);
    ctx.globalAlpha = a;
    ctx.drawImage(figBuf, cx - bw / 2, top, bw, bh);
    ctx.globalAlpha = 1;
  }

  function rr(x, y, w, h, rad) {
    const q = Math.min(rad, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + q, y); ctx.lineTo(x + w - q, y); ctx.quadraticCurveTo(x + w, y, x + w, y + q);
    ctx.lineTo(x + w, y + h - q); ctx.quadraticCurveTo(x + w, y + h, x + w - q, y + h);
    ctx.lineTo(x + q, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - q);
    ctx.lineTo(x, y + q); ctx.quadraticCurveTo(x, y, x + q, y);
    ctx.closePath();
  }

  /* the plates on one sleeve, inside to outside, part-way through the change from week i+1 to week i+2 */
  function plateList(i, t) {
    const z = lowZero(i), out = [];
    let off = 0;
    for (let b = 3; b > z; b--) {
      if (i >> b & 1) { const th = BITS[b].t * G.D; out.push({ b, off, th, dx: 0, a: 1 }); off += th + G.gap; }
    }
    /* small plates that add up to the next size slide off, outermost first */
    let offR = off;
    for (let b = z - 1; b >= 0; b--) {
      const th = BITS[b].t * G.D;
      const u = clamp((t - 0.03 - b * 0.06) / 0.3, 0, 1);
      if (u < 1) out.push({ b, off: offR, th, dx: u * u * u * (G.sleeve - offR + 46), a: 1 - smoothstep(u, 0.45, 1) });
      offR += th + G.gap;
    }
    /* the new plate slides on and lands at TL */
    const tA = z > 0 ? 0.46 : 0.14, dur = z > 0 ? 0.4 : 0.6;
    const u = clamp((t - tA) / dur, 0, 1);
    if (u > 0) out.push({ b: z, off, th: BITS[z].t * G.D, dx: Math.pow(1 - u, 3) * (G.sleeve - off + 46), a: smoothstep(u, 0, 0.22) });
    return out;
  }

  const stackLabel = (n, sg) => {
    const parts = [];
    for (let b = 3; b >= 0; b--) if (n >> b & 1) parts.push(BITS[b].label);
    if (!parts.length) return null;
    if (sg < 0) parts.reverse();
    return { text: parts.join(' + ') + ' kg', tall: BITS[31 - Math.clz32(n)].d };
  };

  function drawScene(p, now) {
    if (!ctx || !G) return;
    const { W, H, D, sleeve, collar, half, cx, y0, barT, sleeveT } = G;
    ctx.clearRect(0, 0, W, H);

    const s = clamp((p - P0) / (P1 - P0), 0, 1) * STEPS;
    const i = Math.min(STEPS - 1, Math.floor(s)), t = s - i;
    const liftU = clamp((p - 0.82) / 0.11, 0, 1);
    const settle = smoothstep(p, 0.93, 1);
    const dipV = clamp((t - TL[i]) / 0.14, 0, 1);
    const dip = t >= TL[i] && t < 1 ? Math.sin(Math.PI * dipV) * D * 0.012 : 0;
    const breathe = now ? Math.sin(now * 0.0012) * 1.6 * settle : 0;
    const yC = y0 - G.lift * ease5(liftU) + dip + breathe;         /* middle of the bar */
    const yE = yC + Math.sin(Math.PI * liftU) * D * 0.028;         /* the loaded ends lag behind on the way up */
    const endX = half + collar;
    const yAt = x => yE + (yC - yE) * (1 - Math.pow((x - cx) / endX, 2));

    /* slow dust in the air */
    for (const d of dust) {
      const x = ((d.x * W + now * d.vx) % W + W) % W, y = ((d.y * H - now * d.vy) % H + H) % H;
      ctx.fillStyle = `rgba(236,237,231,${d.a})`;
      ctx.beginPath(); ctx.arc(x, y, d.s, 0, 6.2832); ctx.fill();
    }

    /* the stands the bar rests on, gone once it is lifted */
    const hk = 1 - smoothstep(p, 0.84, 0.92);
    if (hk > 0.01) {
      const yb = y0 + barT / 2, colW = Math.max(8, barT * 2.2), lip = Math.max(3, barT * 0.45);
      for (const sg of [-1, 1]) {
        const x = cx + sg * half * G.hook;
        const g = ctx.createLinearGradient(0, yb, 0, H);
        g.addColorStop(0, `rgba(62,69,81,${hk.toFixed(3)})`); g.addColorStop(0.75, 'rgba(62,69,81,0)');
        ctx.fillStyle = g; ctx.fillRect(x - colW / 2, yb, colW, H - yb);
        ctx.fillStyle = `rgba(96,106,122,${hk.toFixed(3)})`;
        rr(x - colW * 0.95, yb - 1, colW * 1.9, Math.max(4, barT * 0.7), 2); ctx.fill();
        rr(x - colW * 0.95, yb - barT * 1.35, lip, barT * 1.35 + 2, 1.5); ctx.fill();
        rr(x + colW * 0.95 - lip, yb - barT * 1.35, lip, barT * 1.35 + 2, 1.5); ctx.fill();
      }
    }

    /* shaft */
    let g = ctx.createLinearGradient(0, yC - barT / 2, 0, yC + barT / 2);
    g.addColorStop(0, '#F4F6F8'); g.addColorStop(0.38, '#C5CBD2'); g.addColorStop(1, '#6E7782');
    ctx.strokeStyle = g; ctx.lineWidth = barT; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(cx - endX, yE); ctx.quadraticCurveTo(cx, 2 * yC - yE, cx + endX, yE); ctx.stroke();
    /* knurling, two grips each side */
    ctx.strokeStyle = 'rgba(20,23,28,.3)'; ctx.lineWidth = barT * 0.84; ctx.setLineDash([1.2, 2.3]);
    for (const sg of [-1, 1]) for (const [a, b] of [[0.14, 0.5], [0.62, 0.97]]) {
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) { const x = cx + sg * half * (a + (b - a) * k / 6); if (k) ctx.lineTo(x, yAt(x)); else ctx.moveTo(x, yAt(x)); }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    drawLifter(p, yC, liftU);

    /* sleeves, plates, collars */
    const plates = plateList(i, t);
    for (const sg of [-1, 1]) {
      const xc = cx + sg * endX;
      g = ctx.createLinearGradient(0, yE - sleeveT / 2, 0, yE + sleeveT / 2);
      g.addColorStop(0, '#E9ECEF'); g.addColorStop(0.4, '#B5BCC5'); g.addColorStop(1, '#5F6772');
      ctx.fillStyle = g;
      ctx.fillRect(sg > 0 ? xc : xc - sleeve, yE - sleeveT / 2, sleeve, sleeveT);
      ctx.fillStyle = 'rgba(20,23,28,.45)';
      ctx.fillRect(sg > 0 ? xc + sleeve - 3 : xc - sleeve, yE - sleeveT / 2, 3, sleeveT);

      for (const pl of plates) {
        const B = BITS[pl.b], h = B.d * D, w = pl.th;
        const xin = xc + sg * (pl.off + pl.dx), x = sg > 0 ? xin : xin - w, top = yE - h / 2;
        const pg = ctx.createLinearGradient(0, top, 0, top + h);
        pg.addColorStop(0, B.mid); pg.addColorStop(0.24, B.top); pg.addColorStop(0.6, B.mid); pg.addColorStop(1, B.bot);
        ctx.globalAlpha = pl.a;
        ctx.fillStyle = pg; rr(x, top, w, h, Math.min(w * 0.38, 6)); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(sg > 0 ? x + 0.5 : x + w - 1.5, top + h * 0.07, 1, h * 0.86);
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(sg > 0 ? x + w - 1.5 : x + 0.5, top + h * 0.07, 1, h * 0.86);
      }
      ctx.globalAlpha = 1;

      const ch = sleeveT * 2.1;
      g = ctx.createLinearGradient(0, yE - ch / 2, 0, yE + ch / 2);
      g.addColorStop(0, '#DDE1E5'); g.addColorStop(0.45, '#9AA3AE'); g.addColorStop(1, '#4D5560');
      ctx.fillStyle = g; rr(sg > 0 ? xc - collar : xc, yE - ch / 2, collar, ch, 2); ctx.fill();
    }

    /* what is on each side, written above the stack (wide screens only) */
    if (!G.narrow && fontsReady) {
      ctx.font = '500 12.5px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textBaseline = 'alphabetic';
      const labels = [[i, 1 - smoothstep(t, 0.02, 0.2)], [i + 1, smoothstep(t, TL[i] - 0.02, TL[i] + 0.1)]];
      for (const [n, a] of labels) {
        if (a < 0.02) continue;
        for (const sg of [-1, 1]) {
          const lb = stackLabel(n, sg);
          if (!lb) continue;
          ctx.textAlign = sg > 0 ? 'left' : 'right';
          ctx.fillStyle = `rgba(236,237,231,${(a * 0.74).toFixed(3)})`;
          ctx.fillText(lb.text, cx + sg * (endX + 1), yE - (lb.tall * D) / 2 - 16);
        }
      }
    }

    /* chalk off every landing */
    for (let j = 0; j < STEPS; j++) {
      const tau = (p - PL[j]) / 0.055;
      if (tau <= 0 || tau >= 1) continue;
      const z = lowZero(j), B = BITS[z];
      let off = 0;
      for (let b = 3; b > z; b--) if (j >> b & 1) off += BITS[b].t * D + G.gap;
      const e = 1 - Math.pow(1 - tau, 3), al = (1 - tau) * (1 - tau) * 0.62, sc = D / 236 + 0.35;
      for (const sg of [-1, 1]) {
        const ox = cx + sg * (endX + off + B.t * D * 0.5);
        for (let k = 0; k < NB; k++) {
          const q = (j * NB + k) * 4, up = k % 2 ? -1 : 1, ang = (burst[q] - 0.5) * 2.3;
          const dist = (14 + burst[q + 1] * 54) * sc * e;
          const x = ox + sg * Math.abs(Math.sin(ang)) * dist * 0.9;
          const y = yE + up * B.d * D * 0.5 + up * Math.cos(ang) * dist * 0.5 + tau * tau * 16;
          ctx.fillStyle = `rgba(236,237,231,${(al * (0.4 + burst[q + 2] * 0.6)).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(x, y, 0.7 + burst[q + 3] * 1.5, 0, 6.2832); ctx.fill();
        }
      }
    }
    /* and a bigger cloud as the bar leaves the stands */
    const lt = (p - 0.83) / 0.14;
    if (lt > 0 && lt < 1) {
      const e = 1 - Math.pow(1 - lt, 3), al = (1 - lt) * (1 - lt) * 0.55;
      for (let k = 0; k < 44; k++) {
        const q = k * 4, sg = k % 2 ? -1 : 1;
        const x = cx + sg * (half * G.hook + (liftDust[q] - 0.5) * half * 0.3) + (liftDust[q + 1] - 0.5) * 60 * e;
        const y = y0 + barT + liftDust[q + 2] * 70 * e + lt * lt * 46;
        ctx.fillStyle = `rgba(236,237,231,${(al * (0.35 + liftDust[q + 3] * 0.65)).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(x, y, 0.7 + liftDust[q + 3] * 1.6, 0, 6.2832); ctx.fill();
      }
    }
  }

  /* caption bands, paced in scroll distance */
  const bands = $$('.band').map(el => ({
    el, a: +el.dataset.a, b: +el.dataset.b, ramp: +(el.dataset.ramp || 0),
    first: el.dataset.a === '0', last: el.dataset.b === '1', op: -1, k: -1, on: null
  }));
  let loadK = 0, loadStart = 0;
  let staticMode = MQLS.some(m => m.matches);

  function updateCaptions(p) {
    for (const B of bands) {
      const { a, b } = B;
      const f = Math.min(0.04, (b - a) / 3);
      let op = (B.first ? 1 : smoothstep(p, a, a + f)) * (B.last ? 1 : 1 - smoothstep(p, b - f, b));
      let k = clamp((p - a) / (B.ramp || Math.min(0.045, (b - a) * 0.35)), 0, 1);
      if (B.first) k = Math.max(k, loadK);
      if (staticMode) { op = B.last ? 1 : 0; k = 1; }
      if (Math.abs(op - B.op) > 0.004 || ((op === 0 || op === 1) && op !== B.op)) {
        B.op = op; B.el.style.opacity = op.toFixed(3);
        const on = op > 0.5;
        if (on !== B.on) { B.on = on; B.el.classList.toggle('on', on); }
      }
      if (Math.abs(k - B.k) >= 0.008 || ((k === 0 || k === 1) && k !== B.k)) { B.k = k; B.el.style.setProperty('--k', k.toFixed(3)); }
    }
  }

  const hudL = $('.hud-l'), hudN = $('.hud-n'), cue = $('.cue');
  let hudWeek = 0, hudAt = 0, cueOp = -1;
  function updateHud(p, now) {
    const c = 1 - smoothstep(p, 0, 0.035);
    if (Math.abs(c - cueOp) > 0.01 || (c === 0 && cueOp !== 0)) { cueOp = c; cue.style.opacity = c.toFixed(2); }
    if (hudWeek && now - hudAt < 100) return;
    let week = 1;
    for (let j = 0; j < STEPS; j++) if (p >= PL[j]) week++;
    if (week === hudWeek) return;
    hudWeek = week; hudAt = now;
    hudL.textContent = 'Săpt. ' + String(week).padStart(2, '0') + ' / 12';
    hudN.textContent = String(20 + 2.5 * (week - 1)).replace('.', ',') + ' kg';
  }

  const heroProgress = () => {
    const range = hero.offsetHeight - innerHeight;
    return range > 0 ? clamp(-hero.getBoundingClientRect().top / range, 0, 1) : 1;
  };

  /* the drive loop: eased toward the scroll target, frame-rate independent, and it stops off-screen */
  let target = 0, shown = 0, rafId = null, lastTick = 0, lastDraw = 0, heroOn = true;
  function frame(now) {
    rafId = null;
    const dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    shown += (target - shown) * (1 - Math.pow(1 - 0.14, dt / 16.667));
    const converged = Math.abs(target - shown) < 0.0005;
    if (converged) shown = target;
    if (loadK < 1) { const t = clamp((now - loadStart) / 1100, 0, 1); loadK = 1 - Math.pow(1 - t, 3); }
    const idle = converged && loadK >= 1;
    if (!idle || now - lastDraw > 33) { drawScene(shown, now); lastDraw = now; }
    updateCaptions(shown);
    updateHud(shown, now);
    if (heroOn && !staticMode && !doc.hidden) rafId = requestAnimationFrame(frame);
    else lastTick = 0;
  }
  function kick() { if (rafId === null && heroOn && !staticMode && !doc.hidden) rafId = requestAnimationFrame(frame); }
  function stopLoop() { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } lastTick = 0; }
  function resetBands() { bands.forEach(B => { B.op = -1; B.k = -1; }); }
  function drawStatic() { loadK = 1; drawScene(1, 0); resetBands(); updateCaptions(1); }

  function applyHeroMode() {
    staticMode = MQLS.some(m => m.matches);
    buildScene();
    if (staticMode) { stopLoop(); drawStatic(); }
    else {
      resetBands();
      target = shown = heroProgress();
      hudWeek = 0;
      updateCaptions(shown);
      drawScene(shown, performance.now());
      kick();
    }
  }

  /* ---------------- nav rail ---------------- */
  const below = $('.below'), rail = $('.rail');
  const railLinks = $$('.rail a'), railSecs = railLinks.map(a => $(a.getAttribute('href')));
  let railOn = null, railP = -1, railIdx = -1;
  function updateRail() {
    const on = below.getBoundingClientRect().top < innerHeight * 0.45;
    if (on !== railOn) { railOn = on; rail.classList.toggle('on', on); }
    if (!on) return;
    const line = innerHeight * 0.42, n = railSecs.length;
    let idx = 0, local = 0;
    for (let k = 0; k < n; k++) {
      const r = railSecs[k].getBoundingClientRect();
      if (r.top <= line) { idx = k; local = k === n - 1 ? 0 : clamp((line - r.top) / Math.max(1, r.height), 0, 1); }
    }
    const rp = clamp((idx + local) / (n - 1), 0, 1);
    if (Math.abs(rp - railP) > 0.002) { railP = rp; rail.style.setProperty('--rp', rp.toFixed(4)); }
    if (idx !== railIdx) { railIdx = idx; railLinks.forEach((a, k) => a.classList.toggle('on', k <= idx)); }
  }

  /* page progress, the phone dock and the kinetic bands */
  const dock = $('.dock'), prog = $('.prog'), startSec = $('#start');
  const mqs = $$('.mq-track').map(tr => ({ tr, box: tr.parentElement, rev: tr.parentElement.classList.contains('mq-rev'), setW: 0 }));
  function measureMq() {
    mqs.forEach(M => { M.setW = (M.tr.scrollWidth + (parseFloat(getComputedStyle(M.tr).columnGap) || 0)) / 3; });
  }
  let dockOn = null, progP = -1;
  function updateChrome() {
    updateRail();
    const ih = innerHeight;
    const pp = clamp(scrollY / Math.max(1, doc.documentElement.scrollHeight - ih), 0, 1);
    if (Math.abs(pp - progP) > 0.001) { progP = pp; prog.style.setProperty('--pp', pp.toFixed(4)); }
    const on = below.getBoundingClientRect().top < ih * 0.3 && startSec.getBoundingClientRect().top > ih * 0.8;
    if (on !== dockOn) { dockOn = on; dock.classList.toggle('on', on); dock.tabIndex = on ? 0 : -1; }
    if (RM.matches) return;
    for (const M of mqs) {
      if (!M.setW) continue;
      const r = M.box.getBoundingClientRect();
      if (r.bottom < -60 || r.top > ih + 60) continue;
      const k = (scrollY * 0.4) % M.setW;
      M.tr.style.setProperty('--mx', (M.rev ? k - M.setW : -k).toFixed(1) + 'px');
    }
  }

  let scrollQueued = false;
  function onScroll() {
    if (!staticMode) { target = heroProgress(); kick(); }
    if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(() => { scrollQueued = false; updateChrome(); }); }
  }

  /* ---------------- entrances and living elements ---------------- */
  /* section headings arrive word by word from behind a mask; the full sentence stays in place for screen readers */
  $$('h2').forEach(h => {
    const text = h.textContent.trim();
    const sr = doc.createElement('span'); sr.className = 'sr-only'; sr.textContent = text;
    const vis = doc.createElement('span'); vis.setAttribute('aria-hidden', 'true');
    text.split(/[ \n\t]+/).forEach((w, i, all) => {
      const mask = doc.createElement('span'), word = doc.createElement('span');
      mask.className = 'hw'; word.textContent = w; word.style.setProperty('--w', i);
      mask.appendChild(word); vis.appendChild(mask);
      if (i < all.length - 1) vis.appendChild(doc.createTextNode(' '));
    });
    h.textContent = '';
    h.append(sr, vis);
  });

  /* numbers count up once, the first time they are seen */
  const fmt = (v, dec) => {
    const [a, b] = v.toFixed(dec).split('.');
    return a.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (b ? ',' + b : '');
  };
  const counts = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    counts.unobserve(e.target);
    if (RM.matches) return;
    const el = e.target, to = +el.dataset.to, from = +(el.dataset.from || 0), dec = +(el.dataset.dec || 0), t0 = performance.now();
    const step = now => {
      const u = clamp((now - t0) / 1500, 0, 1);
      el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - u, 3)), dec);
      if (u < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), { threshold: 0.6 });
  $$('.count').forEach(el => counts.observe(el));

  const reveal = new IntersectionObserver(entries => {
    let n = 0;
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.style.setProperty('--i', n++);
      el.classList.add('in');
      reveal.unobserve(el);
      setTimeout(() => el.classList.add('done'), 1500 + n * 100);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
  $$('.rv').forEach(el => reveal.observe(el));

  const seen = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('seen'); seen.unobserve(e.target); }
  }), { threshold: 0.3 });
  $$('.sec').forEach(s => seen.observe(s));

  const live = new IntersectionObserver(entries => entries.forEach(e => e.target.classList.toggle('live', e.isIntersecting)));
  $$('.sec, .hero').forEach(s => live.observe(s));

  new IntersectionObserver(entries => entries.forEach(e => {
    heroOn = e.isIntersecting;
    if (heroOn) kick(); else stopLoop();
  })).observe(hero);

  doc.addEventListener('visibilitychange', () => {
    doc.body.classList.toggle('paused', doc.hidden);
    if (!doc.hidden) { kick(); kickMinis(); }
  });

  /* ---------------- three reps ---------------- */
  const trySec = $('#incearca'), rig = $('.rig'), holdBtn = $('#hold'), holdLbl = $('.hold-label');
  const repN = $('#rep-n'), dayEls = $$('.day'), skipBtn = $('#rep-skip');
  const rigC = $('#rig-canvas'), rigCtx = rigC && rigC.getContext ? rigC.getContext('2d') : null;
  let ph = 0, phShown = -1, holding = false, reps = 0, solved = false, hRaf = null, hLast = 0;
  const depth = () => (1 - Math.cos(Math.PI * 2 * ph)) / 2;     /* 0 standing, 1 at the bottom, 0 standing again */

  function drawRig() {
    if (!rigCtx || !FIG) return;
    const w = rigC.clientWidth, h = rigC.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (rigC.width !== Math.round(w * dpr) || rigC.height !== Math.round(h * dpr)) { rigC.width = Math.round(w * dpr); rigC.height = Math.round(h * dpr); }
    rigCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rigCtx.clearRect(0, 0, w, h);
    const S = h * 0.86;
    FIG.drawSide(rigCtx, w * 0.5 - S * 0.03, h * 0.95, S, FIG.squat(depth(), true), FIG.STYLES.dark);
  }
  function renderHold() {
    if (ph === phShown) return;
    phShown = ph;
    rig.style.setProperty('--hp', depth().toFixed(3));
    drawRig();
  }
  function setLabel() { holdLbl.textContent = solved ? 'Gata. Asta e săptămâna ta.' : reps ? 'Încă una' : 'Ține apăsat'; }
  function finish() {
    solved = true; holding = false;
    trySec.classList.add('solved');
    holdBtn.classList.remove('holding');
    holdBtn.setAttribute('aria-disabled', 'true');
    setLabel();
  }
  function countRep() {
    reps++;
    repN.textContent = String(reps);
    dayEls[reps - 1].classList.add('on');
    setLabel();
    if (reps >= dayEls.length) finish();
  }
  function showAll() {
    reps = dayEls.length;
    repN.textContent = String(reps);
    dayEls.forEach(d => d.classList.add('on'));
    finish();
    if (RM.matches) { ph = 0; renderHold(); } else kickHold();
  }
  function holdTick(now) {
    hRaf = null;
    const dt = Math.min(64, now - (hLast || now));
    hLast = now;
    if (holding && !solved) { ph += dt / 1500; if (ph >= 1) { ph = 0; countRep(); } }        /* one rep: down and back up */
    else if (ph > 0) { ph = ph < 0.5 ? Math.max(0, ph - dt / 800) : ph + dt / 800; if (ph >= 1) ph = 0; }   /* let go early: stand back up the short way */
    renderHold();
    if (ph > 0 || (holding && !solved)) hRaf = requestAnimationFrame(holdTick);
    else hLast = 0;
  }
  function kickHold() { if (hRaf === null) hRaf = requestAnimationFrame(holdTick); }
  function startHold() {
    if (solved) return;
    if (RM.matches) { showAll(); return; }
    holding = true; holdBtn.classList.add('holding'); kickHold();
  }
  function endHold() { if (!holding) return; holding = false; holdBtn.classList.remove('holding'); kickHold(); }
  holdBtn.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    try { holdBtn.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    startHold();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => holdBtn.addEventListener(ev, endHold));
  holdBtn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startHold(); } });
  holdBtn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); endHold(); } });
  holdBtn.addEventListener('blur', endHold);
  holdBtn.addEventListener('contextmenu', e => e.preventDefault());
  skipBtn.addEventListener('click', () => { if (!solved) showAll(); });

  /* ---------------- questions ---------------- */
  $$('.qa').forEach(qa => {
    const btn = $('.q', qa);
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      qa.classList.toggle('open', open);
    });
  });

  /* ---------------- picking a product and the form ----------------
     The form posts to the URL in its action attribute (a form service such as Formspree).
     While action is empty the site is a preview: it says so and never pretends a message was sent. */
  const form = $('#start-form'), formOk = $('#form-ok'), formErr = $('#form-err'), formPrev = $('#form-preview');
  const pickSel = $('#f-pick'), submitBtn = $('button[type="submit"]', form), btnLabel = $('.btn-label', form);
  const endpoint = (form.getAttribute('action') || '').trim();

  $$('.pick').forEach(a => a.addEventListener('click', () => {
    const want = a.dataset.pick, opt = Array.from(pickSel.options).find(o => o.textContent === want);
    if (!opt) return;
    pickSel.value = opt.value;
    const field = pickSel.closest('.field');
    field.classList.remove('flash');
    setTimeout(() => field.classList.add('flash'), 700);
  }));

  function showErr(text) { formErr.textContent = text; formErr.hidden = false; }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (submitBtn.disabled) return;
    formErr.hidden = true; formPrev.hidden = true;
    let bad = null;
    [form.elements.name, form.elements.email].forEach(f => {
      const valid = f.value.trim() !== '' && f.checkValidity();
      f.setAttribute('aria-invalid', String(!valid));
      if (!valid && !bad) bad = f;
    });
    if (bad) { showErr('Completează, te rog, numele și un email valid.'); bad.focus(); return; }
    if (!endpoint) { formPrev.hidden = false; return; }
    submitBtn.disabled = true; btnLabel.textContent = 'Se trimite…';
    try {
      const res = await fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      btnLabel.textContent = 'Trimis';
      form.classList.add('sent');
      formOk.hidden = false;
    } catch (err) {
      submitBtn.disabled = false; btnLabel.textContent = 'Vreau să încep';
      showErr('Ceva n-a mers și mesajul nu s-a trimis. Încearcă din nou.');
    }
  });
  [form.elements.name, form.elements.email].forEach(f => f.addEventListener('input', () => {
    if (f.getAttribute('aria-invalid') === 'true' && f.value.trim() !== '' && f.checkValidity()) f.setAttribute('aria-invalid', 'false');
  }));

  /* ---------------- small lifters in the product cards ---------------- */
  const minis = FIG ? $$('canvas.mini').map((c, i) => ({ c, ctx: c.getContext('2d'), kind: c.dataset.fig, on: false, off: i * 0.31 })) : [];
  let miniRaf = null, miniLast = 0;
  /* one rep: a breath at the top, down, a beat at the bottom, up */
  const repCurve = t => (t < 0.12 ? 0 : t < 0.5 ? FIG.ease((t - 0.12) / 0.38) : t < 0.6 ? 1 : 1 - FIG.ease((t - 0.6) / 0.4));
  function drawMini(m, t) {
    const w = m.c.clientWidth, h = m.c.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (m.c.width !== Math.round(w * dpr) || m.c.height !== Math.round(h * dpr)) { m.c.width = Math.round(w * dpr); m.c.height = Math.round(h * dpr); }
    m.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    m.ctx.clearRect(0, 0, w, h);
    const q = repCurve(t), S = h * 0.9;
    const J = m.kind === 'dl' ? FIG.deadlift(1 - q) : m.kind === 'curl' ? FIG.curl(q) : FIG.squat(q, m.kind === 'bar');
    FIG.drawSide(m.ctx, w * 0.5 - S * 0.02, h * 0.95, S, J, FIG.STYLES.light, { tail: m.kind === 'bw' });
  }
  function miniTick(now) {
    miniRaf = null;
    if (now - miniLast > 32) { miniLast = now; for (const m of minis) if (m.on) drawMini(m, (now / 2900 + m.off) % 1); }
    if (!doc.hidden && !RM.matches && minis.some(m => m.on)) miniRaf = requestAnimationFrame(miniTick);
  }
  function kickMinis() {
    if (miniRaf === null && !doc.hidden && !RM.matches && minis.some(m => m.on)) miniRaf = requestAnimationFrame(miniTick);
  }
  if (minis.length) {
    const seenMini = new IntersectionObserver(entries => {
      entries.forEach(e => { minis.find(m => m.c === e.target).on = e.isIntersecting; });
      kickMinis();
    }, { rootMargin: '60px' });
    minis.forEach(m => { seenMini.observe(m.c); drawMini(m, 0.36); });
  }

  /* ---------------- direction: one drawn body, two starting points ---------------- */
  const DIRS = {
    plin: {
      lede: 'Scazi puțin caloriile, nu tai mâncarea pe jumătate. Faci trei antrenamente pe săptămână, ca să păstrezi mușchii cât se duce grăsimea.',
      way: ['energia și somnul', 'hainele', 'oglinda'], rec: 'Start Acasă și Farfuria, la 1.800 kcal', pick: 'Start Acasă'
    },
    slab: {
      lede: 'Mănânci mai mult decât crezi că poți și ridici greu, de patru ori pe săptămână. Umerii, spatele și picioarele răspund primele.',
      way: ['pofta de mâncare', 'greutățile de pe bară', 'oglinda'], rec: 'Pachetul Start, cu Farfuria la 2.600 kcal', pick: 'Pachetul Start'
    }
  };
  const dirC = $('#dir-canvas'), dirR = $('#dir-range');
  if (dirC && dirR && FIG && dirC.getContext) {
    const dctx = dirC.getContext('2d'), chipEls = $$('.chips button'), wayEls = $$('.way li'), dirBtn = $('#dir-btn');
    /* text that changes with the choice fades through, it never jumps */
    const lede = $('#dir-lede'), ledeIn = doc.createElement('span');
    ledeIn.textContent = lede.textContent; lede.textContent = ''; lede.appendChild(ledeIn);
    const swaps = [ledeIn, $('#dir-rec'), $('#dir-w1'), $('#dir-w2'), $('#dir-w3')];
    swaps.forEach(el => el.classList.add('swp'));
    let mTarget = 0, m = 0, tTarget = 0, t = 0, dRaf = null, touched = false, demoed = false, wayOn = -2, swapTimer = 0;

    function drawDir() {
      const w = dirC.clientWidth, h = dirC.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (dirC.width !== Math.round(w * dpr) || dirC.height !== Math.round(h * dpr)) { dirC.width = Math.round(w * dpr); dirC.height = Math.round(h * dpr); }
      dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dctx.clearRect(0, 0, w, h);
      const start = FIG.mixBuild(FIG.BUILDS.plin, FIG.BUILDS.slab, FIG.ease(m));
      FIG.drawFront(dctx, w / 2, h * 0.975, h * 0.93, FIG.mixBuild(start, FIG.BUILDS.fit, FIG.ease(t)), { arms: 'down' }, FIG.STYLES.dark);
      const on = t >= 0.88 ? 2 : t >= 0.5 ? 1 : t >= 0.12 ? 0 : -1;
      if (on !== wayOn) { wayOn = on; wayEls.forEach((li, i) => li.classList.toggle('on', i <= on)); }
    }
    function dirTick() {
      dRaf = null;
      m += (mTarget - m) * 0.14; t += (tTarget - t) * 0.18;
      if (Math.abs(mTarget - m) < 0.002) m = mTarget;
      if (Math.abs(tTarget - t) < 0.002) t = tTarget;
      drawDir();
      if (m !== mTarget || t !== tTarget) dRaf = requestAnimationFrame(dirTick);
    }
    function settle() {
      if (RM.matches) { m = mTarget; t = tTarget; drawDir(); }
      else if (dRaf === null) dRaf = requestAnimationFrame(dirTick);
    }
    function setT(v, fromUser) {
      tTarget = clamp(v, 0, 1);
      dirR.style.setProperty('--v', (tTarget * 100).toFixed(1) + '%');
      if (!fromUser) dirR.value = String(Math.round(tTarget * 100));
      settle();
    }
    dirR.addEventListener('input', () => { touched = true; setT(dirR.value / 100, true); });

    function choose(btn, focus) {
      const key = btn.dataset.from, D = DIRS[key];
      chipEls.forEach(c => { const on = c === btn; c.setAttribute('aria-checked', String(on)); c.tabIndex = on ? 0 : -1; });
      if (focus) btn.focus();
      mTarget = key === 'slab' ? 1 : 0;
      settle();
      dirBtn.dataset.pick = D.pick;
      const texts = [D.lede, D.rec, D.way[0], D.way[1], D.way[2]];
      clearTimeout(swapTimer);
      if (RM.matches) { swaps.forEach((el, i) => { el.textContent = texts[i]; }); return; }
      swaps.forEach(el => el.classList.add('out'));
      swapTimer = setTimeout(() => swaps.forEach((el, i) => { el.textContent = texts[i]; el.classList.remove('out'); }), 220);
    }
    chipEls.forEach((c, i) => {
      c.tabIndex = c.getAttribute('aria-checked') === 'true' ? 0 : -1;
      c.addEventListener('click', () => choose(c, false));
      c.addEventListener('keydown', e => {
        const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        choose(chipEls[(i + dir + chipEls.length) % chipEls.length], true);
      });
    });

    /* the first time it is seen, the body moves on its own once, so nobody has to guess that it can */
    new IntersectionObserver((entries, io) => entries.forEach(e => {
      if (!e.isIntersecting || demoed) return;
      demoed = true; io.disconnect();
      if (touched) return;
      if (RM.matches) { setT(1, false); return; }
      const t0 = performance.now();
      const step = now => {
        if (touched) return;
        const u = clamp((now - t0 - 350) / 2000, 0, 1);
        setT(0.8 * (1 - Math.pow(1 - u, 3)), false);
        if (u < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }), { threshold: 0.55 }).observe(dirC);
    if (window.ResizeObserver) new ResizeObserver(drawDir).observe(dirC);
    drawDir();
  }

  /* ---------------- boot ---------------- */
  $$('.split').forEach(splitEl);
  buildScene();
  drawRig();
  if (rigC && window.ResizeObserver) new ResizeObserver(() => { phShown = -1; renderHold(); }).observe(rigC);
  measureMq();
  loadStart = performance.now();
  if (staticMode) drawStatic();
  else { target = shown = heroProgress(); if (shown > 0.01) loadK = 1; drawScene(shown, 0); kick(); }
  updateChrome();

  addEventListener('scroll', onScroll, { passive: true });
  MQLS.forEach(m => onMQ(m, applyHeroMode));
  onMQ(NARROW, applyHeroMode);
  /* reduced motion switched on mid-visit: finish the reps too, so nothing is left waiting on a hold */
  onMQ(RM, () => { if (RM.matches && ph > 0) { ph = 0; renderHold(); } kickMinis(); });

  let lastW = stage.clientWidth, lastH = stage.clientHeight;
  new ResizeObserver(() => {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (w !== lastW || Math.abs(h - lastH) > 120) {
      lastW = w; lastH = h;
      buildScene();
      if (staticMode) drawStatic(); else { drawScene(shown, performance.now()); kick(); }
    }
    measureMq();
    updateChrome();
  }).observe(stage);

  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => {
    fontsReady = true; h1Ratio = 0; fitH1(); measureMq(); updateChrome();
    if (staticMode) drawStatic(); else { drawScene(shown, performance.now()); kick(); }
  });
  else fontsReady = true;
})();

/* Încă Una · one small line chart drawn as SVG, shared by the landing page and the jurnal. */
window.IUChart = (() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };
  const fmt = v => String(Math.round(v * 100) / 100).replace('.', ',');
  let uid = 0;

  /* values: numbers in order; opts: { unit, from, to, empty, instant } */
  function line(svg, values, opts) {
    opts = opts || {};
    const W = 320, H = 180, pl = 10, pr = 16, pt = 26, pb = 28;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.textContent = '';
    if (!values.length) {
      const t = el('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'ch-empty' });
      t.textContent = opts.empty || 'Încă nu sunt date';
      svg.appendChild(t);
      return;
    }
    let lo = Math.min.apply(null, values), hi = Math.max.apply(null, values);
    if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.18;
    lo -= pad; hi += pad;
    const n = values.length;
    const X = i => pl + (n === 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (n - 1));
    const Y = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
    for (let g = 0; g < 3; g++) {
      const y = pt + (g * (H - pt - pb)) / 2;
      svg.appendChild(el('line', { x1: pl, x2: W - pr, y1: y, y2: y, class: 'ch-grid' }));
    }
    const pts = values.map((v, i) => [X(i), Y(v)]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    const id = 'iuch' + (++uid);
    const defs = el('defs', {}), grad = el('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.append(el('stop', { offset: '0', class: 'ch-a0' }), el('stop', { offset: '1', class: 'ch-a1' }));
    defs.appendChild(grad);
    svg.appendChild(defs);
    if (n > 1) {
      const area = el('path', { d: d + 'L' + pts[n - 1][0].toFixed(1) + ' ' + (H - pb) + 'L' + pts[0][0].toFixed(1) + ' ' + (H - pb) + 'Z', fill: 'url(#' + id + ')', class: 'ch-area' });
      svg.appendChild(area);
    }
    const path = el('path', { d, class: 'ch-line', pathLength: 1 });
    svg.appendChild(path);
    pts.forEach((p, i) => svg.appendChild(el('circle', { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: i === n - 1 ? 6 : 2.6, class: i === n - 1 ? 'ch-last' : 'ch-dot' })));
    const label = (x, y, txt, cls, anchor) => {
      const t = el('text', { x: x.toFixed(1), y: y.toFixed(1), class: cls, 'text-anchor': anchor });
      t.textContent = txt;
      svg.appendChild(t);
    };
    label(pts[n - 1][0], pts[n - 1][1] - 13, fmt(values[n - 1]) + (opts.unit ? ' ' + opts.unit : ''), 'ch-val', n === 1 ? 'middle' : 'end');
    if (n > 1) label(pts[0][0], pts[0][1] - 11, fmt(values[0]), 'ch-val0', 'start');
    if (opts.from) label(pl, H - 8, opts.from, 'ch-x', 'start');
    if (opts.to) label(W - pr, H - 8, opts.to, 'ch-x', 'end');
    /* the line draws itself in, unless motion is off */
    const still = opts.instant || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    path.style.strokeDasharray = '1';
    path.style.strokeDashoffset = still ? '0' : '1';
    if (!still) requestAnimationFrame(() => requestAnimationFrame(() => { path.style.strokeDashoffset = '0'; }));
  }

  return { line, fmt };
})();

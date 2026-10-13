/* Încă Una · drawn people. One rig, two views: from the side (doing the lifts) and from the front (carrying the bar, changing shape).
   Everything is built from tapered capsules, so a body is a handful of numbers and can move or morph every frame. */
window.IUFig = (() => {
  'use strict';
  const TAU = Math.PI * 2, RAD = Math.PI / 180;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);

  /* one tapered capsule: the hull of two circles */
  function cap(ctx, x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
    ctx.beginPath();
    if (d <= Math.abs(r1 - r2) + 1e-6) {
      const big = r1 >= r2;
      ctx.arc(big ? x1 : x2, big ? y1 : y2, Math.max(r1, r2), 0, TAU);
      return;
    }
    const th = Math.atan2(dy, dx), ph = Math.acos((r1 - r2) / d);
    ctx.arc(x1, y1, r1, th + ph, th - ph + TAU);
    ctx.arc(x2, y2, r2, th - ph, th + ph);
    ctx.closePath();
  }

  /* a limb: a chain of capsules filled as one shape. gap cuts a thin clear line around it, so it reads in front of what is behind */
  function chain(ctx, pts, fill, gap) {
    const n = pts.length;
    const each = fn => {
      if (n === 1) { ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], pts[0][2], 0, TAU); fn(); return; }
      for (let i = 0; i < n - 1; i++) { cap(ctx, pts[i][0], pts[i][1], pts[i][2], pts[i + 1][0], pts[i + 1][1], pts[i + 1][2]); fn(); }
    };
    if (gap) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = gap * 2; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000';
      each(() => ctx.stroke());
      ctx.restore();
    }
    ctx.fillStyle = fill;
    each(() => ctx.fill());
  }

  /* a closed soft shape through control points */
  function blob(ctx, pts) {
    const n = pts.length;
    ctx.beginPath();
    ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.closePath();
  }

  /* two-bone reach: where the middle joint sits between a root and a target */
  function ik(rx, ry, tx, ty, a, b, bend) {
    const dx = tx - rx, dy = ty - ry;
    const d = clamp(Math.hypot(dx, dy), Math.abs(a - b) + 1e-4, a + b - 1e-4);
    const base = Math.atan2(dy, dx), A = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
    return [rx + a * Math.cos(base + bend * A), ry + a * Math.sin(base + bend * A)];
  }

  /* soft light from the upper left, laid over whatever is already drawn (and only there) */
  function shade(ctx, x0, y0, x1, y1, strength) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(255,255,255,' + (strength * 0.5).toFixed(3) + ')');
    g.addColorStop(0.45, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,' + strength.toFixed(3) + ')');
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(x0, x1) - 4000, Math.min(y0, y1) - 4000, 8000, 8000);
    ctx.restore();
  }

  const STYLES = {
    /* chalk figure on rubber */
    dark: { near: '#E7E9E2', far: '#88919D', hair: '#B9BEC0', shoe: '#F6F6F1', shoeFar: '#9AA1AC', shorts: '#D63A22', shortsFar: '#8E2313', plate: '#3B424D', rim: '#5B6471', steel: '#C9CED4', line: 'rgba(20,23,28,.5)', neck: '#C3C7C6', ground: 'rgba(236,237,231,.18)', shade: 0.2 },
    /* ink figure on chalk */
    light: { near: '#1B1F26', far: '#7C8490', hair: '#3A414C', shoe: '#1B1F26', shoeFar: '#7C8490', shorts: '#D63A22', shortsFar: '#A93320', plate: '#C5C8C2', rim: '#A2A6A1', steel: '#5C6470', line: 'rgba(236,237,231,.55)', neck: '#353B45', ground: 'rgba(21,24,29,.16)', shade: 0 },
    /* steel statue behind the headline */
    statue: { near: '#5D6674', far: '#444C58', hair: '#4B5461', shoe: '#4B5461', shoeFar: '#444C58', shorts: '#272C35', shortsFar: '#1F232A', plate: '#3B424D', rim: '#5B6471', steel: '#C9CED4', line: 'rgba(16,18,23,.5)', neck: '#555E6B', ground: 'rgba(236,237,231,0)', shade: 0.34 }
  };

  /* ---------------- side view ---------------- */
  const LEN = { shin: 0.245, thigh: 0.245, torso: 0.29, upper: 0.165, fore: 0.15, neck: 0.118 };
  const ANK = [-0.01, 0.045], MID = 0.03, PLATE_R = 0.1286;
  const SIDE = { pelvis: 0.066, waist: 0.056, chest: 0.082, glute: 0.062, delt: 0.046, bi: 0.038, elbow: 0.026, fore: 0.03, wrist: 0.019, hand: 0.022, thigh: 0.065, knee: 0.038, calf: 0.044, ankle: 0.022, foot: 0.022 };

  /* squat, q = 0 standing, 1 at the bottom. The lean falls out of one rule: the weight stays over the middle of the foot. */
  function squat(q, withBar) {
    const a = lerp(3, 31, q) * RAD, b = lerp(1, 99, q) * RAD;
    const knee = [ANK[0] + LEN.shin * Math.sin(a), ANK[1] + LEN.shin * Math.cos(a)];
    const hip = [knee[0] - LEN.thigh * Math.sin(b), knee[1] + LEN.thigh * Math.cos(b)];
    let g = 0.1;
    for (let i = 0; i < 4; i++) g = Math.asin(clamp(((withBar ? MID + 0.045 * Math.cos(g) : MID + 0.04) - hip[0]) / LEN.torso, -0.95, 0.95));
    const sh = [hip[0] + LEN.torso * Math.sin(g), hip[1] + LEN.torso * Math.cos(g)];
    const J = { ankle: ANK, knee, hip, sh, lean: g };
    if (withBar) {
      J.bar = [sh[0] - 0.045 * Math.cos(g) - 0.012 * Math.sin(g), sh[1] + 0.045 * Math.sin(g) - 0.012 * Math.cos(g)];
      J.hand = [J.bar[0] + 0.012, J.bar[1] - 0.008];
      const psi = 40 * RAD - g * 0.35;             /* elbows point down and a little back, under the bar */
      J.elbow = [sh[0] - LEN.upper * Math.sin(psi), sh[1] - 0.012 - LEN.upper * Math.cos(psi)];
    } else {
      const t = lerp(6, 84, ease(q)) * RAD;
      J.elbow = [sh[0] + LEN.upper * Math.sin(t - 0.1), sh[1] - 0.012 - LEN.upper * Math.cos(t - 0.1)];
      J.hand = [J.elbow[0] + LEN.fore * Math.sin(t + 0.08), J.elbow[1] - LEN.fore * Math.cos(t + 0.08)];
    }
    J.head = [sh[0] + LEN.neck * Math.sin(g * 0.5) + 0.012, sh[1] + LEN.neck * Math.cos(g * 0.5)];
    return J;
  }

  /* deadlift, q = 0 bar on the floor, 1 standing tall. The bar travels straight up and the body folds around it. */
  function deadlift(q) {
    const by = lerp(PLATE_R, 0.468, q), sh = [MID + 0.022, by + 0.325];
    const hx = lerp(-0.215, -0.008, ease(q));
    const hip = [hx, sh[1] - Math.sqrt(Math.max(1e-4, LEN.torso * LEN.torso - (sh[0] - hx) * (sh[0] - hx)))];
    const g = Math.atan2(sh[0] - hip[0], sh[1] - hip[1]);
    const J = { ankle: ANK, hip, sh, lean: g, bar: [MID, by], hand: [MID, by + 0.004] };
    J.knee = ik(hip[0], hip[1], ANK[0], ANK[1], LEN.thigh, LEN.shin, 1);
    J.elbow = [lerp(sh[0], J.hand[0], 0.52) - 0.004, lerp(sh[1] - 0.012, J.hand[1], 0.52)];
    J.head = [sh[0] + LEN.neck * Math.sin(g * 0.6) + 0.012, sh[1] + LEN.neck * Math.cos(g * 0.6)];
    return J;
  }

  function drawPlate(ctx, x, y, S, st) {
    const r = PLATE_R * S;
    ctx.fillStyle = st.plate; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = st.rim; ctx.lineWidth = Math.max(1, S * 0.006);
    ctx.beginPath(); ctx.arc(x, y, r * 0.965, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, TAU); ctx.stroke();
    ctx.fillStyle = st.shorts; ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, TAU); ctx.fill();
    ctx.fillStyle = st.steel; ctx.beginPath(); ctx.arc(x, y, r * 0.15, 0, TAU); ctx.fill();
  }

  /* draws the figure with its feet at (ox, oy); S is the body height in pixels. The canvas must be clear behind it. */
  function drawSide(ctx, ox, oy, S, J, st, o) {
    o = o || {};
    const B = SIDE;
    const X = x => ox + x * S, Y = y => oy - y * S;
    const P = (p, r) => [X(p[0]), Y(p[1]), r * S];
    const mix = (a, b, t, r, dx) => [X(lerp(a[0], b[0], t) + (dx || 0)), Y(lerp(a[1], b[1], t)), r * S];
    const gap = Math.max(1, S * 0.011);
    const u = [Math.sin(J.lean), Math.cos(J.lean)], n = [-u[1], u[0]];
    const along = (t, back, r) => [X(J.hip[0] + u[0] * LEN.torso * t + n[0] * back), Y(J.hip[1] + u[1] * LEN.torso * t + n[1] * back), r * S];

    if (J.bar) drawPlate(ctx, X(J.bar[0]), Y(J.bar[1]), S, st);

    const leg = (dx, tone, shoe, shorts, g) => {
      const hip = [J.hip[0] + dx, J.hip[1]], knee = [J.knee[0] + dx, J.knee[1]], ank = [J.ankle[0] + dx, J.ankle[1]];
      chain(ctx, [P(hip, B.thigh), mix(hip, knee, 0.4, B.thigh * 0.95), P(knee, B.knee), mix(knee, ank, 0.3, B.calf, -0.012), P(ank, B.ankle)], tone, g);
      chain(ctx, [[X(ank[0] - 0.03), Y(0.022), B.foot * S], [X(ank[0] + 0.105), Y(0.019), B.foot * 0.85 * S]], shoe, g);
      /* shorts: the top of the thigh in another colour, cut straight across at the hem */
      const tl = Math.hypot(knee[0] - hip[0], knee[1] - hip[1]) || 1, vx = (knee[0] - hip[0]) / tl, vy = (knee[1] - hip[1]) / tl;
      const corner = (al, side) => [X(hip[0] + vx * al - vy * side), Y(hip[1] + vy * al + vx * side)];
      const c1 = corner(-0.2, -0.2), c2 = corner(-0.2, 0.2), c3 = corner(tl * 0.42, 0.2), c4 = corner(tl * 0.42, -0.2);
      ctx.save();
      ctx.beginPath(); ctx.moveTo(c1[0], c1[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(c3[0], c3[1]); ctx.lineTo(c4[0], c4[1]); ctx.closePath(); ctx.clip();
      chain(ctx, [[X(hip[0] + u[0] * 0.045), Y(hip[1] + u[1] * 0.045), (B.pelvis - 0.003) * S], P(hip, B.thigh + 0.003), mix(hip, knee, 0.6, B.thigh * 0.93 + 0.003)], shorts, 0);
      ctx.restore();
    };
    const arm = (dx, tone, g) => {
      const sh = [J.sh[0] + dx, J.sh[1] - 0.012], el = [J.elbow[0] + dx, J.elbow[1]], ha = [J.hand[0] + dx, J.hand[1]];
      chain(ctx, [P(sh, B.delt), mix(sh, el, 0.42, B.bi), P(el, B.elbow), mix(el, ha, 0.28, B.fore), mix(el, ha, 0.92, B.wrist)], tone, g);
      chain(ctx, [P(ha, B.hand)], tone, 0);
    };

    arm(0.022, st.far, 0);
    leg(0.036, st.far, st.shoeFar, st.shortsFar, 0);

    chain(ctx, [along(-0.02, 0.022, B.glute)], st.near, gap);
    chain(ctx, [along(0, 0.004, B.pelvis), along(0.36, -0.004, B.waist), along(0.74, -0.016, B.chest), along(1, 0, B.delt * 1.04)], st.near, gap);
    chain(ctx, [along(1.02, -0.004, 0.031), [X(J.head[0] - 0.004), Y(J.head[1] - 0.045), 0.027 * S]], st.near, 0);

    /* head, with the hair as a darker cap */
    const hx = X(J.head[0]), hy = Y(J.head[1]), rot = J.lean * 0.5;
    if (o.tail) chain(ctx, [[X(J.head[0] - 0.048), Y(J.head[1] + 0.022), 0.025 * S], [X(J.head[0] - 0.1), Y(J.head[1] - 0.05), 0.011 * S]], st.hair, 0);
    ctx.fillStyle = st.near;
    ctx.beginPath(); ctx.ellipse(hx, hy, 0.053 * S, 0.066 * S, rot, 0, TAU); ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = st.hair;
    ctx.beginPath(); ctx.ellipse(hx - 0.02 * S, hy - 0.03 * S, 0.06 * S, 0.052 * S, rot - 0.35, 0, TAU); ctx.fill();
    ctx.restore();

    leg(0, st.near, st.shoe, st.shorts, gap);
    arm(0, st.near, gap);

    if (st.shade) shade(ctx, X(-0.3), Y(1.05), X(0.35), Y(0), st.shade);

    if (J.bar) {
      const bx = X(J.bar[0]), by = Y(J.bar[1]);
      ctx.fillStyle = st.steel; ctx.beginPath(); ctx.arc(bx, by, 0.015 * S, 0, TAU); ctx.fill();
      ctx.fillStyle = st.plate; ctx.beginPath(); ctx.arc(bx, by, 0.006 * S, 0, TAU); ctx.fill();
    }
    /* the floor goes in last and behind, so the light never touches it */
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = st.ground;
    ctx.beginPath(); ctx.ellipse(X(0.03), Y(-0.004), S * 0.26, S * 0.012, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ---------------- front view ---------------- */
  const BUILDS = {
    slab: { sh: 0.1, delt: 0.03, neck: 0.025, chest: 0.086, waist: 0.073, hip: 0.083, ua: 0.022, el: 0.017, fa: 0.019, wr: 0.015, thigh: 0.04, knee: 0.027, calf: 0.028, ankle: 0.018, def: 0, soft: 0, abd: 3 },
    plin: { sh: 0.112, delt: 0.041, neck: 0.034, chest: 0.122, waist: 0.14, hip: 0.132, ua: 0.039, el: 0.026, fa: 0.028, wr: 0.019, thigh: 0.07, knee: 0.038, calf: 0.043, ankle: 0.023, def: 0, soft: 1, abd: 10 },
    fit: { sh: 0.12, delt: 0.046, neck: 0.033, chest: 0.11, waist: 0.079, hip: 0.09, ua: 0.037, el: 0.023, fa: 0.029, wr: 0.018, thigh: 0.061, knee: 0.034, calf: 0.041, ankle: 0.021, def: 1, soft: 0, abd: 7 }
  };
  function mixBuild(a, b, t) {
    const o = {};
    for (const k in a) o[k] = lerp(a[k], b[k], t);
    return o;
  }

  /* pose: { arms: 'down' | 'bar', barY: pixel height of the bar, drop: how far the hips sit below standing }
     returns where the head ended up, so text can make room for it. The canvas must be clear behind the figure. */
  function drawFront(ctx, ox, oy, S, B, pose, st) {
    pose = pose || {};
    const d = pose.drop || 0;
    const X = x => ox + x * S, Y = y => oy - (y - d) * S, YG = y => oy - y * S;
    const gap = Math.max(1, S * 0.008);
    const fill = st.near;

    /* legs: feet stay put, knees open as the hips come down */
    for (const sg of [-1, 1]) {
      const hip = [sg * B.hip * 0.56, 0.5 - d], ank = [sg * 0.07, 0.045];
      const knee = ik(hip[0], hip[1], ank[0], ank[1], 0.2285, 0.2285, sg);
      const pt = (p, r) => [X(p[0]), YG(p[1]), r * S];
      const mid = (a, b, t, r, dx) => [X(lerp(a[0], b[0], t) + (dx || 0)), YG(lerp(a[1], b[1], t)), r * S];
      chain(ctx, [pt(hip, B.thigh), mid(hip, knee, 0.42, B.thigh * 0.94, sg * 0.004), pt(knee, B.knee), mid(knee, ank, 0.3, B.calf, sg * 0.005), pt(ank, B.ankle)], fill, 0);
      ctx.fillStyle = st.shoe;
      ctx.beginPath(); ctx.ellipse(X(ank[0] + sg * 0.012), YG(0.021), 0.036 * S, 0.021 * S, 0, 0, TAU); ctx.fill();
    }

    /* torso */
    const half = [[B.hip * 0.86, 0.5], [B.hip, 0.55], [B.waist, 0.628], [B.chest, 0.742], [B.sh + B.delt * 0.35, 0.806], [B.sh * 0.66, 0.85], [B.neck, 0.866]];
    const pts = [];
    half.forEach(p => pts.push([X(p[0]), Y(p[1])]));
    for (let i = half.length - 1; i >= 0; i--) pts.push([X(-half[i][0]), Y(half[i][1])]);
    ctx.fillStyle = fill; blob(ctx, pts); ctx.fill();

    /* shorts */
    const wb = lerp(B.waist, B.hip, 0.62) + 0.003, to = B.hip * 0.56 + B.thigh + 0.008;
    ctx.fillStyle = st.shorts; ctx.strokeStyle = st.shorts; ctx.lineJoin = 'round'; ctx.lineWidth = S * 0.014;
    ctx.beginPath();
    ctx.moveTo(X(-wb), Y(0.572)); ctx.lineTo(X(wb), Y(0.572)); ctx.lineTo(X(B.hip + 0.006), Y(0.51)); ctx.lineTo(X(to), Y(0.392));
    ctx.lineTo(X(0.016), Y(0.392)); ctx.lineTo(X(0), Y(0.44)); ctx.lineTo(X(-0.016), Y(0.392)); ctx.lineTo(X(-to), Y(0.392)); ctx.lineTo(X(-B.hip - 0.006), Y(0.51));
    ctx.closePath(); ctx.fill(); ctx.stroke();

    /* definition: only shows as the build gets lean */
    ctx.strokeStyle = st.line; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, S * 0.0055);
    if (B.def > 0.03) {
      ctx.globalAlpha = B.def;
      for (const sg of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(X(sg * 0.01), Y(0.73)); ctx.quadraticCurveTo(X(sg * B.chest * 0.5), Y(0.708), X(sg * B.chest * 0.88), Y(0.746)); ctx.stroke();
        for (const y of [0.676, 0.643, 0.611]) { ctx.beginPath(); ctx.moveTo(X(sg * 0.011), Y(y)); ctx.lineTo(X(sg * 0.04), Y(y + 0.003)); ctx.stroke(); }
      }
      ctx.beginPath(); ctx.moveTo(X(0), Y(0.724)); ctx.lineTo(X(0), Y(0.6)); ctx.stroke();
    }
    if (B.soft > 0.03) {
      ctx.globalAlpha = B.soft;
      ctx.beginPath(); ctx.moveTo(X(-B.waist * 0.6), Y(0.618)); ctx.quadraticCurveTo(X(0), Y(0.583), X(B.waist * 0.6), Y(0.618)); ctx.stroke();
      for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(X(sg * 0.014), Y(0.722)); ctx.quadraticCurveTo(X(sg * B.chest * 0.5), Y(0.69), X(sg * B.chest * 0.84), Y(0.73)); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;

    /* neck and head */
    chain(ctx, [[X(0), Y(0.852), B.neck * 0.96 * S], [X(0), Y(0.892), B.neck * 0.9 * S]], st.neck, 0);
    const hx = X(0), hy = Y(0.93), hrx = 0.054 * S, hry = 0.069 * S;
    /* ears first, then a head that is wider at the temples than at the jaw */
    ctx.fillStyle = st.neck;
    for (const sg of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + sg * hrx * 0.98, hy + hry * 0.06, hrx * 0.16, hry * 0.2, 0, 0, TAU); ctx.fill(); }
    const hp = [[0, -1.06], [0.8, -0.98], [1.06, -0.42], [1.0, 0.2], [0.72, 0.84], [0.3, 1.1], [-0.3, 1.1], [-0.72, 0.84], [-1.0, 0.2], [-1.06, -0.42], [-0.8, -0.98]];
    ctx.fillStyle = fill; blob(ctx, hp.map(p => [hx + p[0] * hrx, hy + p[1] * hry])); ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = st.hair;
    ctx.beginPath(); ctx.ellipse(hx, hy - hry * 0.78, hrx * 1.25, hry * 0.6, 0, 0, TAU); ctx.fill();
    ctx.restore();

    /* arms */
    for (const sg of [-1, 1]) {
      const sh = [X(sg * B.sh), Y(0.8)];
      let el, ha;
      if (pose.arms === 'bar') {
        ha = [X(sg * (B.sh + 0.105)), pose.barY];
        el = [X(sg * (B.sh + 0.074)), Math.max(sh[1] + 0.05 * S, ha[1] + 0.13 * S)];
      } else {
        const a1 = B.abd * RAD, a2 = B.abd * 0.3 * RAD;
        el = [sh[0] + sg * Math.sin(a1) * 0.168 * S, sh[1] + Math.cos(a1) * 0.168 * S];
        ha = [el[0] + sg * Math.sin(a2) * 0.158 * S, el[1] + Math.cos(a2) * 0.158 * S];
      }
      const m = (a, b, t, r) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), r * S];
      const up = pose.arms === 'bar';
      chain(ctx, [[sh[0], sh[1], B.delt * S], m(sh, el, 0.44, B.ua), [el[0], el[1], B.el * S]], fill, 0);
      chain(ctx, [[el[0], el[1], B.el * S], m(el, ha, 0.28, B.fa), m(el, ha, 0.94, B.wr)], fill, up ? gap : 0);
      chain(ctx, [[ha[0], ha[1], 0.024 * S]], fill, up ? gap : 0);
      if (up) continue;
      /* where the arm meets the body */
      ctx.strokeStyle = st.line; ctx.lineWidth = Math.max(1, S * 0.0055); ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(X(sg * (B.chest - 0.004)), Y(0.758)); ctx.quadraticCurveTo(X(sg * (B.chest + 0.002)), Y(0.7), X(sg * lerp(B.chest, B.waist, 0.6)), Y(0.66)); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (st.shade) shade(ctx, X(-0.22), Y(1), X(0.22), Y(0.3), st.shade);
    return { x: hx, y: hy, rx: hrx, ry: hry };
  }

  return { STYLES, BUILDS, PLATE_R, squat, deadlift, drawSide, drawFront, drawPlate, mixBuild, lerp, clamp, ease };
})();

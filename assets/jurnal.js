/* Încă Una · jurnalul de progres. Everything lives in this browser (localStorage); a backup is one JSON file. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const KEY = 'inca-una-jurnal-v1';

  /* The antagonist split. unit: kg (weight and reps), rep (reps only), s (seconds). inc: the step up once every set is done. */
  const PLAN = [
    { name: 'Luni', title: 'Biceps și piept', ex: [
      { id: 'impins-piept', name: 'Împins la piept cu bara', sets: 4, reps: 8, inc: 2.5 },
      { id: 'flexii-bara', name: 'Flexii cu bara', sets: 4, reps: 10, inc: 2.5 },
      { id: 'impins-inclinat', name: 'Împins înclinat cu ganterele', sets: 3, reps: 10, inc: 2 },
      { id: 'flexii-ciocan', name: 'Flexii ciocan', sets: 3, reps: 12, inc: 2 }] },
    { name: 'Marți', title: 'Triceps și spate', ex: [
      { id: 'tractiuni-helcometru', name: 'Tracțiuni la helcometru', sets: 4, reps: 10, inc: 2.5 },
      { id: 'extensii-scripete', name: 'Extensii la scripete', sets: 4, reps: 12, inc: 2.5 },
      { id: 'ramat-bara', name: 'Ramat cu bara', sets: 3, reps: 8, inc: 2.5 },
      { id: 'extensii-cap', name: 'Extensii deasupra capului', sets: 3, reps: 12, inc: 2 }] },
    { name: 'Joi', title: 'Umeri și abdomen', ex: [
      { id: 'impins-cap', name: 'Împins deasupra capului', sets: 4, reps: 8, inc: 2.5 },
      { id: 'ridicari-picioare', name: 'Ridicări de picioare', sets: 3, reps: 12, unit: 'rep' },
      { id: 'ridicari-laterale', name: 'Ridicări laterale', sets: 4, reps: 12, inc: 1 },
      { id: 'plank', name: 'Plank', sets: 3, reps: 40, unit: 's' }] },
    { name: 'Vineri', title: 'Picioare', ex: [
      { id: 'genuflexiuni', name: 'Genuflexiuni cu bara', sets: 4, reps: 6, inc: 2.5 },
      { id: 'indreptari-romanesti', name: 'Îndreptări românești', sets: 3, reps: 8, inc: 2.5 },
      { id: 'presa', name: 'Presă pentru picioare', sets: 3, reps: 12, inc: 5 },
      { id: 'ridicari-varfuri', name: 'Ridicări pe vârfuri', sets: 4, reps: 15, inc: 2.5 }] }
  ];
  const EX = {};
  PLAN.forEach((d, di) => d.ex.forEach(e => { EX[e.id] = Object.assign({ day: di, unit: 'kg' }, e); }));

  /* ---------------- small helpers ---------------- */
  const pad2 = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const today = () => iso(new Date());
  const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
  const nice = s => { const d = fromIso(s); return d.getDate() + ' ' + MONTHS[d.getMonth()]; };
  const monday = d => { const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t; };
  const num = v => { const n = parseFloat(String(v).trim().replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  const fmt = v => String(Math.round(v * 100) / 100).replace('.', ',');
  const unitWord = ex => (ex.unit === 's' ? 'sec' : 'rep');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  /* Romanian counts: 1 antrenament, 5 antrenamente, 20 de antrenamente */
  const ro = (n, one, many) => (n === 1 ? '1 ' + one : n % 100 === 0 || n % 100 >= 20 ? n + ' de ' + many : n + ' ' + many);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- storage ---------------- */
  const blank = () => ({ v: 1, sessions: [], body: [] });
  const valid = o => !!o && o.v === 1 && Array.isArray(o.sessions) && Array.isArray(o.body) &&
    o.sessions.every(s => s && typeof s.date === 'string' && typeof s.ex === 'object') && o.body.every(b => b && typeof b.date === 'string');
  let real = blank(), data = real, demo = false, canSave = true;
  try {
    localStorage.setItem(KEY + '-test', '1'); localStorage.removeItem(KEY + '-test');
    const raw = localStorage.getItem(KEY);
    if (raw) { const o = JSON.parse(raw); if (valid(o)) real = o; }
  } catch (e) { canSave = false; }
  data = real;
  function save() {
    if (demo) return;
    try { localStorage.setItem(KEY, JSON.stringify(real)); } catch (e) { canSave = false; }
    $('#j-warn').hidden = canSave;
  }
  $('#j-warn').hidden = canSave;

  const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.t || 0) - (b.t || 0));
  const sessions = () => data.sessions.slice().sort(byDate);
  function hist(exId) {
    return sessions().filter(s => s.ex[exId] && s.ex[exId].length).map(s => ({ date: s.date, sets: s.ex[exId] }));
  }
  function top(ex, sets) {
    return ex.unit === 'kg' ? Math.max.apply(null, sets.map(s => s[0])) : Math.max.apply(null, sets.map(s => s[1]));
  }

  /* what to try today: every set done last time means one more step up, otherwise one more rep at the same weight */
  function suggest(ex) {
    const h = hist(ex.id), last = h[h.length - 1];
    if (!last) return { first: true, kg: '', reps: ex.reps };
    const sets = last.sets;
    if (ex.unit !== 'kg') {
      const low = Math.min.apply(null, sets.map(s => s[1]));
      return { up: ex.unit, kg: '', reps: low + (ex.unit === 's' ? 5 : 1) };
    }
    const heavy = top(ex, sets), atTop = sets.filter(s => s[0] === heavy);
    const done = sets.length >= ex.sets && sets.every(s => s[1] >= ex.reps);
    if (done) return { up: 'kg', kg: heavy + ex.inc, reps: ex.reps };
    return { up: 'rep', kg: heavy, reps: Math.min(ex.reps, Math.min.apply(null, atTop.map(s => s[1])) + 1) };
  }
  function lastText(ex) {
    const h = hist(ex.id), last = h[h.length - 1];
    if (!last) return '';
    const sets = last.sets;
    let body;
    if (ex.unit !== 'kg') body = sets.map(s => s[1]).join(', ') + ' ' + unitWord(ex);
    else if (sets.every(s => s[0] === sets[0][0])) body = fmt(sets[0][0]) + ' kg × ' + sets.map(s => s[1]).join(', ');
    else body = sets.map(s => fmt(s[0]) + '×' + s[1]).join(', ');
    return 'Data trecută, ' + nice(last.date) + ': ' + body;
  }
  function suggestText(ex, sg) {
    if (sg.first) return ex.unit === 'kg' ? 'Prima dată: alege o greutate cu care faci curat ' + ex.reps + ' repetări.' : 'Prima dată: notează cât reușești.';
    if (sg.up === 's') return 'Azi: ' + sg.reps + ' secunde. Încă 5.';
    if (sg.up === 'rep') return ex.unit === 'rep' ? 'Azi: ' + sg.reps + ' repetări. Încă una.' : 'Azi: ' + fmt(sg.kg) + ' kg, încearcă încă o repetare.';
    return 'Azi: ' + fmt(sg.kg) + ' kg. Încă ' + fmt(ex.inc) + ' kg, ai făcut toate seriile data trecută.';
  }
  function nextDay() {
    const s = sessions();
    return s.length ? (s[s.length - 1].day + 1) % PLAN.length : 0;
  }

  /* ---------------- tabs ---------------- */
  const tabs = $$('.j-tabs [role="tab"]');
  function showTab(btn, focus) {
    tabs.forEach(t => {
      const on = t === btn;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) btn.focus();
    if (btn.id === 'tb-progres') renderProgress();
    if (btn.id === 'tb-corp') renderBody();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => showTab(t, false));
    t.addEventListener('keydown', e => {
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      showTab(tabs[(i + dir + tabs.length) % tabs.length], true);
    });
  });

  /* ---------------- today ---------------- */
  let day = nextDay();
  const dateIn = $('#j-date');
  dateIn.value = today();

  function renderDays() {
    const wrap = $('#j-days');
    wrap.innerHTML = PLAN.map((d, i) => '<button type="button" role="radio" aria-checked="' + (i === day) + '" tabindex="' + (i === day ? 0 : -1) + '" data-day="' + i + '"><b>' + esc(d.name) + '</b> ' + esc(d.title) + '</button>').join('');
    const s = sessions();
    $('#j-next').textContent = s.length
      ? 'Urmează: ' + PLAN[nextDay()].name.toLowerCase() + ', ' + PLAN[nextDay()].title.toLowerCase() + '. Notează seriile și bifează-le pe cele făcute.'
      : 'Alege ziua din split, notează seriile și bifează-le pe cele făcute.';
  }
  $('#j-days').addEventListener('click', e => {
    const b = e.target.closest('button[data-day]');
    if (!b) return;
    day = +b.dataset.day;
    renderDays(); renderToday();
  });
  $('#j-days').addEventListener('keydown', e => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    day = (day + dir + PLAN.length) % PLAN.length;
    renderDays(); renderToday();
    $('#j-days [aria-checked="true"]').focus();
  });

  function renderToday() {
    $('#j-ex').innerHTML = PLAN[day].ex.map(id => {
      const ex = EX[id.id], sg = suggest(ex), last = lastText(ex), kgOn = ex.unit === 'kg';
      let rows = '';
      for (let i = 0; i < ex.sets; i++) {
        rows += '<li><span class="jx-n">' + (i + 1) + '</span>' +
          (kgOn ? '<label class="jx-in"><span>kg</span><input type="text" inputmode="decimal" autocomplete="off" data-k="kg" value="' + (sg.kg === '' ? '' : fmt(sg.kg)) + '"></label><span class="jx-x" aria-hidden="true">×</span>' : '') +
          '<label class="jx-in"><span>' + unitWord(ex) + '</span><input type="text" inputmode="numeric" autocomplete="off" data-k="reps" value="' + sg.reps + '"></label>' +
          '<button type="button" class="jx-ok" aria-pressed="false" aria-label="Seria ' + (i + 1) + ' făcută"></button></li>';
      }
      return '<article class="jx' + (sg.up === 'kg' ? ' up' : '') + '" data-ex="' + ex.id + '">' +
        '<header><h3>' + esc(ex.name) + '</h3><span class="jx-t">' + ex.sets + ' × ' + ex.reps + (ex.unit === 's' ? ' s' : '') + '</span></header>' +
        (last ? '<p class="jx-last">' + esc(last) + '</p>' : '') +
        '<p class="jx-sug"><i aria-hidden="true"></i>' + esc(suggestText(ex, sg)) + '</p>' +
        '<ol class="jx-sets">' + rows + '</ol></article>';
    }).join('');
  }
  $('#j-ex').addEventListener('click', e => {
    const b = e.target.closest('.jx-ok');
    if (!b) return;
    b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
  });

  function say(id, text, bad) {
    const m = $(id);
    m.textContent = text;
    m.classList.toggle('bad', !!bad);
    m.hidden = false;
  }
  $('#j-save').addEventListener('click', () => {
    const date = dateIn.value || today();
    const ex = {};
    let ticked = 0, wrong = null;
    $$('#j-ex .jx').forEach(card => {
      const def = EX[card.dataset.ex], sets = [];
      $$('.jx-sets li', card).forEach(li => {
        if ($('.jx-ok', li).getAttribute('aria-pressed') !== 'true') return;
        ticked++;
        const kgIn = $('[data-k="kg"]', li), reps = num($('[data-k="reps"]', li).value), kg = kgIn ? num(kgIn.value) : 0;
        if (!(reps > 0) || (kgIn && !(kg >= 0))) { wrong = wrong || def.name; return; }
        sets.push([Math.round(kg * 100) / 100, Math.round(reps)]);
      });
      if (sets.length) ex[def.id] = sets;
    });
    if (!ticked) { say('#j-msg', 'Bifează seriile pe care le-ai făcut, apoi salvează.', true); return; }
    if (wrong) { say('#j-msg', 'Verifică cifrele la ' + wrong + '.', true); return; }
    const same = data.sessions.findIndex(s => s.date === date && s.day === day);
    const entry = { id: same >= 0 ? data.sessions[same].id : uid(), date, day, ex, t: Date.now() };
    if (same >= 0) data.sessions[same] = entry; else data.sessions.push(entry);
    save();
    say('#j-msg', (same >= 0 ? 'Am actualizat antrenamentul din ' + nice(date) + '.' : 'Salvat. Încă una bifată.') + (demo ? ' (Exemplu, nu se păstrează.)' : ''), false);
    $('#j-save').classList.remove('pop'); void $('#j-save').offsetWidth; $('#j-save').classList.add('pop');
    day = nextDay();
    renderDays(); renderToday();
  });

  /* ---------------- progress ---------------- */
  const pick = $('#j-pick');
  pick.innerHTML = PLAN.map(d => '<optgroup label="' + esc(d.name + ' · ' + d.title) + '">' + d.ex.map(e => '<option value="' + e.id + '">' + esc(e.name) + '</option>').join('') + '</optgroup>').join('');
  let picked = null;
  pick.addEventListener('change', () => { picked = pick.value; renderChart(); });

  function renderChart() {
    const ex = EX[pick.value], h = hist(ex.id), vals = h.map(x => top(ex, x.sets));
    const unit = ex.unit === 'kg' ? 'kg' : ex.unit === 's' ? 's' : 'rep';
    IUChart.line($('#j-chart'), vals, { unit, from: h.length ? nice(h[0].date) : '', to: h.length > 1 ? nice(h[h.length - 1].date) : '', empty: 'Încă nu ai notat ' + ex.name.toLowerCase() });
    $('#j-chart').setAttribute('aria-label', h.length ? ex.name + ': de la ' + fmt(vals[0]) + ' la ' + fmt(vals[vals.length - 1]) + ' ' + unit + ', în ' + h.length + ' antrenamente' : 'Încă nu sunt date');
    const st = $('#j-stats');
    if (!h.length) { st.innerHTML = '<p class="j-note">Graficul apare după primul antrenament salvat cu exercițiul ăsta.</p>'; return; }
    const first = vals[0], now = vals[vals.length - 1], diff = now - first;
    const word = unit === 'kg' ? ' kg' : unit === 's' ? ' s' : ' rep';
    let extra = ro(h.length, 'antrenament', 'antrenamente');
    if (unit === 'kg' && diff > 0 && ex.inc) extra = ro(Math.round(diff / ex.inc), 'pas', 'pași') + ' de câte ' + fmt(ex.inc) + ' kg';
    st.innerHTML =
      '<div><b>' + fmt(first) + word + '</b><span>prima dată</span></div>' +
      '<div><b>' + fmt(now) + word + '</b><span>acum</span></div>' +
      '<div class="' + (diff > 0 ? 'plus' : '') + '"><b>' + (diff > 0 ? '+' : '') + fmt(diff) + word + '</b><span>' + esc(extra) + '</span></div>';
  }

  function renderWeeks() {
    const s = sessions(), now = monday(new Date()), cols = [];
    for (let w = 11; w >= 0; w--) {
      const start = new Date(now); start.setDate(start.getDate() - w * 7);
      const end = new Date(start); end.setDate(end.getDate() + 7);
      const c = s.filter(x => { const d = fromIso(x.date); return d >= start && d < end; }).length;
      cols.push({ c, now: w === 0 });
    }
    $('#j-weeks').innerHTML = cols.map(col => '<span class="jw' + (col.now ? ' now' : '') + '">' + [0, 1, 2, 3].map(i => '<i' + (i < col.c ? ' class="on"' : '') + '></i>').join('') + '</span>').join('');
    const last4 = cols.slice(-4).reduce((a, b) => a + Math.min(b.c, 4), 0);
    let streak = 0;
    for (let i = cols.length - 2; i >= 0 && cols[i].c >= 3; i--) streak++;
    if (cols[cols.length - 1].c >= 3) streak++;
    $('#j-weeks').setAttribute('aria-label', 'În ultimele 12 săptămâni: ' + cols.map(c => c.c).join(', ') + ' antrenamente pe săptămână');
    $('#j-weeks-note').textContent = s.length
      ? ro(last4, 'antrenament', 'antrenamente') + ' în ultimele 4 săptămâni' + (streak ? ', ' + ro(streak, 'săptămână', 'săptămâni') + ' la rând cu cel puțin trei.' : '.')
      : 'Fiecare antrenament salvat aprinde un punct. Patru pe coloană înseamnă o săptămână plină.';
  }

  function renderHist() {
    const s = sessions().reverse();
    $('#j-hist').innerHTML = s.length ? s.slice(0, 40).map(x => {
      const n = Object.values(x.ex).reduce((a, b) => a + b.length, 0), d = PLAN[x.day] || PLAN[0];
      return '<li><div><b>' + nice(x.date) + '</b> · ' + esc(d.title) + '<span>' + ro(n, 'serie', 'serii') + '</span></div>' +
        '<button type="button" class="j-del" data-id="' + esc(x.id) + '" aria-label="Șterge antrenamentul din ' + nice(x.date) + '">Șterge</button></li>';
    }).join('') : '<li class="j-none">Încă nimic. Primul antrenament salvat apare aici.</li>';
  }
  $('#j-hist').addEventListener('click', e => {
    const b = e.target.closest('.j-del');
    if (!b) return;
    const x = data.sessions.find(s => s.id === b.dataset.id);
    if (!x || !confirm('Ștergi antrenamentul din ' + nice(x.date) + '?')) return;
    data.sessions = data.sessions.filter(s => s.id !== x.id);
    if (!demo) real = data;
    save(); renderProgress(); renderDays(); renderToday();
  });

  function renderProgress() {
    if (!picked) {
      /* start on the lift with the most entries */
      let best = PLAN[0].ex[0].id, most = -1;
      Object.keys(EX).forEach(id => { const c = hist(id).length; if (c > most) { most = c; best = id; } });
      picked = best;
    }
    pick.value = picked;
    renderChart(); renderWeeks(); renderHist();
  }

  /* ---------------- body ---------------- */
  const bodyForm = $('#j-body-form');
  bodyForm.elements.date.value = today();
  bodyForm.addEventListener('submit', e => {
    e.preventDefault();
    const date = bodyForm.elements.date.value || today(), kg = num(bodyForm.elements.kg.value), talie = num(bodyForm.elements.talie.value);
    if (!(kg > 20 && kg < 400)) { say('#j-body-msg', 'Scrie greutatea în kilograme, de exemplu 82,4.', true); bodyForm.elements.kg.focus(); return; }
    if (bodyForm.elements.talie.value.trim() && !(talie > 30 && talie < 250)) { say('#j-body-msg', 'Talia se scrie în centimetri, de exemplu 88.', true); return; }
    const entry = { date, kg: Math.round(kg * 10) / 10 };
    if (talie > 0) entry.talie = Math.round(talie * 10) / 10;
    data.body = data.body.filter(b => b.date !== date).concat(entry);
    save();
    bodyForm.elements.kg.value = ''; bodyForm.elements.talie.value = '';
    say('#j-body-msg', 'Notat pentru ' + nice(date) + '.', false);
    renderBody();
  });
  function renderBody() {
    const b = data.body.slice().sort(byDate), t = b.filter(x => x.talie);
    IUChart.line($('#j-wchart'), b.map(x => x.kg), { unit: 'kg', from: b.length ? nice(b[0].date) : '', to: b.length > 1 ? nice(b[b.length - 1].date) : '', empty: 'Prima cântărire apare aici' });
    IUChart.line($('#j-tchart'), t.map(x => x.talie), { unit: 'cm', from: t.length ? nice(t[0].date) : '', to: t.length > 1 ? nice(t[t.length - 1].date) : '', empty: 'Talia apare aici, dacă o notezi' });
    $('#j-body-hist').innerHTML = b.length ? b.slice().reverse().slice(0, 30).map(x =>
      '<li><div><b>' + nice(x.date) + '</b> · ' + fmt(x.kg) + ' kg' + (x.talie ? '<span>' + fmt(x.talie) + ' cm talie</span>' : '') + '</div>' +
      '<button type="button" class="j-del" data-date="' + x.date + '" aria-label="Șterge cântărirea din ' + nice(x.date) + '">Șterge</button></li>').join('') : '';
  }
  $('#j-body-hist').addEventListener('click', e => {
    const b = e.target.closest('.j-del');
    if (!b || !confirm('Ștergi cântărirea din ' + nice(b.dataset.date) + '?')) return;
    data.body = data.body.filter(x => x.date !== b.dataset.date);
    if (!demo) real = data;
    save(); renderBody();
  });

  /* ---------------- backup, example data, wipe ---------------- */
  $('#j-export').addEventListener('click', () => {
    if (demo) { say('#j-copy-msg', 'Ești în exemplu. Ieși din exemplu ca să descarci jurnalul tău.', true); return; }
    const blob = new Blob([JSON.stringify(real, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'inca-una-jurnal-' + today() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    say('#j-copy-msg', 'Copia e în descărcări. Păstreaz-o undeva sigur, de exemplu în email.', false);
  });
  $('#j-import-btn').addEventListener('click', () => $('#j-import').click());
  $('#j-import').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const o = JSON.parse(await f.text());
      if (!valid(o)) throw new Error('format');
      if ((real.sessions.length || real.body.length) && !confirm('Înlocuiești ce e acum în jurnal cu copia asta?')) return;
      if (demo) leaveDemo();
      real = o; data = real; save();
      picked = null; day = nextDay();
      renderAll();
      say('#j-copy-msg', 'Gata, jurnalul e înapoi: ' + ro(o.sessions.length, 'antrenament', 'antrenamente') + '.', false);
    } catch (err) {
      say('#j-copy-msg', 'Fișierul nu pare o copie a jurnalului.', true);
    }
  });
  $('#j-wipe').addEventListener('click', () => {
    if (demo) { leaveDemo(); return; }
    if (!confirm('Ștergi tot jurnalul de pe telefonul ăsta? Nu se poate anula, doar dacă ai o copie.')) return;
    real = blank(); data = real; save();
    picked = null; day = 0;
    renderAll();
    say('#j-copy-msg', 'Jurnalul e gol.', false);
  });

  /* twelve weeks of a made-up lifter, kept in memory only */
  function demoData() {
    const d = blank(), start = monday(new Date());
    start.setDate(start.getDate() - 11 * 7);
    const base = { 'impins-piept': 40, 'flexii-bara': 20, 'impins-inclinat': 12, 'flexii-ciocan': 10, 'tractiuni-helcometru': 40, 'extensii-scripete': 20, 'ramat-bara': 40, 'extensii-cap': 12, 'impins-cap': 25, 'ridicari-laterale': 6, genuflexiuni: 50, 'indreptari-romanesti': 50, presa: 80, 'ridicari-varfuri': 40 };
    const offset = [0, 1, 3, 4];
    for (let w = 0; w < 12; w++) {
      PLAN.forEach((p, di) => {
        if (w === 6 && di === 3) return;          /* one missed day, like real life */
        const date = new Date(start); date.setDate(date.getDate() + w * 7 + offset[di]);
        const ex = {};
        p.ex.forEach(e => {
          const def = EX[e.id], sets = [];
          for (let i = 0; i < def.sets; i++) {
            if (def.unit === 's') sets.push([0, def.reps + w * 3]);
            else if (def.unit === 'rep') sets.push([0, Math.max(6, def.reps - 4 + Math.floor(w * 0.7) - (i === def.sets - 1 ? 1 : 0))]);
            else {
              const kg = base[e.id] + def.inc * Math.floor(w * 0.75);
              sets.push([kg, def.reps - (w % 3 === 2 && i === def.sets - 1 ? 1 : 0)]);
            }
          }
          ex[e.id] = sets;
        });
        d.sessions.push({ id: 'demo' + w + di, date: iso(date), day: di, ex, t: w * 10 + di });
      });
      const bd = new Date(start); bd.setDate(bd.getDate() + w * 7);
      d.body.push({ date: iso(bd), kg: Math.round((84.2 - w * 0.32 + (w % 2 ? 0.2 : -0.1)) * 10) / 10, talie: Math.round((93 - w * 0.4) * 10) / 10 });
    }
    return d;
  }
  function leaveDemo() {
    demo = false; data = real;
    $('#j-demo').hidden = true;
    picked = null; day = nextDay();
    renderAll();
  }
  $('#j-demo-on').addEventListener('click', () => {
    demo = true; data = demoData();
    $('#j-demo').hidden = false;
    picked = 'impins-piept'; day = nextDay();
    renderAll();
    showTab($('#tb-progres'), false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('#j-demo-exit').addEventListener('click', leaveDemo);

  function renderAll() {
    renderDays(); renderToday(); renderProgress(); renderBody();
  }

  /* ?exemplu opens straight into the example, handy for a quick look or a video */
  if (/[?&]exemplu\b/.test(location.search)) $('#j-demo-on').click();
  else renderAll();
})();

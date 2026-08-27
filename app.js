/* Участок — рабочее место начальника участка по электрике.
   Объект (типы квартир, спецификации, раскладка) загружается файлом и лежит в браузере.
   Ход работ хранится в браузере, данные обхода приезжают выгрузкой из «Электро-приёмки». */

/* ============ иконки ============ */
var I = (function () {
  function s(p) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  }
  return {
    chart: s('<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 15v-3M12 15V8M17 15v-6"/>'),
    grid: s('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
    box: s('<path d="M21 8v13H3V8"/><rect x="1" y="3" width="22" height="5" rx="1"/><path d="M10 12h4"/>'),
    down: s('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>'),
    left: s('<path d="m15 18-6-6 6-6"/>'),
    right: s('<path d="m9 18 6-6-6-6"/>'),
    check: s('<path d="M20 6 9 17l-5-5"/>'),
    list: s('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
    file: s('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h6"/>'),
    warn: s('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
    bolt: s('<path d="M13 2 3 14h8l-1 8 10-12h-8z"/>'),
    user: s('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>')
  };
})();

/* ============ группы позиций ============ */
/* Спецификация проекта подробная (45 строк), обход считает крупными позициями.
   Свести их можно только по группам — иначе факт и план не о чём не говорят. */
var GROUPS = [
  { k: 'socket', n: 'Розетки', re: /^Розетк/i },
  { k: 'swtch', n: 'Выключатели', re: /^Выключател[ья]\s+(одно|двух|тр[её]х)клав/i },
  { k: 'light', n: 'Светильники', re: /^Светильник/i },
  { k: 'lamp', n: 'Лампы и патроны', re: /^(Лампа|Карболитовый патрон|Светодиодная лампа)/i },
  { k: 'box', n: 'Коробки устан.', re: /^Коробка установочная/i },
  { k: 'frame', n: 'Рамки', re: /^Рамка/i },
  { k: 'panel', n: 'Щиты', re: /^Щит распред/i },
  { k: 'kup', n: 'КУП и СУП', re: /^(Коробка монтажная для доп|Хомут уравнивания)/i }
];
function groupOf(name) {
  for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].re.test(name)) return GROUPS[i].k;
  return null;
}
function groupName(k) {
  var g = GROUPS.filter(function (x) { return x.k === k; })[0];
  return g ? g.n : k;
}
/* Названия позиций подсчёта из обхода — тоже к группам, иначе факт не привязать */
function groupOfCount(name) {
  var n = String(name);
  if (/розетк/i.test(n)) return 'socket';
  if (/выключател/i.test(n)) return 'swtch';
  if (/светильник|люстр/i.test(n)) return 'light';
  if (/бра|лампа|патрон/i.test(n)) return 'lamp';
  if (/коробк/i.test(n)) return 'box';
  if (/рамк/i.test(n)) return 'frame';
  if (/щит/i.test(n)) return 'panel';
  if (/куп|суп|уравнива/i.test(n)) return 'kup';
  return null;
}

/* ============ данные ============ */
var PROJ = null, ST = null, VIEW = { name: 'obj' }, app;

/* Что на этаже: обычная раскладка или своя, если этаж попал в исключения */
function floorCfg(c, f) {
  var ex = (c.ex || []).filter(function (x) { return f >= x.from && f <= x.to; })[0];
  return ex ? { per: ex.per, stack: ex.stack || [], ex: ex } : { per: c.per, stack: c.stack || [] };
}

function newState() {
  return { bid: '', flats: {}, imp: null, cfg: {} };
}
function cfgOf(b) { return (ST.cfg && ST.cfg[b.id]) || null; }
/* Место квартиры на этаже: этаж и номер по стояку (#1…#12, как на чертеже).
   Считается не формулой, а по разложенной карте — этажи бывают разной ёмкости. */
function posOf(b, num) {
  var mp = flatMap(b);
  return (mp.pos && mp.pos[num]) || null;
}
function loadState() {
  try { ST = JSON.parse(localStorage.getItem('uch_state')) || null; } catch (e) { ST = null; }
  if (!ST || !ST.flats) ST = newState();
}
var saveT;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(function () {
    try { localStorage.setItem('uch_state', JSON.stringify(ST)); }
    catch (e) { toast('Не удалось сохранить: память браузера переполнена'); }
  }, 150);
}
function bld(id) {
  var b = PROJ.buildings.filter(function (x) { return x.id === (id || ST.bid); })[0];
  return b || PROJ.buildings[0];
}
function fr(bid, num, create) {
  ST.flats[bid] = ST.flats[bid] || {};
  if (!ST.flats[bid][num] && create) ST.flats[bid][num] = {};
  return ST.flats[bid][num] || {};
}

/* Карта «номер квартиры → тип». Считается один раз на корпус: при 200 квартирах
   и 10 типах перебирать списки на каждой отрисовке — это заметно на слабой машине. */
var MAPS = {};
function flatMap(b) {
  if (MAPS[b.id]) return MAPS[b.id];
  var c = cfgOf(b);
  /* Задана раскладка стояка — она главнее списков в шапках: этажи типовые,
     и номер квартиры однозначно даёт её место, а значит и тип. */
  if (c) {
    var mm = {}, nn = [], pos = {}, k = 0;
    for (var f = c.from; f <= c.to; f++) {
      var fc = floorCfg(c, f);
      for (var i = 0; i < fc.per; i++) {
        var num = c.first + k; k++;
        nn.push(num);
        pos[num] = { f: f, i: i + 1, ex: !!fc.ex };
        if (fc.stack[i]) mm[num] = fc.stack[i];
      }
    }
    MAPS[b.id] = {
      m: mm, nums: nn, pos: pos, max: nn.length ? nn[nn.length - 1] : 0,
      miss: nn.filter(function (x) { return !mm[x]; }), dup: {}, cfg: c
    };
    return MAPS[b.id];
  }
  var m = {}, dup = {};
  b.types.forEach(function (t) {
    t.flats.forEach(function (n) {
      if (m[n] && m[n] !== t.id) { dup[n] = dup[n] || [m[n]]; dup[n].push(t.id); }
      else m[n] = t.id;
    });
  });
  var nums = Object.keys(m).map(Number).sort(function (a, z) { return a - z; });
  var max = nums.length ? nums[nums.length - 1] : 0, miss = [];
  for (var i = 1; i <= max; i++) if (!m[i]) miss.push(i);
  MAPS[b.id] = { m: m, nums: nums, max: max, miss: miss, dup: dup };
  return MAPS[b.id];
}
function typeOf(b, num) {
  var r = fr(b.id, num), id = r.ty || flatMap(b).m[num];
  return b.types.filter(function (t) { return t.id === id; })[0] || null;
}
/* План по квартире, свёрнутый в группы */
function planOf(b, num) {
  var t = typeOf(b, num), per = {}, total = 0;
  if (t) t.items.forEach(function (it) {
    var k = groupOf(it.n);
    if (!k) return;
    per[k] = (per[k] || 0) + it.q; total += it.q;
  });
  return { per: per, total: total, type: t };
}
/* Факт: то, что начальник поставил руками, важнее пришедшего из обхода —
   он стоит на объекте и видит квартиру, а выгрузка может быть недельной давности. */
function factOf(b, num) {
  var r = fr(b.id, num), q = r.q || {}, qm = r.qm || {}, per = {}, total = 0;
  /* Квартира принята без замечаний, а количества по ней никто не считал —
     берём проектные: всё, что должно стоять, стоит. */
  var byPlan = r.c === 1 && ST.autoq !== false && !Object.keys(qm).length;
  var pl = byPlan ? planOf(b, num).per : null;
  GROUPS.forEach(function (g) {
    var v = qm[g.k] != null ? qm[g.k] : (q[g.k] || 0);
    if (!v && pl && pl[g.k]) v = pl[g.k];
    if (v) { per[g.k] = v; total += v; }
  });
  return { per: per, total: total, man: qm, imp: q, byPlan: byPlan && total > 0 };
}
function setQ(b, num, k, v) {
  var r = fr(b.id, num, true);
  r.qm = r.qm || {};
  if (v < 0) v = 0;
  r.qm[k] = v;
  if (!Object.keys(r.qm).length) delete r.qm;
  save();
}
/* Стадии: «сдано» ставит начальник, «проверено» приходит из обхода.
   «Установлено» отдельно отмечать не нужно там, где квартиру уже приняли без
   замечаний: принято — значит всё по проекту стоит. Руками тоже можно. */
function stg(b, num) {
  var r = fr(b.id, num);
  var auto = r.c === 1 && ST.autom !== false;
  return { m: !!r.m || auto, c: r.c || 0, s: !!r.s, autom: auto && !r.m };
}
function sumB(b) {
  var mp = flatMap(b), out = { all: mp.nums.length, m: 0, c: 0, clean: 0, s: 0, plan: {}, fact: {} };
  mp.nums.forEach(function (n) {
    var g = stg(b, n), p = planOf(b, n), f = factOf(b, n);
    if (g.m) out.m++;
    if (g.c) { out.c++; if (g.c === 1) out.clean++; }
    if (g.s) out.s++;
    GROUPS.forEach(function (x) {
      out.plan[x.k] = (out.plan[x.k] || 0) + (p.per[x.k] || 0);
      out.fact[x.k] = (out.fact[x.k] || 0) + (f.per[x.k] || 0);
    });
  });
  return out;
}
/* Полная ведомость материалов по корпусу: спецификация × количество квартир типа.
   «Смонтировано» считаем по квартирам, отмеченным как установленные. */
function materials(b) {
  var mp = flatMap(b), acc = {};
  mp.nums.forEach(function (n) {
    var t = typeOf(b, n);
    if (!t) return;
    var done = stg(b, n).m;
    t.items.forEach(function (it) {
      var key = it.n + '|' + it.u;
      if (!acc[key]) acc[key] = { n: it.n, u: it.u, s: it.s, need: 0, done: 0 };
      acc[key].need += it.q;
      if (done) acc[key].done += it.q;
    });
  });
  /* Порядок — как в проекте, а не по алфавиту: начальник сверяет ведомость
     со спецификацией построчно, и перетасованные строки только мешают. */
  var ord = {}, k = 0;
  b.types.forEach(function (t) {
    t.items.forEach(function (it) {
      var key = it.n + '|' + it.u;
      if (ord[key] == null) ord[key] = k++;
    });
  });
  return Object.keys(acc).map(function (key) {
    acc[key].o = ord[key] == null ? 1e6 : ord[key];
    return acc[key];
  }).sort(function (a, z) { return a.o - z.o; });
}

/* ============ мелочи ============ */
function h(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
function nf(v) { return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
function shortType(n) {
  return String(n).replace(/^к\.\d+,\s*/, '').replace(/сек\.\d+,\s*/, '').replace(/кв\.?тип\s*/i, 'тип ');
}
var toastT;
function toast(m) {
  var t = document.getElementById('toast');
  t.textContent = m; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2600);
}
function go(name, opt) {
  VIEW = Object.assign({ name: name }, opt || {});
  save(); render(); window.scrollTo(0, 0);
}

/* ============ рендер ============ */
function render() {
  var f = { obj: viewObj, flats: viewFlats, flat: viewFlat, mat: viewMat, imp: viewImport, cfg: viewCfg, crews: viewCrews }[VIEW.name];
  app.innerHTML = '<div class="wrap">' + side() + '<div class="main">' + f() + '</div></div>';
  bind();
}
function side() {
  var b = bld(), s = sumB(b);
  function nav(id, ico, label, n) {
    return '<button data-go="' + id + '" class="' + (VIEW.name === id || (id === 'flats' && VIEW.name === 'flat') ? 'on' : '') + '">' +
      ico + '<span>' + label + '</span>' + (n != null ? '<span class="n">' + n + '</span>' : '') + '</button>';
  }
  return '<div class="side">' +
    '<div class="brand">' + I.bolt + '<span>' + h(PROJ.object) + '<small>начальник участка</small></span></div>' +
    '<div class="nav">' +
    nav('obj', I.chart, 'Сводка') +
    nav('flats', I.grid, 'Квартиры', s.all) +
    nav('mat', I.box, 'Материалы') +
    nav('crews', I.user, 'Бригады') +
    nav('cfg', I.list, 'Раскладка') +
    nav('imp', I.down, 'Данные обхода') +
    '</div>' +
    '<div class="side-sec">Корпуса</div>' +
    '<div class="nav">' + PROJ.buildings.map(function (x) {
      var xs = sumB(x);
      return '<button data-bld="' + x.id + '" class="' + (x.id === b.id ? 'on' : '') + '">' +
        '<span>' + h(x.name) + '</span><span class="n">' + xs.s + '/' + xs.all + '</span></button>';
    }).join('') + '</div>' +
    '</div>';
}

/* ---------- сводка ---------- */
function viewObj() {
  var b = bld(), s = sumB(b), mp = flatMap(b);
  var kpi = [
    ['Сдано заказчику', s.s, s.all, 'квартир'],
    ['Установлено', s.m, s.all, 'квартир'],
    ['Проверено обходом', s.c, s.all, s.c ? s.clean + ' без замечаний' : 'обход не загружен']
  ].map(function (x) {
    return '<div class="card kpi"><div class="l">' + x[0] + '</div>' +
      '<div class="v">' + pct(x[1], x[2]) + '<small>%</small></div>' +
      '<div class="d">' + x[1] + ' из ' + x[2] + ' · ' + x[3] + '</div></div>';
  }).join('');

  var rows = GROUPS.map(function (g) {
    var pl = s.plan[g.k] || 0, fa = s.fact[g.k] || 0;
    if (!pl && !fa) return '';
    return '<tr><td>' + h(g.n) + '</td>' +
      '<td class="num">' + nf(pl) + '</td>' +
      '<td class="num ' + (fa >= pl ? 'v-ok' : fa ? '' : 'v-mut') + '">' + nf(fa) + '</td>' +
      '<td class="num ' + (pl - fa > 0 ? 'v-bad' : 'v-mut') + '">' + nf(Math.max(0, pl - fa)) + '</td>' +
      '<td style="width:160px"><div class="bar"><i class="b-s" style="width:' +
      Math.min(100, pct(fa, pl)) + '%"></i></div></td></tr>';
  }).join('');

  var warn = '';
  if (mp.miss.length || Object.keys(mp.dup).length) {
    warn = '<div class="note" style="margin-bottom:16px">' + I.warn + ' <b>Проект прочитан не полностью.</b> ' +
      (mp.miss.length ? 'Без типа: ' + mp.miss.length + ' кв. (' + mp.miss.slice(0, 12).join(', ') +
        (mp.miss.length > 12 ? '…' : '') + '). ' : '') +
      (Object.keys(mp.dup).length ? 'В двух типах сразу: ' + Object.keys(mp.dup).slice(0, 12).join(', ') +
        (Object.keys(mp.dup).length > 12 ? '…' : '') + '. ' : '') +
      'Такие квартиры в план не попали — открой их в разделе «Квартиры» и назначь тип руками.</div>';
  }

  return '<div class="head"><h1>Сводка</h1><span class="sub">' + h(b.name) + ' · ' +
    s.all + ' квартир · ' + b.types.length + ' типов</span></div>' +
    warn +
    '<div class="grid g4">' + kpi + '</div>' +
    '<div class="card pad" style="margin-top:12px">' +
    '<div class="srow"><span>Установлено</span><div class="bar"><i class="b-m" style="width:' +
    pct(s.m, s.all) + '%"></i></div><u>' + s.m + '/' + s.all + '</u></div>' +
    '<div class="srow"><span>Проверено</span><div class="bar"><i class="b-c" style="width:' +
    pct(s.c, s.all) + '%"></i></div><u>' + s.c + '/' + s.all + '</u></div>' +
    '<div class="srow"><span>Сдано</span><div class="bar"><i class="b-s" style="width:' +
    pct(s.s, s.all) + '%"></i></div><u>' + s.s + '/' + s.all + '</u></div>' +
    '</div>' +

    '<div class="sec">Оборудование по проекту</div>' +
    '<div class="tblwrap"><table class="tbl"><thead><tr><th>Позиция</th>' +
    '<th class="num">По проекту</th><th class="num">Установлено</th><th class="num">Осталось</th>' +
    '<th style="width:160px"></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<div class="hint">«По проекту» — спецификация ЭОМ, умноженная на количество квартир каждого типа. ' +
    '«Установлено» — то, что насчитали монтажники в обходе. Пока выгрузка не загружена, ' +
    'этот столбец будет пустым.</div>' +

    '<div class="sec">Типы квартир</div>' +
    '<div class="tblwrap"><table class="tbl"><thead><tr><th>Тип</th><th class="num">Квартир</th>' +
    GROUPS.slice(0, 5).map(function (g) { return '<th class="num">' + h(g.n) + '</th>'; }).join('') +
    '</tr></thead><tbody>' +
    b.types.map(function (t) {
      var per = {};
      t.items.forEach(function (it) { var k = groupOf(it.n); if (k) per[k] = (per[k] || 0) + it.q; });
      return '<tr><td>' + h(shortType(t.n)) + '</td><td class="num">' + t.flats.length + '</td>' +
        GROUPS.slice(0, 5).map(function (g) {
          return '<td class="num' + (per[g.k] ? '' : ' v-mut') + '">' + (per[g.k] || '—') + '</td>';
        }).join('') + '</tr>';
    }).join('') + '</tbody></table></div>';
}

/* ---------- квартиры ---------- */
function viewFlats() {
  var b = bld(), mp = flatMap(b), f = VIEW.filter || 'all';
  var list = mp.nums.filter(function (n) {
    var g = stg(b, n);
    if (f === 'todo') return !g.s;
    if (f === 'done') return g.s;
    if (f === 'iss') return g.c === 2;
    if (f === 'notype') return !typeOf(b, n);
    return true;
  });
  var cells = list.map(function (n) {
    var g = stg(b, n), t = typeOf(b, n), ps = posOf(b, n);
    return '<button class="flat' + (t ? '' : ' miss') + '" data-flat="' + n + '"><b>' + n + '</b>' +
      '<em>' + (ps ? '№' + ps.i + ' · ' : '') + (t ? h(shortType(t.n)) : 'тип ?') + '</em>' +
      '<span class="stg"><i class="m' + (g.m ? ' on' : '') + '"></i>' +
      '<i class="c' + (g.c ? ' on' : '') + '"></i><i class="s' + (g.s ? ' on' : '') + '"></i></span></button>';
  }).join('');

  function tb(id, label, n) {
    return '<button class="tab ' + (f === id ? 'on' : '') + '" data-filter="' + id + '">' +
      label + (n != null ? ' · ' + n : '') + '</button>';
  }
  var s = sumB(b);
  return '<div class="head"><h1>Квартиры</h1><span class="sub">' + h(b.name) + '</span></div>' +
    '<div class="tabs">' + tb('all', 'Все', mp.nums.length) + tb('todo', 'Не сдано', mp.nums.length - s.s) +
    tb('done', 'Сдано', s.s) + tb('iss', 'С замечаниями', s.c - s.clean) +
    tb('notype', 'Без типа', mp.nums.filter(function (n) { return !typeOf(b, n); }).length) + '</div>' +
    (list.length ? '<div class="flats">' + cells + '</div>'
      : '<div class="empty">В этом списке пусто</div>') +
    '<div class="legend">' +
    '<span><i style="background:#60a5fa"></i>Установлено</span>' +
    '<span><i style="background:var(--warn)"></i>Проверено обходом</span>' +
    '<span><i style="background:var(--ok)"></i>Сдано</span>' +
    '<span><i style="background:var(--muted)"></i>Нет</span></div>';
}

/* ---------- карточка квартиры ---------- */
function viewFlat() {
  var b = bld(), num = VIEW.flat, mp = flatMap(b), r = fr(b.id, num, true);
  var t = typeOf(b, num), g = stg(b, num), p = planOf(b, num), fa = factOf(b, num);
  var i = mp.nums.indexOf(num);
  var prev = i > 0 ? mp.nums[i - 1] : null, next = i >= 0 && i < mp.nums.length - 1 ? mp.nums[i + 1] : null;

  var spec = '';
  if (t) {
    var sect = '';
    spec = '<div class="tblwrap"><table class="tbl"><thead><tr><th>Наименование</th>' +
      '<th class="num">Ед.</th><th class="num">По проекту</th></tr></thead><tbody>' +
      t.items.map(function (it) {
        var head = '';
        if (it.s !== sect) { sect = it.s; head = '<tr class="grp"><td colspan="3">' + h(sect) + '</td></tr>'; }
        return head + '<tr><td>' + h(it.n) + '</td><td class="num v-mut">' + h(it.u) + '</td>' +
          '<td class="num">' + nf(it.q) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  } else {
    spec = '<div class="note bad">' + I.warn + ' У квартиры не определён тип — в проекте её номер ' +
      'не встретился ни в одном листе' + (mp.dup[num] ? ' либо встретился сразу в нескольких' : '') +
      '. Выбери тип вручную выше, тогда появится спецификация и она попадёт в план.</div>';
  }

  var cmp = GROUPS.map(function (x) {
    var pl = p.per[x.k] || 0, ft = fa.per[x.k] || 0;
    if (!pl && !ft) return '';
    var man = fa.man[x.k] != null, imp = fa.imp[x.k] || 0;
    return '<tr><td>' + h(x.n) +
      (man && imp ? '<br><span class="badge" title="из обхода приезжало другое число">обход: ' + imp + '</span>' : '') +
      '</td><td class="num">' + pl + '</td>' +
      '<td class="num"><span class="qc">' +
      '<button class="qb" data-q="' + x.k + '|-1">−</button>' +
      '<input class="qi ' + (!ft ? 'v-mut' : ft >= pl ? 'v-ok' : 'v-bad') + '" data-qi="' + x.k + '" value="' + ft + '">' +
      '<button class="qb" data-q="' + x.k + '|1">+</button></span></td></tr>';
  }).join('');

  var obhod = !g.c
    ? '<div class="card pad" style="color:var(--muted-fg);font-size:14px">Квартиру ещё не обходили ' +
    'либо выгрузка не загружена.</div>'
    : '<div class="card pad">' +
    '<div style="font-weight:650;margin-bottom:6px" class="' + (g.c === 1 ? 'v-ok' : 'v-bad') + '">' +
    (g.c === 1 ? 'Обход пройден, замечаний нет' : 'Обход: есть замечания') + '</div>' +
    (r.miss ? '<div style="font-size:14px;color:var(--muted-fg)">Не принято: ' + h(r.miss) + '</div>' : '') +
    (r.left ? '<div style="font-size:14px;color:var(--muted-fg);margin-top:4px">' + h(r.left) + '</div>' : '') +
    (r.crit ? '<div style="margin-top:8px"><span class="badge bad">критично</span></div>' : '') +
    '</div>';

  var ps = posOf(b, num);
  return '<div class="head"><button class="btn" data-go="flats">' + I.left + ' Квартиры</button>' +
    '<h1>Кв. ' + num + '</h1>' +
    '<span class="sub">' + (ps ? 'этаж ' + ps.f + ' · №' + ps.i + ' на этаже · ' : '') +
    (t ? h(shortType(t.n)) : 'тип не определён') + '</span>' +
    '<span class="sp"></span>' +
    '<button class="btn" data-nav="' + (prev || '') + '"' + (prev ? '' : ' disabled') + '>' + I.left + ' ' + (prev || '—') + '</button>' +
    '<button class="btn" data-nav="' + (next || '') + '"' + (next ? '' : ' disabled') + '>' + (next || '—') + ' ' + I.right + '</button>' +
    '</div>' +

    '<div class="grid g2">' +
    '<div><div class="sec">Стадии</div><div class="card">' +
    '<div class="row"><b>Установлено (чистовая)' +
    (g.autom ? '<br><span class="badge ok">принято обходом</span>' : '') +
    '</b><div class="sw' + (g.m ? ' on' : '') + '" data-sg="m"></div></div>' +
    '<div class="row"><b style="color:var(--muted-fg)">Проверено обходом</b>' +
    '<div class="sw ro' + (g.c ? ' on' + (g.c === 2 ? ' warn' : '') : '') + '"></div></div>' +
    '<div class="row"><b>Сдано заказчику</b><div class="sw' + (g.s ? ' on' : '') + '" data-sg="s"></div></div>' +
    '<div class="row"><b>Тип квартиры</b><select data-ty><option value="">по проекту' +
    (flatMap(b).m[num] ? ' (' + h(shortType((b.types.filter(function (x) { return x.id === flatMap(b).m[num]; })[0] || {}).n || '')) + ')' : ': не найден') +
    '</option>' + b.types.map(function (x) {
      return '<option value="' + x.id + '"' + (r.ty === x.id ? ' selected' : '') + '>' + h(shortType(x.n)) + '</option>';
    }).join('') + '</select></div>' +
    '</div>' +
    '<div class="hint">«Проверено» вручную не переключается: оно приходит из выгрузки обхода, ' +
    'чтобы твоя картина и картина монтажников не разъезжались.</div></div>' +

    '<div><div class="sec">Факт против проекта</div>' +
    (cmp ? '<div class="tblwrap" style="max-height:none"><table class="tbl"><thead><tr><th>Позиция</th>' +
      '<th class="num">Проект</th><th class="num" style="width:132px">Факт</th></tr></thead><tbody>' + cmp + '</tbody></table></div>' +
      '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
      '<button class="btn btn-ok" data-act="allplan">' + I.check + ' Всё по проекту</button>' +
      '<button class="btn" data-act="clearq">Обнулить</button></div>' +
      (fa.byPlan
        ? '<div class="note" style="margin-top:10px">Квартира принята обходом без замечаний, ' +
        'поэтому факт показан по проекту. Поправь любую цифру — и дальше по этой квартире ' +
        'будут только твои числа.</div>'
        : '') +
      '<div class="hint">Цифры правятся руками — кнопками или прямо в поле. Если по квартире ' +
      'приезжали данные обхода, а ты поставил своё число, под названием останется, что показывал обход.</div>'
      : '<div class="card pad" style="color:var(--muted-fg);font-size:14px">Нечего сравнивать: тип не определён.</div>') +
    '<div class="sec">Что показал обход</div>' + obhod + '</div>' +
    '</div>' +

    '<div class="sec">Спецификация по проекту</div>' + spec;
}

/* ---------- материалы ---------- */
function viewMat() {
  var b = bld(), list = materials(b), q = (VIEW.q || '').toLowerCase();
  var shown = q ? list.filter(function (x) { return x.n.toLowerCase().indexOf(q) >= 0; }) : list;
  var sect = '';
  var rows = shown.map(function (x) {
    var head = '';
    if (x.s !== sect && !q) { sect = x.s; head = '<tr class="grp"><td colspan="5">' + h(sect) + '</td></tr>'; }
    var left = x.need - x.done;
    return head + '<tr><td>' + h(x.n) + '</td><td class="num v-mut">' + h(x.u) + '</td>' +
      '<td class="num">' + nf(x.need) + '</td>' +
      '<td class="num ' + (x.done ? 'v-ok' : 'v-mut') + '">' + (x.done ? nf(x.done) : '—') + '</td>' +
      '<td class="num ' + (left > 0 ? '' : 'v-mut') + '">' + nf(left) + '</td></tr>';
  }).join('');

  return '<div class="head"><h1>Материалы</h1><span class="sub">' + h(b.name) + ' · ' + list.length + ' позиций</span>' +
    '<span class="sp"></span>' +
    '<input id="q" placeholder="Поиск по названию" style="width:240px" value="' + h(VIEW.q || '') + '">' +
    '<button class="btn" data-act="csv">' + I.file + ' Выгрузить в CSV</button></div>' +
    '<div class="tblwrap"><table class="tbl"><thead><tr><th>Наименование</th><th class="num">Ед.</th>' +
    '<th class="num">Нужно на корпус</th><th class="num">Смонтировано</th><th class="num">Осталось</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<div class="hint">«Нужно на корпус» — спецификация проекта, умноженная на количество квартир ' +
    'каждого типа. «Смонтировано» считается по квартирам, отмеченным как <b>установленные</b>: ' +
    'отмечаешь квартиру — материал по ней уходит в этот столбец.</div>';
}

/* ---------- бригады: кто сколько сделал ---------- */
function crewName(id) {
  if (id === '?') return 'без бригады';
  var w = (ST.crews || []).filter(function (x) { return x.id === id; })[0];
  return w ? w.n : 'бригада ' + id;
}
/* Сводка по бригадам: по одному корпусу или по всему объекту */
function crewSum(bid) {
  var out = {}, list = bid ? [bld(bid)] : PROJ.buildings;
  list.forEach(function (b) {
    var d = ST.flats[b.id] || {};
    Object.keys(d).forEach(function (num) {
      var w = d[num].w;
      if (!w) return;
      Object.keys(w).forEach(function (wid) {
        out[wid] = out[wid] || { per: {}, total: 0, flats: 0 };
        var got = 0;
        Object.keys(w[wid]).forEach(function (k) {
          out[wid].per[k] = (out[wid].per[k] || 0) + w[wid][k];
          got += w[wid][k];
        });
        if (got) { out[wid].total += got; out[wid].flats++; }
      });
    });
  });
  return out;
}
function viewCrews() {
  var scope = VIEW.scope || 'all';
  var sums = crewSum(scope === 'all' ? null : scope);
  var ids = Object.keys(sums).sort(function (a, z) { return sums[z].total - sums[a].total; });
  var grand = 0;
  ids.forEach(function (i) { grand += sums[i].total; });

  if (!ids.length) {
    return '<div class="head"><h1>Бригады</h1></div>' +
      '<div class="empty">' + I.warn + '<div>Данных о бригадах нет.</div>' +
      '<div style="font-size:14px;margin-top:8px">Они приезжают вместе с выгрузкой обхода — ' +
      'раздел «Данные обхода». Считается то, что монтажники отметили на вкладке «Подсчёт».</div></div>';
  }

  var cols = GROUPS.filter(function (g) {
    return ids.some(function (i) { return sums[i].per[g.k]; });
  });

  var cards = ids.map(function (i) {
    var s = sums[i];
    return '<div class="card kpi"><div class="l">' + h(crewName(i)) + '</div>' +
      '<div class="v">' + nf(s.total) + '<small> шт.</small></div>' +
      '<div class="d">квартир: ' + s.flats + ' · ' + pct(s.total, grand) + '% объёма</div>' +
      '<div class="bar"><i class="b-s" style="width:' + pct(s.total, grand) + '%"></i></div></div>';
  }).join('');

  var rows = ids.map(function (i) {
    return '<tr><td>' + h(crewName(i)) + '</td>' +
      cols.map(function (g) {
        return '<td class="num' + (sums[i].per[g.k] ? '' : ' v-mut') + '">' +
          (sums[i].per[g.k] ? nf(sums[i].per[g.k]) : '—') + '</td>';
      }).join('') +
      '<td class="num"><b>' + nf(sums[i].total) + '</b></td></tr>';
  }).join('');
  var totals = '<tr class="grp"><td>Всего</td>' +
    cols.map(function (g) {
      var s = 0;
      ids.forEach(function (i) { s += sums[i].per[g.k] || 0; });
      return '<td class="num">' + nf(s) + '</td>';
    }).join('') + '<td class="num">' + nf(grand) + '</td></tr>';

  return '<div class="head"><h1>Бригады</h1>' +
    '<span class="sub">' + (scope === 'all' ? 'весь объект' : h(bld(scope).name)) + '</span>' +
    '<span class="sp"></span>' +
    '<button class="btn" data-act="crewcsv">' + I.file + ' В CSV</button></div>' +

    '<div class="tabs"><button class="tab ' + (scope === 'all' ? 'on' : '') + '" data-scope="all">Весь объект</button>' +
    PROJ.buildings.map(function (b) {
      return '<button class="tab ' + (scope === b.id ? 'on' : '') + '" data-scope="' + b.id + '">' + h(b.name) + '</button>';
    }).join('') + '</div>' +

    '<div class="grid g4">' + cards + '</div>' +

    '<div class="sec">По позициям</div>' +
    '<div class="tblwrap"><table class="tbl"><thead><tr><th>Бригада</th>' +
    cols.map(function (g) { return '<th class="num">' + h(g.n) + '</th>'; }).join('') +
    '<th class="num">Всего</th></tr></thead><tbody>' + rows + totals + '</tbody></table></div>' +
    '<div class="hint">Считается по журналу нажатий из обхода: каждая отметка записана на ту ' +
    'бригаду, что была выбрана в момент подсчёта. <b>«Без бригады»</b> — записи из старых версий ' +
    'приложения, где бригад ещё не было. Твои ручные правки количеств сюда не попадают: ' +
    'у них нет автора.</div>';
}

/* ---------- раскладка корпуса ---------- */
function viewCfg() {
  var b = bld(), c = cfgOf(b), mp = flatMap(b);
  var d = c || { from: 1, to: 17, per: 12, first: 1, stack: [] };

  var fields = [['from', 'Этажи с'], ['to', 'Этажи по'], ['per', 'Квартир на этаже'], ['first', 'Первая квартира']]
    .map(function (x) {
      return '<div class="row"><b>' + x[1] + '</b>' +
        '<input type="number" min="1" style="width:90px" data-cf="' + x[0] + '" value="' + d[x[0]] + '"></div>';
    }).join('');

  var stack = '';
  for (var i = 0; i < d.per; i++) {
    var cur = d.stack[i] || '';
    stack += '<div class="row"><b>№' + (i + 1) + ' на этаже</b>' +
      '<select data-st="' + i + '"><option value="">не задан</option>' +
      b.types.map(function (t) {
        return '<option value="' + t.id + '"' + (cur === t.id ? ' selected' : '') + '>' + h(t.n) + '</option>';
      }).join('') + '</select></div>';
  }

  /* Этажи-исключения: наверху дома этаж часто короче и с другими типами */
  var exs = (d.ex || []).map(function (x, xi) {
    var st = '';
    for (var j = 0; j < x.per; j++) {
      st += '<div class="row"><b>№' + (j + 1) + ' на этаже</b>' +
        '<select data-ex="' + xi + '|' + j + '"><option value="">не задан</option>' +
        b.types.map(function (t) {
          return '<option value="' + t.id + '"' + ((x.stack || [])[j] === t.id ? ' selected' : '') + '>' + h(t.n) + '</option>';
        }).join('') + '</select></div>';
    }
    return '<div class="card" style="margin-bottom:12px">' +
      '<div class="row"><b>Этажи с</b><input type="number" min="1" style="width:80px" data-exf="' + xi + '|from" value="' + x.from + '">' +
      '<b style="flex:0 0 auto">по</b><input type="number" min="1" style="width:80px" data-exf="' + xi + '|to" value="' + x.to + '">' +
      '<b style="flex:0 0 auto">квартир</b><input type="number" min="1" style="width:74px" data-exf="' + xi + '|per" value="' + x.per + '">' +
      '<button class="btn" style="min-height:32px;padding:0 10px;color:var(--bad)" data-delex="' + xi + '">Убрать</button></div>' +
      st + '</div>';
  }).join('');

  var sample = c ? (function () {
    var out = [];
    for (var k = 0; k < Math.min(d.per, 14); k++) {
      var n = d.first + k, t = typeOf(b, n);
      out.push('<tr><td>№' + (k + 1) + '</td><td>кв. ' + n + '</td><td>' +
        (t ? h(t.n) : '<span class="v-bad">не задан</span>') + '</td>' +
        '<td class="v-mut">кв. ' + (n + d.per) + ', ' + (n + d.per * 2) + ', …</td></tr>');
    }
    return '<div class="tblwrap" style="max-height:none"><table class="tbl"><thead><tr>' +
      '<th>Место</th><th>1-й этаж</th><th>Тип</th><th>Дальше по стояку</th>' +
      '</tr></thead><tbody>' + out.join('') + '</tbody></table></div>';
  })() : '';

  return '<div class="head"><h1>Раскладка корпуса</h1><span class="sub">' + h(b.name) + '</span>' +
    '<span class="sp"></span>' +
    (c ? '<span class="badge ok">задана · ' + mp.nums.length + ' квартир</span>'
      : '<span class="badge">не задана, типы берутся из шапок Excel</span>') + '</div>' +

    '<div class="grid g2">' +
    '<div><div class="sec">Дом</div><div class="card">' + fields + '</div>' +
    '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
    (c ? '<button class="btn" data-act="cfgoff">Убрать раскладку</button>' : '') +
    '</div>' +
    '<div class="hint">Этажи типовые: какая квартира стоит на месте №1, такая же на всех этажах ' +
    'выше. Номера считаются сквозняком от первой квартиры — при 12 квартирах на этаже ' +
    'третий этаж даёт 25–36.</div></div>' +

    '<div><div class="sec">Кто на каком месте (как на плане этажа)</div>' +
    '<div class="card">' + stack + '</div></div>' +
    '</div>' +

    '<div class="sec">Этажи с другим количеством квартир</div>' +
    (exs || '<div class="card pad" style="color:var(--muted-fg);font-size:14px">Пока таких нет — все этажи одинаковые.</div>') +
    '<button class="btn" data-act="addex" style="margin-top:10px">+ Добавить такие этажи</button>' +
    '<div class="hint">Наверху дома этаж обычно короче и с другими квартирами. Такие этажи ' +
    'описываются здесь отдельно: сколько на них квартир и кто на каком месте. Сквозная нумерация ' +
    'пересчитается сама.</div>' +

    (sample ? '<div class="sec">Как это разложится</div>' + sample : '');
}

/* ---------- импорт выгрузки обхода ---------- */
function viewImport() {
  var imp = ST.imp;
  var pend = VIEW.pending;
  var body;

  if (pend) {
    body = '<div class="card pad"><div style="font-weight:650;margin-bottom:10px">' +
      'В файле ' + pend.bs.length + ' корпус(ов). Укажи, какому корпусу проекта что соответствует:</div>' +
      pend.bs.map(function (x, i) {
        return '<div class="row"><b>' + h(x.name) + ' <span class="badge">' + x.n + ' кв.</span></b>' +
          '<select data-map="' + i + '"><option value="">пропустить</option>' +
          PROJ.buildings.map(function (pb) {
            return '<option value="' + pb.id + '"' + (x.guess === pb.id ? ' selected' : '') + '>' + h(pb.name) + '</option>';
          }).join('') + '</select></div>';
      }).join('') +
      '<div style="display:flex;gap:10px;margin-top:14px">' +
      '<button class="btn btn-primary" data-act="doimport">' + I.check + ' Загрузить</button>' +
      '<button class="btn" data-act="cancelimport">Отмена</button></div></div>';
  } else {
    body = '<div class="card pad">' +
      (imp
        ? '<div style="font-weight:650">Загружено: ' + h(imp.name) + '</div>' +
        '<div style="color:var(--muted-fg);font-size:14px;margin-top:4px">' + h(imp.when) +
        ' · квартир с данными: ' + imp.n + '</div>'
        : '<div style="color:var(--muted-fg)">Данные обхода ещё не загружались.</div>') +
      '<div style="display:flex;gap:10px;margin-top:14px">' +
      '<button class="btn btn-primary" data-act="pick">' + I.down + ' Выбрать файл выгрузки</button>' +
      (imp ? '<button class="btn" data-act="clearimp">Убрать данные обхода</button>' : '') +
      '</div></div>';
  }

  return '<div class="head"><h1>Данные обхода</h1></div>' + body +
    '<div class="sec">Как получить файл</div>' +
    '<div class="card pad" style="font-size:14px;line-height:1.6;color:var(--muted-fg)">' +
    '1. В приложении обхода «Электро-приёмка» открой <b style="color:var(--fg)">Выгрузка → ' +
    'Выгрузка для начальника</b>.<br>' +
    '2. Файл придёт с именем вроде <b style="color:var(--fg)">Начальнику_2026-08-27.json</b> — ' +
    'он маленький, без фотографий, уходит в мессенджер мгновенно.<br>' +
    '3. Открой его кнопкой выше.<br><br>' +
    'Подтянутся: что принято по каждой квартире (станет «Проверено»), замечания, количества и ' +
    '<b style="color:var(--fg)">разбивка по бригадам</b> для раздела «Бригады». Твои отметки ' +
    '«Установлено» и «Сдано» и твои ручные количества импорт не трогает.<br><br>' +
    'Полная резервная копия обхода тоже подойдёт — но она тяжёлая из-за фотографий.</div>' +
    '<div class="sec">Что считать сделанным</div>' +
    '<div class="card">' +
    '<div class="row"><b>Принятые квартиры считать установленными</b>' +
    '<div class="sw' + (ST.autom !== false ? ' on' : '') + '" data-opt="autom"></div></div>' +
    '<div class="row"><b>По принятым брать количества из проекта</b>' +
    '<div class="sw' + (ST.autoq !== false ? ' on' : '') + '" data-opt="autoq"></div></div>' +
    '</div>' +
    '<div class="hint">Квартира принята обходом без замечаний — значит по ней всё смонтировано ' +
    'по проекту. Пока эти правила включены, отдельно отмечать такие квартиры и вбивать по ним ' +
    'количества не нужно. Любая ручная правка всё равно главнее.</div>' +

    '<div class="sec">Объект</div>' +
    '<div class="card pad" style="font-size:14px;color:var(--muted-fg)">' +
    'Сейчас загружен: <b style="color:var(--fg)">' + h(PROJ.object) + '</b> · корпусов ' + PROJ.buildings.length +
    '<div style="margin-top:12px"><button class="btn" data-act="loadobj">' + I.down + ' Загрузить другой объект</button></div>' +
    '<div style="font-size:13px;margin-top:10px">Загрузка другого объекта заменяет проект и все отметки. ' +
    'Сохрани копию, если текущие данные нужны.</div></div>' +

    '<div class="sec">Данные этого приложения</div>' +
    '<div style="display:flex;gap:10px"><button class="btn" data-act="backup">' + I.file + ' Сохранить копию</button>' +
    '<button class="btn" data-act="restore">Загрузить копию</button>' +
    '<button class="btn" style="color:var(--bad)" data-act="wipe">Стереть отметки</button></div>' +
    '<div class="hint">Отметки живут в этом браузере на этом компьютере. Перед переустановкой ' +
    'системы или переездом на другую машину сохрани копию.</div>';
}

/* ============ события ============ */
function bind() {
  app.querySelectorAll('[data-go]').forEach(function (el) {
    el.onclick = function () { go(el.dataset.go); };
  });
  app.querySelectorAll('[data-bld]').forEach(function (el) {
    el.onclick = function () { ST.bid = el.dataset.bld; go(VIEW.name === 'flat' ? 'flats' : VIEW.name); };
  });
  app.querySelectorAll('[data-opt]').forEach(function (el) {
    el.onclick = function () {
      var k = el.dataset.opt;
      ST[k] = ST[k] === false;
      save(); render();
    };
  });
  app.querySelectorAll('[data-scope]').forEach(function (el) {
    el.onclick = function () { VIEW.scope = el.dataset.scope; render(); };
  });
  app.querySelectorAll('[data-filter]').forEach(function (el) {
    el.onclick = function () { VIEW.filter = el.dataset.filter; render(); };
  });
  app.querySelectorAll('[data-flat]').forEach(function (el) {
    el.onclick = function () { go('flat', { flat: +el.dataset.flat }); };
  });
  app.querySelectorAll('[data-nav]').forEach(function (el) {
    el.onclick = function () { if (el.dataset.nav) go('flat', { flat: +el.dataset.nav }); };
  });
  app.querySelectorAll('[data-sg]').forEach(function (el) {
    el.onclick = function () {
      var r = fr(ST.bid, VIEW.flat, true), k = el.dataset.sg;
      if (r[k]) delete r[k]; else r[k] = Date.now();
      save(); render();
    };
  });
  app.querySelectorAll('[data-ty]').forEach(function (el) {
    el.onchange = function () {
      var r = fr(ST.bid, VIEW.flat, true);
      if (el.value) r.ty = el.value; else delete r.ty;
      save(); render();
    };
  });
  app.querySelectorAll('[data-q]').forEach(function (el) {
    el.onclick = function () {
      var p = el.dataset.q.split('|'), b = bld();
      setQ(b, VIEW.flat, p[0], (factOf(b, VIEW.flat).per[p[0]] || 0) + (+p[1]));
      render();
    };
  });
  app.querySelectorAll('[data-qi]').forEach(function (el) {
    el.onchange = function () {
      setQ(bld(), VIEW.flat, el.dataset.qi, Math.max(0, parseInt(el.value, 10) || 0));
      render();
    };
  });
  app.querySelectorAll('[data-cf]').forEach(function (el) {
    el.onchange = function () {
      var b = bld(), c = cfgOf(b) || { from: 1, to: 17, per: 12, first: 1, stack: [] };
      c[el.dataset.cf] = Math.max(1, parseInt(el.value, 10) || 1);
      if (c.to < c.from) c.to = c.from;
      ST.cfg[b.id] = c; ST.cfgman = true; MAPS = {}; save(); render();
    };
  });
  app.querySelectorAll('[data-st]').forEach(function (el) {
    el.onchange = function () {
      var b = bld(), c = cfgOf(b) || { from: 1, to: 17, per: 12, first: 1, stack: [] };
      c.stack = c.stack || [];
      c.stack[+el.dataset.st] = el.value;
      ST.cfg[b.id] = c; ST.cfgman = true; MAPS = {}; save(); render();
    };
  });
  app.querySelectorAll('[data-exf]').forEach(function (el) {
    el.onchange = function () {
      var p = el.dataset.exf.split('|'), c = cfgOf(bld());
      c.ex[+p[0]][p[1]] = Math.max(1, parseInt(el.value, 10) || 1);
      ST.cfgman = true; MAPS = {}; save(); render();
    };
  });
  app.querySelectorAll('[data-ex]').forEach(function (el) {
    el.onchange = function () {
      var p = el.dataset.ex.split('|'), x = cfgOf(bld()).ex[+p[0]];
      x.stack = x.stack || [];
      x.stack[+p[1]] = el.value;
      ST.cfgman = true; MAPS = {}; save(); render();
    };
  });
  app.querySelectorAll('[data-delex]').forEach(function (el) {
    el.onclick = function () {
      cfgOf(bld()).ex.splice(+el.dataset.delex, 1);
      ST.cfgman = true; MAPS = {}; save(); render();
    };
  });
  app.querySelectorAll('[data-map]').forEach(function (el) {
    el.onchange = function () { VIEW.pending.bs[+el.dataset.map].to = el.value; };
  });
  var q = document.getElementById('q');
  if (q) {
    q.oninput = function () { VIEW.q = q.value; render(); var e = document.getElementById('q'); e.focus(); e.selectionStart = e.value.length; };
  }
  app.querySelectorAll('[data-act]').forEach(function (el) {
    el.onclick = function () { act(el.dataset.act); };
  });
}

function act(a) {
  switch (a) {
    case 'pick': loadAny(); break;
    case 'cancelimport': go('imp'); break;
    case 'doimport': doImport(); break;
    case 'clearimp':
      if (!confirm('Убрать все данные обхода? Твои отметки «Установлено» и «Сдано» останутся.')) return;
      Object.keys(ST.flats).forEach(function (b) {
        Object.keys(ST.flats[b]).forEach(function (n) {
          var r = ST.flats[b][n];
          delete r.c; delete r.q; delete r.w; delete r.left; delete r.miss; delete r.crit; delete r.fix;
        });
      });
      ST.imp = null; save(); render(); toast('Данные обхода убраны');
      break;
    case 'allplan':
      var b = bld(), p = planOf(b, VIEW.flat), r = fr(b.id, VIEW.flat, true);
      if (!p.total) { toast('У квартиры не определён тип'); return; }
      r.qm = {};
      GROUPS.forEach(function (g) { if (p.per[g.k]) r.qm[g.k] = p.per[g.k]; });
      save(); render(); toast('Проставлено по проекту');
      break;
    case 'clearq':
      var rb = fr(bld().id, VIEW.flat, true);
      rb.qm = {};
      GROUPS.forEach(function (g) { rb.qm[g.k] = 0; });
      save(); render();
      break;
    case 'addex':
      var cb = cfgOf(bld());
      if (!cb) { toast('Сначала задай этажность корпуса'); return; }
      cb.ex = cb.ex || [];
      cb.ex.push({ from: cb.to, to: cb.to, per: cb.per, stack: [] });
      ST.cfgman = true; MAPS = {}; save(); render();
      break;
    case 'cfgoff':
      if (!confirm('Убрать раскладку? Типы снова будут браться из шапок Excel.')) return;
      delete ST.cfg[bld().id]; ST.cfgman = true; MAPS = {}; save(); render();
      break;
    case 'loadobj': loadObject(); break;
    case 'csv': exportCsv(); break;
    case 'crewcsv': exportCrewCsv(); break;
    case 'backup':
      dl(new Blob([JSON.stringify(ST)], { type: 'application/json' }),
        'Участок_копия_' + stamp() + '.json');
      toast('Копия сохранена');
      break;
    case 'restore':
      pickFile(function (o, name) {
        if (!o || !o.flats || !o.proj) { alert('Файл не похож на копию этого приложения'); return; }
        if (!confirm('Заменить текущие отметки данными из копии?')) return;
        ST = o; MAPS = {}; save(); startWith(ST.proj); toast('Копия загружена');
      });
      break;
    case 'wipe':
      if (!confirm('Стереть все отметки? Проект и раскладка останутся.')) return;
      var keep = { proj: ST.proj, cfg: ST.cfg, crews: ST.crews, bid: ST.bid };
      ST = newState();
      ST.proj = keep.proj; ST.cfg = keep.cfg; ST.crews = keep.crews; ST.bid = keep.bid;
      save(); go('obj'); toast('Отметки стёрты');
      break;
  }
}

function stamp() {
  var d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function dl(blob, name) {
  var u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = name; a.click();
  setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
}
function pickFile(cb) {
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = function () {
    var f = inp.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try { cb(JSON.parse(rd.result), f.name); }
      catch (e) { alert('Файл не читается: ' + e.message); }
    };
    rd.readAsText(f);
  };
  inp.click();
}

/* Понимаем два файла: лёгкую «выгрузку для начальника» и полную резервную копию.
   Приводим их к одному виду, чтобы дальше был один путь загрузки. */
function normalizeImport(o) {
  if (o && o.t === 'uch-export') {
    var data = {};
    Object.keys(o.flats || {}).forEach(function (bid) {
      data[bid] = {};
      Object.keys(o.flats[bid]).forEach(function (n) { data[bid][n] = o.flats[bid][n]; });
    });
    return {
      light: true, obj: o.obj, at: o.at,
      cfg: { buildings: o.buildings || [], positions: o.positions || [], count: o.count || [] },
      crews: o.crews || [], data: data
    };
  }
  if (o && o.cfg && o.data) {
    return { light: false, cfg: o.cfg, crews: o.cfg.crews || [], data: o.data };
  }
  return null;
}

function readImport(raw, name) {
  var o = normalizeImport(raw);
  if (!o) { alert('Это не выгрузка из приложения обхода'); return; }
  var bs = (o.cfg.buildings || []).map(function (b) {
    var d = o.data[b.id] || {};
    var guess = '';
    PROJ.buildings.forEach(function (pb) {
      var m = String(b.name).match(/\d+/), pm = String(pb.name).match(/\d+/);
      if (m && pm && m[0] === pm[0]) guess = pb.id;
    });
    return { id: b.id, name: b.name, n: Object.keys(d).length, guess: guess, to: guess };
  });
  if (!bs.length) { alert('В файле нет корпусов'); return; }
  go('imp', { pending: { raw: o, bs: bs, name: name, light: o.light } });
}

function doImport() {
  var p = VIEW.pending, o = p.raw, cfg = o.cfg, n = 0;
  /* позиции подсчёта из обхода → наши группы; без этого факт не с чем сложить */
  var cmap = {};
  (cfg.count || []).forEach(function (c) { cmap[c.id] = groupOfCount(c.n); });
  var pos = cfg.positions || [];

  ST.crews = (o.crews || []).map(function (w) { return { id: w.id, n: w.n }; });

  p.bs.forEach(function (x) {
    if (!x.to) return;
    var d = o.data[x.id] || {};
    Object.keys(d).forEach(function (num) {
      var src = d[num];
      if (!src) return;
      var r = fr(x.to, num, true);

      /* Готовность: в лёгкой выгрузке она уже посчитана, в резервной копии
         её надо собрать из отметок по позициям. */
      if (o.light) {
        if (src.c) { r.c = src.c; n++; } else { delete r.c; }
        if (src.miss) r.miss = src.miss; else delete r.miss;
      } else {
        var filled = 0, bad = 0, missing = [];
        pos.forEach(function (pp) {
          var v = src.st && src.st[pp.id];
          if (v != null) filled++;
          if (v === 0) { bad++; missing.push(pp.n); }
        });
        if (filled) { r.c = bad ? 2 : 1; n++; } else { delete r.c; }
        if (missing.length) r.miss = missing.join(', '); else delete r.miss;
      }
      if (src.left) r.left = src.left; else delete r.left;
      if (src.crit) r.crit = true; else delete r.crit;
      if (src.fix) r.fix = src.fix; else delete r.fix;

      /* количества: складываем по группам */
      var q = {};
      Object.keys(src.q || {}).forEach(function (cid) {
        var k = cmap[cid];
        if (k) q[k] = (q[k] || 0) + src.q[cid];
      });
      if (Object.keys(q).length) r.q = q; else delete r.q;

      /* то же самое в разрезе бригад — ради этого начальник и смотрит подсчёт */
      var w = {};
      Object.keys(src.w || {}).forEach(function (wid) {
        var per = {};
        Object.keys(src.w[wid] || {}).forEach(function (cid) {
          var k = cmap[cid];
          if (k) per[k] = (per[k] || 0) + src.w[wid][cid];
        });
        if (Object.keys(per).length) w[wid] = per;
      });
      if (Object.keys(w).length) r.w = w; else delete r.w;
    });
  });

  ST.imp = {
    name: p.name || 'выгрузка обхода', when: new Date().toLocaleString('ru-RU'),
    n: n, light: !!p.light
  };
  save(); go('imp');
  toast('Загружено: квартир с приёмкой ' + n);
}

function exportCrewCsv() {
  var scope = VIEW.scope || 'all';
  var sums = crewSum(scope === 'all' ? null : scope);
  var ids = Object.keys(sums).sort(function (a, z) { return sums[z].total - sums[a].total; });
  if (!ids.length) { toast('Нечего выгружать'); return; }
  var rows = [['Бригада'].concat(GROUPS.map(function (g) { return g.n; })).concat(['Всего', 'Квартир'])];
  ids.forEach(function (i) {
    rows.push([crewName(i)].concat(GROUPS.map(function (g) { return sums[i].per[g.k] || 0; }))
      .concat([sums[i].total, sums[i].flats]));
  });
  dl(new Blob(['﻿' + rows.map(function (r) {
    return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(';');
  }).join('\r\n')], { type: 'text/csv;charset=utf-8' }),
    'Бригады_' + (scope === 'all' ? 'объект' : bld(scope).name.replace(/\s+/g, '')) + '_' + stamp() + '.csv');
  toast('Файл сохранён');
}

function exportCsv() {
  var b = bld(), list = materials(b);
  var rows = [['Наименование', 'Ед.изм.', 'Нужно на корпус', 'Смонтировано', 'Осталось']];
  list.forEach(function (x) { rows.push([x.n, x.u, x.need, x.done, x.need - x.done]); });
  var csv = '﻿' + rows.map(function (r) {
    return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(';');
  }).join('\r\n');
  dl(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'Материалы_' + b.name.replace(/\s+/g, '') + '_' + stamp() + '.csv');
  toast('Файл сохранён');
}

/* ============ старт ============ */
window.addEventListener('DOMContentLoaded', function () {
  app = document.getElementById('app');
  loadState();
  /* Приложение общее, объект в него загружается файлом. Пока объекта нет —
     показываем экран загрузки, а не пустые нули. */
  if (!ST.proj) { renderEmpty(); return; }
  startWith(ST.proj);
});

function startWith(p) {
  try {
    PROJ = p;
    ST.cfg = ST.cfg || {};
    MAPS = {};
    if (!ST.bid || !PROJ.buildings.some(function (b) { return b.id === ST.bid; })) ST.bid = PROJ.buildings[0].id;
    render();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () { });
  } catch (e) {
    app.innerHTML = '<div class="empty">Объект не читается: ' + h(e.message) + '</div>';
  }
}

/* Первый запуск: объекта ещё нет */
function renderEmpty() {
  app.innerHTML = '<div class="wrap"><div class="main" style="max-width:720px;margin:0 auto;padding-top:56px">' +
    '<div class="head" style="justify-content:center"><h1>' + I.bolt + ' Участок</h1></div>' +
    '<div class="card pad" style="text-align:center">' +
    '<div style="font-size:16px;font-weight:650;margin-bottom:6px">Загрузи файл объекта</div>' +
    '<div style="color:var(--muted-fg);font-size:14px;line-height:1.6;margin-bottom:16px">' +
    'В нём проект: типы квартир, спецификации, этажность и раскладка по стоякам. ' +
    'Файл готовит тот, кто вёл проект, — тебе достаточно его открыть.</div>' +
    '<button class="btn btn-primary" data-act="loadobj">' + I.down + ' Выбрать файл объекта</button>' +
    '</div>' +
    '<div class="hint" style="text-align:center">Всё хранится в этом браузере на этом компьютере. ' +
    'Ничего никуда не отправляется.</div>' +
    '</div></div>';
  app.querySelectorAll('[data-act]').forEach(function (el) {
    el.onclick = function () { loadObject(); };
  });
}

/* Кнопок загрузки в приложении несколько, а файлов три вида, и перепутать их
   легко. Поэтому смотрим не на то, куда нажали, а на то, что внутри файла. */
function loadAny() {
  pickFile(function (o, name) {
    if (o && o.t === 'uch-object' && o.buildings) { applyObject(o, name); return; }
    if (o && (o.t === 'uch-export' || (o.cfg && o.data))) { readImport(o, name); return; }
    if (o && o.flats && o.proj) {
      if (!confirm('Это копия данных приложения. Заменить текущие отметки?')) return;
      ST = o; MAPS = {}; save(); startWith(ST.proj); toast('Копия загружена');
      return;
    }
    alert('Файл не подошёл.\n\nПодходят три вида:\n' +
      '• файл объекта — «..._объект.json»\n' +
      '• выгрузка обхода — «Начальнику_....json»\n' +
      '• копия данных этого приложения');
  });
}

/* Пакет объекта: проект + раскладка + уже собранные данные обхода */
function loadObject() { loadAny(); }

function applyObject(o, name) {
  {
    ST = newState();
    ST.proj = { object: o.object, buildings: o.buildings };
    ST.cfg = JSON.parse(JSON.stringify(o.preset || {}));
    ST.crews = o.crews || [];
    if (o.walk) {
      ST.flats = o.walk;
      ST.imp = {
        name: o.walkName || 'из файла объекта',
        when: o.walkWhen || new Date().toLocaleString('ru-RU'),
        n: Object.keys(o.walk).reduce(function (s, b) { return s + Object.keys(o.walk[b]).length; }, 0),
        light: true
      };
    }
    MAPS = {};
    save();
    startWith(ST.proj);
    toast('Объект загружен: ' + o.object +
      (o.walk ? ' · с данными обхода' : ''));
  }
}

// Token Radar dashboard: renders window.RADAR (written by main.ts) with no
// network. Views: board, live tokens, excluded, model. The board is sortable
// and filterable; clicking a row opens its detail view with the implied-value
// breakdown, the bootstrap rank range, and the seven-step farm plan netted to
// the dollar. The deposit and drop-share filters recompute every row's slice,
// net, break-even and verdict live from the stored implied value and costs.
(function () {
  var D = window.RADAR;
  var rows = D.rows;
  var watchlist = new Set(D.watchlist || []);
  var state = { view: 'board', q: '', cat: '', chain: '', verdict: '', deposit: 1000, drop: 0.1, watchOnly: false, sort: 'rank', sel: null };

  function fmtUsd(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n;
  }
  function money2(n) { return '$' + n.toFixed(2); }
  function signed(n) { return (n >= 0 ? '+' : '\u2212') + '$' + Math.abs(n).toFixed(2); }
  function fmtPct(v) {
    if (v === null || v === undefined) return '—';
    return (v > 0 ? '+' : '') + v.toFixed(1) + '%';
  }
  function fmtAge(d) {
    if (d === null || d === undefined) return '—';
    if (d >= 365) return (d / 365).toFixed(1) + 'y';
    return d + 'd';
  }
  function fmtBe(be) {
    if (!isFinite(be) || be === null) return '—';
    if (be <= 1) return (be * 100).toFixed(0) + '%';
    return '>100%';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // The farm economics at the current deposit and drop share, recomputed from
  // the stored implied value, TVL, gas, hold and active time.
  function econ(r) {
    var f = r.farm;
    var forgone = state.deposit * 0.05 * f.hold_days / 365;
    var slice = state.drop * r.implied_value_usd * state.deposit / r.tvl_usd;
    var total = f.gas_usd + forgone;
    var net = slice - total;
    var perHour = net / (f.active_minutes / 60);
    var verdict = net >= 25 ? 'FARM' : net >= 5 ? 'THIN' : net > 0 ? 'MARGINAL' : 'SKIP';
    return { slice: slice, gas: f.gas_usd, forgone: forgone, total: total, net: net, perHour: perHour, be: slice > 0 ? total / slice : Infinity, verdict: verdict, hold: f.hold_days, active: f.active_minutes };
  }

  function badge(r) {
    if (r.badge === 'WATCHLIST') return '<span class="pill watch">watchlist</span>';
    if (r.badge === 'OFF LIST') return '<span class="pill off">off list</span>';
    return '<span class="pill early">early</span>';
  }
  function verdictPill(v) { return '<span class="verdict ' + v.toLowerCase() + '">' + v + '</span>'; }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = rows.filter(function (r) {
      if (state.watchOnly && !watchlist.has(r.slug)) return false;
      if (state.cat && (r.category || 'Uncategorized') !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) === -1) return false;
      if (state.verdict && econ(r).verdict !== state.verdict) return false;
      if (q && r.name.toLowerCase().indexOf(q) === -1 && r.slug.indexOf(q) === -1) return false;
      return true;
    });
    var key = state.sort;
    var cmp = {
      rank: function (a, b) { return a.rank - b.rank; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
      growth: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
      age: function (a, b) { return (b.age_days || 0) - (a.age_days || 0); },
      net: function (a, b) { return econ(b).net - econ(a).net; },
      perhour: function (a, b) { return econ(b).perHour - econ(a).perHour; },
      name: function (a, b) { return a.name < b.name ? -1 : 1; }
    }[key] || function (a, b) { return a.rank - b.rank; };
    return list.sort(cmp);
  }

  function renderBoard() {
    var list = filtered();
    var tb = document.getElementById('rows');
    tb.innerHTML = list.map(function (r) {
      var e = econ(r);
      var g = r.change_7d === null ? '<span>—</span>' : '<span class="' + (r.change_7d >= 0 ? 'pos' : 'neg') + '">' + fmtPct(r.change_7d) + '</span>';
      var plan = '<b>' + esc(r.plan_label || 'Deposit USDC') + '</b><br><span class="range">' + esc(r.chains[0] || '—') + ' · ' + money2(e.total) + ' · ' + e.hold + 'd</span>';
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.sel === r.slug ? ' class="sel"' : '') + '>' +
        '<td>' + r.rank + '</td>' +
        '<td><b>' + esc(r.name) + '</b><br><span class="slug">' + esc(r.slug) + '</span> ' + badge(r) + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td><td class="num">' + g + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num implied">' + fmtUsd(r.implied_value_usd) + '<br><span class="range">#' + r.rank_range[0] + '–' + r.rank_range[1] + '</span></td>' +
        '<td>' + plan + '</td>' +
        '<td class="num ' + (e.net >= 0 ? 'pos' : 'neg') + '">' + signed(e.net) + '<br><span class="range">' + signed(e.perHour) + '/h</span></td>' +
        '<td>' + verdictPill(e.verdict) + '</td></tr>';
    }).join('');
    document.getElementById('count').textContent = list.length + ' of ' + rows.length + ' shown';
    tb.querySelectorAll('tr').forEach(function (tr) {
      tr.addEventListener('click', function () { select(tr.getAttribute('data-slug')); });
    });
  }

  // The verdict chips above the board: counts recomputed at the current
  // deposit and drop share; clicking one filters the board to that verdict
  // (Watchlist filters to the watchlist instead).
  function renderChips() {
    var counts = { ALL: rows.length, WATCHLIST: 0, FARM: 0, THIN: 0, MARGINAL: 0, SKIP: 0 };
    rows.forEach(function (r) {
      if (watchlist.has(r.slug)) counts.WATCHLIST++;
      counts[econ(r).verdict]++;
    });
    var map = { '': 'ALL', watchlist: 'WATCHLIST', FARM: 'FARM', THIN: 'THIN', MARGINAL: 'MARGINAL', SKIP: 'SKIP' };
    document.querySelectorAll('#chips .chip').forEach(function (chip) {
      var key = map[chip.getAttribute('data-verdict')] || 'ALL';
      var label = chip.textContent.replace(/ \d+$/, '');
      chip.innerHTML = label + ' <b>' + counts[key] + '</b>';
      var active = (chip.getAttribute('data-verdict') === state.verdict && !state.watchOnly) ||
        (chip.getAttribute('data-verdict') === 'watchlist' && state.watchOnly);
      chip.classList.toggle('active', active);
    });
  }

  function renderBestFarms() {
    var top = rows.slice().sort(function (a, b) { return econ(b).perHour - econ(a).perHour; }).slice(0, 3);
    document.getElementById('best-farms').innerHTML = top.map(function (r) {
      var e = econ(r);
      return '<span class="farm-pick"><b>' + esc(r.name) + '</b> ' + signed(e.net) + ' net \u00b7 ' + signed(e.perHour) + '/hour</span>';
    }).join('') + '<span class="farm-more">and ' + (rows.length - 3) + ' more</span>';
  }

  function renderLive() {
    document.getElementById('live-rows').innerHTML = D.live.map(function (p) {
      var ratio = p.mcap_usd && p.tvl_usd ? (p.mcap_usd / p.tvl_usd).toFixed(2) + 'x' : '—';
      return '<tr><td><b>' + esc(p.name) + '</b></td><td>' + esc(p.category || '—') + '</td>' +
        '<td class="num">' + fmtUsd(p.tvl_usd) + '</td><td class="num">' + (p.mcap_usd ? fmtUsd(p.mcap_usd) : '—') + '</td>' +
        '<td class="num">' + ratio + '</td><td>' + (p.status === 'trades' ? 'Trades' : 'On record') + '</td></tr>';
    }).join('');
  }

  function renderExcluded() {
    document.getElementById('excluded-rows').innerHTML = D.excluded.map(function (p) {
      return '<tr><td><b>' + esc(p.name) + '</b></td><td>' + esc(p.category || '—') + '</td>' +
        '<td class="num">' + fmtUsd(p.tvl_usd) + '</td><td>' + esc(p.reason) + '</td><td>' + esc(p.rule) + '</td></tr>';
    }).join('');
  }

  function select(slug) {
    var r = rows.find(function (x) { return x.slug === slug; });
    if (!r) return;
    state.sel = slug;
    var e = econ(r);
    var c = D.curve;
    var el = document.getElementById('detail');
    el.innerHTML =
      '<h2>' + esc(r.name) + '</h2>' +
      '<p class="sub">Rank #' + r.rank + ' (bootstrap p2.5–p97.5: #' + r.rank_range[0] + '–' + r.rank_range[1] + ') · ' + esc(r.category || 'Uncategorized') + ' · ' + esc(r.chains.join(', ') || '—') + ' ' + badge(r) + '</p>' +
      '<dl class="kv">' +
      '<dt>Implied value</dt><dd class="implied">' + fmtUsd(r.implied_value_usd) + '</dd>' +
      '<dt>TVL</dt><dd>' + fmtUsd(r.tvl_usd) + '</dd>' +
      '<dt>Fitted multiple</dt><dd>' + r.fitted_multiple.toFixed(2) + 'x</dd>' +
      '<dt>Curve</dt><dd>ln V = ' + c.intercept.toFixed(2) + ' + ' + c.slope.toFixed(2) + ' × (ln TVL − ' + c.mean_ln_tvl.toFixed(2) + ')' + (r.category_offset === 0 ? ' (pooled: no category offset)' : ' ' + (r.category_offset >= 0 ? '+' : '−') + ' ' + Math.abs(r.category_offset).toFixed(2)) + '</dd>' +
      '<dt>7-day change</dt><dd>' + fmtPct(r.change_7d) + '</dd>' +
      '<dt>No token for</dt><dd>' + fmtAge(r.age_days) + '</dd>' +
      '<dt>Listed</dt><dd>' + esc(r.listed_at || 'unknown') + '</dd>' +
      '<dt>Token recorded</dt><dd>None — pre-token</dd>' +
      '</dl>' +
      '<h3>Farm plan — $' + state.deposit.toLocaleString('en-US') + ' deposit, ' + (state.drop * 100).toFixed(0) + '% drop share</h3>' +
      '<dl class="kv">' +
      '<dt>Airdrop slice</dt><dd>' + money2(e.slice) + '</dd>' +
      '<dt>Gas, all steps</dt><dd>' + money2(e.gas) + '</dd>' +
      '<dt>Forgone T-bill yield</dt><dd>' + money2(e.forgone) + ' (' + e.hold + ' days at 5%/yr)</dd>' +
      '<dt>Total cost</dt><dd>' + money2(e.total) + '</dd>' +
      '<dt>Net expected value</dt><dd class="' + (e.net >= 0 ? 'pos' : 'neg') + '">' + signed(e.net) + '</dd>' +
      '<dt>Break-even launch odds</dt><dd>' + fmtBe(e.be) + '</dd>' +
      '<dt>Net per hour</dt><dd class="' + (e.perHour >= 0 ? 'pos' : 'neg') + '">' + signed(e.perHour) + '/hour (' + e.active + ' active minutes)</dd>' +
      '<dt>Verdict</dt><dd>' + verdictPill(e.verdict) + '</dd>' +
      '</dl>' +
      '<h3>Seven steps — the $1,000 plan</h3>' +
      '<ol class="steps">' + r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<h3>Why this rank</h3>' +
      '<p class="note">Implied value ' + fmtUsd(r.implied_value_usd) + ' follows from this protocol\u2019s own snapshot figures: ' + fmtUsd(r.tvl_usd) + ' TVL on a curve that prices a protocol of this size at a ' + r.fitted_multiple.toFixed(2) + 'x multiple, ' + fmtPct(r.change_7d) + ' over 7 days, ' + fmtAge(r.age_days) + ' with no token recorded, across ' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + '. The rank range is the p2.5–p97.5 of 200 refits of the same curve on resampled traded tokens. It is this radar\u2019s claim, not a prediction that a token will launch.</p>';
    renderBoard();
  }

  function setView(v) {
    state.view = v;
    document.querySelectorAll('.views button').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === v); });
    document.getElementById('board').style.display = v === 'board' ? '' : 'none';
    document.getElementById('live').hidden = v !== 'live';
    document.getElementById('excluded').hidden = v !== 'excluded';
    document.getElementById('model').hidden = v !== 'model';
    if (v === 'live') renderLive();
    if (v === 'excluded') renderExcluded();
  }

  function initControls() {
    var cats = [...new Set(rows.map(function (r) { return r.category || 'Uncategorized'; }))].sort();
    document.getElementById('cat').innerHTML = '<option value="">All categories</option>' + cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    var chains = [...new Set(rows.flatMap(function (r) { return r.chains; }))].sort();
    document.getElementById('chain').innerHTML = '<option value="">All chains</option>' + chains.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });
    document.getElementById('cat').addEventListener('change', function (e) { state.cat = e.target.value; renderBoard(); });
    document.getElementById('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); });
    document.getElementById('deposit').addEventListener('change', function (e) { state.deposit = Number(e.target.value); renderBoard(); renderBestFarms(); renderChips(); if (state.sel) select(state.sel); });
    document.getElementById('drop').addEventListener('change', function (e) { state.drop = Number(e.target.value); renderBoard(); renderBestFarms(); renderChips(); if (state.sel) select(state.sel); });
    document.getElementById('watch').addEventListener('change', function (e) { state.watchOnly = e.target.checked; if (e.target.checked) state.verdict = ''; renderBoard(); renderChips(); });
    document.getElementById('sort').addEventListener('change', function (e) { state.sort = e.target.value; renderBoard(); });
    document.querySelectorAll('#chips .chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var v = chip.getAttribute('data-verdict');
        if (v === 'watchlist') { state.watchOnly = true; state.verdict = ''; document.getElementById('watch').checked = true; }
        else { state.verdict = v; state.watchOnly = false; document.getElementById('watch').checked = false; }
        renderBoard(); renderChips();
      });
    });
    document.querySelectorAll('.views button').forEach(function (b) {
      b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
    });
    document.querySelectorAll('#board-table thead th').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-k');
        state.sort = { rank: 'rank', name: 'name', tvl: 'tvl', growth: 'growth', age: 'age', implied: 'implied', plan: 'net', netlaunch: 'net', verdict: 'net' }[k] || 'rank';
        document.getElementById('sort').value = state.sort;
        renderBoard();
      });
    });
    renderChips();
  }

  function initFromQuery() {
    var p = new URLSearchParams(window.location.search);
    var f = p.get('filter');
    if (f === 'watchlist') { state.watchOnly = true; document.getElementById('watch').checked = true; }
    else if (f && f.indexOf('category:') === 0) { state.cat = f.slice(9); document.getElementById('cat').value = state.cat; }
    if (p.get('verdict')) { state.verdict = p.get('verdict'); renderChips(); }
    if (p.get('view') === 'live') setView('live');
    else if (p.get('view') === 'excluded') setView('excluded');
    else if (p.get('view') === 'model') setView('model');
    var slug = p.get('slug');
    if (slug) select(slug);
    else renderBoard();
  }

  renderBestFarms();
  initControls();
  renderBoard();
  initFromQuery();
})();

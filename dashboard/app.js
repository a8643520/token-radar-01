// Token Radar dashboard: renders window.RADAR (written by main.ts) with no
// network. Views: board, live tokens, model. The board is sortable and
// filterable; clicking a row opens its detail view with the implied-value
// breakdown and the seven-step farm plan.
(function () {
  var D = window.RADAR;
  var rows = D.rows;
  var watchlist = new Set(D.watchlist || []);
  var state = { view: 'board', q: '', cat: '', chain: '', watchOnly: false, sort: 'rank', sel: null };

  function fmtUsd(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n;
  }
  function fmtPct(v) {
    if (v === null || v === undefined) return '—';
    return (v > 0 ? '+' : '') + v.toFixed(1) + '%';
  }
  function fmtAge(d) { return d === null || d === undefined ? '—' : d + 'd'; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = rows.filter(function (r) {
      if (state.watchOnly && !watchlist.has(r.slug)) return false;
      if (state.cat && (r.category || 'Uncategorized') !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) === -1) return false;
      if (q && r.name.toLowerCase().indexOf(q) === -1 && r.slug.indexOf(q) === -1) return false;
      return true;
    });
    var key = state.sort;
    var cmp = {
      rank: function (a, b) { return a.rank - b.rank; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
      age: function (a, b) { return (b.age_days || 0) - (a.age_days || 0); },
      name: function (a, b) { return a.name < b.name ? -1 : 1; }
    }[key] || cmpRank;
    function cmpRank(a, b) { return a.rank - b.rank; }
    return list.sort(cmp);
  }

  function renderStats() {
    var total = rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
    document.getElementById('stats').innerHTML =
      '<div class="stat"><b>' + D.board_size + '</b><span>protocols ranked</span></div>' +
      '<div class="stat"><b>' + D.watchlist_size + '</b><span>on the watchlist</span></div>' +
      '<div class="stat"><b>' + D.early_size + '</b><span>early finds</span></div>' +
      '<div class="stat"><b>' + fmtUsd(total) + '</b><span>total implied value</span></div>' +
      '<div class="stat"><b>' + esc(D.as_of) + '</b><span>snapshot date</span></div>';
  }

  function renderBoard() {
    var list = filtered();
    var tb = document.getElementById('rows');
    tb.innerHTML = list.map(function (r) {
      var g = r.change_7d === null ? '<span>—</span>' : '<span class="' + (r.change_7d >= 0 ? 'pos' : 'neg') + '">' + fmtPct(r.change_7d) + '</span>';
      var chains = r.chains.slice(0, 3).map(function (c) { return '<span class="pill">' + esc(c) + '</span>'; }).join('') + (r.chains.length > 3 ? '<span class="pill">+' + (r.chains.length - 3) + '</span>' : '');
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.sel === r.slug ? ' class="sel"' : '') + '>' +
        '<td>' + r.rank + '</td>' +
        '<td><b>' + esc(r.name) + '</b> ' + (watchlist.has(r.slug) ? '<span class="pill watch">watchlist</span>' : '') + '<br><span style="color:var(--muted);font-size:12px">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td><td>' + chains + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td><td class="num">' + g + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num implied">' + fmtUsd(r.implied_value_usd) + '</td></tr>';
    }).join('');
    document.getElementById('count').textContent = list.length + ' of ' + rows.length + ' shown';
    tb.querySelectorAll('tr').forEach(function (tr) {
      tr.addEventListener('click', function () { select(tr.getAttribute('data-slug')); });
    });
  }

  function renderLive() {
    document.getElementById('live-rows').innerHTML = D.live.map(function (p) {
      var ratio = p.mcap_usd && p.tvl_usd ? (p.mcap_usd / p.tvl_usd).toFixed(2) + 'x' : '—';
      return '<tr><td><b>' + esc(p.name) + '</b></td><td>' + esc(p.category || '—') + '</td>' +
        '<td class="num">' + fmtUsd(p.tvl_usd) + '</td><td class="num">' + (p.mcap_usd ? fmtUsd(p.mcap_usd) : '—') + '</td>' +
        '<td class="num">' + ratio + '</td></tr>';
    }).join('');
  }

  function renderModel() {
    document.getElementById('formula').textContent =
      'comparable = median mcap / TVL of live-token protocols in the same category\n' +
      '             (at least 3 of them), else the live overall median; clamped to [0.08, 0.80]\n' +
      'base       = TVL x comparable\n' +
      'growth     = 1 + clamp(7d change, -50, +150) x 0.006 (rising) or x 0.0035 (falling)\n' +
      'maturity   = 0.70 + min(age in days, 1460) / 1460 x 0.50   (unknown age: 365 days)\n' +
      'chains     = 1 + 0.04 x min(chains - 1, 5)\n' +
      'implied    = TVL x comparable x growth x maturity x chains';
    document.getElementById('comp-rows').innerHTML = D.comparables.map(function (c) {
      return '<tr><td>' + esc(c.category) + '</td><td class="num">' + c.multiple.toFixed(2) + 'x</td><td class="num">' + c.n + '</td></tr>';
    }).join('') + '<tr><td><b>Overall live median</b></td><td class="num"><b>' + D.overall_comparable.toFixed(2) + 'x</b></td><td class="num">—</td></tr>';
  }

  function select(slug) {
    var r = rows.find(function (x) { return x.slug === slug; });
    if (!r) return;
    state.sel = slug;
    var base = r.tvl_usd * r.comparable_multiple;
    var el = document.getElementById('detail');
    el.innerHTML =
      '<h2>' + esc(r.name) + '</h2>' +
      '<p class="sub">Rank #' + r.rank + ' · ' + esc(r.category || 'Uncategorized') + ' · ' + esc(r.chains.join(', ') || '—') + (watchlist.has(r.slug) ? ' · <span class="pill watch">watchlist</span>' : '') + '</p>' +
      '<dl class="kv">' +
      '<dt>Implied value</dt><dd class="implied">' + fmtUsd(r.implied_value_usd) + '</dd>' +
      '<dt>TVL</dt><dd>' + fmtUsd(r.tvl_usd) + '</dd>' +
      '<dt>Comparable multiple</dt><dd>' + r.comparable_multiple.toFixed(2) + 'x</dd>' +
      '<dt>Base (TVL x comparable)</dt><dd>' + fmtUsd(Math.round(base)) + '</dd>' +
      '<dt>Growth multiplier</dt><dd>x' + r.growth_multiplier.toFixed(2) + ' (' + fmtPct(r.change_7d) + ' in 7d)</dd>' +
      '<dt>Maturity multiplier</dt><dd>x' + r.maturity_multiplier.toFixed(2) + ' (' + fmtAge(r.age_days) + ' old)</dd>' +
      '<dt>Chain multiplier</dt><dd>x' + r.chain_multiplier.toFixed(2) + ' (' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ')</dd>' +
      '<dt>Listed</dt><dd>' + esc(r.listed_at || 'unknown') + '</dd>' +
      '<dt>Token recorded</dt><dd>None — pre-token</dd>' +
      '</dl>' +
      '<h3>Farm plan — 7 steps</h3>' +
      '<ol class="steps">' + r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<h3>Why this rank</h3>' +
      '<p class="note">Implied value ' + fmtUsd(r.implied_value_usd) + ' follows from this protocol\u2019s own snapshot figures: ' + fmtUsd(r.tvl_usd) + ' TVL at a ' + r.comparable_multiple.toFixed(2) + 'x category comparable, ' + fmtPct(r.change_7d) + ' over 7 days, ' + fmtAge(r.age_days) + ' of track record with no token recorded, across ' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + '. It is this radar\u2019s claim, not a prediction that a token will launch.</p>';
    renderBoard();
  }

  function setView(v) {
    state.view = v;
    document.querySelectorAll('.views button').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === v); });
    document.getElementById('board').style.display = v === 'board' ? '' : 'none';
    document.querySelector('.controls').style.display = v === 'board' ? '' : 'none';
    document.getElementById('live').hidden = v !== 'live';
    document.getElementById('model').hidden = v !== 'model';
    if (v === 'live') renderLive();
    if (v === 'model') renderModel();
  }

  function initControls() {
    var cats = [...new Set(rows.map(function (r) { return r.category || 'Uncategorized'; }))].sort();
    document.getElementById('cat').innerHTML = '<option value="">All categories</option>' + cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    var chains = [...new Set(rows.flatMap(function (r) { return r.chains; }))].sort();
    document.getElementById('chain').innerHTML = '<option value="">All chains</option>' + chains.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });
    document.getElementById('cat').addEventListener('change', function (e) { state.cat = e.target.value; renderBoard(); });
    document.getElementById('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); });
    document.getElementById('watch').addEventListener('change', function (e) { state.watchOnly = e.target.checked; renderBoard(); });
    document.getElementById('sort').addEventListener('change', function (e) { state.sort = e.target.value; renderBoard(); });
    document.querySelectorAll('.views button').forEach(function (b) {
      b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
    });
    document.querySelectorAll('#board thead th').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-k');
        state.sort = { rank: 'rank', name: 'name', tvl: 'tvl', growth: 'growth', age: 'age', implied: 'rank', category: 'rank', chains: 'rank' }[k] || 'rank';
        document.getElementById('sort').value = state.sort;
        renderBoard();
      });
    });
  }

  function initFromQuery() {
    var p = new URLSearchParams(window.location.search);
    var f = p.get('filter');
    if (f === 'watchlist') { state.watchOnly = true; document.getElementById('watch').checked = true; }
    else if (f && f.indexOf('category:') === 0) { state.cat = f.slice(9); document.getElementById('cat').value = state.cat; }
    if (p.get('view') === 'live') setView('live');
    else if (p.get('view') === 'model') setView('model');
    var slug = p.get('slug');
    if (slug) select(slug);
    else renderBoard();
  }

  document.getElementById('source').textContent = 'Source: ' + D.source + ' · Snapshot ' + D.as_of + ' · Floor $50,000,000 · Model radar-2.';
  renderStats();
  initControls();
  renderBoard();
  initFromQuery();
})();

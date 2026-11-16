/* Archive and Database landing pages (2026-11-12). Markup: scripts/hubs.mjs.
   Everything here is an enhancement: with no JavaScript both pages still
   list every game, team, record leader and letter as plain links. */
(function () {
  var root = document.documentElement;
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Theme button (the page's own inline script is removed by the build).
  var toggle = document.getElementById('theme-toggle');
  function setTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('ntw-theme', t); } catch (e) {}
    if (toggle) { toggle.textContent = t === 'dark' ? 'Light' : 'Dark'; }
  }
  setTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  if (toggle) {
    toggle.addEventListener('click', function () { setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); });
  }

  // Sticky tools sit under the sticky header, whatever its height is.
  var header = $('.site-header');
  var tools = $('#g-tools');
  function measure() {
    var top = header && !header.classList.contains('tucked') ? header.offsetHeight : 0;
    root.style.setProperty('--hub-top', top + 'px');
    if (tools) { root.style.setProperty('--tools-h', tools.offsetHeight + 'px'); }
  }
  measure();
  window.addEventListener('resize', measure);
  if (header && window.MutationObserver) { new MutationObserver(measure).observe(header, { attributes: true, attributeFilter: ['class'] }); }

  // Hero numbers count up once.
  $$('.hub-stats [data-count]').forEach(function (el) {
    var end = Number(el.getAttribute('data-count'));
    if (reduced || !end || !window.requestAnimationFrame) { return; }
    var t0 = null;
    function step(t) {
      if (t0 === null) { t0 = t; }
      var p = Math.min(1, (t - t0) / 900);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))).toLocaleString('en-US');
      if (p < 1) { requestAnimationFrame(step); }
    }
    el.textContent = '0';
    requestAnimationFrame(step);
  });

  function press(buttons, active) {
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', b === active ? 'true' : 'false'); });
  }

  // ── Archive ──────────────────────────────────────────────────────────────
  var results = $('#g-results');
  if (results) {
    var cards = $$('.g-card', results);
    var sections = $$('.decade[data-era]', results);
    var flat = $('#g-flat');
    var flatGrid = $('.g-grid', flat);
    var empty = $('#g-empty');
    var countEl = $('#g-count'), countLabel = $('#g-count-label'), clearBtn = $('#g-clear');
    var qInput = $('#g-q'), teamSel = $('#g-team'), sortSel = $('#g-sort');
    var sportBtns = $$('[data-sport]', tools), eraBtns = $$('[data-era]', tools), viewBtns = $$('[data-view]', tools);
    var state = { sport: 'all', era: 'all', team: 'all', sort: 'new', q: '', view: 'grid' };
    var defaults = { sport: 'all', era: 'all', team: 'all', sort: 'new', q: '', view: 'grid' };
    var num = function (c, k) { return Number(c.getAttribute('data-' + k)); };
    var sorters = {
      'new': function (a, b) { return num(b, 'time') - num(a, 'time'); },
      old: function (a, b) { return num(a, 'time') - num(b, 'time'); },
      close: function (a, b) { return num(a, 'margin') - num(b, 'margin') || num(b, 'time') - num(a, 'time'); },
      wide: function (a, b) { return num(b, 'margin') - num(a, 'margin') || num(b, 'time') - num(a, 'time'); },
      high: function (a, b) { return num(b, 'total') - num(a, 'total') || num(b, 'time') - num(a, 'time'); }
    };

    function readHash() {
      location.hash.replace(/^#/, '').split('&').forEach(function (pair) {
        var i = pair.indexOf('=');
        if (i === -1) { return; }
        var k = pair.slice(0, i), v = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
        if (k in state) { state[k] = v; }
      });
      if (!sorters[state.sort]) { state.sort = 'new'; }
      if (state.view !== 'list') { state.view = 'grid'; }
    }
    function writeHash() {
      var parts = [];
      Object.keys(state).forEach(function (k) { if (state[k] !== defaults[k]) { parts.push(k + '=' + encodeURIComponent(state[k])); } });
      try { history.replaceState(null, '', parts.length ? '#' + parts.join('&') : location.pathname + location.search); } catch (e) {}
    }

    function apply() {
      var tokens = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      var shown = cards.filter(function (c) {
        var ok = (state.sport === 'all' || c.getAttribute('data-sport') === state.sport)
          && (state.era === 'all' || c.getAttribute('data-era') === state.era)
          && (state.team === 'all' || (' ' + c.getAttribute('data-teams') + ' ').indexOf(' ' + state.team + ' ') !== -1);
        if (ok && tokens.length) {
          var hay = c.getAttribute('data-search');
          ok = tokens.every(function (t) { return hay.indexOf(t) !== -1; });
        }
        c.hidden = !ok;
        return ok;
      }).sort(sorters[state.sort]);

      var chrono = state.sort === 'new' || state.sort === 'old';
      flat.hidden = chrono || !shown.length;
      if (chrono) {
        var byEra = {};
        shown.forEach(function (c) { (byEra[c.getAttribute('data-era')] = byEra[c.getAttribute('data-era')] || []).push(c); });
        sections.slice().sort(function (a, b) {
          var cmp = a.getAttribute('data-era') < b.getAttribute('data-era') ? -1 : 1;
          return state.sort === 'new' ? -cmp : cmp;
        }).forEach(function (sec) {
          var list = byEra[sec.getAttribute('data-era')] || [];
          var grid = $('.g-grid', sec);
          list.forEach(function (c) { grid.appendChild(c); });
          sec.hidden = !list.length;
          var p = $('.decade-head p', sec);
          if (p) { p.innerHTML = '<b>' + list.length + '</b> ' + (list.length === 1 ? 'game' : 'games'); }
          results.insertBefore(sec, flat);
        });
      } else {
        sections.forEach(function (sec) { sec.hidden = true; });
        shown.forEach(function (c) { flatGrid.appendChild(c); });
      }

      empty.hidden = shown.length > 0;
      countEl.textContent = shown.length;
      countLabel.textContent = (shown.length === 1 ? 'game' : 'games') + (shown.length === cards.length ? '' : ' of ' + cards.length);
      var filtered = state.sport !== 'all' || state.era !== 'all' || state.team !== 'all' || state.q !== '';
      clearBtn.hidden = !filtered;
      results.classList.toggle('view-list', state.view === 'list');
      sportBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-sport') === state.sport)); });
      eraBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-era') === state.era)); });
      viewBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === state.view)); });
      teamSel.value = state.team; if (teamSel.value !== state.team) { state.team = 'all'; teamSel.value = 'all'; }
      teamSel.classList.toggle('on', state.team !== 'all');
      sortSel.value = state.sort;
      sortSel.classList.toggle('on', state.sort !== 'new');
      if (qInput.value !== state.q) { qInput.value = state.q; }
      writeHash();
      measure();
    }

    function set(k, v) { state[k] = v; apply(); }
    sportBtns.forEach(function (b) { b.addEventListener('click', function () { set('sport', b.getAttribute('data-sport')); }); });
    eraBtns.forEach(function (b) { b.addEventListener('click', function () { set('era', state.era === b.getAttribute('data-era') ? 'all' : b.getAttribute('data-era')); }); });
    viewBtns.forEach(function (b) { b.addEventListener('click', function () { set('view', b.getAttribute('data-view')); }); });
    teamSel.addEventListener('change', function () { set('team', teamSel.value); });
    sortSel.addEventListener('change', function () { set('sort', sortSel.value); });
    qInput.addEventListener('input', function () { set('q', qInput.value.trim()); });
    qInput.addEventListener('keydown', function (e) { if (e.key === 'Escape' && qInput.value) { e.stopPropagation(); set('q', ''); } });
    function clear() { state.sport = 'all'; state.era = 'all'; state.team = 'all'; state.q = ''; apply(); }
    clearBtn.addEventListener('click', clear);
    $$('[data-clear]', results).forEach(function (b) { b.addEventListener('click', clear); });

    readHash();
    apply();

    // Margin chart: the readout names the bar under the pointer or focus.
    var readout = $('#mc-readout');
    if (readout) {
      var rest = readout.textContent;
      $$('.mc-bar').forEach(function (bar) {
        var on = function () { readout.textContent = bar.getAttribute('data-tip'); readout.classList.add('live'); };
        var off = function () { readout.textContent = rest; readout.classList.remove('live'); };
        bar.addEventListener('mouseenter', on); bar.addEventListener('focus', on);
        bar.addEventListener('mouseleave', off); bar.addEventListener('blur', off);
      });
    }
  }

  // ── Database: record book ────────────────────────────────────────────────
  var rbMain = $('.rb-main');
  if (rbMain) {
    var panels = $$('.rb-panel', rbMain);
    var cats = $$('.rb-cats a');
    var modeBtns = $$('[data-mode]', $('.rb-controls'));
    var statsBox = $('#rb-stats'), more = $('#rb-more');
    var rb = { cat: panels[0].getAttribute('data-cat'), mode: 'career', stat: 0 };
    var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
    function show() {
      var list = panels.filter(function (p) { return p.getAttribute('data-cat') === rb.cat && p.getAttribute('data-mode') === rb.mode; });
      if (!list.length) { rb.mode = 'career'; list = panels.filter(function (p) { return p.getAttribute('data-cat') === rb.cat; }); }
      if (rb.stat >= list.length) { rb.stat = 0; }
      panels.forEach(function (p) { p.hidden = p !== list[rb.stat]; });
      statsBox.innerHTML = '';
      list.forEach(function (p, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = cap(p.getAttribute('data-stat'));
        b.setAttribute('aria-pressed', String(i === rb.stat));
        b.addEventListener('click', function () { rb.stat = i; show(); });
        statsBox.appendChild(b);
      });
      cats.forEach(function (a) { if (a.getAttribute('data-cat') === rb.cat) { a.setAttribute('aria-current', 'true'); } else { a.removeAttribute('aria-current'); } });
      modeBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === rb.mode)); });
      more.setAttribute('href', '/database/records-' + rb.cat);
    }
    cats.forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey) { return; }
        e.preventDefault();
        rb.cat = a.getAttribute('data-cat'); rb.stat = 0; show();
      });
    });
    modeBtns.forEach(function (b) { b.addEventListener('click', function () { rb.mode = b.getAttribute('data-mode'); show(); }); });
    show();
  }

  // ── Database: team order ─────────────────────────────────────────────────
  var tmGrid = $('#tm-grid'), tmRanked = $('#tm-ranked');
  if (tmGrid && tmRanked) {
    var tiles = $$('.tm', tmGrid);
    var homes = tiles.map(function (t) { return t.parentNode; });
    var orderBtns = $$('[data-order]');
    orderBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-order');
        press(orderBtns, b);
        if (key === 'division') {
          tiles.forEach(function (t, i) { homes[i].appendChild(t); $('.tm-rank', t).textContent = ''; });
          tmRanked.hidden = true; tmGrid.hidden = false;
          return;
        }
        var val = function (t) { return Number(t.getAttribute('data-' + key)); };
        tiles.slice().sort(function (a, b2) {
          return val(b2) - val(a) || Number(b2.getAttribute('data-pct')) - Number(a.getAttribute('data-pct'));
        }).forEach(function (t, i) { $('.tm-rank', t).textContent = '#' + (i + 1); tmRanked.appendChild(t); });
        tmGrid.hidden = true; tmRanked.hidden = false;
      });
    });
  }

  // ── Database: search ─────────────────────────────────────────────────────
  var box = $('#db-search');
  if (box) {
    var input = $('#db-q'), panel = $('#db-results');
    var players = null, loading = false, active = -1, links = [];
    var teams = $$('.tm').map(function (t) {
      return { name: t.getAttribute('data-name'), abbr: t.getAttribute('data-abbr'), href: $('.tm-head', t).getAttribute('href'), color: t.style.getPropertyValue('--c') };
    });
    var norm = function (s) { return s.toLowerCase().replace(/[.'’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); };
    var escHtml = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

    function load() {
      if (players || loading) { return; }
      loading = true;
      fetch(box.getAttribute('data-src')).then(function (r) { return r.json(); }).then(function (rows) {
        players = rows.map(function (r) { return { id: r[0], name: r[1], pos: r[2], y0: r[3], y1: r[4], key: ' ' + norm(r[1]) }; });
        loading = false;
        if (input.value.trim()) { search(); }
      }).catch(function () { loading = false; });
    }

    function close() { panel.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; }
    function mark(i) {
      active = i;
      links.forEach(function (a, n) { a.classList.toggle('active', n === i); });
      if (links[i]) { links[i].scrollIntoView({ block: 'nearest' }); }
    }

    function search() {
      var q = norm(input.value);
      if (!q) { close(); return; }
      var tokens = q.split(' ');
      var hitsTeams = teams.filter(function (t) {
        var key = ' ' + norm(t.name) + ' ' + t.abbr.toLowerCase();
        return tokens.every(function (tok) { return key.indexOf(' ' + tok) !== -1; });
      }).slice(0, 3);
      var hits = [];
      if (players) {
        for (var i = 0; i < players.length; i++) {
          var p = players[i], ok = true;
          for (var j = 0; j < tokens.length; j++) { if (p.key.indexOf(' ' + tokens[j]) === -1) { ok = false; break; } }
          if (!ok) { continue; }
          var score = p.key.indexOf(' ' + q) === 0 ? 3 : (p.key.lastIndexOf(' ' + tokens[0]) === p.key.lastIndexOf(' ') ? 2 : 1);
          hits.push({ p: p, s: score });
        }
        hits.sort(function (a, b) { return b.s - a.s || (b.p.y1 - b.p.y0) - (a.p.y1 - a.p.y0) || b.p.y1 - a.p.y1 || a.p.name.localeCompare(b.p.name); });
      }
      var total = hits.length;
      hits = hits.slice(0, 8);
      var html = '';
      if (hitsTeams.length) {
        html += '<div class="r-group">Teams</div>' + hitsTeams.map(function (t) {
          return '<a role="option" href="' + t.href + '"><span class="r-ico team" style="--c:' + t.color + '">' + t.abbr + '</span><span class="r-name">' + escHtml(t.name) + '</span><span class="r-sub">Team</span></a>';
        }).join('');
      }
      if (hits.length) {
        html += '<div class="r-group">Players' + (total > hits.length ? ' · top ' + hits.length + ' of ' + total.toLocaleString('en-US') : '') + '</div>' + hits.map(function (h) {
          var p = h.p;
          return '<a role="option" href="/database/players/' + p.id + '"><span class="r-ico">' + escHtml(p.pos || '') + '</span><span class="r-name">' + escHtml(p.name) + '</span><span class="r-sub">' + (p.y0 === p.y1 ? p.y0 : p.y0 + ' to ' + p.y1) + '</span></a>';
        }).join('');
      }
      if (!html) { html = '<div class="r-empty">' + (players ? 'No player or team matches that name.' : 'Loading players…') + '</div>'; }
      panel.innerHTML = html;
      panel.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      links = $$('a', panel);
      mark(links.length ? 0 : -1);
    }

    input.addEventListener('focus', function () { load(); if (input.value.trim()) { search(); } });
    input.addEventListener('input', function () { load(); search(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' && links.length) { e.preventDefault(); mark((active + 1) % links.length); }
      else if (e.key === 'ArrowUp' && links.length) { e.preventDefault(); mark((active - 1 + links.length) % links.length); }
      else if (e.key === 'Enter' && links[active]) { e.preventDefault(); location.href = links[active].getAttribute('href'); }
      else if (e.key === 'Escape' && !panel.hidden) { e.stopPropagation(); close(); }
    });
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) { close(); } });
  }
})();

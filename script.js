// Vercel Web Analytics (plain-HTML integration, same as @vercel/analytics inject()).
// One shared file, so this covers every page type (posts, archive, database) that
// loads script.js. Requires Web Analytics enabled on the Vercel project dashboard;
// until then /_vercel/insights/script.js 404s harmlessly and va() just queues.
(function () {
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  if (document.querySelector('script[src*="/_vercel/insights/script.js"]')) return;
  var s = document.createElement('script');
  s.defer = true;
  s.src = '/_vercel/insights/script.js';
  document.head.appendChild(s);
})();
document.addEventListener('click', function (e) {
  if (e.target.closest('button.logo')) { window.location.href = '/'; return; }
  var t = e.target.closest('[data-demo]');
  if (!t) return;
  showToast('Demo preview — this button is not live yet.');
});
document.addEventListener('submit', function (e) {
  if (!e.target.classList || !e.target.classList.contains('newsletter-box')) return;
  e.preventDefault();
  var input = e.target.querySelector('input[type="email"]');
  if (!input || !input.value) return;
  showToast('Thanks — one newsletter per week.');
  input.value = '';
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && e.target.matches('[data-demo-input]')) {
    showToast('Demo preview — search is not live yet.');
  }
});
function showToast(msg) {
  var toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2200);
}

/* v4 redesign: progressive touches. Each one checks for its elements, so pages
   without them (Archive, Database, older layouts) are untouched. */
(function () {
  // Photos for the lead story and the four cards, read from each post's own
  // page so they always match what the post shows. Cached for the session.
  function postImage(href, done) {
    var key = 'ntw-img:' + href;
    try { var hit = sessionStorage.getItem(key); if (hit) { done(hit === '-' ? null : hit); return; } } catch (e) {}
    fetch(href).then(function (r) { return r.ok ? r.text() : ''; }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var img = doc.querySelector('img.article-img');
      var src = img ? new URL(img.getAttribute('src'), new URL(href, location.href)).href : null;
      try { sessionStorage.setItem(key, src || '-'); } catch (e) {}
      done(src, img ? img.getAttribute('alt') : '');
    }).catch(function () { done(null); });
  }
  function addPhoto(link, className, first) {
    postImage(link.getAttribute('href'), function (src) {
      if (!src) return;
      var img = new Image();
      img.className = className;
      img.alt = '';
      img.loading = first ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.src = src;
      link.insertBefore(img, link.firstChild);
      if (className === 'lead-img') link.classList.add('has-img');
    });
  }
  var lead = document.querySelector('a.modern-lead');
  if (lead) addPhoto(lead, 'lead-img', true);
  document.querySelectorAll('.cards > a').forEach(function (a) { addPhoto(a, 'card-img', false); });

  // The running list: one heading per day, newest day first, and only the
  // latest three days open. Stories keep their order within a day, so a
  // story added out of order still lands under its own date.
  var list = document.querySelector('.today-list');
  if (list) {
    var items = Array.prototype.slice.call(list.querySelectorAll(':scope > a'));
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var now = new Date();
    var dayValue = function (label) {
      var m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})$/.exec(label);
      if (!m) return -Infinity;
      var month = MONTHS.indexOf(m[1].slice(0, 1).toUpperCase() + m[1].slice(1, 3).toLowerCase());
      if (month < 0) return -Infinity;
      // No year on the page: a month later than next month belongs to last year.
      var year = now.getFullYear() - (month > now.getMonth() + 1 ? 1 : 0);
      return new Date(year, month, Number(m[2])).getTime();
    };
    var groups = [], byDay = {};
    items.forEach(function (a) {
      var meta = a.querySelector('span');
      var text = meta ? meta.textContent : '';
      var day = text.indexOf('·') !== -1 ? text.split('·')[0].trim() : '';
      // The day heading carries the date, so the row keeps only the read time.
      if (day) meta.textContent = text.split('·').slice(1).join('·').trim();
      var key = day || 'Earlier';
      if (!byDay[key]) { byDay[key] = { label: key, value: day ? dayValue(day) : -Infinity, items: [] }; groups.push(byDay[key]); }
      byDay[key].items.push(a);
    });
    groups.sort(function (x, y) { return y.value - x.value; });
    var folded = 0;
    groups.forEach(function (g, i) {
      var h = document.createElement('p');
      h.className = 'day';
      h.textContent = g.label;
      var fold = i >= 3;
      if (fold) { h.classList.add('folded'); h.style.display = 'none'; }
      list.appendChild(h);
      g.items.forEach(function (a) {
        if (fold) { a.classList.add('folded'); folded++; }
        list.appendChild(a);
      });
    });
    if (folded) {
      var more = document.createElement('button');
      more.type = 'button';
      more.className = 'today-more';
      more.textContent = 'Show all ' + items.length + ' stories';
      more.addEventListener('click', function () {
        list.querySelectorAll('.folded').forEach(function (el) { el.classList.remove('folded'); el.style.display = ''; });
        more.remove();
      });
      list.appendChild(more);
    }
  }

  // Articles: a caption from the photo's description, and a reading bar.
  var art = document.querySelector('main.article');
  if (art) {
    var photo = art.querySelector('img.article-img');
    if (photo && photo.alt && !(photo.nextElementSibling && photo.nextElementSibling.classList.contains('article-caption'))) {
      var cap = document.createElement('p');
      cap.className = 'article-caption';
      cap.textContent = photo.alt;
      photo.insertAdjacentElement('afterend', cap);
    }
    var bar = document.createElement('div');
    bar.className = 'read-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    var tick = function () {
      var rect = art.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      var p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
      bar.style.transform = 'scaleX(' + p + ')';
    };
    window.addEventListener('scroll', tick, { passive: true });
    window.addEventListener('resize', tick);
    tick();
  }
})();

/* Design variations (branch design-variations only, for choosing a look).
   Two independent choices: a layout (structure, positions, type; /layouts)
   and a colour palette (/colors) that every page follows. Pick them with
   ?layout=N&color=M, /layout/N, /color/N, or /theme/N (layout N with colour
   N), or with the bar at the bottom. The choice is remembered while
   browsing. Not for production. */
(function () {
  var AXES = {
    layout: { label: 'Layout', dir: '/layouts/', names: ['Editorial', 'Broadsheet', 'Swiss', 'Terminal', 'Magazine cover', 'Startup', 'Soft', 'Brutalist', 'Literary', 'Wire service'] },
    color: { label: 'Color', dir: '/colors/', names: ['Classic blue', 'Newsprint', 'Signal red', 'Terminal', 'Violet', 'Mint', 'Coral', 'Highlighter', 'Forest paper', 'Ember'],
      swatch: [['#3047ff', '#ffffff'], ['#b3121f', '#f7f2e7'], ['#e30613', '#ffffff'], ['#ffb000', '#0c0b08'], ['#6d28d9', '#ffffff'], ['#0a8a43', '#ffffff'], ['#e8484f', '#faf6f3'], ['#ffe600', '#111111'], ['#1f5d4a', '#f8f3e8'], ['#e8590c', '#ffffff']] },
  };
  var params = new URLSearchParams(location.search);
  var state = {};
  Object.keys(AXES).forEach(function (axis) {
    var n = Number(params.get(axis));
    var saved = 1;
    try { saved = Number(localStorage.getItem('ntw-' + axis)) || 1; } catch (e) {}
    state[axis] = n >= 1 && n <= 10 ? n : saved;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    AXES[axis].link = link;
    document.head.appendChild(link);
  });

  var bar = document.createElement('div');
  bar.setAttribute('aria-label', 'Design variations');
  bar.style.cssText = 'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:4px;max-width:calc(100vw - 16px);padding:6px;border-radius:18px;background:rgba(17,17,17,.95);color:#fff;font:600 12.5px/1 Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3);-webkit-font-smoothing:antialiased;';
  var btnCss = 'flex:0 0 auto;min-width:30px;height:30px;padding:0 7px;border:0;border-radius:999px;font:inherit;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px;';
  Object.keys(AXES).forEach(function (axis) {
    var cfg = AXES[axis];
    var row = document.createElement('div');
    row.setAttribute('role', 'toolbar');
    row.setAttribute('aria-label', cfg.label);
    row.style.cssText = 'display:flex;align-items:center;gap:2px;overflow-x:auto;scrollbar-width:none;';
    var title = document.createElement('span');
    title.textContent = cfg.label;
    title.style.cssText = 'flex:0 0 58px;padding-left:8px;color:#9a9a9a;font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;';
    row.appendChild(title);
    var arrow = function (text, delta) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.setAttribute('aria-label', (delta < 0 ? 'Previous ' : 'Next ') + axis);
      b.style.cssText = btnCss + 'background:transparent;color:#fff;';
      b.addEventListener('click', function () { set(axis, ((state[axis] - 1 + delta + 10) % 10) + 1); });
      return b;
    };
    row.appendChild(arrow('‹', -1));
    cfg.buttons = cfg.names.map(function (name, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.title = (i + 1) + ' · ' + name;
      if (cfg.swatch) {
        var dot = document.createElement('span');
        dot.style.cssText = 'width:10px;height:10px;border-radius:50%;background:' + cfg.swatch[i][0] + ';box-shadow:0 0 0 2px ' + cfg.swatch[i][1] + ';';
        b.appendChild(dot);
      }
      b.appendChild(document.createTextNode(String(i + 1)));
      b.addEventListener('click', function () { set(axis, i + 1); });
      row.appendChild(b);
      return b;
    });
    row.appendChild(arrow('›', 1));
    cfg.nameEl = document.createElement('span');
    cfg.nameEl.style.cssText = 'flex:0 0 auto;min-width:104px;padding:0 10px 0 6px;white-space:nowrap;color:#ddd;font-weight:500;';
    row.appendChild(cfg.nameEl);
    bar.appendChild(row);
  });

  function set(axis, n) {
    var cfg = AXES[axis];
    state[axis] = n;
    cfg.link.href = cfg.dir + (n < 10 ? '0' + n : n) + '.css';
    try { localStorage.setItem('ntw-' + axis, String(n)); } catch (e) {}
    var url = new URL(location.href);
    url.searchParams.delete('theme');
    url.searchParams.set('layout', String(state.layout || 1));
    url.searchParams.set('color', String(state.color || 1));
    history.replaceState(null, '', url);
    cfg.buttons.forEach(function (b, i) {
      var on = i + 1 === n;
      b.style.cssText = btnCss + (on ? 'background:#fff;color:#111;' : 'background:transparent;color:#ddd;');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    cfg.nameEl.textContent = n + ' · ' + cfg.names[n - 1];
  }
  set('layout', state.layout);
  set('color', state.color);
  document.body.appendChild(bar);
  document.body.style.paddingBottom = '110px';

  // Keep both choices when following links inside the site.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank') return;
    var u = new URL(a.getAttribute('href'), location.href);
    if (u.origin !== location.origin || (u.hash && u.pathname === location.pathname)) return;
    u.searchParams.set('layout', String(state.layout));
    u.searchParams.set('color', String(state.color));
    a.href = u.pathname + u.search + u.hash;
  }, true);
  // Arrow keys change the layout; with Shift they change the colour.
  document.addEventListener('keydown', function (e) {
    if (/input|textarea|select/i.test(e.target.tagName)) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var axis = e.shiftKey ? 'color' : 'layout';
    var delta = e.key === 'ArrowRight' ? 1 : -1;
    set(axis, ((state[axis] - 1 + delta + 10) % 10) + 1);
  });
})();

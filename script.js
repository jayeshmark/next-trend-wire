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

/* Navigation layer (2026-11-11): site search and the header strip. The
   header, topic pages and /search-index.json come from scripts/build-site.mjs
   at deploy time; without them (the raw source pages) this does nothing. */
(function () {
  // On narrow screens the section strip scrolls sideways: bring the current
  // section into view so the reader can see where they are.
  var current = document.querySelector('.site-nav [aria-current]');
  if (current && current.parentNode.scrollWidth > current.parentNode.clientWidth) {
    current.parentNode.scrollLeft = current.offsetLeft - (current.parentNode.clientWidth - current.offsetWidth) / 2;
  }

  // Phones: slide the header away while scrolling down a story, bring it
  // back on any scroll up, so it never covers more than it has to.
  var hdr = document.querySelector('.site-header');
  if (hdr && window.matchMedia) {
    var narrow = window.matchMedia('(max-width: 760px)'), lastY = window.scrollY, ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        if (!narrow.matches || y < 160 || y < lastY - 4 || document.body.classList.contains('search-locked')) hdr.classList.remove('tucked');
        else if (y > lastY + 4) hdr.classList.add('tucked');
        lastY = y;
        ticking = false;
      });
    }, { passive: true });
  }

  var openers = document.querySelectorAll('.search-open');
  if (!openers.length) return;

  var index = null, loading = null, results = [], active = 0;
  var dialog = document.createElement('div');
  dialog.className = 'search-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Search Next Trend Wire');
  dialog.innerHTML =
    '<div class="search-panel">' +
      '<label class="search-field"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
      '<input type="search" placeholder="Search stories, topics and the archive" autocomplete="off" spellcheck="false" aria-label="Search" aria-controls="search-results">' +
      '<kbd data-close>' + (window.matchMedia('(hover: none)').matches ? 'Close' : 'Esc') + '</kbd></label>' +
      '<div class="search-results" id="search-results" role="listbox"></div>' +
      '<div class="search-hint"><span>&uarr; &darr; to move</span><span>Enter to open</span><span>Esc to close</span></div>' +
    '</div>';
  document.body.appendChild(dialog);
  var input = dialog.querySelector('input');
  var list = dialog.querySelector('.search-results');

  function load() {
    if (index) return Promise.resolve(index);
    if (!loading) loading = fetch('/search-index.json').then(function (r) { return r.json(); }).then(function (j) { index = j; return j; });
    return loading;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fold(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function mark(text, words) {
    var out = esc(text);
    words.forEach(function (w) {
      if (w.length < 2) return;
      out = out.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
    });
    return out;
  }

  function render(q) {
    var words = fold(q).split(/\s+/).filter(Boolean);
    var html = '';
    results = [];
    if (!words.length) {
      html += '<p class="search-group">Topics</p><div class="search-chips topic-chips">' +
        index.topics.map(function (t) { return '<a href="' + t.u + '">' + esc(t.n) + ' <span>' + t.c + '</span></a>'; }).join('') + '</div>';
      html += '<p class="search-group">Latest stories</p>';
      index.posts.slice(0, 6).forEach(function (p) { results.push(p.u); html += row(p.u, p.t, p.c + ' · ' + p.d, []); });
    } else {
      var score = function (hay, title) {
        var s = 0;
        for (var i = 0; i < words.length; i++) {
          var w = words[i];
          if (hay.indexOf(w) === -1) return 0;
          s += title.indexOf(w) !== -1 ? (new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(title) ? 4 : 2) : 1;
        }
        return s;
      };
      var topics = index.topics.filter(function (t) { return score(fold(t.n), fold(t.n)); });
      var posts = index.posts.map(function (p, i) {
        var t = fold(p.t);
        return { p: p, s: score(t + ' ' + fold(p.c) + ' ' + fold(p.s), t), i: i };
      }).filter(function (x) { return x.s; }).sort(function (a, b) { return b.s - a.s || a.i - b.i; }).slice(0, 12);
      var games = index.archive.filter(function (a) { return score(fold(a.t), fold(a.t)); }).slice(0, 5);
      if (topics.length) {
        html += '<p class="search-group">Topics</p>';
        topics.forEach(function (t) { results.push(t.u); html += row(t.u, t.n, t.c + ' stories', words); });
      }
      if (posts.length) {
        html += '<p class="search-group">Stories</p>';
        posts.forEach(function (x) { results.push(x.p.u); html += row(x.p.u, x.p.t, x.p.c + ' · ' + x.p.d + (x.p.m ? ' · ' + x.p.m + ' min' : ''), words); });
      }
      if (games.length) {
        html += '<p class="search-group">Sports archive</p>';
        games.forEach(function (a) { results.push(a.u); html += row(a.u, a.t, 'Archive', words); });
      }
      if (!results.length) html = '<p class="search-empty">Nothing matches &ldquo;' + esc(q) + '&rdquo;. Try a name, a company or a topic.</p>';
    }
    list.innerHTML = html;
    setActive(0);
  }
  function row(u, title, meta, words) {
    return '<a href="' + u + '" role="option"><span class="sr-title">' + mark(title, words) + '</span><span class="sr-meta">' + esc(meta) + '</span></a>';
  }
  function setActive(i) {
    var rows = list.querySelectorAll('a[role="option"]');
    if (!rows.length) return;
    active = (i + rows.length) % rows.length;
    rows.forEach(function (r, j) { r.classList.toggle('active', j === active); r.setAttribute('aria-selected', j === active ? 'true' : 'false'); });
    rows[active].scrollIntoView({ block: 'nearest' });
  }

  var lastFocus = null;
  function open() {
    lastFocus = document.activeElement;
    dialog.classList.add('open');
    document.body.classList.add('search-locked');
    input.value = '';
    list.innerHTML = '<p class="search-empty">Loading&hellip;</p>';
    setTimeout(function () { input.focus(); }, 0);
    load().then(function () { render(input.value); }).catch(function () { list.innerHTML = '<p class="search-empty">Search could not load. Try again in a moment.</p>'; });
  }
  function close() {
    dialog.classList.remove('open');
    document.body.classList.remove('search-locked');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  openers.forEach(function (b) { b.addEventListener('click', open); });
  dialog.addEventListener('click', function (e) { if (e.target === dialog || e.target.closest('[data-close]')) close(); });
  input.addEventListener('input', function () { if (index) render(input.value); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter') {
      var rows = list.querySelectorAll('a[role="option"]');
      if (rows[active]) { e.preventDefault(); window.location.href = rows[active].getAttribute('href'); }
    }
  });
  document.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if (e.key === 'Escape' && dialog.classList.contains('open')) { close(); return; }
    if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
      e.preventDefault();
      if (dialog.classList.contains('open')) close(); else open();
    }
  });
})();

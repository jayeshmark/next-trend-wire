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

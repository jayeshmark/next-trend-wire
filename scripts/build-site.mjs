#!/usr/bin/env node
// Next Trend Wire site build (navigation layer).
//
// The pages in this repo stay exactly as the post pipeline writes them. This
// script runs on every Vercel deploy (vercel.json buildCommand), copies the
// site to dist/ and, on the copy only:
//   - gives every page the same header (topics, search, Archive, Database)
//     and the same sitemap footer, with the current section marked;
//   - adds breadcrumbs, previous/next and "More in <topic>" to every post;
//   - adds "Browse by topic" to the homepage;
//   - writes /topics/ and one page per topic, plus /search-index.json;
//   - adds the topic pages to sitemap.xml;
//   - rebuilds the Archive and Database landing pages from the games, teams,
//     records and players already in the repo (scripts/hubs.mjs).
// Topics come from each post's eyebrow ("Business · November 11, 2026"), so
// a new topic appears on its own the first time a post uses it.
//
// Local preview: node scripts/build-site.mjs && npx serve dist

import fs from 'node:fs';
import path from 'node:path';
import { archiveHub, databaseHub, applyHub, detailContext, detailPage } from './hubs.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.resolve(ROOT, process.argv[2] || 'dist');
const SITE = 'https://next-trend-wire.vercel.app';
const SKIP = new Set(['.git', '.vercel', 'dist', 'node_modules', 'scripts', 'drafts', '.claude']);

// Topics shown in the header, in this order. Every other topic is reachable
// from /topics/, the footer and search.
const PRIMARY = ['Politics', 'Business', 'Technology', 'Sports', 'Culture', 'Health'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = (s) => String(s).replace(/&middot;/g, '·').replace(/&#8599;/g, '↗').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&mdash;/g, '\u2014').replace(/&ndash;/g, '-').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const slugify = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const shortDate = (d) => `${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`;
const longDate = (d) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;

// ── Read the posts ──────────────────────────────────────────────────────────
const homepage = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// The homepage list is newest first, which breaks ties between posts of one day.
const homeOrder = new Map();
for (const m of homepage.matchAll(/href="posts\/([^"#?]+)"/g)) if (!homeOrder.has(m[1])) homeOrder.set(m[1], homeOrder.size);

const posts = [];
for (const file of fs.readdirSync(path.join(ROOT, 'posts'))) {
  if (!file.endsWith('.html')) continue;
  const slug = file.slice(0, -5);
  const html = fs.readFileSync(path.join(ROOT, 'posts', file), 'utf8');
  const title = unesc((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || slug).replace(/<[^>]+>/g, '').trim();
  const eyebrow = unesc((html.match(/<p class="eyebrow">([\s\S]*?)<\/p>/) || [])[1] || '');
  const [rawTopic, rawDate] = eyebrow.split('·').map((s) => s.trim());
  const ld = (html.match(/"datePublished":\s*"(\d{4}-\d{2}-\d{2})/) || [])[1];
  let date = rawDate ? new Date(rawDate + ' UTC') : null;
  if (!date || isNaN(date)) date = ld ? new Date(ld + 'T00:00:00Z') : new Date(0);
  const desc = unesc((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '');
  const img = (html.match(/<img class="article-img" src="([^"]+)"/) || [])[1];
  const alt = unesc((html.match(/<img class="article-img"[^>]*alt="([^"]*)"/) || [])[1] || '');
  const mins = (html.match(/(\d+) min read/) || [])[1];
  const topic = rawTopic || 'News';
  posts.push({
    slug, title, topic, topicSlug: slugify(topic), date, desc, alt, mins: mins ? Number(mins) : null,
    img: img ? '/' + img.replace(/^(\.\.\/)+/, '').replace(/^\//, '') : null,
    url: '/posts/' + slug,
  });
}
posts.sort((a, b) => b.date - a.date || (homeOrder.get(a.slug) ?? 1e9) - (homeOrder.get(b.slug) ?? 1e9) || a.title.localeCompare(b.title));

const topics = new Map();
for (const p of posts) {
  if (!topics.has(p.topicSlug)) topics.set(p.topicSlug, { name: p.topic, slug: p.topicSlug, posts: [] });
  topics.get(p.topicSlug).posts.push(p);
}
const allTopics = [...topics.values()].sort((a, b) => {
  const ia = PRIMARY.indexOf(a.name), ib = PRIMARY.indexOf(b.name);
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  return b.posts.length - a.posts.length || a.name.localeCompare(b.name);
});
const navTopics = allTopics.filter((t) => PRIMARY.includes(t.name));

// Archive games for search.
const archiveEntries = [];
for (const file of fs.readdirSync(path.join(ROOT, 'archive'))) {
  if (!file.endsWith('.html') || file === 'index.html') continue;
  const html = fs.readFileSync(path.join(ROOT, 'archive', file), 'utf8');
  const t = unesc((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || file).replace(/<[^>]+>/g, '').replace(/\s+[\u2014|-]\s+Next Trend Wire.*$/, '').trim();
  archiveEntries.push({ t, u: '/archive/' + file.slice(0, -5) });
}

// ── Shared pieces ───────────────────────────────────────────────────────────
const ICON_SEARCH = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

function header(current, { themeToggle = false, extraClass = '' } = {}) {
  const link = (href, label, key) => `<a href="${href}"${current === key ? ' aria-current="page"' : ''}>${esc(label)}</a>`;
  return `<header class="site-header${extraClass ? ' ' + extraClass : ''}">
    <a class="logo" href="/" aria-label="Next Trend Wire, home">NEXT TREND <b>WIRE</b></a>
    <nav class="site-nav" aria-label="Sections">
      ${link('/', 'Latest', 'latest')}
      ${navTopics.map((t) => link('/topics/' + t.slug, t.name, 'topic:' + t.slug)).join('\n      ')}
      <span class="nav-sep" aria-hidden="true"></span>
      ${link('/archive/', 'Archive', 'archive')}
      ${link('/database/', 'Database', 'database')}
      ${link('/topics/', 'All topics', 'topics')}
    </nav>
    <div class="header-tools">
      <button class="search-open" type="button" aria-label="Search stories" aria-haspopup="dialog">${ICON_SEARCH}<span>Search</span><kbd>/</kbd></button>
      ${themeToggle ? '<button class="theme-toggle" id="theme-toggle" type="button" aria-label="Toggle dark mode">Dark</button>\n      ' : ''}<a class="subscribe" href="/#newsletter">Subscribe <b>&#8599;</b></a>
    </div>
  </header>`;
}

const footer = `<footer class="site-footer">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="logo" href="/">NEXT TREND <b>WIRE</b></a>
        <p>New and noteworthy. The stories people are searching for, explained in a few minutes.</p>
        <button class="search-open footer-search" type="button" aria-haspopup="dialog">${ICON_SEARCH}<span>Search ${posts.length} stories</span></button>
      </div>
      <div>
        <h2>Topics</h2>
        <ul>${allTopics.map((t) => `<li><a href="/topics/${t.slug}">${esc(t.name)}</a> <span>${t.posts.length}</span></li>`).join('')}</ul>
      </div>
      <div>
        <h2>Explore</h2>
        <ul><li><a href="/">Latest stories</a></li><li><a href="/topics/">All topics</a></li><li><a href="/archive/">Sports archive</a></li><li><a href="/database/">NFL database</a></li><li><a href="/feed.xml">RSS feed</a></li></ul>
      </div>
      <div>
        <h2>Next Trend Wire</h2>
        <ul><li><a href="/about">About</a></li><li><a href="/editorial-policy">Editorial policy</a></li><li><a href="/contact">Contact</a></li><li><a href="/#newsletter">Newsletter</a></li></ul>
      </div>
    </div>
    <div class="footer-base"><span>&copy; 2027 Next Trend Wire</span><span>Independent. Curious. Forward.</span></div>
  </footer>`;

const crumbs = (items) => `<nav class="crumbs" aria-label="Breadcrumb">${items.map(([href, label], i) => i === items.length - 1 ? `<span aria-current="page">${esc(label)}</span>` : `<a href="${href}">${esc(label)}</a>`).join('<i aria-hidden="true">/</i>')}</nav>`;
const crumbsLd = (items) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([href, label], i) => ({ '@type': 'ListItem', position: i + 1, name: label, item: SITE + href })) })}</script>`;

const metaLine = (p) => `${shortDate(p.date)}${p.mins ? ` · ${p.mins} min` : ''}`;
const storyCard = (p, { showTopic = true, eager = false } = {}) => `<a class="story-card" href="${p.url}">
        ${p.img ? `<img src="${p.img}" alt="" loading="${eager ? 'eager' : 'lazy'}" decoding="async">` : ''}
        ${showTopic ? `<p class="eyebrow">${esc(p.topic)}</p>` : ''}<h3>${esc(p.title)}</h3><span>${metaLine(p)}</span>
      </a>`;
const topicChips = (current) => `<nav class="topic-chips" aria-label="Topics">${allTopics.map((t) => `<a href="/topics/${t.slug}"${t.slug === current ? ' aria-current="page"' : ''}>${esc(t.name)} <span>${t.posts.length}</span></a>`).join('')}</nav>`;

function dayGroupedList(list) {
  let out = '', day = '';
  for (const p of list) {
    const d = longDate(p.date);
    if (d !== day) { out += `<p class="day">${d}</p>`; day = d; }
    out += `<a href="${p.url}">${esc(p.title)} <span>${p.mins ? p.mins + ' min' : ''}</span></a>`;
  }
  return out;
}

// ── Page rewriting ──────────────────────────────────────────────────────────
function sectionFor(rel) {
  if (rel === 'index.html') return 'latest';
  if (rel.startsWith('archive/')) return 'archive';
  if (rel.startsWith('database/')) return 'database';
  if (rel.startsWith('topics/')) return rel === 'topics/index.html' ? 'topics' : 'topic:' + rel.slice(7, -5);
  if (rel.startsWith('posts/')) { const p = postBySlug.get(rel.slice(6, -5)); return p ? 'topic:' + p.topicSlug : ''; }
  return '';
}

function chrome(html, rel) {
  const hm = html.match(/<header([^>]*)>[\s\S]*?<\/header>/);
  if (hm) {
    const extraClass = /archive-header/.test(hm[1]) ? 'archive-header' : '';
    html = html.replace(hm[0], () => header(sectionFor(rel), { themeToggle: /id="theme-toggle"/.test(hm[0]), extraClass }));
  }
  html = html.replace(/<footer[^>]*>[\s\S]*?<\/footer>/, () => footer);
  return html;
}

const postBySlug = new Map(posts.map((p) => [p.slug, p]));

function enhancePost(html, p) {
  const idx = posts.indexOf(p);
  const newer = posts[idx - 1], older = posts[idx + 1];
  const trail = [['/', 'Home'], ['/topics/' + p.topicSlug, p.topic], [p.url, p.title]];
  // Breadcrumb above the eyebrow, and the eyebrow's topic becomes a link.
  html = html.replace(/<p class="eyebrow">([^<·&]*?)(\s*(?:&middot;|·))/, (m, t, rest) => `${crumbs(trail.slice(0, 2))}\n    <p class="eyebrow"><a href="/topics/${p.topicSlug}">${t.trim()}</a>${rest}`);
  html = html.replace('</head>', () => crumbsLd(trail) + '\n</head>');
  const sameTopic = topics.get(p.topicSlug).posts.filter((q) => q !== p).slice(0, 4);
  const latest = posts.filter((q) => q !== p && !sameTopic.includes(q)).slice(0, 6);
  const block = `<section class="read-next" aria-label="Keep reading">
      <div class="prev-next-stories">
        ${older ? `<a class="pn-prev" href="${older.url}"><span>&larr; Previous story</span><strong>${esc(older.title)}</strong></a>` : '<span></span>'}
        ${newer ? `<a class="pn-next" href="${newer.url}"><span>Next story &rarr;</span><strong>${esc(newer.title)}</strong></a>` : '<span></span>'}
      </div>
      ${sameTopic.length ? `<div class="more-topic">
        <div class="section-head"><h2>More in ${esc(p.topic)}</h2><a href="/topics/${p.topicSlug}">All ${topics.get(p.topicSlug).posts.length} stories &rarr;</a></div>
        <div class="story-grid">${sameTopic.map((q) => storyCard(q, { showTopic: false })).join('')}</div>
      </div>` : ''}
      <div class="latest-mini">
        <div class="section-head"><h2>Latest</h2><a href="/">Front page &rarr;</a></div>
        <div class="mini-list">${latest.map((q) => `<a href="${q.url}"><span class="eyebrow">${esc(q.topic)}</span>${esc(q.title)}</a>`).join('')}</div>
      </div>
      ${topicChips(p.topicSlug)}
    </section>`;
  // Old "back" links are replaced by the block above.
  html = html.replace(/<p class="article-back">[\s\S]*?<\/p>/, '');
  return html.replace(/(<\/div>\s*)(<\/main>)/, (m, a, b) => `${a}${block}\n  ${b}`);
}

function enhanceHome(html) {
  const index = `<section class="topic-index" aria-labelledby="topic-index-h">
        <div class="section-head"><h2 id="topic-index-h">Browse by topic</h2><a href="/topics/">All topics &rarr;</a></div>
        <div class="topic-index-grid">${navTopics.map((t, i) => `<a href="/topics/${t.slug}"><span class="ti-num">${String(i + 1).padStart(2, '0')}</span><span class="ti-name">${esc(t.name)}</span><span class="ti-count">${t.posts.length} stories</span><span class="ti-latest">${esc(t.posts[0].title)}</span></a>`).join('')}</div>
      </section>`;
  // After the four cards, before the running list.
  return html.replace(/(\n\s*)<div class="today-list">/, (m, ws) => `${ws}${index}${ws}<div class="today-list">`);
}

// ── Generated pages ─────────────────────────────────────────────────────────
const template = fs.readFileSync(path.join(ROOT, 'about.html'), 'utf8');
const headStart = template.slice(0, template.indexOf('<title>'));
const headTail = template.slice(template.indexOf('</head>'));
const analytics = (template.match(/<!-- Google tag[\s\S]*?(?=<\/head>)/) || [''])[0];

function page({ title, description, canonical, body, rel, ld = '' }) {
  return `${headStart}<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
${analytics}${ld}
</head>
<body>
<div class="shell">
  ${header(sectionFor(rel))}
  ${body}
  ${footer}
</div>
<div id="toast" role="status" aria-live="polite"></div>
<script src="/script.js"></script>
</body>
</html>
`;
}

function topicPage(t) {
  const [lead, ...rest] = t.posts;
  const top = rest.slice(0, 3);
  const trail = [['/', 'Home'], ['/topics/', 'Topics'], ['/topics/' + t.slug, t.name]];
  const body = `<main class="page topic-page">
    ${crumbs(trail)}
    <div class="topic-head">
      <h1>${esc(t.name)}</h1>
      <p>${t.posts.length} ${t.posts.length === 1 ? 'story' : 'stories'} · latest ${longDate(lead.date)}</p>
    </div>
    ${topicChips(t.slug)}
    <a class="topic-lead" href="${lead.url}">
      ${lead.img ? `<img src="${lead.img}" alt="${esc(lead.alt)}" loading="eager" decoding="async">` : ''}
      <div><span class="topic-lead-meta">${metaLine(lead)}</span><h2>${esc(lead.title)}</h2><p class="dek">${esc(lead.desc)}</p><span class="read">Read the story <b>&#8599;</b></span></div>
    </a>
    ${top.length ? `<div class="story-grid three">${top.map((p) => storyCard(p, { showTopic: false })).join('')}</div>` : ''}
    ${rest.length > 3 ? `<div class="topic-list"><h2>Every ${esc(t.name.toLowerCase())} story</h2>${dayGroupedList(rest.slice(3))}</div>` : ''}
  </main>`;
  return page({
    title: `${t.name} news and explainers | Next Trend Wire`,
    description: `${t.posts.length} ${t.name.toLowerCase()} stories from Next Trend Wire, newest first. Latest: ${lead.title}.`,
    canonical: '/topics/' + t.slug, body, rel: `topics/${t.slug}.html`,
    ld: '\n' + crumbsLd(trail),
  });
}

function topicsIndex() {
  const body = `<main class="page topic-page">
    ${crumbs([['/', 'Home'], ['/topics/', 'Topics']])}
    <div class="topic-head"><h1>All topics</h1><p>${posts.length} stories across ${allTopics.length} topics, plus the sports archive and the NFL database.</p></div>
    <div class="topics-grid">
      ${allTopics.map((t, i) => `<section class="topic-block">
        <a class="tb-head" href="/topics/${t.slug}"><span class="ti-num">${String(i + 1).padStart(2, '0')}</span><h2>${esc(t.name)}</h2><span class="ti-count">${t.posts.length}</span></a>
        <ul>${t.posts.slice(0, 3).map((p) => `<li><a href="${p.url}">${esc(p.title)}</a><span>${shortDate(p.date)}</span></li>`).join('')}</ul>
        <a class="tb-all" href="/topics/${t.slug}">All ${esc(t.name.toLowerCase())} &rarr;</a>
      </section>`).join('\n      ')}
      <section class="topic-block">
        <a class="tb-head" href="/archive/"><span class="ti-num">${String(allTopics.length + 1).padStart(2, '0')}</span><h2>Sports archive</h2><span class="ti-count">${archiveEntries.length}</span></a>
        <ul><li><a href="/archive/">Super Bowls and classic finals, game by game</a></li></ul>
        <a class="tb-all" href="/archive/">Open the archive &rarr;</a>
      </section>
      <section class="topic-block">
        <a class="tb-head" href="/database/"><span class="ti-num">${String(allTopics.length + 2).padStart(2, '0')}</span><h2>NFL database</h2></a>
        <ul><li><a href="/database/">Players, teams and all-time records</a></li></ul>
        <a class="tb-all" href="/database/">Open the database &rarr;</a>
      </section>
    </div>
  </main>`;
  return page({ title: 'All topics | Next Trend Wire', description: `Browse ${posts.length} Next Trend Wire stories by topic: ${allTopics.map((t) => t.name).join(', ')}.`, canonical: '/topics/', body, rel: 'topics/index.html' });
}

// ── Build ───────────────────────────────────────────────────────────────────
const t0 = Date.now();
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const name of fs.readdirSync(ROOT)) {
  if (SKIP.has(name) || /\.(py|md|mjs)$/.test(name) || path.join(ROOT, name) === OUT) continue;
  fs.cpSync(path.join(ROOT, name), path.join(OUT, name), { recursive: true });
}

// Archive and Database landing pages, generated from the source data.
const dbHub = databaseHub(ROOT);
const hubMain = { 'archive/index.html': archiveHub(ROOT), 'database/index.html': dbHub.main };
fs.writeFileSync(path.join(OUT, 'database', 'players.json'), JSON.stringify(dbHub.players));

const detailCtx = detailContext(ROOT);

let rewritten = 0;
(function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) { walk(full); continue; }
    if (!ent.name.endsWith('.html') || !ent.name.length) continue;
    const rel = path.relative(OUT, full).split(path.sep).join('/');
    let html = fs.readFileSync(full, 'utf8');
    if (!/<header|<footer/.test(html)) continue;
    html = chrome(html, rel);
    if (hubMain[rel]) html = applyHub(html, hubMain[rel]);
    else if (rel.startsWith('database/')) html = detailPage(html, rel, detailCtx, ROOT);
    if (rel === 'index.html') html = enhanceHome(html);
    else if (rel.startsWith('posts/') && postBySlug.has(rel.slice(6, -5))) html = enhancePost(html, postBySlug.get(rel.slice(6, -5)));
    fs.writeFileSync(full, html);
    rewritten++;
  }
})(OUT);

fs.mkdirSync(path.join(OUT, 'topics'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'topics', 'index.html'), topicsIndex());
for (const t of allTopics) fs.writeFileSync(path.join(OUT, 'topics', t.slug + '.html'), topicPage(t));

fs.writeFileSync(path.join(OUT, 'search-index.json'), JSON.stringify({
  topics: allTopics.map((t) => ({ n: t.name, u: '/topics/' + t.slug, c: t.posts.length })),
  posts: posts.map((p) => ({ t: p.title, u: p.url, c: p.topic, d: shortDate(p.date), m: p.mins, s: p.desc.slice(0, 220), i: p.img })),
  archive: archiveEntries,
}));

const smPath = path.join(OUT, 'sitemap.xml');
if (fs.existsSync(smPath)) {
  const urls = ['/topics/', ...allTopics.map((t) => '/topics/' + t.slug)].map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${(topics.get(u.slice(8))?.posts[0].date || posts[0].date).toISOString().slice(0, 10)}</lastmod></url>`).join('\n');
  fs.writeFileSync(smPath, fs.readFileSync(smPath, 'utf8').replace('</urlset>', urls + '\n</urlset>'));
}

console.log(`build-site: ${posts.length} posts, ${allTopics.length} topics, ${rewritten} pages rewritten, ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${path.relative(ROOT, OUT) || '.'}`);

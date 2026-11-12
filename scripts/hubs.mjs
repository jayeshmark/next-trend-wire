// Archive and Database landing pages (2026-11-12).
//
// Both pages are generated at build time from what the source already holds,
// so the pipeline that adds games, teams and players keeps writing the plain
// pages it always wrote:
//   - the Archive reads the game cards in archive/index.html plus the facts
//     panel of each game page;
//   - the Database reads the team hubs, the five records pages and the
//     player letter indexes.
// Only <main> is replaced in the built copy. Styles are hubs.css, behaviour
// is hubs.js, and both pages read fine without JavaScript.

import fs from 'node:fs';
import path from 'node:path';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = (s) => String(s).replace(/&middot;/g, '·').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&ndash;/g, '-').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const text = (html) => unesc(String(html).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const num = (n) => Number(n).toLocaleString('en-US');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ICON_SEARCH = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const ARROW = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';

// One colour per club, used as a small marker only. Near-black primaries are
// swapped for the club's second colour so the marker shows in dark mode too.
const NFL_COLORS = {
  ARI: '#97233F', ATL: '#A71930', BAL: '#4B2E9E', BUF: '#00338D', CAR: '#0085CA', CHI: '#C83803', CIN: '#FB4F14', CLE: '#FF3C00',
  DAL: '#1B4AA8', DEN: '#FB4F14', DET: '#0076B6', GB: '#1F6B4C', HOU: '#A71930', IND: '#0B4A9E', JAX: '#006778', KC: '#E31837',
  LA: '#1B4AA8', LAC: '#0080C6', LV: '#A5ACAF', MIA: '#008E97', MIN: '#5B2D91', NE: '#C60C30', NO: '#C8AE7A', NYG: '#1A3A9C',
  NYJ: '#1C6B50', PHI: '#00646E', PIT: '#FFB612', SEA: '#69BE28', SF: '#AA0000', TB: '#D50A0A', TEN: '#4B92DB', WAS: '#8A2B43',
  STL: '#B3995D', SD: '#FFC20E', OAK: '#A5ACAF',
};
const SLUG_COLORS = {
  packers: NFL_COLORS.GB, chiefs: NFL_COLORS.KC, jets: NFL_COLORS.NYJ, colts: NFL_COLORS.IND, giants: NFL_COLORS.NYG, bills: NFL_COLORS.BUF,
  rams: NFL_COLORS.LA, titans: NFL_COLORS.TEN, patriots: NFL_COLORS.NE, eagles: NFL_COLORS.PHI, falcons: NFL_COLORS.ATL, seahawks: NFL_COLORS.SEA,
  '49ers': NFL_COLORS.SF, ravens: NFL_COLORS.BAL, buccaneers: NFL_COLORS.TB, raiders: NFL_COLORS.LV, panthers: NFL_COLORS.CAR, steelers: NFL_COLORS.PIT,
  bears: NFL_COLORS.CHI, cardinals: NFL_COLORS.ARI, saints: NFL_COLORS.NO, broncos: NFL_COLORS.DEN, bengals: NFL_COLORS.CIN, vikings: NFL_COLORS.MIN,
  cowboys: NFL_COLORS.DAL, dolphins: NFL_COLORS.MIA, washington: NFL_COLORS.WAS, chargers: NFL_COLORS.LAC,
  bulls: '#CE1141', jazz: '#7A4BC4', cavaliers: '#9B1B4B', warriors: '#FFC72C',
};
const DIVISIONS = [
  ['AFC', 'East', ['BUF', 'MIA', 'NE', 'NYJ']], ['AFC', 'North', ['BAL', 'CIN', 'CLE', 'PIT']], ['AFC', 'South', ['HOU', 'IND', 'JAX', 'TEN']], ['AFC', 'West', ['DEN', 'KC', 'LV', 'LAC']],
  ['NFC', 'East', ['DAL', 'NYG', 'PHI', 'WAS']], ['NFC', 'North', ['CHI', 'DET', 'GB', 'MIN']], ['NFC', 'South', ['ATL', 'CAR', 'NO', 'TB']], ['NFC', 'West', ['ARI', 'LA', 'SF', 'SEA']],
];
// Clubs that moved: the old city's seasons are part of the same club's run.
const PREDECESSOR = { LA: 'STL', LAC: 'SD', LV: 'OAK' };


// ── Archive ─────────────────────────────────────────────────────────────────
function readGames(ROOT) {
  const index = fs.readFileSync(path.join(ROOT, 'archive', 'index.html'), 'utf8');
  const teamLabels = new Map([...index.matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)].map((m) => [m[1], unesc(m[2])]));
  const games = [];
  const re = /<a class="game-card" href="([^"]+)" data-sport="([^"]+)" data-era="([^"]+)" data-teams="([^"]+)">\s*<h2>([\s\S]*?)<\/h2>\s*<p class="score">([\s\S]*?)<\/p>\s*<p>([\s\S]*?)<\/p>/g;
  for (const m of index.matchAll(re)) {
    const [, slug, sport, era, teamAttr, rawTitle, rawScore, rawMeta] = m;
    const title = text(rawTitle), score = text(rawScore), meta = text(rawMeta);
    const sm = score.match(/^(.+?) (\d+), (.+?) (\d+)(?:,\s*(.+))?$/);
    if (!sm) continue;
    const [label, matchup = ''] = title.split(/:\s+/);
    const full = matchup.split(/\s+vs\.?\s+/);
    const slugs = teamAttr.split(' ');
    const side = (nick) => {
      let i = full.findIndex((f) => f.toLowerCase().includes(nick.toLowerCase()));
      if (i === -1) i = slugs.findIndex((s) => nick.toLowerCase().includes(s));
      return { name: full[i] || nick, nick, color: SLUG_COLORS[slugs[i]] || '#8a8a86' };
    };
    const [dateText, venue = ''] = meta.split('·').map((s) => s.trim());
    const dm = dateText.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})$/);
    const game = {
      slug, sport, era, slugs, title, label,
      win: { ...side(sm[1]), pts: Number(sm[2]) }, lose: { ...side(sm[3]), pts: Number(sm[4]) },
      note: sm[5] || '', dateText, venue,
      year: dm ? Number(dm[3]) : 0,
      time: dm ? Date.UTC(Number(dm[3]), MONTHS.indexOf(dm[1]), Number(dm[2])) : 0,
      shortDate: dm ? `${dm[1].slice(0, 3)} ${dm[2]}, ${dm[3]}` : dateText,
    };
    game.margin = game.win.pts - game.lose.pts;
    game.total = game.win.pts + game.lose.pts;
    const bm = label.match(/^Super Bowl ([IVXLC]+)$/);
    game.kind = bm ? 'Super Bowl' : label.replace(/\s+Game \d+$/, '');
    game.mark = bm ? bm[1] : (label.match(/Game (\d+)$/) ? 'G' + label.match(/Game (\d+)$/)[1] : '');
    const pagePath = path.join(ROOT, 'archive', slug + '.html');
    if (fs.existsSync(pagePath)) {
      const page = fs.readFileSync(pagePath, 'utf8');
      const fact = (...keys) => { for (const k of keys) { const f = page.match(new RegExp(`<dt>${k}</dt>\\s*<dd>([\\s\\S]*?)</dd>`)); if (f) return text(f[1]); } return ''; };
      game.mvp = fact('MVP', 'Finals MVP').split(',')[0].trim();
      game.city = fact('City').split(',')[0].trim();
    }
    games.push(game);
  }
  return { games, teamLabels };
}

function gameCard(g, i) {
  const share = Math.round((g.win.pts / (g.total || 1)) * 100);
  const place = [g.venue, g.city && !g.venue.includes(g.city) ? g.city : ''].filter(Boolean).join(', ');
  const search = [g.title, g.win.name, g.lose.name, g.venue, g.city, g.mvp, g.year, g.dateText].join(' ').toLowerCase();
  return `<a class="g-card" href="/archive/${g.slug}" data-sport="${g.sport}" data-era="${g.era}" data-teams="${esc(g.slugs.join(' '))}" data-time="${g.time}" data-margin="${g.margin}" data-total="${g.total}" data-search="${esc(search)}" style="--c1:${g.win.color};--c2:${g.lose.color};--i:${i}">
          <span class="g-top"><span class="g-label">${esc(g.label)}</span><span class="g-date">${esc(g.shortDate)}</span></span>
          <span class="g-score">
            <span class="g-team win"><i></i><span>${esc(g.win.name)}</span><b>${g.win.pts}</b></span>
            <span class="g-team"><i></i><span>${esc(g.lose.name)}</span><b>${g.lose.pts}</b></span>
          </span>
          <span class="g-bar" aria-hidden="true"><i style="width:${share}%"></i></span>
          <span class="g-foot">
            <span class="g-mvp">${g.mvp ? `<em>MVP</em> ${esc(g.mvp)}` : ''}</span>
            <span class="g-place">${esc(place)}</span>
            <span class="g-margin">${g.note ? esc(g.note.replace(/^in /, '')) + ' · ' : ''}${g.margin === 1 ? '1 point' : g.margin + ' points'}</span>
          </span>
        </a>`;
}

export function archiveHub(ROOT) {
  const { games, teamLabels } = readGames(ROOT);
  const newest = [...games].sort((a, b) => b.time - a.time);
  const bowls = games.filter((g) => g.kind === 'Super Bowl').sort((a, b) => a.time - b.time);
  const eras = [...new Set(games.map((g) => g.era))].sort();
  const sports = [...new Set(games.map((g) => g.sport))];
  const years = games.map((g) => g.year).filter(Boolean);
  const pool = bowls.length ? bowls : games;
  const closest = [...pool].sort((a, b) => a.margin - b.margin || b.time - a.time)[0];
  const widest = [...pool].sort((a, b) => b.margin - a.margin)[0];
  const highest = [...pool].sort((a, b) => b.total - a.total)[0];
  const latest = newest[0];
  const maxMargin = Math.max(...bowls.map((g) => g.margin), 1);
  const oneScore = bowls.filter((g) => g.margin <= 8).length;

  // The margin chart: one bar per Super Bowl, grouped by decade.
  const chart = eras.map((era) => {
    const list = bowls.filter((g) => g.era === era);
    if (!list.length) return '';
    return `<div class="mc-decade" style="--n:${list.length}"><div class="mc-bars">${list.map((g) => `<a class="mc-bar" href="/archive/${g.slug}" style="--h:${Math.max(4, Math.round((g.margin / maxMargin) * 100))}%;--c:${g.win.color}" data-tip="${esc(`${g.label} · ${g.win.nick} ${g.win.pts}, ${g.lose.nick} ${g.lose.pts} · ${g.margin === 1 ? '1 point' : g.margin + ' points'}`)}" aria-label="${esc(`${g.label}, ${g.year}: ${g.win.name} ${g.win.pts}, ${g.lose.name} ${g.lose.pts}`)}"><i></i></a>`).join('')}</div><span>${era}</span></div>`;
  }).join('');

  const highlight = (tag, g, stat) => `<a class="hl" href="/archive/${g.slug}" style="--c1:${g.win.color};--c2:${g.lose.color}">
        <span class="hl-tag">${tag}</span>
        <strong>${esc(g.label)}</strong>
        <span class="hl-score"><i></i>${esc(g.win.nick)} ${g.win.pts}<span>${esc(g.lose.nick)} ${g.lose.pts}</span></span>
        <span class="hl-stat">${stat} · ${g.year}</span>
        <span class="hl-go">${ARROW}</span>
      </a>`;

  const teamCounts = new Map();
  for (const g of games) for (const s of g.slugs) teamCounts.set(s, (teamCounts.get(s) || 0) + 1);
  const teamOptions = [...teamCounts.keys()].map((s) => [s, teamLabels.get(s) || s]).sort((a, b) => a[1].localeCompare(b[1]));
  const sportName = (s) => s.toUpperCase();

  const decades = [...eras].reverse().map((era) => {
    const list = newest.filter((g) => g.era === era);
    return `<section class="decade" data-era="${era}">
        <div class="decade-head"><h2>${era}</h2><p><b>${list.length}</b> ${list.length === 1 ? 'game' : 'games'}</p></div>
        <div class="g-grid">
        ${list.map((g, i) => gameCard(g, i)).join('\n        ')}
        </div>
      </section>`;
  }).join('\n      ');

  return `<main class="page hub hub-archive">
    <section class="hub-hero">
      <div class="hub-hero-bg" aria-hidden="true"></div>
      <p class="eyebrow">The archive</p>
      <h1>Great games. <em>Built to last.</em></h1>
      <p class="lede">Every flagship game, with the story and the box score in one place. Pick a game, a team or a decade.</p>
      <dl class="hub-stats">
        <div><dt>Games</dt><dd data-count="${games.length}">${games.length}</dd></div>
        <div><dt>Super Bowls</dt><dd data-count="${bowls.length}">${bowls.length}</dd></div>
        <div><dt>Seasons covered</dt><dd>${Math.min(...years)} to ${Math.max(...years)}</dd></div>
        <div><dt>Decided by one score</dt><dd data-count="${oneScore}">${oneScore}</dd></div>
      </dl>
      ${bowls.length ? `<div class="mc" id="margin-chart">
        <div class="mc-head"><h2>Every Super Bowl by winning margin</h2><p class="mc-readout" id="mc-readout" aria-live="polite">Taller bar, bigger win. Select a bar to open the game.</p></div>
        <div class="mc-plot">${chart}</div>
      </div>` : ''}
    </section>

    <section class="hl-row" aria-label="Record games">
      ${highlight('Closest finish', closest, closest.margin === 1 ? 'Won by 1 point' : `Won by ${closest.margin} points`)}
      ${highlight('Biggest margin', widest, `Won by ${widest.margin} points`)}
      ${highlight('Highest scoring', highest, `${highest.total} points combined`)}
      ${highlight('Most recent', latest, esc(latest.shortDate.replace(/, \d{4}$/, '')))}
    </section>

    <section class="g-browser" aria-label="All games">
      <div class="g-tools" id="g-tools">
        <div class="g-tools-row">
          <label class="g-search">${ICON_SEARCH}<span class="sr-only">Search games</span><input id="g-q" type="search" placeholder="Search a team, a year, a stadium or an MVP" autocomplete="off" spellcheck="false"></label>
          <div class="seg" role="group" aria-label="Sport">
            <button type="button" data-sport="all" aria-pressed="true">All <span>${games.length}</span></button>
            ${sports.map((s) => `<button type="button" data-sport="${s}" aria-pressed="false">${sportName(s)} <span>${games.filter((g) => g.sport === s).length}</span></button>`).join('')}
          </div>
          <label class="pick"><span class="sr-only">Team</span><select id="g-team" aria-label="Filter by team"><option value="all">Any team</option>${teamOptions.map(([s, label]) => `<option value="${esc(s)}">${esc(label)} (${teamCounts.get(s)})</option>`).join('')}</select></label>
          <label class="pick"><span class="sr-only">Sort</span><select id="g-sort" aria-label="Sort games"><option value="new">Newest first</option><option value="old">Oldest first</option><option value="close">Closest finish</option><option value="wide">Biggest margin</option><option value="high">Highest scoring</option></select></label>
          <div class="seg seg-icons" role="group" aria-label="Layout">
            <button type="button" data-view="grid" aria-pressed="true" aria-label="Cards"><svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg></button>
            <button type="button" data-view="list" aria-pressed="false" aria-label="List"><svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="1" y="2" width="14" height="2.4" rx="1"/><rect x="1" y="6.8" width="14" height="2.4" rx="1"/><rect x="1" y="11.6" width="14" height="2.4" rx="1"/></svg></button>
          </div>
        </div>
        <div class="g-tools-row g-eras">
          <div class="chips" role="group" aria-label="Decade">
            <button type="button" data-era="all" aria-pressed="true">All years</button>
            ${eras.map((e) => `<button type="button" data-era="${e}" aria-pressed="false">${e} <span>${games.filter((g) => g.era === e).length}</span></button>`).join('')}
          </div>
          <p class="g-count"><b id="g-count">${games.length}</b> <span id="g-count-label">games</span> <button type="button" id="g-clear" hidden>Clear filters</button></p>
        </div>
      </div>
      <div id="g-results">
      ${decades}
      <section class="decade g-flat" id="g-flat" hidden><div class="g-grid"></div></section>
      <div class="g-empty" id="g-empty" hidden><strong>No game matches that.</strong><p>Try a team name, a year or a stadium, or clear the filters.</p><button type="button" data-clear>Clear filters</button></div>
      </div>
    </section>
  </main>`;
}

// ── Database ────────────────────────────────────────────────────────────────
function readTeams(ROOT) {
  const dir = path.join(ROOT, 'database', 'teams');
  const hubs = new Map();
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.html') || /-\d{4}\.html$/.test(file)) continue;
    const abbr = file.slice(0, -5);
    const html = fs.readFileSync(path.join(dir, file), 'utf8');
    const name = text((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || abbr);
    const seasons = [];
    for (const m of html.matchAll(/<tr><td><a href="([^"]+)">(\d{4})<\/a><\/td><td>(\d+)-(\d+)(?:-(\d+))?<\/td><td>(\d+)<\/td><td>(\d+)<\/td><td>([^<]*)<\/td>/g)) {
      const finish = text(m[8]);
      seasons.push({
        href: '/database/teams/' + m[1], year: Number(m[2]), w: Number(m[3]), l: Number(m[4]), t: Number(m[5] || 0), pf: Number(m[6]), pa: Number(m[7]), finish,
        level: /^Won Super Bowl/.test(finish) ? 3 : /^Lost Super Bowl/.test(finish) ? 2 : /^Did not/.test(finish) ? 0 : 1,
      });
    }
    hubs.set(abbr, { abbr, name, seasons });
  }
  return hubs;
}

function readRecords(ROOT) {
  const cats = [['passing', 'Passing'], ['rushing', 'Rushing'], ['receiving', 'Receiving'], ['scoring', 'Scoring'], ['defense', 'Defense']];
  const out = [];
  for (const [key, name] of cats) {
    const file = path.join(ROOT, 'database', `records-${key}.html`);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const panels = [];
    for (const sec of html.matchAll(/<h2>([^<]+)<\/h2>([\s\S]*?)<\/table>/g)) {
      const heading = text(sec[1]);
      const mode = /^Single season/i.test(heading) ? 'season' : 'career';
      const stat = heading.replace(/^(Career|Single season)\s+/i, '');
      const rows = [];
      for (const tr of sec[2].matchAll(/<tr>((?:<td>[\s\S]*?<\/td>)+)<\/tr>/g)) {
        const cells = [...tr[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
        const href = (cells[1].match(/href="([^"]+)"/) || [])[1];
        const valueText = text(mode === 'career' ? cells[2] : cells[4]);
        rows.push({
          rank: text(cells[0]), name: text(cells[1]), href: href ? '/database/' + href.replace(/^\.\//, '') : null,
          valueText, value: Number(valueText.replace(/,/g, '')),
          sub: mode === 'career' ? text(cells[3]) : `${text(cells[2])} · ${text(cells[3])}`,
        });
        if (rows.length === 10) break;
      }
      if (rows.length) panels.push({ mode, stat, rows });
    }
    if (panels.length) out.push({ key, name, panels });
  }
  return out;
}

function readPlayers(ROOT) {
  const dir = path.join(ROOT, 'database', 'players');
  const letters = [], players = [];
  for (const file of fs.readdirSync(dir).filter((f) => /^index-.+\.html$/.test(f)).sort()) {
    const html = fs.readFileSync(path.join(dir, file), 'utf8');
    let count = 0;
    for (const m of html.matchAll(/<li><a href="([^"]+)">([^<]+)<\/a>(?: \(([^)]*)\))? <span class="db-years">([^<]*)<\/span><\/li>/g)) {
      const ys = (m[4].match(/\d{4}/g) || []).map(Number);
      players.push([m[1], unesc(m[2]), m[3] || '', ys[0] || 0, ys[ys.length - 1] || 0]);
      count++;
    }
    letters.push({ letter: file.slice(6, -5), count });
  }
  return { letters, players };
}

function teamTile(team, hubs) {
  const old = hubs.get(PREDECESSOR[team.abbr]);
  const seasons = [...(old ? old.seasons : []), ...team.seasons].sort((a, b) => a.year - b.year);
  const sum = (k) => seasons.reduce((n, s) => n + s[k], 0);
  const w = sum('w'), l = sum('l'), t = sum('t');
  const pct = (w + t / 2) / Math.max(1, w + l + t);
  const titles = seasons.filter((s) => s.level === 3).length;
  const trips = seasons.filter((s) => s.level > 0).length;
  const byYear = new Map(seasons.map((s) => [s.year, s]));
  let spark = '';
  for (let y = 1999; y <= 2025; y++) {
    const s = byYear.get(y);
    if (!s) { spark += '<span class="sp-gap"></span>'; continue; }
    const p = (s.w + s.t / 2) / Math.max(1, s.w + s.l + s.t);
    const rec = `${s.w}-${s.l}${s.t ? '-' + s.t : ''}`;
    spark += `<a class="sp l${s.level}" href="${s.href}" style="--h:${Math.round(14 + p * 86)}%" title="${y}: ${rec}. ${esc(s.finish)}" aria-label="${y} season, ${rec}"></a>`;
  }
  return `<article class="tm" data-abbr="${team.abbr}" data-name="${esc(team.name)}" data-pct="${pct.toFixed(4)}" data-titles="${titles}" data-trips="${trips}" data-pf="${sum('pf')}" style="--c:${NFL_COLORS[team.abbr] || '#8a8a86'}">
            <a class="tm-head" href="/database/teams/${team.abbr}"><span class="tm-chip">${team.abbr}</span><span class="tm-name">${esc(team.name)}</span><span class="tm-rank" aria-hidden="true"></span></a>
            <div class="tm-spark">${spark}</div>
            <p class="tm-meta"><span><b>${w}-${l}${t ? '-' + t : ''}</b> ${pct.toFixed(3).replace(/^0/, '')}</span><span>${trips} playoff ${trips === 1 ? 'trip' : 'trips'}</span>${titles ? `<span class="tm-titles" title="Super Bowl wins, 1999 to 2025">${'<i></i>'.repeat(titles)}${titles}</span>` : ''}</p>
            ${old ? `<p class="tm-note">Includes the <a href="/database/teams/${old.abbr}">${esc(old.name)}</a>, ${old.seasons[0].year} to ${old.seasons[old.seasons.length - 1].year}</p>` : ''}
          </article>`;
}

export function databaseHub(ROOT) {
  const hubs = readTeams(ROOT);
  const records = readRecords(ROOT);
  const { letters, players } = readPlayers(ROOT);
  const teamSeasons = [...hubs.values()].reduce((n, h) => n + h.seasons.length, 0);
  const allYears = [...hubs.values()].flatMap((h) => h.seasons.map((s) => s.year));
  const first = Math.min(...allYears), last = Math.max(...allYears);
  const maxLetter = Math.max(...letters.map((l) => l.count), 1);
  const current = DIVISIONS.flatMap((d) => d[2]).filter((a) => hubs.has(a));
  const others = [...hubs.keys()].filter((a) => !current.includes(a) && !Object.values(PREDECESSOR).includes(a));
  const historical = Object.values(PREDECESSOR).filter((a) => hubs.has(a));

  const leaders = records.map((c) => ({ cat: c, row: c.panels[0].rows[0], stat: c.panels[0].stat })).filter((x) => x.row && x.row.href);

  const panel = (cat, p, shown) => {
    const [lead, ...rest] = p.rows;
    const top = lead.value || 1;
    return `<div class="rb-panel" data-cat="${cat.key}" data-mode="${p.mode}" data-stat="${esc(p.stat)}"${shown ? '' : ' hidden'}>
            <a class="rb-lead" href="${lead.href || '/database/records-' + cat.key}">
              <span class="rb-lead-tag">No. 1 · ${p.mode === 'career' ? 'career' : 'single season'} ${esc(p.stat)}</span>
              <strong>${esc(lead.name)}</strong>
              <b>${esc(lead.valueText)}</b>
              <span class="rb-lead-sub">${esc(lead.sub)}</span>
            </a>
            <ol class="rb-list">
              ${rest.map((r) => `<li><a href="${r.href || '/database/records-' + cat.key}"><span class="rb-rank">${esc(r.rank)}</span><span class="rb-name">${esc(r.name)}<small>${esc(r.sub)}</small></span><span class="rb-val">${esc(r.valueText)}</span><i style="width:${Math.max(2, Math.round((r.value / top) * 100))}%"></i></a></li>`).join('\n              ')}
            </ol>
          </div>`;
  };

  const division = ([conf, div, abbrs]) => `<section class="tm-div" data-conf="${conf}">
          <h3><span>${conf}</span> ${div}</h3>
          ${abbrs.filter((a) => hubs.has(a)).map((a) => teamTile(hubs.get(a), hubs)).join('\n          ')}
        </section>`;

  const main = `<main class="page hub hub-db">
    <section class="hub-hero">
      <div class="hub-hero-bg" aria-hidden="true"></div>
      <div class="hero-cols">
        <div>
          <p class="eyebrow">NFL stats database</p>
          <h1>NFL stats, <em>${first} to ${last}.</em></h1>
          <p class="lede">Team seasons, player careers and records in plain tables. No paywall, no ads and no login.</p>
          <div class="db-search" id="db-search" data-src="/database/players.json">
            <label class="db-search-field">${ICON_SEARCH}<span class="sr-only">Search the database</span><input id="db-q" type="search" placeholder="Search ${num(players.length)} players and ${hubs.size} teams" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="db-results" aria-autocomplete="list"><kbd>Enter</kbd></label>
            <div class="db-results" id="db-results" role="listbox" hidden></div>
          </div>
        </div>
        ${leaders.length ? `<aside class="hero-leaders" aria-label="Career leaders">
          <h2>Career leaders <span>${first} to ${last}</span></h2>
          <ol>${leaders.map((x) => `<li><a href="${x.row.href}"><span>${esc(x.stat)}</span><strong>${esc(x.row.name)}</strong><b>${esc(x.row.valueText)}</b></a></li>`).join('')}</ol>
        </aside>` : ''}
      </div>
      <dl class="hub-stats">
        <div><dt>Seasons</dt><dd data-count="${last - first + 1}">${last - first + 1}</dd></div>
        <div><dt>Players</dt><dd data-count="${players.length}">${num(players.length)}</dd></div>
        <div><dt>Team seasons</dt><dd data-count="${teamSeasons}">${num(teamSeasons)}</dd></div>
        <div><dt>Record tables</dt><dd data-count="${records.reduce((n, c) => n + c.panels.length, 0)}">${records.reduce((n, c) => n + c.panels.length, 0)}</dd></div>
      </dl>
      <nav class="hub-jump" aria-label="On this page"><a href="#records">Records</a><a href="#teams">Teams</a><a href="#players">Players</a><a href="#about-data">About the data</a></nav>
    </section>

    <section class="hub-sec rb" id="records">
      <div class="sec-head"><div><p class="eyebrow">Record book</p><h2>Who holds the record</h2></div><p>The top ten for every total in the data, regular season and postseason combined.</p></div>
      <div class="rb-shell">
        <nav class="rb-cats" aria-label="Record category">
          ${records.map((c, i) => `<a href="/database/records-${c.key}" data-cat="${c.key}"${i === 0 ? ' aria-current="true"' : ''}><span>${String(i + 1).padStart(2, '0')}</span>${c.name}</a>`).join('\n          ')}
        </nav>
        <div class="rb-main">
          <div class="rb-controls">
            <div class="seg" role="group" aria-label="Career or single season"><button type="button" data-mode="career" aria-pressed="true">Career</button><button type="button" data-mode="season" aria-pressed="false">Single season</button></div>
            <div class="chips rb-stats" id="rb-stats" role="group" aria-label="Statistic"></div>
          </div>
          ${records.map((c, ci) => c.panels.map((p, pi) => panel(c, p, ci === 0 && pi === 0)).join('\n          ')).join('\n          ')}
          <a class="rb-more" id="rb-more" href="/database/records-${records[0] ? records[0].key : 'passing'}">See the full top 25 <b>&#8599;</b></a>
        </div>
      </div>
    </section>

    <section class="hub-sec tms" id="teams">
      <div class="sec-head"><div><p class="eyebrow">Teams</p><h2>${current.length} teams, season by season</h2></div><p>Each bar is one season, taller for more wins. Select a bar for that season, or a name for the whole run.</p></div>
      <div class="tm-tools">
        <div class="seg" role="group" aria-label="Order teams"><button type="button" data-order="division" aria-pressed="true">By division</button><button type="button" data-order="pct" aria-pressed="false">Best record</button><button type="button" data-order="titles" aria-pressed="false">Most titles</button><button type="button" data-order="trips" aria-pressed="false">Most playoff trips</button></div>
        <ul class="tm-legend" aria-label="Bar colours"><li><i class="l0"></i>Missed the playoffs</li><li><i class="l1"></i>Playoffs</li><li><i class="l2"></i>Lost the Super Bowl</li><li><i class="l3"></i>Won the Super Bowl</li></ul>
      </div>
      <div class="tm-grid" id="tm-grid">
        ${DIVISIONS.map(division).join('\n        ')}
        ${others.length ? `<section class="tm-div"><h3>Other teams</h3>${others.map((a) => teamTile(hubs.get(a), hubs)).join('')}</section>` : ''}
      </div>
      <div class="tm-ranked" id="tm-ranked" hidden></div>
      ${historical.length ? `<p class="tm-hist"><span>Earlier homes</span>${historical.map((a) => { const h = hubs.get(a); return `<a href="/database/teams/${a}">${esc(h.name)} <small>${h.seasons[0].year} to ${h.seasons[h.seasons.length - 1].year}</small></a>`; }).join('')}</p>` : ''}
    </section>

    <section class="hub-sec pl" id="players">
      <div class="sec-head"><div><p class="eyebrow">Players</p><h2>${num(players.length)} players, A to Z</h2></div><p>Listed by surname. Suffixes like Jr. and III are ignored, so Kenneth Walker III is under W.</p></div>
      <div class="lt-grid">
        ${letters.map((l) => `<a class="lt" href="/database/players/index-${l.letter}"${l.count ? '' : ' aria-disabled="true"'}><b>${l.letter}</b><span>${num(l.count)}</span><i style="--h:${Math.round((l.count / maxLetter) * 100)}%"></i></a>`).join('')}
      </div>
    </section>

    <section class="hub-sec about" id="about-data">
      <div class="sec-head"><div><p class="eyebrow">About the data</p><h2>How to read these numbers</h2></div></div>
      <div class="about-grid">
        <div><h3>What is here</h3><p>NFL numbers from the ${first} season through the ${last} season. Team seasons: one page per team, with that team's season by season record. Player careers: one page per player, with that player's totals across the seasons in this data. Records: the top 25 career and single season totals for passing, rushing, receiving, scoring and defense.</p></div>
        <div><h3>How totals work</h3><p>All totals combine the regular season and the postseason. Only totals are shown, so there are no rate stats and no minimum thresholds to argue about. A player's career total is the sum of that player's season totals in this data, ${first} to ${last}.</p></div>
        <div><h3>Source</h3><p>nflverse player stats, ${first} to ${last}, regular season and postseason combined. Figures are presented in this site's own layout. Team records on this page are regular season records.</p><p><a href="/archive/">Looking for a single game? Open the archive <b>&#8599;</b></a></p></div>
      </div>
    </section>
  </main>`;

  return { main, players };
}

// Swap <main>, load hubs.css and hubs.js, and set the theme before first paint.
// The page's own inline script (theme button, old filters) is dropped because
// hubs.js does both jobs.
export function applyHub(html, main) {
  html = html.replace(/<main[^>]*>[\s\S]*?<\/main>/, () => main);
  html = html.replace(/<script>(?:(?!<\/script>)[\s\S])*?ntw-theme[\s\S]*?<\/script>\s*/g, '');
  html = html.replace('</head>', () => `<link rel="stylesheet" href="/hubs.css">
<script>try{document.documentElement.setAttribute('data-theme',localStorage.getItem('ntw-theme')||'light')}catch(e){}</script>
</head>`);
  return html.replace('</body>', () => '<script src="/hubs.js" defer></script>\n</body>');
}


// ── Database detail pages (players, teams, seasons, records, letter lists) ──
// Same idea as the landing pages: the source page is left alone and the built
// copy gets a hero, breadcrumbs and, for players, headline totals and a
// season chart worked out from the page's own tables.
const STAT_NAMES = {
  'Passing|Yds': 'Passing yards', 'Passing|TD': 'Passing touchdowns', 'Passing|INT': 'Interceptions thrown', 'Passing|Comp': 'Completions',
  'Rushing|Yds': 'Rushing yards', 'Rushing|TD': 'Rushing touchdowns', 'Rushing|Att': 'Carries',
  'Receiving|Rec': 'Receptions', 'Receiving|Yds': 'Receiving yards', 'Receiving|TD': 'Receiving touchdowns',
  'Defense|Solo': 'Solo tackles', 'Defense|Sacks': 'Sacks', 'Defense|INT': 'Interceptions', 'Defense|FF': 'Forced fumbles', 'Defense|PD': 'Passes defended',
};
const STAT_ORDER = ['Yds', 'Rec', 'Solo', 'TD', 'Sacks', 'INT', 'FF', 'PD', 'Comp', 'Att'];
const PRIMARY_GROUP = { QB: 'Passing', RB: 'Rushing', FB: 'Rushing', WR: 'Receiving', TE: 'Receiving' };
const crumbTrail = (items) => `<nav class="crumbs" aria-label="Breadcrumb">${items.map(([href, label], i) => i === items.length - 1 ? `<span aria-current="page">${esc(label)}</span>` : `<a href="${href}">${esc(label)}</a>`).join('<i aria-hidden="true">/</i>')}</nav>`;
const toNum = (s) => Number(String(s).replace(/,/g, '')) || 0;

export function detailContext(ROOT) {
  const hubs = readTeams(ROOT);
  const letterOf = new Map();
  const dir = path.join(ROOT, 'database', 'players');
  for (const file of fs.readdirSync(dir).filter((f) => /^index-.+\.html$/.test(f))) {
    const html = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const m of html.matchAll(/<li><a href="([^"]+)">/g)) letterOf.set(m[1], file.slice(6, -5));
  }
  return { abbrByName: new Map([...hubs.values()].map((h) => [h.name, h.abbr])), nameByAbbr: new Map([...hubs.values()].map((h) => [h.abbr, h.name])), letterOf };
}

// Column groups from a two-row table head: [{ group, label }] per column.
function columnsOf(thead) {
  const rows = [...thead.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<th([^>]*)>([\s\S]*?)<\/th>/g)]);
  if (rows.length < 2) return (rows[0] || []).map((c) => ({ group: '', label: text(c[2]) }));
  const subs = rows[1].map((c) => text(c[2]));
  const cols = [];
  for (const c of rows[0]) {
    const span = Number((c[1].match(/colspan="(\d+)"/) || [])[1] || 1);
    if (/rowspan/.test(c[1])) cols.push({ group: '', label: text(c[2]) });
    else for (let i = 0; i < span; i++) cols.push({ group: text(c[2]), label: subs.shift() || '', start: i === 0 });
  }
  return cols;
}

// Dim the zeros and mark where each column group starts.
function dressTable(table) {
  const head = (table.match(/<thead>[\s\S]*?<\/thead>/) || [''])[0];
  const cols = columnsOf(head);
  let out = table.replace(/<tr>((?:\s*<td[\s\S]*?<\/td>)+)\s*<\/tr>/g, (row, cells) => {
    let i = -1;
    return '<tr>' + cells.replace(/<td([^>]*)>([\s\S]*?)<\/td>/g, (m, attrs, inner) => {
      i++;
      const cls = [cols[i] && cols[i].start ? 'gs' : '', /^(0|0\.0)$/.test(inner.trim()) ? 'z' : ''].filter(Boolean).join(' ');
      return `<td${attrs}${cls ? ` class="${cls}"` : ''}>${inner}</td>`;
    }) + '</tr>';
  });
  let g = 0;
  out = out.replace(/<th colspan=/g, () => `<th class="gh${g++ ? ' gs' : ' gs'}" colspan=`);
  let s = -1;
  const subStarts = new Set(cols.filter((c) => c.group).map((c, i) => (c.start ? i : -1)).filter((i) => i >= 0));
  out = out.replace(/(<\/tr>\s*<tr>)([\s\S]*?)(<\/tr>\s*<\/thead>)/, (m, a, mid, z) => a + mid.replace(/<th>/g, () => { s++; return subStarts.has(s) ? '<th class="gs">' : '<th>'; }) + z);
  return { html: out, cols };
}

function playerPage(html, rel, ctx) {
  const id = rel.slice('database/players/'.length, -5);
  const main = (html.match(/<main[^>]*>[\s\S]*?<\/main>/) || [''])[0];
  const name = text((main.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '');
  const fact = (k) => text((main.match(new RegExp(`<dt>${k}</dt>\\s*<dd>([\\s\\S]*?)</dd>`)) || [])[1] || '');
  const pos = fact('Position'), group = fact('Position group'), seasonsText = fact('Seasons'), games = fact('Games');
  const stints = fact('Teams').split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
    const m = s.match(/^(.*?)\s+(\d{4}.*)$/);
    const team = m ? m[1] : s;
    return { team, years: m ? m[2] : '', abbr: ctx.abbrByName.get(team) };
  });
  const tables = [...main.matchAll(/<div class="db-table-wrap"><table class="db-table">[\s\S]*?<\/table><\/div>/g)].map((m) => m[0]);
  if (tables.length < 2 || !name) return null;
  const career = dressTable(tables[0]), seasons = dressTable(tables[1]);
  const cols = career.cols;
  const careerCells = [...(tables[0].match(/<tbody>[\s\S]*?<\/tbody>/) || [''])[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => text(c[1]));

  // Headline totals: the position's own group first, then whatever is biggest.
  const groups = [...new Set(cols.map((c) => c.group).filter(Boolean))];
  const weight = (g) => Math.max(0, ...cols.map((c, i) => (c.group === g ? toNum(careerCells[i]) : 0)));
  const primary = groups.includes(PRIMARY_GROUP[group] || PRIMARY_GROUP[pos]) ? (PRIMARY_GROUP[group] || PRIMARY_GROUP[pos]) : groups.slice().sort((a, b) => weight(b) - weight(a))[0];
  const ordered = [primary, ...groups.filter((g) => g !== primary).sort((a, b) => weight(b) - weight(a))];
  const tiles = [];
  for (const g of ordered) {
    const picks = cols.map((c, i) => ({ ...c, i })).filter((c) => c.group === g && STAT_NAMES[`${g}|${c.label}`] && toNum(careerCells[c.i]) > 0)
      .sort((a, b) => STAT_ORDER.indexOf(a.label) - STAT_ORDER.indexOf(b.label));
    for (const c of picks.slice(0, g === primary ? 3 : 1)) tiles.push({ label: STAT_NAMES[`${g}|${c.label}`], value: careerCells[c.i], i: c.i });
    if (tiles.length >= 4) break;
  }

  // Season chart for the first headline stat.
  let chart = '';
  const lead = tiles[0];
  if (lead) {
    const rows = [...(tables[1].match(/<tbody>[\s\S]*?<\/tbody>/) || [''])[0].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) => {
      const cells = [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
      return { year: text(cells[0]), abbr: text(cells[1]), href: (cells[1].match(/href="([^"]+)"/) || [])[1], value: text(cells[lead.i] || '0') };
    }).filter((r) => /^\d{4}$/.test(r.year));
    const max = Math.max(...rows.map((r) => toNum(r.value)), 1);
    if (rows.length > 1) {
      chart = `<div class="pc"><div class="mc-head"><h2>${esc(lead.label)} by season</h2><p class="mc-readout">Best: ${esc(rows.slice().sort((a, b) => toNum(b.value) - toNum(a.value))[0].value)} in ${rows.slice().sort((a, b) => toNum(b.value) - toNum(a.value))[0].year}</p></div>
        <div class="pc-plot">${rows.map((r) => `<a class="pc-bar${toNum(r.value) === max ? ' top' : ''}" href="${r.href ? '/database/teams/' + r.href.replace(/^.*teams\//, '') : '#'}" style="--h:${Math.max(3, Math.round((Math.max(0, toNum(r.value)) / max) * 100))}%;--c:${NFL_COLORS[r.abbr] || '#8a8a86'}" data-tip="${esc(`${r.year} ${r.abbr}: ${r.value}`)}" aria-label="${esc(`${r.year}, ${r.abbr}: ${r.value} ${lead.label.toLowerCase()}`)}"><i></i><span>${r.year.slice(2)}</span></a>`).join('')}</div>
      </div>`;
    }
  }

  const letter = ctx.letterOf.get(id);
  const trail = [['/database/', 'Database'], ['/database/#players', 'Players'], ...(letter ? [[`/database/players/index-${letter}`, letter]] : []), [`/database/players/${id}`, name]];
  const hero = `<section class="hub-hero d-hero">
      <div class="hub-hero-bg" aria-hidden="true"></div>
      ${crumbTrail(trail)}
      <p class="eyebrow">NFL stats · Player</p>
      <h1>${esc(name)}</h1>
      <p class="d-chips">${pos ? `<span class="d-pos">${esc(pos)}</span>` : ''}${seasonsText ? `<span>${esc(seasonsText)}</span>` : ''}${stints.map((s) => s.abbr ? `<a href="/database/teams/${s.abbr}" style="--c:${NFL_COLORS[s.abbr] || '#8a8a86'}"><i></i>${esc(s.team)} <small>${esc(s.years)}</small></a>` : `<span>${esc(s.team)} <small>${esc(s.years)}</small></span>`).join('')}</p>
      <dl class="hub-stats">
        ${games ? `<div><dt>Games</dt><dd>${esc(games)}</dd></div>` : ''}
        ${tiles.map((t) => `<div><dt>${esc(t.label)}</dt><dd>${esc(t.value)}</dd></div>`).join('\n        ')}
      </dl>
      ${chart}
    </section>`;

  let body = (main.match(/<div class="article-body">[\s\S]*<\/div>\s*(?=<p class="article-back">|<\/main>)/) || [''])[0];
  body = body.replace(tables[0], () => career.html).replace(tables[1], () => seasons.html);
  body = body.replace(/<h2>Newsletter<\/h2>/, '<h2 class="sr-only">Newsletter</h2>');
  // Super Bowl appearances: one card per game with the result.
  body = body.replace(/<li>(<a href="[^"]*archive\/[^"]+">[^<]+<\/a>), ([^<]*?), with the ([^:<]+): ([^<]+?)\.<\/li>/g, (m, link, when, team, score) => {
    const sm = score.match(/^(.+?) (\d+), (.+?) (\d+)$/);
    const won = sm ? (sm[1] === team ? Number(sm[2]) > Number(sm[4]) : Number(sm[4]) > Number(sm[2])) : null;
    return `<li class="sb"><span class="sb-res ${won ? 'w' : 'l'}">${won === null ? '' : won ? 'Won' : 'Lost'}</span><strong>${link}</strong><span class="sb-score">${esc(unesc(score))}</span><small>${esc(unesc(when))} · ${esc(unesc(team))}</small></li>`;
  });
  return html.replace(main, () => `<main class="page db-page hub db-detail db-player">
    ${hero}
    ${body}
  </main>`);
}


// Team season: record and points in the hero, a win/loss strip for every
// game, totals and leaders as cards, the roster as a grid.
function teamSeasonPage(html, rel, ctx, ROOT) {
  const file = rel.split('/').pop().slice(0, -5);
  const [abbr, year] = file.split('-');
  const main = (html.match(/<main[^>]*>[\s\S]*?<\/main>/) || [''])[0];
  const h1 = text((main.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '');
  const fact = (k) => text((main.match(new RegExp(`<dt>${k}</dt>\\s*<dd>([\\s\\S]*?)</dd>`)) || [])[1] || '');
  const record = fact('Regular season record'), pf = fact('Points for'), pa = fact('Points against'), coach = fact('Head coach'), stadium = fact('Home stadium'), finish = fact('Playoff finish');
  if (!h1 || !record) return null;
  const teamName = ctx.nameByAbbr.get(abbr) || abbr;
  const section = (title) => {
    const m = main.match(new RegExp(`<h2>${title}</h2>[\\s\\S]*?(<div class="db-table-wrap">[\\s\\S]*?</table></div>)`));
    if (!m) return null;
    const rows = [...(m[1].match(/<tbody>[\s\S]*?<\/tbody>/) || [''])[0].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]));
    return { wrap: m[1], rows };
  };
  let body = main;

  const totals = section('Team totals');
  if (totals) {
    const groups = new Map();
    for (const [cat, stat, val] of totals.rows) { if (!groups.has(cat)) groups.set(cat, []); groups.get(cat).push([stat, val]); }
    body = body.replace(totals.wrap, () => `<div class="ts-cards">${[...groups].map(([cat, list]) => `<section class="ts-card"><h3>${cat}</h3><dl>${list.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></section>`).join('')}</div>`);
  }
  const leaders = section('Season leaders');
  if (leaders) {
    body = body.replace(leaders.wrap, () => `<div class="ts-leaders">${leaders.rows.map(([cat, player, line]) => `<div class="ts-leader"><span>${cat}</span><strong>${player}</strong><p>${line}</p></div>`).join('')}</div>`);
  }
  const games = section('Game by game results');
  let strip = '';
  if (games) {
    const cells = games.rows.map((r) => r.map(text));
    strip = `<div class="gs-strip"><div class="mc-head"><h2>Every game, in order</h2><p class="mc-readout">${cells.filter((c) => c[5] === 'W').length} wins, ${cells.filter((c) => c[5] === 'L').length} losses${cells.some((c) => c[5] === 'T') ? `, ${cells.filter((c) => c[5] === 'T').length} ties` : ''} including the playoffs</p></div><div class="gs-row">${cells.map((c) => {
      const post = !/^Week/i.test(c[2]);
      const opp = (c[3].match(/\(([A-Z]+)\)/) || [])[1] || c[3];
      return `<span class="gs-g ${c[5] === 'W' ? 'w' : c[5] === 'T' ? 't' : 'l'}${post ? ' post' : ''}" data-tip="${esc(`${c[2]} ${c[4] === 'Away' ? 'at' : 'vs'} ${opp}: ${c[5]} ${c[6]}`)}"><b>${esc(c[5])}</b><small>${esc(opp)}</small></span>`;
    }).join('')}</div></div>`;
    body = body.replace(games.wrap, () => games.wrap.replace(/<td>(W|L|T)<\/td>/g, (m, r) => `<td><span class="res ${r.toLowerCase()}">${r}</span></td>`));
  }
  const roster = section('Roster');
  if (roster) {
    body = body.replace(roster.wrap, () => `<ul class="ts-roster">${roster.rows.map(([player, pos]) => `<li><span>${text(pos)}</span>${player}</li>`).join('')}</ul>`);
  }
  body = body.replace(/<section class="facts"[\s\S]*?<\/section>\s*/, '');

  const y = Number(year);
  const near = (n) => fs.existsSync(path.join(ROOT, 'database', 'teams', `${abbr}-${n}.html`)) ? `<a href="/database/teams/${abbr}-${n}">${n < y ? '&larr; ' : ''}${n}${n > y ? ' &rarr;' : ''}</a>` : '';
  const diff = toNum(pf) - toNum(pa);
  const won = /^Won Super Bowl/.test(finish);
  const hero = `<section class="hub-hero d-hero" style="--c:${NFL_COLORS[abbr] || 'transparent'}">
      <div class="hub-hero-bg" aria-hidden="true"></div>
      ${crumbTrail([['/database/', 'Database'], ['/database/#teams', 'Teams'], [`/database/teams/${abbr}`, teamName], [`/database/teams/${file}`, year]])}
      <p class="eyebrow">NFL database · ${esc(year)} season</p>
      <h1>${esc(h1)}</h1>
      <p class="d-chips"><a href="/database/teams/${abbr}" style="--c:${NFL_COLORS[abbr] || '#8a8a86'}"><i></i>${esc(teamName)} <small>all seasons</small></a>${coach ? `<span><small>Coach</small> ${esc(coach)}</span>` : ''}${stadium ? `<span><small>Home</small> ${esc(stadium)}</span>` : ''}${near(y - 1)}${near(y + 1)}</p>
      <dl class="hub-stats">
        <div><dt>Regular season</dt><dd>${esc(record)}</dd></div>
        <div><dt>Points for</dt><dd>${esc(pf)}</dd></div>
        <div><dt>Points against</dt><dd>${esc(pa)}</dd></div>
        <div><dt>Point difference</dt><dd>${diff > 0 ? '+' : ''}${diff}</dd></div>
        <div class="ts-finish${won ? ' won' : ''}"><dt>Playoffs</dt><dd>${esc(finish)}</dd></div>
      </dl>
      ${strip}
    </section>`;
  body = body.replace(/(<main[^>]*>)[\s\S]*?(?=<div class="article-body">)/, () => `<main class="page db-page hub db-detail db-season">\n    ${hero}\n    `);
  return html.replace(main, () => body);
}

function genericDetail(html, rel, ctx) {
  const file = rel.split('/').pop().slice(0, -5);
  let trail = [['/database/', 'Database']], color = '';
  if (rel.startsWith('database/teams/')) {
    const [abbr, year] = file.split('-');
    color = NFL_COLORS[abbr] || '';
    const teamName = ctx.nameByAbbr.get(abbr) || abbr;
    trail.push(['/database/#teams', 'Teams']);
    if (year) trail.push([`/database/teams/${abbr}`, teamName], [`/database/teams/${file}`, year]);
    else trail.push([`/database/teams/${abbr}`, teamName]);
  } else if (rel.startsWith('database/players/index-')) {
    trail.push(['/database/#players', 'Players'], [`/database/players/${file}`, file.slice(6)]);
  } else if (file.startsWith('records-')) {
    trail.push(['/database/#records', 'Records'], [`/database/${file}`, file.slice(8).replace(/^./, (c) => c.toUpperCase())]);
  } else return null;
  const m = html.match(/(<main[^>]*>)\s*(<p class="eyebrow">[\s\S]*?<\/p>\s*<h1[^>]*>[\s\S]*?<\/h1>)\s*(<p class="(?:article-meta|db-intro)">[\s\S]*?<\/p>)?/);
  if (!m) return null;
  const lede = m[3] ? m[3].replace(/class="(?:article-meta|db-intro)"/, 'class="lede"') : '';
  html = html.replace(m[0], () => `<main class="page db-page hub db-detail">
    <section class="hub-hero d-hero"${color ? ` style="--c:${color}"` : ''}>
      <div class="hub-hero-bg" aria-hidden="true"></div>
      ${crumbTrail(trail)}
      ${m[2]}
      ${lede}
    </section>`);
  // Dim zeros in the tables.
  return html.replace(/<td>(0|0\.0)<\/td>/g, '<td class="z">$1</td>');
}

export function detailPage(html, rel, ctx, ROOT) {
  if (!rel.startsWith('database/') || rel === 'database/index.html') return html;
  const isPlayer = rel.startsWith('database/players/') && !rel.includes('/index-');
  const isSeason = /^database\/teams\/[A-Z]+-\d{4}\.html$/.test(rel);
  const out = isPlayer ? playerPage(html, rel, ctx) : (isSeason && teamSeasonPage(html, rel, ctx, ROOT)) || genericDetail(html, rel, ctx);
  if (!out) return html;
  return out.replace('</head>', () => `<link rel="stylesheet" href="/hubs.css">
<script>try{document.documentElement.setAttribute('data-theme',localStorage.getItem('ntw-theme')||'light')}catch(e){}</script>
</head>`);
}

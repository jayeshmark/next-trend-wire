# Next Trend Wire — UI preview v3.2, Figma Make Modern (production)

Demo preview only. All headlines and buttons are placeholders to review the design.

Design v3.3 copies the Figma Make Modern code: src/App.tsx Modern() structure and src/index.css values. The Homepage direction switcher is NOT included, it is a Figma Make demo control, not part of the site. Tailwind preflight is restored by hand, so buttons have no browser-default borders. Inter is loaded as a variable font so weight 450 renders correctly. No Jobs in Modern. Added, per Jayesh 2026-10-27: a small email signup in the right rail below the sponsor card, with the line "One newsletter per week." only, and the header Subscribe link scrolls to it. Footer year is 2027. Email signup is UI only for now, no backend storage yet.

- Homepage: `index.html`
- Styles: `styles.css`
- Fake interactions: `script.js` (buttons show a "Demo preview" toast)

Live: https://next-trend-wire.vercel.app/

## Navigation layer (2026-11-11)

Vercel runs `node scripts/build-site.mjs` on every deploy and serves `dist/`. The source pages stay exactly as the post pipeline writes them; the build gives every page one header (Latest, the six main topics, Archive, Database, All topics, Search) and one sitemap footer, adds breadcrumbs, previous/next and "More in <topic>" to every post, adds "Browse by topic" to the homepage, and writes `/topics/`, one page per topic, `/search-index.json` and the topic URLs in `sitemap.xml`. Topics come from each post's eyebrow, so a new topic appears the first time a post uses it. Search opens with `/` or Cmd+K. Preview locally: `node scripts/build-site.mjs && npx serve dist`.

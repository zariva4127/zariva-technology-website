# Zariva Technology website

A dynamic company site. All text lives in `data/content.json` and is edited through the admin panel; no code changes needed.

## Run locally
```bash
node server.js            # http://localhost:3000   admin: /admin (default password admin123)
```
No `npm install` is required (zero dependencies, Node 18+).

## Go live checklist
1. **Set environment variables** (see `.env.example`): `NODE_ENV=production`, `ADMIN_PASSWORD`, `SITE_URL`, and optionally `NOTIFY_WEBHOOK_URL` (Slack/Discord/Zapier) for instant lead alerts. In production the server refuses to start without `ADMIN_PASSWORD`.
2. **Host it on a server that keeps files** (a VPS, Render/Railway/Fly with a persistent disk, or Docker with a volume on `/app/data`). Serverless hosts such as Vercel wipe files, so content and messages would need a database first.
3. **Replace placeholder content** in `/admin`: stats, clients, team, testimonials, projects, prices, social links, `company.bookingUrl` (Calendly etc.) and `company.plausibleDomain` (enables Plausible analytics).
4. **Review `/privacy` and `/terms`**. They are templates, not legal advice.
5. Add real photos: set `photo` on team members and `image` on portfolio items (use a URL or a file placed in `public/`).

## What's included
- Content-driven sections, case-study and blog pop-ups, cost estimator, Salesforce section
- Light/dark toggle (dark by default), scroll-spy nav, accessible modal, skip link, form validation
- Site assistant (answers from your own content, no external AI) and WhatsApp button
- SEO: title/description/Open Graph/JSON-LD injected on the server, sitemap.xml, robots.txt
- Security: CSP and security headers, rate limiting, honeypot, login lockout, 12h admin sessions, content backups (last 15 in `data/backups`)
- Gzip + ETag caching, custom 404, CSV export of messages and subscribers

## Free hosting on GitHub Pages (static version)
GitHub Pages cannot run `server.js`, so there is no admin panel or message storage there. Instead:
```bash
node build-static.js https://YOUR-USERNAME.github.io/YOUR-REPO   # regenerates ./docs
```
- Content is edited in `data/content.json`, then re-run the build, commit and push.
- Set `company.formEndpoint` to a Formspree (or Web3Forms) form URL so the contact and newsletter forms email you. Without it the forms open the visitor's email app.
- In the GitHub repo: Settings, Pages, Deploy from a branch, branch `main`, folder `/docs`.

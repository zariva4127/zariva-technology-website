// Zero-dependency server: static files, SEO, JSON content API, admin endpoints.
//
// Environment variables:
//   PORT                 port to listen on (default 3000)
//   ADMIN_PASSWORD       admin panel password (REQUIRED when NODE_ENV=production)
//   SITE_URL             public URL, used in sitemap/canonical tags (e.g. https://zariva.com)
//   NOTIFY_WEBHOOK_URL   optional Slack/Discord/Zapier webhook that is pinged on new messages
//   TRUST_PROXY=1        read the client IP from X-Forwarded-For (set this behind a proxy)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const PORT = process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === 'production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
if (PROD && !process.env.ADMIN_PASSWORD) { console.error('Refusing to start in production without ADMIN_PASSWORD.'); process.exit(1); }
const SITE_URL = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const NOTIFY = process.env.NOTIFY_WEBHOOK_URL;
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

const PUBLIC = path.join(__dirname, 'public');
const DATA = path.join(__dirname, 'data');
const CONTENT_FILE = path.join(DATA, 'content.json');
const MESSAGES_FILE = path.join(DATA, 'messages.json');
const SUBS_FILE = path.join(DATA, 'subscribers.json');
const BACKUPS = path.join(DATA, 'backups');
const PAGES = { '/': 'index.html', '/admin': 'admin.html', '/privacy': 'privacy.html', '/terms': 'terms.html' };
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml' };
const COMPRESSIBLE = /^(text\/|application\/(json|xml)|image\/svg)/;

const CSP_PUBLIC = "default-src 'self'; script-src 'self' https://plausible.io; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://plausible.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
const CSP_ADMIN = CSP_PUBLIC.replace("script-src 'self' https://plausible.io", "script-src 'self' 'unsafe-inline'");

// ---------- helpers ----------
const readJSON = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } };
const writeJSON = (f, d) => { fs.writeFileSync(f + '.tmp', JSON.stringify(d, null, 2)); fs.renameSync(f + '.tmp', f); };
const attr = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const clientIp = (req) => (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';

function respond(req, res, code, body, type, extra = {}) {
  const headers = {
    'Content-Type': type + (/^(text|application\/json)/.test(type) ? '; charset=utf-8' : ''),
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': req.url.startsWith('/admin') ? CSP_ADMIN : CSP_PUBLIC,
    ...extra
  };
  if (!Buffer.isBuffer(body)) body = Buffer.from(body);
  if (COMPRESSIBLE.test(type) && body.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    body = zlib.gzipSync(body); headers['Content-Encoding'] = 'gzip'; headers.Vary = 'Accept-Encoding';
  }
  headers['Content-Length'] = body.length;
  res.writeHead(code, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}
const json = (req, res, code, obj) => respond(req, res, code, JSON.stringify(obj), 'application/json', { 'Cache-Control': 'no-store' });

const readBody = (req) => new Promise((resolve, reject) => {
  let s = '';
  req.on('data', (c) => { s += c; if (s.length > 1e6) { reject(new Error('Request too large')); req.destroy(); } });
  req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new Error('Invalid JSON')); } });
});

// Sliding-window rate limiter (in memory).
const hits = new Map();
const recent = (key, win) => { const now = Date.now(); const a = (hits.get(key) || []).filter((t) => now - t < win); hits.set(key, a); return a; };
const overLimit = (key, max, win) => recent(key, win).length >= max;
const record = (key, win) => recent(key, win).push(Date.now());
setInterval(() => { const now = Date.now(); for (const [k, a] of hits) if (!a.some((t) => now - t < 3600e3)) hits.delete(k); }, 600e3).unref();

// Admin sessions: token -> expiry.
const tokens = new Map();
const TOKEN_TTL = 12 * 3600e3;
const bearer = (req) => (req.headers.authorization || '').replace('Bearer ', '');
const authed = (req) => { const t = bearer(req), exp = tokens.get(t); if (!exp) return false; if (exp < Date.now()) { tokens.delete(t); return false; } return true; };

function notify(text) {
  if (!NOTIFY) return;
  // `text` works for Slack, `content` for Discord.
  fetch(NOTIFY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, content: text }) }).catch((e) => console.error('Webhook failed:', e.message));
}
function backupContent() {
  try {
    fs.mkdirSync(BACKUPS, { recursive: true });
    fs.copyFileSync(CONTENT_FILE, path.join(BACKUPS, `content-${Date.now()}.json`));
    fs.readdirSync(BACKUPS).sort().slice(0, -15).forEach((f) => fs.unlinkSync(path.join(BACKUPS, f)));
  } catch (e) { console.error('Backup failed:', e.message); }
}

// ---------- SEO ----------
function seoTags(c) {
  const co = c.company || {}, desc = (c.hero && c.hero.subtitle) || co.tagline || '';
  const title = `${co.name} | ${co.tagline}`;
  const ld = { '@context': 'https://schema.org', '@type': 'Organization', name: co.name, url: SITE_URL, email: co.email, telephone: co.phone, description: desc, logo: `${SITE_URL}/logo.svg`, address: { '@type': 'PostalAddress', streetAddress: co.address }, sameAs: (co.social || []).map((s) => s.url) };
  return { title, tags: [
    `<meta name="description" content="${attr(desc)}">`,
    `<link rel="canonical" href="${attr(SITE_URL)}/">`,
    `<meta property="og:type" content="website">`, `<meta property="og:site_name" content="${attr(co.name)}">`,
    `<meta property="og:title" content="${attr(title)}">`, `<meta property="og:description" content="${attr(desc)}">`, `<meta property="og:url" content="${attr(SITE_URL)}/">`,
    `<meta name="twitter:card" content="summary">`, `<meta name="twitter:title" content="${attr(title)}">`, `<meta name="twitter:description" content="${attr(desc)}">`,
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`
  ].join('\n') };
}
function renderIndex() {
  let html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  const { title, tags } = seoTags(readJSON(CONTENT_FILE, {}));
  return html.replace(/<title>.*?<\/title>/, `<title>${attr(title)}</title>`).replace('<!--SEO-->', tags);
}

// ---------- API ----------
async function api(req, res, url) {
  const p = url.pathname, ip = clientIp(req);
  if (req.method === 'GET' && p === '/api/content') return json(req, res, 200, readJSON(CONTENT_FILE, {}));
  if (req.method === 'GET' && p === '/api/health') return json(req, res, 200, { ok: true });

  if (req.method === 'POST' && p === '/api/contact') {
    if (overLimit('contact:' + ip, 5, 3600e3)) return json(req, res, 429, { error: 'Too many messages. Please try again later.' });
    const d = await readBody(req);
    if (d.website) return json(req, res, 201, { ok: true }); // honeypot: bots fill hidden fields
    const name = String(d.name || '').trim().slice(0, 100);
    const email = String(d.email || '').trim().slice(0, 150);
    const message = String(d.message || '').trim().slice(0, 3000);
    if (!name) return json(req, res, 400, { error: 'Please enter your name.', field: 'name' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return json(req, res, 400, { error: 'Please enter a valid email address.', field: 'email' });
    if (message.length < 5) return json(req, res, 400, { error: 'Please write a short message.', field: 'message' });
    if (!d.consent) return json(req, res, 400, { error: 'Please accept the Privacy Policy to continue.', field: 'consent' });
    record('contact:' + ip, 3600e3);
    const entry = { id: crypto.randomUUID(), name, email, subject: String(d.subject || '').slice(0, 150), service: String(d.service || '').slice(0, 100), budget: String(d.budget || '').slice(0, 100), message, date: new Date().toISOString() };
    const msgs = readJSON(MESSAGES_FILE, []); msgs.unshift(entry); writeJSON(MESSAGES_FILE, msgs);
    notify(`New website enquiry from ${name} <${email}>${entry.service ? ` about ${entry.service}` : ''}${entry.budget ? ` (budget ${entry.budget})` : ''}:\n${message.slice(0, 500)}`);
    return json(req, res, 201, { ok: true });
  }
  if (req.method === 'POST' && p === '/api/subscribe') {
    if (overLimit('sub:' + ip, 5, 3600e3)) return json(req, res, 429, { error: 'Too many attempts. Please try again later.' });
    const d = await readBody(req);
    if (d.website) return json(req, res, 201, { ok: true });
    const email = String(d.email || '').trim().toLowerCase().slice(0, 150);
    if (!/^\S+@\S+\.\S+$/.test(email)) return json(req, res, 400, { error: 'Please enter a valid email.' });
    record('sub:' + ip, 3600e3);
    const subs = readJSON(SUBS_FILE, []);
    if (!subs.some((x) => x.email === email)) { subs.unshift({ email, date: new Date().toISOString() }); writeJSON(SUBS_FILE, subs); notify(`New newsletter subscriber: ${email}`); }
    return json(req, res, 201, { ok: true });
  }

  if (req.method === 'POST' && p === '/api/admin/login') {
    if (overLimit('login:' + ip, 5, 15 * 60e3)) return json(req, res, 429, { error: 'Too many failed attempts. Try again in 15 minutes.' });
    const d = await readBody(req);
    const a = crypto.createHash('sha256').update(String(d.password || '')).digest(), b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
    if (!crypto.timingSafeEqual(a, b)) { record('login:' + ip, 15 * 60e3); return json(req, res, 401, { error: 'Wrong password' }); }
    const t = crypto.randomBytes(24).toString('hex'); tokens.set(t, Date.now() + TOKEN_TTL);
    return json(req, res, 200, { token: t });
  }
  if (!authed(req)) return json(req, res, 401, { error: 'Unauthorized' });
  if (req.method === 'POST' && p === '/api/admin/logout') { tokens.delete(bearer(req)); return json(req, res, 200, { ok: true }); }
  if (req.method === 'PUT' && p === '/api/content') {
    const d = await readBody(req);
    if (!d || typeof d !== 'object' || Array.isArray(d) || !d.company || !d.hero) return json(req, res, 400, { error: 'Invalid content' });
    backupContent(); writeJSON(CONTENT_FILE, d);
    return json(req, res, 200, { ok: true });
  }
  if (req.method === 'GET' && p === '/api/messages') return json(req, res, 200, readJSON(MESSAGES_FILE, []));
  if (req.method === 'DELETE' && p.startsWith('/api/messages/')) { const id = p.split('/').pop(); writeJSON(MESSAGES_FILE, readJSON(MESSAGES_FILE, []).filter((m) => m.id !== id)); return json(req, res, 200, { ok: true }); }
  if (req.method === 'GET' && p === '/api/subscribers') return json(req, res, 200, readJSON(SUBS_FILE, []));
  if (req.method === 'DELETE' && p.startsWith('/api/subscribers/')) { const e = decodeURIComponent(p.split('/').pop()); writeJSON(SUBS_FILE, readJSON(SUBS_FILE, []).filter((x) => x.email !== e)); return json(req, res, 200, { ok: true }); }
  json(req, res, 404, { error: 'Not found' });
}

// ---------- static ----------
function notFound(req, res) {
  fs.readFile(path.join(PUBLIC, '404.html'), (e, d) => respond(req, res, 404, e ? 'Not found' : d, e ? 'text/plain' : 'text/html'));
}
function serveFile(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return notFound(req, res);
    const etag = `W/"${st.size}-${Math.round(st.mtimeMs)}"`;
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag }); return res.end(); }
    fs.readFile(file, (e, data) => e ? notFound(req, res) : respond(req, res, 200, data, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', { ETag: etag, 'Cache-Control': 'no-cache' }));
  });
}

http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD', 'POST', 'PUT', 'DELETE'].includes(req.method)) return respond(req, res, 405, 'Method not allowed', 'text/plain');
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname === '/robots.txt') return respond(req, res, 200, `User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: ${SITE_URL}/sitemap.xml\n`, 'text/plain');
    if (url.pathname === '/sitemap.xml') {
      const urls = ['/', '/privacy', '/terms'].map((u) => `  <url><loc>${SITE_URL}${u}</loc></url>`).join('\n');
      return respond(req, res, 200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, 'application/xml');
    }
    const clean = url.pathname.length > 1 ? url.pathname.replace(/\/$/, '') : url.pathname;
    if (clean === '/') return respond(req, res, 200, renderIndex(), 'text/html', { 'Cache-Control': 'no-cache' });
    const rel = PAGES[clean] || decodeURIComponent(url.pathname);
    const file = path.join(PUBLIC, rel);
    if (!file.startsWith(PUBLIC + path.sep)) return respond(req, res, 403, 'Forbidden', 'text/plain');
    serveFile(req, res, file);
  } catch (e) { json(req, res, e.message === 'Request too large' ? 413 : 400, { error: e.message }); }
}).listen(PORT, () => {
  console.log(`Zariva site:  http://localhost:${PORT}\nAdmin panel:  http://localhost:${PORT}/admin`);
  if (!process.env.ADMIN_PASSWORD) console.log('WARNING: using default admin password. Set ADMIN_PASSWORD before deploying.');
  if (!NOTIFY) console.log('Tip: set NOTIFY_WEBHOOK_URL to get a Slack/Discord alert for each new enquiry.');
});

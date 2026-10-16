// Builds a static copy of the site into ./docs for GitHub Pages (no server needed).
//   node build-static.js https://yourname.github.io/zariva-site
// Pass the final public URL (used for sitemap, canonical and share tags). Re-run after editing data/content.json.
const fs = require('fs');
const path = require('path');

const SITE_URL = (process.argv[2] || process.env.SITE_URL || 'http://localhost:8080').replace(/\/$/, '');
const PUBLIC = path.join(__dirname, 'public');
const OUT = path.join(__dirname, 'docs');
const content = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'content.json'), 'utf8'));
const attr = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// Make root-absolute URLs relative so the site works from a sub-path like /zariva-site/.
const relativize = (text) => text.replace(/(src|href)="\/(?!\/)([^"]*)"/g, (_, a, p) => {
  if (p === '') return `${a}="./"`;
  if (p === 'privacy' || p === 'terms') return `${a}="${p}.html"`;
  if (p.startsWith('#')) return `${a}="./${p}"`;
  return `${a}="${p}"`;
});

const SKIP = new Set(['admin.html']);
for (const name of fs.readdirSync(PUBLIC)) {
  if (SKIP.has(name)) continue;
  let data = fs.readFileSync(path.join(PUBLIC, name));
  if (/\.(html|js)$/.test(name)) {
    let t = data.toString('utf8');
    t = relativize(t);
    if (name === 'config.js') t = '// Static (GitHub Pages) build: forms go to company.formEndpoint, content comes from content.json.\nwindow.ZARIVA_STATIC = true;\n';
    if (name === 'index.html') {
      const co = content.company, desc = content.hero.subtitle || co.tagline;
      const title = `${co.name} | ${co.tagline}`;
      const ld = { '@context': 'https://schema.org', '@type': 'Organization', name: co.name, url: SITE_URL, email: co.email, telephone: co.phone, description: desc, address: { '@type': 'PostalAddress', streetAddress: co.address }, sameAs: (co.social || []).map((s) => s.url) };
      const tags = [
        `<meta name="description" content="${attr(desc)}">`, `<link rel="canonical" href="${attr(SITE_URL)}/">`,
        `<meta property="og:type" content="website">`, `<meta property="og:site_name" content="${attr(co.name)}">`,
        `<meta property="og:title" content="${attr(title)}">`, `<meta property="og:description" content="${attr(desc)}">`, `<meta property="og:url" content="${attr(SITE_URL)}/">`,
        `<meta name="twitter:card" content="summary">`,
        `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`
      ].join('\n');
      t = t.replace(/<title>.*?<\/title>/, `<title>${attr(title)}</title>`).replace('<!--SEO-->', tags);
    }
    data = Buffer.from(t);
  }
  fs.writeFileSync(path.join(OUT, name), data);
}

fs.copyFileSync(path.join(__dirname, 'data', 'content.json'), path.join(OUT, 'content.json'));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['', 'privacy.html', 'terms.html'].map((u) => `  <url><loc>${SITE_URL}/${u}</loc></url>`).join('\n')}\n</urlset>\n`);
console.log(`Built static site in ./docs for ${SITE_URL}`);
if (!content.company.formEndpoint) console.log('Note: company.formEndpoint is empty, so the contact form will open the visitor\'s email app instead. Set a Formspree/Web3Forms URL in data/content.json for real form submissions.');

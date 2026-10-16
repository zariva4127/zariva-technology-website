// Renders the whole site from /api/content. Edit content in /admin; no code changes needed.
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Only allow safe link targets (blocks javascript: URLs from edited content).
const safeUrl = (u) => (/^(https?:|mailto:|tel:|#|\/)/i.test(u) ? esc(u) : '#');
const initials = (n) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
// Inline SVG icon set (24x24, stroke). Content "icon" fields use these names; anything else renders as plain text/emoji.
const ICONS = {
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  'message-circle': '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  headset: '<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  plug: '<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  smartphone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
  'pen-tool': '<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.6 7.6"/><circle cx="11" cy="11" r="2"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  landmark: '<path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2 20 7H4z"/>',
  'heart-pulse': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
  'shopping-cart': '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  'graduation-cap': '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  factory: '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  'map-pin': '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>',
  github: '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
  x: '<path d="M4 4l16 16M20 4 4 20"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'
};
const ic = (name) => (ICONS[name] ? `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>` : esc(name));
let content;
// Sends a form either to our own API or, on the static (GitHub Pages) build, to the form service set in company.formEndpoint.
async function sendForm(kind, data) {
  if (!window.ZARIVA_STATIC) {
    const r = await fetch('/api/' + kind, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return { ok: r.ok, body: await r.json() };
  }
  const url = content.company.formEndpoint;
  if (!url) { // no form service configured: fall back to the visitor's email app
    const body = Object.entries(data).filter(([k, v]) => v && k !== 'website' && k !== 'consent').map(([k, v]) => `${k}: ${v}`).join('\n');
    location.href = `mailto:${content.company.email}?subject=${encodeURIComponent(kind === 'contact' ? 'Website enquiry' : 'Newsletter signup')}&body=${encodeURIComponent(body)}`;
    return { ok: true, body: {} };
  }
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ ...data, _subject: kind === 'contact' ? 'New website enquiry' : 'New newsletter signup' }) });
  let j = {}; try { j = await r.json(); } catch {}
  return { ok: r.ok, body: { error: j.error || (j.errors && j.errors[0] && j.errors[0].message) } };
}
// Highlights the last three words of the hero title with the animated gradient.
const gradTitle = (t) => { const w = t.trim().split(/\s+/); const k = Math.max(0, w.length - 3); return esc(w.slice(0, k).join(' ')) + ' <span class="grad">' + esc(w.slice(k).join(' ')) + '</span>'; };

function render(c) {
  content = c;
  const co = c.company, h = c.hero;
  document.title = `${co.name} | ${co.tagline}`;
  const [w1, ...wr] = co.name.split(' ');
  $('#logo').innerHTML = `<img src="logo.svg" alt="" width="38" height="38"><span class="wm"><b>${esc(w1)}</b>${wr.length ? `<small>${esc(wr.join(' '))}</small>` : ''}</span>`;
  $('#hero').innerHTML = `<div class="hero-grid"><div class="hero-copy"><span class="eyebrow">${esc(h.eyebrow)}</span><h1>${gradTitle(h.title)}</h1><p class="lead">${esc(h.subtitle)}</p>
    <div class="actions"><a class="btn" href="${safeUrl(h.primaryCta.href)}">${esc(h.primaryCta.label)}</a><a class="btn ghost" href="${safeUrl(h.secondaryCta.href)}">${esc(h.secondaryCta.label)}</a>${co.bookingUrl ? `<a class="btn ghost" href="${safeUrl(co.bookingUrl)}" target="_blank" rel="noopener noreferrer">${ic('calendar')} ${esc(h.bookingLabel || 'Book a free call')}</a>` : ''}</div></div>
    <div class="hero-art" aria-hidden="true"><div class="term"><div class="term-bar"><i></i><i></i><i></i><span>zariva — deploy</span></div><pre class="term-body" id="term"></pre></div>
    ${(h.chips || []).map((x, i) => `<div class="fchip fc${i}">${ic(x.icon)}<span>${esc(x.text)}</span></div>`).join('')}</div></div>`;
  typeTerminal(h.terminal || []);
  $('#stats').innerHTML = c.stats.map((s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join('');
  $('#services-list').innerHTML = c.services.map((s) => `<article class="card"><div class="icon-big">${ic(s.icon)}</div><h3>${esc(s.title)}</h3><p>${esc(s.description)}</p><ul>${(s.features || []).map((f) => `<li>${esc(f)}</li>`).join('')}</ul></article>`).join('');
  $('#about-body').innerHTML = `<div class="two"><div><h2>${esc(c.about.title)}</h2>${c.about.paragraphs.map((p) => `<p class="lead">${esc(p)}</p>`).join('')}</div>
    <div class="grid3" style="margin-top:0;grid-template-columns:1fr 1fr">${c.about.values.map((v) => `<div class="card"><h3>${esc(v.title)}</h3><p>${esc(v.text)}</p></div>`).join('')}</div></div>`;
  $('#process-list').innerHTML = c.process.map((p, i) => `<div class="card"><div class="num">${i + 1}</div><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></div>`).join('');
  const loop = (arr) => [...arr, ...arr].map((t) => `<span class="pill">${esc(t)}</span>`).join('');
  $('#clients').innerHTML = `<div class="track">${loop(c.clients)}</div>`;
  $('#tech').innerHTML = `<div class="track">${loop(c.techStack)}</div>`;
  $('#industry-list').innerHTML = c.industries.map((x) => `<article class="card"><div class="icon-big">${ic(x.icon)}</div><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></article>`).join('');
  $('#pricing-list').innerHTML = c.pricing.map((x) => `<article class="card price ${x.highlight ? 'hot' : ''}">${x.highlight ? '<span class="badge">Most popular</span>' : ''}<h3>${esc(x.name)}</h3><div class="amount">${esc(x.price)}<small> ${esc(x.period)}</small></div><p>${esc(x.description)}</p><ul class="ticks">${x.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul><a class="btn ${x.highlight ? '' : 'ghost'}" href="#contact">${esc(x.cta)}</a></article>`).join('');
  const sf = c.salesforce;
  $('#sf-body').innerHTML = `<span class="eyebrow">${esc(sf.eyebrow)}</span><h2>${esc(sf.title)}</h2><p class="lead">${esc(sf.subtitle)}</p>
    <div class="grid4" id="sf-list">${sf.offerings.map((o) => `<article class="card"><div class="icon-big">${ic(o.icon)}</div><h3>${esc(o.title)}</h3><p>${esc(o.text)}</p></article>`).join('')}</div>
    <div class="sf-more card"><ul class="ticks">${sf.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul><a class="btn" href="${safeUrl(sf.cta.href)}">${esc(sf.cta.label)}</a></div><p class="meta" style="margin-top:16px">${esc(sf.note)}</p>`;
  renderEstimator();
  $('#service-select').innerHTML = '<option value="">Select a service</option>' + c.services.map((x) => `<option>${esc(x.title)}</option>`).join('') + '<option>Something else</option>';
  renderPortfolio('All');
  renderBlog();
  $('#testimonial-list').innerHTML = c.testimonials.map((t) => `<figure class="card" style="margin:0"><blockquote>“${esc(t.quote)}”</blockquote><b>${esc(t.name)}</b><div class="meta">${esc(t.role)}</div></figure>`).join('');
  $('#team-list').innerHTML = c.team.map((m) => `<div class="card">${m.photo ? `<img class="avatar photo" src="${safeUrl(m.photo)}" alt="${esc(m.name)}" loading="lazy" width="84" height="84">` : `<div class="avatar">${esc(initials(m.name))}</div>`}<h3>${esc(m.name)}</h3><div class="meta">${esc(m.role)}</div><p>${esc(m.bio)}</p></div>`).join('');
  $('#careers-list').innerHTML = c.careers.map((j) => `<div class="card job"><div><h3>${esc(j.title)}</h3><p class="meta">${esc(j.location)} · ${esc(j.type)}</p><p>${esc(j.description)}</p></div><a class="btn small" href="mailto:${esc(co.email)}?subject=${encodeURIComponent('Application: ' + j.title)}">Apply</a></div>`).join('');
  $('#faq-list').innerHTML = c.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');
  $('#contact-info').innerHTML = `<li>${ic('mail')}<a href="mailto:${esc(co.email)}">${esc(co.email)}</a></li><li>${ic('phone')}<a href="tel:${esc(co.phone.replace(/[^\d+]/g, ''))}">${esc(co.phone)}</a></li><li>${ic('map-pin')}<span>${esc(co.address)}</span></li><li>${ic('clock')}<span>${esc(co.hours)}</span></li>`;
  $('#social').innerHTML = co.social.map((s) => `<a href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(s.label)}" title="${esc(s.label)}">${ic(ICONS[s.label.toLowerCase()] ? s.label.toLowerCase() : 'globe')}</a>`).join('');
  $('#footer').innerHTML = `<div class="fcol fbrand"><a href="#top" class="logo"><img src="logo.svg" alt="" width="38" height="38"><span class="wm"><b>${esc(w1)}</b>${wr.length ? `<small>${esc(wr.join(' '))}</small>` : ''}</span></a><p>${esc(co.tagline)}</p><div class="social">${$('#social').innerHTML}</div></div>
    <div class="fcol"><h4>Company</h4><a href="#about">About</a><a href="#portfolio">Our work</a><a href="#blog">Insights</a><a href="#team">Team</a><a href="#careers">Careers</a><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms of Service</a></div>
    <div class="fcol"><h4>Services</h4>${c.services.slice(0, 5).map((x) => `<a href="#services">${esc(x.title)}</a>`).join('')}</div>
    <div class="fcol"><h4>Contact</h4><a href="mailto:${esc(co.email)}">${esc(co.email)}</a><a href="tel:${esc(co.phone.replace(/[^\d+]/g, ''))}">${esc(co.phone)}</a><span>${esc(co.address)}</span><span>${esc(co.hours)}</span></div>
    <div class="fbottom"><span>© ${new Date().getFullYear()} ${esc(co.name)}. All rights reserved.</span><span>${esc(c.salesforce.note)}</span></div>`;
  initFx();
  route();
  if (co.plausibleDomain && !document.querySelector('script[data-domain]')) {
    const a = document.createElement('script'); a.defer = true; a.dataset.domain = co.plausibleDomain; a.src = 'https://plausible.io/js/script.js'; document.head.append(a);
  }
  document.dispatchEvent(new Event('content-ready'));
  // Content is rendered after load, so re-apply the URL anchor (e.g. /#pricing) once sections exist.
  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) target.scrollIntoView();
}

// Types the hero terminal line by line (instantly if the visitor prefers reduced motion).
let termTimer;
function typeTerminal(lines) {
  const el = $('#term'); if (!el) return;
  clearTimeout(termTimer);
  const html = (l) => `<span class="${l.startsWith('✔') ? 'ok' : l.startsWith('→') ? 'go' : 'cmd'}">${esc(l)}</span>`;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.innerHTML = lines.map(html).join('\n'); return; }
  let i = 0, j = 0;
  (function step() {
    if (i >= lines.length) { el.innerHTML = lines.map(html).join('\n') + '\n<span class="caret"></span>'; return; }
    const done = lines.slice(0, i).map(html).join('\n');
    const cur = lines[i].slice(0, j);
    el.innerHTML = (done ? done + '\n' : '') + html(cur) + '<span class="caret"></span>';
    if (j < lines[i].length) { j++; termTimer = setTimeout(step, i === 0 ? 55 : 14); }
    else { i++; j = 0; termTimer = setTimeout(step, 420); }
  })();
}

function renderPortfolio(cat) {
  const cats = ['All', ...new Set(content.portfolio.map((p) => p.category))];
  $('#filters').innerHTML = cats.map((k) => `<button class="chip ${k === cat ? 'on' : ''}" data-cat="${esc(k)}">${esc(k)}</button>`).join('');
  $('#portfolio-list').innerHTML = content.portfolio.filter((p) => cat === 'All' || p.category === cat).map((p) =>
    `<article class="card">${p.image ? `<img class="thumb-img" src="${safeUrl(p.image)}" alt="${esc(p.title)} preview" loading="lazy">` : `<div class="thumb" style="background:linear-gradient(135deg,${esc(p.color)},#0f172a)">${esc(p.title)}</div>`}<div class="meta">${esc(p.category)}</div><h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p><div class="tags">${(p.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>${p.caseStudy ? `<a href="#work/${esc(p.id)}" class="more">View case study →</a>` : ''}</article>`).join('');
}

let blogCat = 'All';
function renderBlog() {
  const q = ($('#blog-q').value || '').toLowerCase();
  const cats = ['All', ...new Set(content.blog.map((b) => b.category).filter(Boolean))];
  $('#blog-cats').innerHTML = cats.map((k) => `<button class="chip ${k === blogCat ? 'on' : ''}" data-bcat="${esc(k)}">${esc(k)}</button>`).join('');
  const list = content.blog.filter((b) => (blogCat === 'All' || b.category === blogCat) && (b.title + b.excerpt + b.author).toLowerCase().includes(q));
  $('#blog-list').innerHTML = list.length ? list.map((b) => `<article class="card">${b.category ? `<span class="tag">${esc(b.category)}</span>` : ''}<div class="meta" style="margin-top:8px">${esc(fmtDate(b.date))} · ${esc(b.author)} · ${Math.max(1, Math.round(b.body.join(' ').split(/\s+/).length / 200))} min read</div><h3>${esc(b.title)}</h3><p>${esc(b.excerpt)}</p><a href="#post/${esc(b.id)}" class="more">Read article →</a></article>`).join('') : '<p class="lead">No articles match your search.</p>';
}

function renderEstimator() {
  const e = content.estimator, opts = (a) => a.map((x, i) => `<option value="${i}">${esc(x.label)}</option>`).join('');
  $('#estimator').innerHTML = `<h3>${esc(e.title)}</h3><p>${esc(e.subtitle)}</p><div class="est-grid"><label>Project type<select id="e-s">${opts(e.services)}</select></label><label>Size<select id="e-z">${opts(e.sizes)}</select></label><label>Timeline<select id="e-t">${opts(e.timelines)}</select></label></div>
    <div class="est-out"><div class="amount" id="e-out"></div><small>${esc(e.note)}</small></div><a href="#contact" class="btn" id="e-go">Discuss this estimate</a>`;
  const calc = () => {
    const v = (id, a) => a[$(id).value];
    const base = v('#e-s', e.services).base * v('#e-z', e.sizes).mult * v('#e-t', e.timelines).mult;
    const r = (n) => e.currency + (Math.round(n / 100) * 100).toLocaleString();
    $('#e-out').textContent = `${r(base * 0.85)} – ${r(base * 1.25)}`;
  };
  $('#estimator').oninput = calc; calc();
  $('#e-go').onclick = () => {
    const sel = $('#service-select'), name = e.services[$('#e-s').value].label;
    const hit = [...sel.options].find((o) => name.toLowerCase().split(' ').some((w) => w.length > 3 && o.text.toLowerCase().includes(w)));
    if (hit) sel.value = hit.value;
    $('#form [name=message]').value = `Estimate: ${name}, ${e.sizes[$('#e-z').value].label} size, ${e.timelines[$('#e-t').value].label} timeline (${$('#e-out').textContent}).\n`;
  };
}

let modalOpen = false, lastFocus = null;
// Blog post modal driven by the URL hash (#post/<id>), so posts are linkable.
function route() {
  const w = location.hash.match(/^#work\/(.+)$/);
  const work = w && content.portfolio.find((p) => p.id === decodeURIComponent(w[1]));
  const m = location.hash.match(/^#post\/(.+)$/);
  const post = m && content.blog.find((b) => b.id === decodeURIComponent(m[1]));
  const open = !!(post || work);
  $('#modal').hidden = !open;
  if (open && !modalOpen) { lastFocus = document.activeElement; setTimeout(() => $('#modal-close').focus(), 0); }
  if (!open && modalOpen && lastFocus && lastFocus.focus) lastFocus.focus();
  modalOpen = open;
  if (work) {
    const cs = work.caseStudy || {};
    $('#modal-body').innerHTML = `<div class="thumb" style="background:linear-gradient(135deg,${esc(work.color)},#0f172a)">${esc(work.title)}</div><div class="meta">${esc(work.category)} case study</div><h2>${esc(work.title)}</h2><p>${esc(work.summary)}</p><h3>The challenge</h3><p>${esc(cs.challenge)}</p><h3>Our solution</h3><p>${esc(cs.solution)}</p><h3>Results</h3><ul class="ticks">${(cs.results || []).map((r) => `<li>${esc(r)}</li>`).join('')}</ul><div class="tags">${(work.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div><p style="margin-top:20px"><a class="btn" href="#contact">Start a similar project</a></p>`;
  } else if (post) $('#modal-body').innerHTML = `<div class="meta">${esc(fmtDate(post.date))} · ${esc(post.author)}</div><h2>${esc(post.title)}</h2>${post.body.map((p) => `<p>${esc(p)}</p>`).join('')}`;
}

document.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (chip) renderPortfolio(chip.dataset.cat);
  const bc = e.target.closest('[data-bcat]');
  if (bc) { blogCat = bc.dataset.bcat; renderBlog(); }
  if (e.target.closest('#modal-close') || e.target.id === 'modal' || e.target.closest('.modal a[href="#contact"]')) { const back = location.hash.startsWith('#work') ? '#portfolio' : '#blog'; if (e.target.closest('.modal a[href="#contact"]')) { e.preventDefault(); history.replaceState(null, '', '#contact'); $('#modal').hidden = true; $('#contact').scrollIntoView(); } else location.hash = back; }
  if (e.target.closest('#menu a')) { $('#menu').classList.remove('open'); $('#burger').setAttribute('aria-expanded', 'false'); }
});
document.addEventListener('keydown', (e) => {
  if ($('#modal').hidden) return;
  if (e.key === 'Escape') location.hash = location.hash.startsWith('#work') ? '#portfolio' : '#blog';
  if (e.key === 'Tab') { // keep keyboard focus inside the dialog
    const f = [...$('#modal').querySelectorAll('a[href],button')].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
window.addEventListener('hashchange', () => content && route());
$('#blog-q').addEventListener('input', () => content && renderBlog());
$('#burger').onclick = () => { const o = $('#menu').classList.toggle('open'); $('#burger').setAttribute('aria-expanded', o); };


$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, st = $('#form-status'), btn = f.querySelector('button[type=submit]');
  const fail = (msg, name) => { st.className = 'err'; st.textContent = msg; const el = f.elements[name]; if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); } };
  f.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
  const d = Object.fromEntries(new FormData(f));
  if (!d.name.trim()) return fail('Please enter your name.', 'name');
  if (!/^\S+@\S+\.\S+$/.test(d.email.trim())) return fail('Please enter a valid email address.', 'email');
  if (d.message.trim().length < 5) return fail('Please write a short message.', 'message');
  if (!d.consent) return fail('Please accept the Privacy Policy to continue.', 'consent');
  st.className = ''; st.textContent = 'Sending…'; btn.disabled = true;
  try {
    const { ok, body: j } = await sendForm('contact', d);
    if (!ok) { fail(j.error || 'Something went wrong. Please try again.', j.field); return; }
    st.className = 'ok'; st.textContent = 'Thanks! We\'ll be in touch within one business day.'; f.reset();
  } catch { st.className = 'err'; st.textContent = 'Network error. Please try again or email us directly.'; }
  finally { btn.disabled = false; }
});

$('#news-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const st = $('#news-status');
  try {
    const { ok, body: j } = await sendForm('subscribe', Object.fromEntries(new FormData(e.target)));
    if (!ok) throw new Error(j.error);
    st.className = 'ok'; st.textContent = 'You\'re subscribed. Thank you!'; e.target.reset();
  } catch (err) { st.className = 'err'; st.textContent = err.message || 'Could not subscribe.'; }
});
$('#theme').onclick = () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('theme', t); } catch {}
  document.querySelector('meta[name=theme-color]').content = t === 'dark' ? '#0b1220' : '#eef4fb';
};
// Highlight the nav link of the section currently in view.
{
  const links = [...document.querySelectorAll('#menu a[href^="#"]')];
  const spy = new IntersectionObserver((es) => es.forEach((en) => {
    if (!en.isIntersecting) return;
    links.forEach((a) => { const on = a.getAttribute('href') === '#' + en.target.id; a.classList.toggle('active', on); on ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'); });
  }), { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((a) => { const t = document.querySelector(a.getAttribute('href')); if (t) spy.observe(t); });
}
$('#totop').onclick = () => scrollTo({ top: 0, behavior: 'smooth' });

fetch(window.ZARIVA_STATIC ? 'content.json' : '/api/content').then((r) => r.json()).then(render).catch(() => { $('#hero').innerHTML = '<p class="skeleton">Unable to load content. Please refresh.</p>'; });

// ---- Visual effects: reveal on scroll, animated counters, card spotlight, scroll progress ----
function initFx() {
  if (!$('.grid-bg')) $('.hero').insertAdjacentHTML('afterbegin', '<div class="grid-bg"></div>');
  const els = document.querySelectorAll('section:not(.hero) h2, section:not(.hero) .lead, .stat, #services-list .card, #process-list .card, #team-list .card, #blog-list .card, #testimonial-list .card, #portfolio-list .card, #careers-list .card, #industry-list .card, #sf-list .card, .sf-more, #pricing-list .card, .est, #about-body .card, details, #form');
  els.forEach((el, i) => { el.classList.add('reveal'); el.style.setProperty('--d', (i % 4) * 90 + 'ms'); });
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
    if (e.target.classList.contains('stat')) countUp(e.target.querySelector('b'));
  }), { threshold: 0.15 });
  els.forEach((el) => io.observe(el));
}
function countUp(el) {
  const m = el.textContent.match(/^(\D*)(\d+)(.*)$/);
  if (!m || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const [, pre, num, suf] = m, end = +num, t0 = performance.now();
  (function tick(t) {
    const p = Math.min(1, (t - t0) / 1200);
    el.textContent = pre + Math.round(end * (1 - Math.pow(1 - p, 3))) + suf;
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}
document.addEventListener('mousemove', (e) => {
  const c = e.target.closest && e.target.closest('.card');
  if (!c) return;
  const r = c.getBoundingClientRect();
  c.style.setProperty('--mx', e.clientX - r.left + 'px'); c.style.setProperty('--my', e.clientY - r.top + 'px');
});
const bar = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'progress' }));
addEventListener('scroll', () => {
  const h = document.documentElement;
  bar.style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight || 1)) * 100 + '%';
  $('#nav').classList.toggle('scrolled', h.scrollTop > 10);
  $('#totop').hidden = h.scrollTop < 600;
}, { passive: true });

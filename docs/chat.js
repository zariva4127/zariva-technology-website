// Site assistant: answers visitor questions from the site's own content (FAQ, services, pricing...).
// It runs entirely in the browser: no external AI service or API key is involved.
document.addEventListener('content-ready', () => {
  if ($('#chat-btn')) return;
  const c = content, co = c.company, wa = co.phone.replace(/\D/g, '');
  const waLink = `https://wa.me/${wa}?text=${encodeURIComponent(`Hi ${co.name}, I'd like to know more about your services.`)}`;
  document.body.insertAdjacentHTML('beforeend', `
    <a class="wa" href="${waLink}" target="_blank" rel="noopener noreferrer" aria-label="Chat with us on WhatsApp">${ic('phone')}<span>WhatsApp</span></a>
    <button id="chat-btn" class="chat-btn" aria-label="Open chat assistant" aria-expanded="false" aria-controls="chat">${ic('message-circle')}</button>
    <section id="chat" class="chat" hidden aria-label="Chat assistant">
      <header><b>Ask ${esc(co.name.split(' ')[0])}</b><button class="icon" id="chat-x" aria-label="Close chat">✕</button></header>
      <div id="chat-log" class="chat-log" role="log" aria-live="polite"></div>
      <div id="chat-quick" class="chat-quick"></div>
      <form id="chat-form"><input id="chat-in" placeholder="Type your question…" autocomplete="off" maxlength="200" aria-label="Your question"><button class="btn small" aria-label="Send">${ic('send')}</button></form>
    </section>`);

  const log = $('#chat-log'), input = $('#chat-in');
  const add = (who, text, actions = []) => {
    const m = document.createElement('div'); m.className = 'msg-' + who;
    const p = document.createElement('p'); p.textContent = text; m.append(p);
    actions.forEach((a) => { const l = document.createElement('a'); l.className = 'chat-act'; l.textContent = a.label; l.href = a.href; if (a.ext) { l.target = '_blank'; l.rel = 'noopener noreferrer'; } m.append(l); });
    log.append(m); log.scrollTop = log.scrollHeight;
  };
  const kb = () => [
    ...c.faq.map((f) => ({ k: f.q + ' ' + f.a, a: f.a })),
    ...c.services.map((s) => ({ k: s.title + ' ' + s.description + ' ' + (s.features || []).join(' '), a: `${s.title}: ${s.description}` })),
    ...c.salesforce.offerings.map((o) => ({ k: 'salesforce ' + o.title + ' ' + o.text, a: `${o.title}: ${o.text}` })),
    ...c.industries.map((i) => ({ k: 'industry ' + i.title + ' ' + i.text, a: `${i.title}: ${i.text}` })),
    ...c.careers.map((j) => ({ k: 'job jobs career careers hiring ' + j.title + ' ' + j.location, a: `We're hiring: ${j.title} (${j.location}, ${j.type}). Email ${co.email} to apply.` }))
  ];
  const STOP = new Set('the and for you your are with what how can does about have our any this that from will who why when where tell'.split(' '));
  const contactActions = [{ label: 'Email us', href: 'mailto:' + co.email }, { label: 'WhatsApp', href: waLink, ext: true }, { label: 'Contact form', href: '#contact' }];

  function answer(q) {
    const t = q.toLowerCase();
    if (/^(hi|hello|hey|namaste)\b/.test(t)) return [`Hi! I can tell you about ${co.name}'s services, pricing and more. What would you like to know?`];
    if (/price|pricing|cost|charge|fee|rate|quote|budget|afford|expensive|cheap|how much|plan/.test(t))
      return [c.pricing.map((p) => `${p.name}: ${p.price} ${p.period}`).join(' • ') + '. Use the estimator on the Pricing section for a quick range.', [{ label: 'See pricing', href: '#pricing' }]];
    if (/contact|email|phone|call|reach|address|location|hours|office|talk|human/.test(t))
      return [`Email: ${co.email}\nPhone: ${co.phone}\nAddress: ${co.address}\nHours: ${co.hours}`, contactActions];
    if (/^(services?|what do you do)\b/.test(t)) return ['We offer: ' + c.services.map((s) => s.title).join(', ') + '.', [{ label: 'View services', href: '#services' }]];
    const words = t.split(/\W+/).filter((w) => w.length > 2 && !STOP.has(w));
    let best = null, top = 0;
    for (const e of kb()) {
      const k = e.k.toLowerCase();
      const score = words.reduce((n, w) => n + (k.includes(w) ? 1 : 0), 0);
      if (score > top) { top = score; best = e; }
    }
    if (best && top >= 1) return [best.a];
    return ["I'm not sure about that one, but our team can help directly.", contactActions];
  }
  function ask(q) {
    q = q.trim(); if (!q) return;
    add('me', q);
    const [text, actions] = answer(q);
    setTimeout(() => add('bot', text, actions || []), 350);
  }
  const quick = ['Services', 'Pricing', 'Salesforce', 'Careers', 'Contact'];
  $('#chat-quick').innerHTML = quick.map((x) => `<button type="button" class="chip">${x}</button>`).join('');
  $('#chat-quick').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) ask(b.textContent); });
  $('#chat-form').addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); input.value = ''; });

  const panel = $('#chat'), btn = $('#chat-btn');
  const toggle = (open) => {
    panel.hidden = !open; btn.setAttribute('aria-expanded', open); btn.classList.toggle('on', open);
    if (open) { if (!log.children.length) add('bot', `Hi! I'm the ${co.name} assistant. Ask me about our services, pricing or Salesforce work.`); input.focus(); }
    else btn.focus();
  };
  btn.onclick = () => toggle(panel.hidden);
  $('#chat-x').onclick = () => toggle(false);
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
  panel.addEventListener('click', (e) => { if (e.target.closest('a[href^="#"]')) toggle(false); });
});

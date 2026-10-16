// Fills company details into the legal pages from the same content the main site uses.
document.getElementById('d').textContent = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
fetch(window.ZARIVA_STATIC ? 'content.json' : '/api/content').then((r) => r.json()).then((c) => {
  const co = c.company;
  document.querySelectorAll('[data-co]').forEach((el) => {
    const k = el.dataset.co;
    if (k === 'mail') { el.textContent = co.email; el.href = 'mailto:' + co.email; }
    else el.textContent = co[k] || '';
  });
  document.title += ' | ' + co.name;
}).catch(() => {});

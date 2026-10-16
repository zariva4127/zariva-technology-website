// Hero-only "neural network" background: drifting nodes linked by lines.
// Nodes connect to the cursor and to each other; click to spawn a burst of new nodes.
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0';
  hero.prepend(cv);
  const ctx = cv.getContext('2d');
  const LINK = 140, MAX_EXTRA = 24;
  let W, H, nodes = [], extra = [], mouse = { x: -999, y: -999 }, last = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const col = (k) => (k ? '125,211,252' : '56,189,248');
  const node = (x = rnd(0, W), y = rnd(0, H), burst = false) => {
    const a = rnd(0, 6.283), s = burst ? rnd(40, 90) : rnd(8, 26);
    return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rnd(1.4, 2.8), k: Math.random() < .5, life: burst ? 1 : Infinity };
  };
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = hero.clientWidth; H = hero.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(90, Math.max(28, W * H / 16000)));
    while (nodes.length < n) nodes.push(node());
    nodes.length = Math.min(nodes.length, n);
  }
  function draw(t) {
    const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
    if (!visible) return requestAnimationFrame(draw);
    ctx.clearRect(0, 0, W, H);
    extra = extra.filter((n) => (n.life -= dt * .35) > 0);
    const all = nodes.concat(extra);
    for (const n of all) {
      n.x += n.vx * dt; n.y += n.vy * dt;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
      if (n.life !== Infinity) { n.vx *= .985; n.vy *= .985; }
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < LINK) {
          ctx.strokeStyle = `rgba(${col(a.k)},${(1 - d / LINK) * .4})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      const dm = Math.hypot(a.x - mouse.x, a.y - mouse.y);
      if (dm < 190) {
        ctx.strokeStyle = `rgba(186,230,253,${(1 - dm / 190) * .55})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        a.x += (mouse.x - a.x) * dt * .25; a.y += (mouse.y - a.y) * dt * .25;
      }
    }
    for (const n of all) {
      const al = n.life === Infinity ? .7 : n.life * .8;
      ctx.fillStyle = `rgba(${col(n.k)},${al})`;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 6.283); ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  addEventListener('resize', resize);
  new ResizeObserver(resize).observe(hero);
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);
  const pos = (e) => { const r = hero.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  hero.addEventListener('mousemove', (e) => { [mouse.x, mouse.y] = pos(e); }, { passive: true });
  hero.addEventListener('mouseleave', () => { mouse.x = mouse.y = -999; });
  hero.addEventListener('click', (e) => {
    const [x, y] = pos(e);
    for (let i = 0; i < 8 && extra.length < MAX_EXTRA; i++) extra.push(node(x, y, true));
  });
  resize(); requestAnimationFrame(draw);
})();

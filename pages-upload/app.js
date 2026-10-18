/* =========== MORPH / PURE MUSCLE — site scripts ===========
   Two animated components, each in its own file:
     hero    → liquid-sculpture-hero.js  (WebGL2 particle sculpture)
     feature → image-stream-hero.js      (image corridor) + hero-images.js
   ========================================================= */

/* the liquid sculpture publishes window.LiquidSculptureHero */
const { clamp, mountSculptureHero } = window.LiquidSculptureHero || {};

/* ═══════════ HERO — liquid sculpture ═══════════ */
(function () {
  const hero = document.getElementById('hero');
  if (!hero || !mountSculptureHero) return;
  /* restStyle 'particles' + ambient: the sculpture stays a living particle
     field at rest instead of settling into the flat image; the cursor
     turns it liquid. With no WebGL2 the fallback image shows instead. */
  mountSculptureHero(hero, {
    restStyle: 'particles',
    ambient: true,
    ambientIntensity: 1.1,
    intro: true,
    interactive: true,
  });
})();

/* ═══════════ MARQUEE — gradient wave background ═══════════ */
(function () {
  const waveBox = document.getElementById('marqueeWave');
  if (waveBox && window.GradientWaveMarquee) {
    /* the component's own shipped palette (sky blue + white), unchanged */
    window.GradientWaveMarquee.mount(waveBox, {
      colors: ['#f9b8d4', '#ffffff', '#ffd9b8', '#ff9a80'],
    });
  }
})();

/* ═══════════ STATS — grid pulse field ═══════════ */
(function () {
  const pulseBox = document.getElementById('statsPulse');
  if (pulseBox && window.GridPulse) {
    window.GridPulse.mount(pulseBox, { cell: 24 });   // keep in step with --grid-pulse-cell in styles.css
  }
})();

/* ═══════════ CTA — 3D testimonials layer ═══════════ */
(function () {
  const t3d = document.getElementById('cta3d');
  if (t3d && window.TestimonialMarquee) window.TestimonialMarquee.mount(t3d);
})();

/* ═══════════ FEATURE — image stream corridor ═══════════ */(function () {
  const root = document.getElementById('featureStream');
  const Hero = window.ImageStreamHero;
  if (!root || !Hero) return;

  Hero.mount(root, {
    images: window.HERO_IMAGES || [],

    /* corridor geometry — see image-stream-hero.js for what each one does.
       The section is a wide frame (like the hero), so the corridor is back
       to its natural proportions: it spans the full width and fills the
       upper part of the section, with the copy in the band below it.
       Keep two invariants when retuning:
         (railExit - cardWidth/2) * exitHeight/cardHeight > 50   -- a card
            must leave the frame before it ends, or it pops out in view;
         exitHeight/birthHeight spread over `cards`             -- adjacent
            cards must stay overlapped, or the ribbon tears open. */
    cards: 9,        // cards per rail — less crowded, so each image reads.
                     // A new image enters every `speed / cards` seconds (~2.7s)
    speed: 24,       // seconds for one card to cross the whole corridor
    axis: 36,        // corridor axis, % of the section height
    path: {
      birthHeight: 3,
      exitHeight: 66,
      railExit: 38,
      cardWidth: 24,   // 12:9 cards (4:3) — smaller panels, so more of the
      cardHeight: 18,  // page colour shows between them
      fan: 3.3
    }
  });
})();

/* ═══════════ BACKGROUND — gym-equipment line art ═══════════ */
(function () {
  if (window.GymBackground) window.GymBackground.mount();
})();

/* ═══════════ SCROLL-DRIVEN STICKY SECTIONS ═══════════ */
(function () {
  const pinnedSections = document.querySelectorAll('.pinned-section');
  function getScrollProgress(section) {
    const rect = section.getBoundingClientRect();
    const scrollable = section.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return 0;
    return clamp(-rect.top / scrollable, 0, 1);
  }

  const productsSection = document.getElementById('products');
  const productCards = productsSection ? productsSection.querySelectorAll('[data-card]') : [];
  function updateProducts(progress) {
    const n = productCards.length;
    productCards.forEach((card, i) => {
      const start = (i / n) * 0.7, end = start + 0.3;
      const p = clamp((progress - start) / (end - start), 0, 1);
      card.classList.toggle('visible', p > 0.15);
      const ease = 1 - Math.pow(1 - p, 3);
      card.style.opacity = ease;
      card.style.transform = `translateY(${(1 - ease) * 60}px) scale(${0.96 + ease * 0.04})`;
    });
  }

  const statsSection = document.getElementById('stats');
  const statNums = statsSection ? statsSection.querySelectorAll('.stat-num') : [];
  let statsStarted = false;
  function updateStats(progress) {
    if (progress < 0.15) return;
    if (!statsStarted) {
      statsStarted = true;
      statNums.forEach(el => {
        const target = parseInt(el.parentElement.dataset.count, 10) || 0;
        const suffix = el.parentElement.dataset.suffix || '';
        const dur = 1200, start = performance.now();
        function tick(now) {
          const t = clamp((now - start) / dur, 0, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          el.textContent = Math.round(ease * target) + suffix;
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    }
  }

  /* the corridor drifts while the feature section is pinned */
  const featureStream = document.getElementById('featureStream');
  function updateFeature(progress) {
    if (!featureStream) return;
    const y = (progress - 0.5) * -46;
    featureStream.style.transform = `translateY(${y}px)`;
  }

  const quoteSection = document.querySelector('.quote-sticky');
  const quoteText = quoteSection ? quoteSection.querySelector('.quote-text') : null;
  const quoteAttr = quoteSection ? quoteSection.querySelector('.quote-attr') : null;
  function updateQuote(progress) {
    const p = clamp((progress - 0.3) / 0.4, 0, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    if (quoteText) { quoteText.style.opacity = ease; quoteText.style.transform = `translateY(${(1 - ease) * 40}px)`; }
    if (quoteAttr) { const p2 = clamp((progress - 0.6) / 0.3, 0, 1); quoteAttr.style.opacity = 1 - Math.pow(1 - p2, 3); }
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      pinnedSections.forEach(section => {
        const progress = getScrollProgress(section);
        if (section.id === 'products') updateProducts(progress);
        else if (section.id === 'stats') updateStats(progress);
        else if (section.id === 'feature') updateFeature(progress);
        else updateQuote(progress);
      });
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ═══════════ BOXES BACKGROUND — quote section ═══════════ */
(function () {
  const layer = document.getElementById('boxesLayer');
  if (!layer) return;

  const ROWS = 46, COLS = 28;
  const COLORS = [
    "rgb(125 211 252)", "rgb(249 168 212)", "rgb(134 239 172)",
    "rgb(253 224 71)", "rgb(252 165 165)", "rgb(216 180 254)",
    "rgb(147 197 253)", "rgb(165 180 253)", "rgb(196 181 253)"
  ];
  const SVGNS = 'http://www.w3.org/2000/svg';

  const frag = document.createDocumentFragment();
  for (let i = 0; i < ROWS; i++) {
    const row = document.createElement('div');
    row.className = 'boxes-row';
    for (let j = 0; j < COLS; j++) {
      const cell = document.createElement('div');
      cell.className = 'boxes-cell';
      if (i % 2 === 0 && j % 2 === 0) {
        const svg = document.createElementNS(SVGNS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '1');
        svg.setAttribute('class', 'boxes-plus');
        const path = document.createElementNS(SVGNS, 'path');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('d', 'M12 6v12m6-6H6');
        svg.appendChild(path);
        cell.appendChild(svg);
      }
      row.appendChild(cell);
    }
    frag.appendChild(row);
  }
  layer.appendChild(frag);

  let last = null;
  layer.addEventListener('pointerover', e => {
    const cell = e.target.closest ? e.target.closest('.boxes-cell') : null;
    if (!cell || cell === last) return;
    last = cell;
    cell.style.transition = 'none';
    cell.style.backgroundColor = COLORS[(Math.random() * COLORS.length) | 0];
  }, { passive: true });
  layer.addEventListener('pointerout', e => {
    const cell = e.target.closest ? e.target.closest('.boxes-cell') : null;
    if (!cell) return;
    cell.style.transition = 'background-color 2s ease';
    cell.style.backgroundColor = '';
    if (last === cell) last = null;
  }, { passive: true });
})();

/* ═══════════ WIRING MOVED OUT OF THE MARKUP ═══════════ */
(function () {
  const credit = document.querySelector('.hero-credit');
  if (credit) credit.addEventListener('click', function (e) { e.preventDefault(); });

  const form = document.querySelector('.cta-form');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    const btn = form.querySelector('button');
    if (btn) btn.textContent = 'Subscribed ✓';
  });
})();

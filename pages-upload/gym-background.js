/* =========== MORPH / PURE MUSCLE — gym-equipment background ===========
   Dumbbells, hex dumbbells, a barbell, a kettlebell, a weight plate, a
   shaker, a jump rope and a pull-up bar, drawn as dark-pink line art and
   scattered behind the page.

   The arrangement is deliberately "disturbed" rather than sequenced:
   there is no row, no repeating order and no grid. Each drawing gets its
   own jittered position, size, angle, stroke weight, ink tone, opacity
   and mirroring, and the vertical step itself varies, so nothing lines
   up. A fixed seed keeps the scatter identical between reloads (no
   re-shuffling flicker on refresh).

   Publishes window.GymBackground = { mount }.
   ======================================================================= */
(function () {
  'use strict';

  /* nominal vertical step between scatter positions, in px */
  const STRIDE = 260;
  const MIN_SIZE = 68;
  const MAX_SIZE = 210;

  /* one ink scale, all of it dark pink, so the art matches the theme */
  const INKS = ['#b2406b', '#a83460', '#9c2f57', '#c2567f', '#b03e68'];

  /* mulberry32 — deterministic PRNG, so the background never re-shuffles */
  function makeRandom(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── the equipment: strokes only, each inside a 0 0 100 100 box ── */
  const SHAPES = [
    /* dumbbell — two plates per side */
    '<path d="M32 50h36"/>' +
    '<rect x="17" y="31" width="13" height="38" rx="5"/>' +
    '<rect x="27" y="37" width="7" height="26" rx="3"/>' +
    '<rect x="70" y="31" width="13" height="38" rx="5"/>' +
    '<rect x="66" y="37" width="7" height="26" rx="3"/>',

    /* hex dumbbell — rubber heads */
    '<path d="M38 50h24"/>' +
    '<path d="M20 31l13-5 8 13v22l-8 13-13-5z"/>' +
    '<path d="M80 31l-13-5-8 13v22l8 13 13-5z"/>',

    /* barbell — long bar, plates and collars */
    '<path d="M6 50h88"/>' +
    '<rect x="14" y="33" width="8" height="34" rx="3"/>' +
    '<rect x="23" y="26" width="9" height="48" rx="3"/>' +
    '<rect x="33" y="44" width="6" height="12" rx="2"/>' +
    '<rect x="78" y="33" width="8" height="34" rx="3"/>' +
    '<rect x="68" y="26" width="9" height="48" rx="3"/>' +
    '<rect x="61" y="44" width="6" height="12" rx="2"/>',

    /* kettlebell — handle over the bell */
    '<path d="M29 43c0-22 42-22 42 0"/>' +
    '<circle cx="50" cy="60" r="21"/>',

    /* weight plate — hub and four grip holes */
    '<circle cx="50" cy="50" r="36"/>' +
    '<circle cx="50" cy="50" r="10"/>' +
    '<circle cx="50" cy="26" r="3"/>' +
    '<circle cx="50" cy="74" r="3"/>' +
    '<circle cx="26" cy="50" r="3"/>' +
    '<circle cx="74" cy="50" r="3"/>',

    /* shaker bottle — body, screw lid and cap */
    '<rect x="35" y="32" width="30" height="54" rx="9"/>' +
    '<rect x="33" y="20" width="34" height="13" rx="5"/>' +
    '<rect x="44" y="11" width="12" height="9" rx="3"/>' +
    '<path d="M38 56h24"/>',

    /* jump rope — the loop with both handles */
    '<path d="M22 40c2 34 54 34 56 0"/>' +
    '<rect x="14" y="14" width="11" height="28" rx="5"/>' +
    '<rect x="75" y="14" width="11" height="28" rx="5"/>',

    /* pull-up bar — bar, posts and feet */
    '<path d="M12 22h76"/>' +
    '<path d="M25 22v68"/>' +
    '<path d="M75 22v68"/>' +
    '<path d="M18 90h14"/>' +
    '<path d="M68 90h14"/>'
  ];

  /* pick order — dumbbells lead (they are the headline piece), the rest of
     the equipment fills in around them */
  const POOL = [0, 0, 0, 1, 1, 1, 2, 3, 4, 5, 6, 7];

  function drawing(shape, x, y, size, rot, weight, ink, opacity, flip) {
    return '<svg viewBox="0 0 100 100" fill="none" stroke="' + ink + '"' +
      ' stroke-width="' + weight.toFixed(2) + '" stroke-linecap="round" stroke-linejoin="round"' +
      ' style="left:' + x.toFixed(2) + '%;top:' + Math.round(y) + 'px;' +
      'width:' + Math.round(size) + 'px;height:' + Math.round(size) + 'px;' +
      'opacity:' + opacity.toFixed(3) + ';' +
      'transform:translate(-50%,-50%) rotate(' + rot.toFixed(1) + 'deg)' +
      (flip ? ' scaleX(-1)' : '') + '">' + shape + '</svg>';
  }

  let watching = false;

  function mount() {
    const layer = document.getElementById('gymBg');
    if (!layer) return;

    const r = makeRandom(20241231);

    const docH = Math.max(
      document.documentElement.scrollHeight,
      document.body ? document.body.scrollHeight : 0,
      window.innerHeight
    );

    /* ranges where the art must not show: the opening screen (the hero), and
       the two opaque dark bands, where it would be hidden anyway */
    const blocked = [];
    ['#hero', '.stats-sticky', '.quote-sticky'].forEach(function (sel) {
      const el = document.querySelector(sel);
      if (!el) return;
      const host = el.closest('.pinned-section') || el;
      const top = host.getBoundingClientRect().top + window.scrollY;
      blocked.push([top - 40, top + host.offsetHeight + 40]);
    });
    function hidden(y) {
      for (let i = 0; i < blocked.length; i++) {
        if (y > blocked[i][0] && y < blocked[i][1]) return true;
      }
      return false;
    }

    const parts = [];
    let y = 120;
    while (y < docH - 30) {
      /* one or two pieces this step, each confined to its own loose band
         and then jittered inside it — coverage without a visible row */
      const count = r() < 0.72 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const band = 100 / count;
        const x = band * i + band * (0.18 + r() * 0.64);
        const yy = Math.max(70, y + (r() - 0.5) * STRIDE * 0.8);
        if (hidden(yy)) continue;
        parts.push(drawing(
          SHAPES[POOL[(r() * POOL.length) | 0]],
          x + (r() - 0.5) * 6,
          yy,
          MIN_SIZE + r() * (MAX_SIZE - MIN_SIZE),
          (r() - 0.5) * 74,
          1.7 + r() * 1.9,
          INKS[(r() * INKS.length) | 0],
          0.12 + r() * 0.21,
          r() < 0.34
        ));
      }
      y += STRIDE * (0.62 + r() * 0.86);   /* the step itself varies too */
    }

    layer.style.height = docH + 'px';
    layer.innerHTML = parts.join('');

    /* the page gets taller/shorter when the layout reflows: redraw, but
       only listen once so repeated mounts cannot stack listeners */
    if (!watching) {
      watching = true;
      let timer = 0;
      let lastH = docH;
      window.addEventListener('resize', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          const h = document.documentElement.scrollHeight;
          if (Math.abs(h - lastH) > 60) {
            lastH = h;
            mount();
          }
        }, 250);
      });
    }
  }

  window.GymBackground = { mount: mount };
})();

/* ═══════════════════════════════════════════════════════════════════════
   image-stream-hero.js
   Vanilla port of components/ui/image-stream-hero.tsx
   (React/TS component -> plain classic script, no toolchain required)

   ── the corridor ─────────────────────────────────────────────────────
   Two rails of cards ride from far behind the screen toward the viewer.
   Perspective alone does the work that looks like two animations: as a
   card's z grows it gets bigger *and* its screen x sweeps outward from
   the vanishing point, because the projection scales position and size
   by the same factor.

   Three things shape it, and each one fixes a specific artefact:

   1. Depth is authored as *apparent size*, geometrically - each card is a
      constant ratio bigger than the one behind it, all the way out.
      Spacing a straight z-range evenly instead makes the near cards tear
      apart from each other as the projection blows up.
   2. The rails open hard in the first stretch and then hold (`fan` > 1).
      That opening cancels the - still slow - growth back there, so the
      ribbon leaves the centre as a flat band, bends once, and only then
      runs out on the diagonal. Parallel rails project to a straight cone
      with no bend at all.
   3. Neither end of the loop is ever on screen. A card dies with its inner
      edge past 50cqw, clear of the container's edge. And it is born
      *across* the axis - `railBirth` is negative, so the newest card starts
      on the far side and sweeps back through the centre. That plugs the
      throat: the axis stays covered at every instant, and a newborn lands
      behind cards that already cover it, so it needs no fade in. Birthing
      on its own side instead leaves a hole at dead centre that blinks open
      once every cycle.

   Every length is in `cqw` - a percentage of the container's width - so
   the whole corridor keeps its proportions at any size. The defaults were
   fitted numerically against a reference recording's card-height and
   edge-position profile, not eyeballed.

   Usage
     ImageStreamHero.mount(document.getElementById('heroStream'), {
       images: [{ src, alt }], cards: 9, speed: 18, axis: 55, path: {}
     })
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /**
   * Geometry of the corridor. Every length is `cqw`, a percentage of the
   * container's width, so the shape is resolution-independent.
   *
   * These interact: the ribbon only stays solid while consecutive cards
   * overlap, which needs `exitHeight / birthHeight` spread over enough
   * `cards`. Raising `exitHeight`, dropping `cards`, or pulling `railExit`
   * in all push toward a visible tear near the frame edge.
   */
  var PATH = {
    perspective: 30,   /* strength of the projection. Lower is a wider-angle rush */
    cardWidth: 18,     /* card width in world units */
    cardHeight: 25,    /* card height in world units */
    cardRadius: 0.4,   /* corner radius applied to each card */
    birthHeight: 2.6,  /* on-screen card height at the waist, where a card is born */
    exitHeight: 46,    /* on-screen card height as a card leaves the frame */
    railBirth: -11,    /* lateral offset at birth (negative: starts across the axis) */
    railExit: 44,      /* lateral offset once the rails have finished opening */
    fan: 3.3,          /* how front-loaded the opening is. >1 opens early then holds */
    turnBirth: 6,      /* Y-rotation at birth, degrees */
    turnExit: 28,      /* Y-rotation at exit, degrees */
    stops: 24          /* keyframe stops used to trace the curve */
  };

  /* Sample the path once so the CSS keyframes trace the real curve. */
  function keyframes(dir, name, p) {
    var steps = [];
    for (var s = 0; s <= p.stops; s++) {
      var u = s / p.stops;
      /* Geometric in apparent size, so consecutive cards keep a constant
         size ratio and the ribbon stays solid at both ends. */
      var scale = (p.birthHeight / p.cardHeight) * Math.pow(p.exitHeight / p.birthHeight, u);
      var z = p.perspective * (1 - 1 / scale);
      var rail = p.railExit - (p.railExit - p.railBirth) * Math.pow(1 - u, p.fan);
      var turn = p.turnBirth + (p.turnExit - p.turnBirth) * u;
      steps.push(
        (u * 100).toFixed(2) + '%{transform:translate3d(' + (dir * rail).toFixed(2) +
        'cqw,0,' + z.toFixed(2) + 'cqw) rotateY(' + (-dir * turn).toFixed(2) + 'deg)}'
      );
    }
    return '@keyframes ' + name + '{' + steps.join('') + '}';
  }

  var uid = 0;

  /**
   * Build the corridor inside `root`.
   *
   * @param {HTMLElement} root  container (also the `cqw` container)
   * @param {object} [opts]
   * @param {Array<{src:string, alt?:string}>} opts.images  cycled onto the rails
   * @param {number} [opts.cards=9]   cards on each rail at once
   * @param {number} [opts.speed=18]  seconds for one card to travel the corridor
   * @param {number} [opts.axis=55]   vertical placement of the axis, % of height
   * @param {object} [opts.path]      overrides merged over PATH
   * @returns {{root:HTMLElement, cards:HTMLElement[], setImages:Function, destroy:Function}}
   */
  function mount(root, opts) {
    opts = opts || {};
    var p = Object.assign({}, PATH, opts.path || {});
    var images = (opts.images || []).slice();
    var count = Math.max(1, opts.cards == null ? 9 : opts.cards);
    var speed = opts.speed == null ? 18 : opts.speed;
    var axis = opts.axis == null ? 55 : opts.axis;

    var id = 'ish' + (++uid) + Math.random().toString(36).slice(2, 6);
    var right = 'ish-r-' + id;
    var left = 'ish-l-' + id;
    var cardClass = 'ish-c-' + id;

    /* Pausing rather than disabling keeps the corridor whole: every card is
       already dropped mid-flight by its negative delay, so it freezes as a
       finished still instead of collapsing onto the axis. */
    var style = document.createElement('style');
    style.textContent =
      keyframes(1, right, p) + keyframes(-1, left, p) +
      '@media(prefers-reduced-motion:reduce){.' + cardClass + '{animation-play-state:paused}}';

    var layer = document.createElement('div');
    layer.className = 'stream-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.perspective = p.perspective + 'cqw';
    layer.style.perspectiveOrigin = '50% ' + axis + '%';

    var inner = document.createElement('div');
    inner.className = 'stream-inner';

    var nodes = [right, left].map(function (name) {
      var rail = [];
      for (var i = 0; i < count; i++) {
        /* Both rails walk the same sequence, so the left side mirrors the
           right at every depth. */
        var img = images.length ? images[i % images.length] : null;
        var el = document.createElement('div');
        el.className = cardClass + ' stream-card';
        el.style.left = '50%';
        el.style.top = axis + '%';
        el.style.width = p.cardWidth + 'cqw';
        el.style.height = p.cardHeight + 'cqw';
        el.style.marginLeft = (-p.cardWidth / 2) + 'cqw';
        el.style.marginTop = (-p.cardHeight / 2) + 'cqw';
        el.style.borderRadius = p.cardRadius + 'cqw';
        el.style.animation = name + ' ' + speed + 's linear infinite';
        /* Negative delay drops each card mid-flight, so the corridor is
           already full on the first frame. */
        el.style.animationDelay = (-(i * speed) / count) + 's';
        el.style.backfaceVisibility = 'hidden';
        if (img) {
          var im = document.createElement('img');
          im.src = img.src;
          im.alt = img.alt || '';
          im.loading = 'lazy';
          im.decoding = 'async';
          im.draggable = false;
          im.className = 'stream-img';
          el.appendChild(im);
        }
        inner.appendChild(el);
        rail.push(el);
      }
      return rail;
    });
    var cards = nodes[0].concat(nodes[1]);

    layer.appendChild(inner);
    root.appendChild(style);
    root.appendChild(layer);

    return {
      root: root,
      cards: cards,
      /* swap the imagery without rebuilding the corridor */
      setImages: function (list) {
        images = (list || []).slice();
        cards.forEach(function (el, i) {
          var img = images.length ? images[i % images.length] : null;
          var im = el.querySelector('img');
          if (!img) { if (im) im.remove(); return; }
          if (!im) {
            im = document.createElement('img');
            im.loading = 'lazy';
            im.decoding = 'async';
            im.draggable = false;
            im.className = 'stream-img';
            el.appendChild(im);
          }
          if (im.getAttribute('src') !== img.src) im.setAttribute('src', img.src);
          im.alt = img.alt || '';
        });
      },
      destroy: function () {
        style.remove();
        layer.remove();
      }
    };
  }

  global.ImageStreamHero = { PATH: PATH, keyframes: keyframes, mount: mount };
})(window);

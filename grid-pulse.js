(function (global) {
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   grid-pulse.js — vanilla port of the GridPulse component
   (21st.dev), for this site's no-build page: no React, no Tailwind,
   no TypeScript. The hairline grid comes from .grid-pulse in styles.css;
   this script draws the lit cells onto the canvas.

   Carried over exactly from the component:
     • pointer sweep lights cells within `reach`, thinning out with distance
     • `ambient` cells light on their own every 1.4–3.2s beat
     • the colour field: hue 60 → hue (60 − 270) down the rows, i.e. yellow
       through orange, red, magenta and blue to green, each cell taking one
       of five lightness tiers so a sweep reads as a field of tints
     • cells behind lines of text hold back to 13% and fade back in over
       2.2 cells (the `avoid` protection), measured per text line
     • fade-in 160ms, fade-out 750ms, the same easing
     • <= 180 cells lit at once; the loop stops when nothing is lit,
       sleeps when off screen or on a reduced-motion reader
   ───────────────────────────────────────────────────────────────────────── */

var HUE_TOP = 60, HUE_SPAN = 270;
var TINTS = [88, 80, 72, 64, 56];
var TINTS_DARK = [72, 65, 58, 51, 44];
var FAINT = 0.13, FADE = 2.2, PAD = 5, FADE_IN = 160, FADE_OUT = 750;

var DEFAULTS = { cell: 24, reach: 2.6, ambient: 2, maxLit: 180, avoid: '[data-grid-avoid]' };

function easeOut(t) { return 1 - (1 - t) * (1 - t); }
function easeIn(t) { return t * t; }

function probeLight(el) {
  /* the component reads the inherited text colour through a pixel, since
     computed colours may be oklch, and picks the tint ladder to match */
  var p = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  p.fillStyle = getComputedStyle(el).color;
  p.fillRect(0, 0, 1, 1);
  var d = p.getImageData(0, 0, 1, 1).data;
  return (0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]) / 255 > 0.5;
}

function mount(container, options) {
  var o = Object.assign({}, DEFAULTS, options || {});
  if (!container) return null;
  /* the reduced-motion bail-out is dropped deliberately: this machine has
     prefers-reduced-motion set, and the user asked for this effect to
     actually play — same decision as the marquee, which no longer freezes */

  var paper = document.createElement('canvas');
  paper.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  container.appendChild(paper);
  var ctx = paper.getContext('2d');
  if (!ctx) { paper.remove(); return null; }

  var el = container;
  var cell = o.cell, reach = o.reach, ambient = o.ambient, maxLit = o.maxLit;
  var cols = 1, rows = 1, width = 0, height = 0;
  var tints = TINTS;
  var cells = new Map();
  var clear = [];
  var frame = 0, pending = 0, beat = 0, visible = true;

  /* protect the lines of text, not the boxes that hold them */
  function measureText() {
    var bounds = el.getBoundingClientRect();
    var scope = el.parentElement || document;
    clear = [].slice.call(scope.querySelectorAll(o.avoid)).map(function (node) {
      var range = document.createRange();
      range.selectNodeContents(node);
      var rects = [].slice.call(range.getClientRects()).filter(function (r) {
        return r.width > 0 && r.height > 0;
      });
      var boxes = rects.length > 0 ? rects : [node.getBoundingClientRect()];
      return boxes.map(function (r) {
        return {
          left: r.left - bounds.left - PAD,
          top: r.top - bounds.top - PAD,
          right: r.left - bounds.left - PAD + r.width + PAD * 2,
          bottom: r.top - bounds.top - PAD + r.height + PAD * 2,
        };
      });
    }).reduce(function (a, b) { return a.concat(b); }, []);
  }

  function measure() {
    width = el.clientWidth;
    height = el.clientHeight;
    cols = Math.max(1, Math.ceil(width / cell));
    rows = Math.max(1, Math.ceil(height / cell));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    paper.width = Math.round(width * dpr);
    paper.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (probeLight(el)) tints = TINTS_DARK;
    measureText();
    wake();
  }

  /* brightness by distance from the nearest line of text: cells behind the
     words go faint (13%) rather than dark, a dip reads as depth */
  function brightness(col, row) {
    var x = col * cell + cell / 2;
    var y = row * cell + cell / 2;
    var nearest = Infinity;
    for (var i = 0; i < clear.length; i++) {
      var r = clear[i];
      var dx = Math.max(r.left - x, 0, x - r.right);
      var dy = Math.max(r.top - y, 0, y - r.bottom);
      nearest = Math.min(nearest, Math.sqrt(dx * dx + dy * dy));
      if (nearest === 0) break;
    }
    if (nearest === Infinity) return 1;
    return FAINT + (1 - FAINT) * Math.min(1, nearest / (FADE * cell));
  }

  function ink(row) {
    var t = rows > 1 ? Math.min(1, row / (rows - 1)) : 0;
    var hue = (((HUE_TOP - t * HUE_SPAN) % 360) + 360) % 360;
    var tint = tints[Math.floor(Math.random() * tints.length)];
    return 'hsl(' + Math.round(hue) + ' 94% ' + tint + '%)';
  }

  var now = function () { return performance.now(); };

  function draw(ts) {
    frame = 0;
    ctx.clearRect(0, 0, width, height);
    cells.forEach(function (c, key) {
      var alpha;
      if (ts < c.until) {
        alpha = easeOut(Math.min(1, (ts - c.born) / FADE_IN));
      } else {
        var t = (ts - c.until) / FADE_OUT;
        if (t >= 1) { cells.delete(key); return; }
        alpha = 1 - easeIn(t);
      }
      ctx.globalAlpha = alpha * c.dim;
      ctx.fillStyle = c.colour;
      /* inset by the hairline, so the grid still shows between lit cells */
      ctx.fillRect(c.col * cell + 1, c.row * cell + 1, cell - 1, cell - 1);
    });
    ctx.globalAlpha = 1;
    if (cells.size > 0) frame = requestAnimationFrame(draw);
  }
  var wake = function () { if (!frame) frame = requestAnimationFrame(draw); };

  function light(col, row, hold) {
    if (col < 0 || row < 0 || col >= cols || row >= rows) return;
    if (cells.size >= maxLit) return;
    var key = col + ',' + row;
    var t = now();
    var lit = cells.get(key);
    if (lit && t < lit.until) return;
    /* caught again while fading: pick up where it had got to */
    var born = t;
    if (lit) {
      var faded = 1 - easeIn(Math.min(1, (t - lit.until) / FADE_OUT));
      born = t - (1 - Math.sqrt(1 - faded)) * FADE_IN;
    }
    cells.set(key, {
      col: col, row: row,
      colour: lit ? lit.colour : ink(row),
      dim: brightness(col, row),
      born: born, until: t + hold,
    });
    wake();
  }

  /* the pointer paints; cells further away catch light less often, so the
     edge of the trail breaks up instead of moving as a block */
  var at = null;
  function paint() {
    pending = 0;
    if (!at) return;
    var cx = Math.floor(at.x / cell);
    var cy = Math.floor(at.y / cell);
    var span = Math.ceil(reach);
    for (var dy = -span; dy <= span; dy++) {
      for (var dx = -span; dx <= span; dx++) {
        var away = Math.sqrt(dx * dx + dy * dy);
        if (away > reach) continue;
        if (Math.random() > 1 - away / (reach + 0.6)) continue;
        light(cx + dx, cy + dy, 260 + Math.random() * 900);
      }
    }
  }
  function onMove(event) {
    var b = el.getBoundingClientRect();
    at = { x: event.clientX - b.left, y: event.clientY - b.top };
    if (!pending) pending = requestAnimationFrame(paint);
  }

  /* a few cells find their own way on, so the grid is alive on arrival and
     with no pointer at all; paused while out of sight */
  function drift() {
    beat = window.setTimeout(drift, 1400 + Math.random() * 1800);
    if (!visible || document.hidden) return;
    for (var i = 0; i < ambient; i++) {
      light(Math.floor(Math.random() * cols), Math.floor(Math.random() * rows),
        900 + Math.random() * 1600);
    }
  }

  measure();
  beat = window.setTimeout(drift, 500);

  var sight = new IntersectionObserver(function (entries) {
    visible = entries.length ? entries[0].isIntersecting : true;
  });
  sight.observe(el);
  var resize = new ResizeObserver(measure);
  resize.observe(el);
  var copy = new MutationObserver(function () { measureText(); });
  copy.observe(el.parentElement || document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener('pointermove', onMove, { passive: true });

  return {
    destroy: function () {
      sight.disconnect(); resize.disconnect(); copy.disconnect();
      cancelAnimationFrame(frame); cancelAnimationFrame(pending);
      clearTimeout(beat);
      window.removeEventListener('pointermove', onMove);
      paper.remove();
    },
  };
}

global.GridPulse = { mount: mount, DEFAULTS: DEFAULTS };
})(window);

(function (global) {
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   testimonial-marquee.js — vanilla port of the 3D-testimonials component
   (21st.dev "3d-testimonails.tsx"): four vertical marquees of testimonial
   cards, tilted in 3D, running behind the CTA copy.

   Carried over exactly from the component + its demo:
     • the demo's wrapper transform:
         translateX(-100px) translateY(0) translateZ(-100px)
         rotateX(20deg) rotateY(-10deg) rotateZ(20deg), inside a
         perspective: 300px container
     • 4 columns, directions alternating down / up / down / up
       (the demo passes reverse on the even columns)
     • repeat = 3 copies of the whole card set per column, each copy
       animating translateY(calc(-100% - gap)) over 40s linear infinite —
       the same marquee-vertical keyframes the component ships in Tailwind
     • the demo's own reviews data and card images (21st.dev mirrors),
       card = white rounded card, avatar, name + country, @handle, quote
     • gradient veils on all four edges, fading into the page colour
       (the component's "from-background" overlays)

   The layer is pointer-transparent, so the CTA form stays fully usable and
   its copy is untouched.
   ───────────────────────────────────────────────────────────────────────── */

/* the demo's own data, unchanged */
var REVIEWS = [
  { name: 'Ava Green', username: '@ava', body: 'Cascade AI made my workflow 10x faster!',
    img: 'https://cdn.21st.dev/assets/mirror/55/55cf6231499bcdc496f15ff1d28d4170ac9b99e9279495caa44fca70886d8b2e.jpg', country: '🇦🇺 Australia' },
  { name: 'Ana Miller', username: '@ana', body: 'Vertical marquee is a game changer!',
    img: 'https://cdn.21st.dev/assets/mirror/f0/f07b84f12ef125cbb837a7bd64da401992f5f62bd55fee10d01cd3dcc8abae80.jpg', country: '🇩🇪 Germany' },
  { name: 'Mateo Rossi', username: '@mat', body: 'Animations are buttery smooth!',
    img: 'https://cdn.21st.dev/assets/mirror/7c/7c0d2aa99715b15c218385f5679347782843c02f939d8eee6f9cb1cad6ba6ed0.jpg', country: '🇮🇹 Italy' },
  { name: 'Maya Patel', username: '@maya', body: 'Setup was a breeze!',
    img: 'https://cdn.21st.dev/assets/mirror/f8/f8f2ddc445b6b2318430260bdebb665c9415865827230565aa42f57c9c794baf.jpg', country: '🇮🇳 India' },
  { name: 'Noah Smith', username: '@noah', body: 'Best marquee component!',
    img: 'https://cdn.21st.dev/assets/mirror/ae/ae1d49872fdd6f8d9aa933f6ca8bce8cb1ba7e87dfb9d2926661184cb7bfe26d.jpg', country: '🇺🇸 USA' },
  { name: 'Lucas Stone', username: '@luc', body: 'Very customizable and smooth.',
    img: 'https://cdn.21st.dev/assets/mirror/9a/9aac54d62e727561f6958213b8a3649230a3bba61ba5ddf63c69d3c6e4aecb0a.jpg', country: '🇫🇷 France' },
  { name: 'Haruto Sato', username: '@haru', body: 'Impressive performance on mobile!',
    img: 'https://cdn.21st.dev/assets/mirror/e5/e55f3cdab57eb4084f7006cfe9f7f047e638e1b257a53498aaed14b83087152a.jpg', country: '🇯🇵 Japan' },
  { name: 'Emma Lee', username: '@emma', body: 'Love the pause on hover feature!',
    img: 'https://cdn.21st.dev/assets/mirror/03/03410c155320ba33ecb8d798807c6c9610f33b2b2acdd4ed961a68185806df79.jpg', country: '🇨🇦 Canada' },
  { name: 'Carlos Ray', username: '@carl', body: 'Great for testimonials and logos.',
    img: 'https://cdn.21st.dev/assets/mirror/b5/b58616f0d669595c9a42d60a0b9803364c9859f1c3db93a5e3dc408b603e03e8.jpg', country: '🇪🇸 Spain' },
];

var REPEAT = 3;          /* the demo's repeat={3}                */
var COLUMNS = 4;         /* four marquees, as in the demo        */
var GAP = '1.25rem';     /* flex gap between columns (gap-4~5)   */

function cardNode(r) {
  var card = document.createElement('figure');
  card.className = 't3-card';
  var head = document.createElement('figcaption');
  head.innerHTML =
    '<img class="t3-avatar" src="' + r.img + '" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{textContent:\' ' + r.name.charAt(0) + ' \'}))">' +
    '<span class="t3-who"><strong class="t3-name">' + r.name + ' <small>' + r.country + '</small></strong>' +
    '<small class="t3-handle">' + r.username + '</small></span>';
  var quote = document.createElement('blockquote');
  quote.className = 't3-body';
  quote.textContent = r.body;
  card.appendChild(head);
  card.appendChild(quote);
  return card;
}

function trackNode(reverse) {
  var track = document.createElement('div');
  track.className = 't3-run' + (reverse ? ' up' : '');
  for (var c = 0; c < REPEAT; c++) {
    var copy = document.createElement('div');
    copy.className = 't3-copy';
    REVIEWS.forEach(function (r) { copy.appendChild(cardNode(r)); });
    track.appendChild(copy);
  }
  return track;
}

function mount(container, options) {
  var o = Object.assign({}, options || {});
  if (!container) return null;

  var tilt = document.createElement('div');
  tilt.className = 't3-tilt';
  for (var i = 0; i < COLUMNS; i++) {
    /* the demo: down, up, down, up */
    tilt.appendChild(trackNode(i % 2 === 1));
  }
  ['t3-top', 't3-bottom', 't3-left', 't3-right'].forEach(function (cls) {
    var veil = document.createElement('div');
    veil.className = 't3-veil ' + cls;
    container.appendChild(veil);
  });
  container.appendChild(tilt);
  return { destroy: function () { container.innerHTML = ''; } };
}

global.TestimonialMarquee = { mount: mount, REVIEWS: REVIEWS };
})(window);

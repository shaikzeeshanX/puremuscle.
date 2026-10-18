/* ═══════════════════════════════════════════════════════════════════════
   hero-images.js — the images cycling through the corridor
   (the corridor runs full-bleed across the QUALITY section,
    mounted in app.js as `featureStream`)

   This is the only file you need to touch to change the corridor imagery.
   Add / remove / reorder entries and the corridor rebuilds around them.

   notes
     • six images, so each one comes round again quickly and sits on screen
       for a few seconds. More entries = a longer cycle, never a faster one.
     • the cards are 12:9 (4:3), set by cardWidth/cardHeight in app.js.
     • both rails run the same sequence, so the corridor reads as one
       mirrored stream — the left side mirrors the right at every depth.
     • any image URL works as long as it is reachable and CORS-friendly
       (they are drawn as plain <img>, so even hot-link-protected hosts
       are fine as long as the browser can fetch them).
     • `alt` is only used if you drop the decorative treatment: the whole
       corridor is aria-hidden, like the original component.
     • source: Burst (burst.shopify.com) — free to use, no attribution,
       and hot-link friendly. `?width=900&format=pjpg` is the size knob.
   ═══════════════════════════════════════════════════════════════════════ */
window.HERO_IMAGES = [
  { src: 'https://burst.shopifycdn.com/photos/lifting-weights.jpg?width=900&format=pjpg', alt: 'Athlete pressing a barbell overhead' },
  { src: 'https://burst.shopifycdn.com/photos/exercise-free-weights.jpg?width=900&format=pjpg', alt: 'Rack of dumbbells in the gym' },
  { src: 'https://burst.shopifycdn.com/photos/close-up-of-a-hand-adding-weight-to-a-dumbbell.jpg?width=900&format=pjpg', alt: 'Loading a dumbbell' },
  { src: 'https://burst.shopifycdn.com/photos/workout-preparation.jpg?width=900&format=pjpg', alt: 'Setting up on the machine' },
  { src: 'https://burst.shopifycdn.com/photos/hand-lift-free-weights.jpg?width=900&format=pjpg', alt: 'Lifting a hex dumbbell' },
  { src: 'https://burst.shopifycdn.com/photos/person-dressed-in-black-holds-two-weights-in-each-hand.jpg?width=900&format=pjpg', alt: 'Two dumbbells in hand' }

  /* three spares from the same batch — swap any of the six above for one of
     these (or just add them back to the list; then set `cards` in app.js to
     10 or 12 so the same image does not repeat too close together):
  { src: 'https://burst.shopifycdn.com/photos/gym-weight-stack.jpg?width=900&format=pjpg', alt: 'Weight stack close-up' },
  { src: 'https://burst.shopifycdn.com/photos/gym-weights.jpg?width=900&format=pjpg', alt: 'Dumbbells lined up on a rack' },
  { src: 'https://burst.shopifycdn.com/photos/arm-workout.jpg?width=900&format=pjpg', alt: 'Curl in progress' }
  */
];

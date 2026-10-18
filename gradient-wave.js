(function (global) {
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   gradient-wave.js — vanilla port of designali-in's GradientWave
   (21st.dev/@designali-in/components/gradient-wave), built for this site's
   no-build page: no React, no shadcn, no Tailwind, no TypeScript.

   Carried over exactly from the component:
     • the simplex-noise vertex deform and the wave-layer colour blending
     • every uniform and every default value, then the component's
       prop-apply step on top of them (shadowPower 8, darkenTop off,
       noiseSpeed 1e-5, noiseFrequency [1e-4, 9e-4],
       deform incline .5 / noiseAmp 250 / noiseFlow 5)
     • u_time stepping in milliseconds, capped at 1000/15 per frame
     • the plane topology: 2% of the frame's width across, 5% of its
       height vertically; transparent clear
     • the same geometry layout (X left→right, top row carries uv.y = 1)

   Two adaptations, because the component was built to fill a whole window
   and the marquee is a short band:
     1. The plane is drawn into a *frame* that keeps the component's own
        proportions (band width × 2.6× the band's height), vertically
        centred and cropped by the band — so the waves roll with the same
        shape they have in the full-screen demo instead of being flattened.
     2. The backing store is multiplied by devicePixelRatio (capped at 2)
        while all the math stays in CSS pixels — that is what keeps it
        crisp ("super hd") on retina-scale screens.

   If WebGL is unavailable, the canvas never appears and the band keeps a
   static CSS gradient stand-in.
   ───────────────────────────────────────────────────────────────────────── */

const NOISE_GLSL = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

vec3 blendNormal(vec3 base, vec3 blend) { return blend; }
vec3 blendNormal(vec3 base, vec3 blend, float opacity) { return (blend * opacity + base * (1.0 - opacity)); }
`;

const VERT = `
attribute vec4 position;
attribute vec2 uv;
attribute vec2 uvNorm;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform vec2 resolution;
uniform float u_time;
uniform vec4 u_active_colors;
uniform vec3 u_baseColor;
struct Global { vec2 noiseFreq; float noiseSpeed; };
uniform Global u_global;
struct VertDeform { float incline; float offsetTop; float offsetBottom; vec2 noiseFreq; float noiseAmp; float noiseSpeed; float noiseFlow; float noiseSeed; };
uniform VertDeform u_vertDeform;
struct WaveLayers { vec3 color; vec2 noiseFreq; float noiseSpeed; float noiseFlow; float noiseSeed; float noiseFloor; float noiseCeil; };
uniform WaveLayers u_waveLayers[__LAYERS__];
const int u_waveLayers_length = __LAYERS__;
${NOISE_GLSL}
varying vec3 v_color;

void main() {
  float time = u_time * u_global.noiseSpeed;
  vec2 noiseCoord = resolution * uvNorm * u_global.noiseFreq;
  float tilt = resolution.y / 2.0 * uvNorm.y;
  float incline = resolution.x * uvNorm.x / 2.0 * u_vertDeform.incline;
  float offset = resolution.x / 2.0 * u_vertDeform.incline * mix(u_vertDeform.offsetBottom, u_vertDeform.offsetTop, uv.y);

  float noise = snoise(vec3(
    noiseCoord.x * u_vertDeform.noiseFreq.x + time * u_vertDeform.noiseFlow,
    noiseCoord.y * u_vertDeform.noiseFreq.y,
    time * u_vertDeform.noiseSpeed + u_vertDeform.noiseSeed
  )) * u_vertDeform.noiseAmp;

  noise *= 1.0 - pow(abs(uvNorm.y), 2.0);
  noise = max(0.0, noise);

  vec3 pos = vec3(position.x, position.y + tilt + incline + noise - offset, position.z);

  v_color = u_baseColor;

  for (int i = 0; i < u_waveLayers_length; i++) {
    if (u_active_colors[i + 1] == 1.) {
      WaveLayers layer = u_waveLayers[i];
      float layerNoise = smoothstep(
        layer.noiseFloor,
        layer.noiseCeil,
        snoise(vec3(
          noiseCoord.x * layer.noiseFreq.x + time * layer.noiseFlow,
          noiseCoord.y * layer.noiseFreq.y,
          time * layer.noiseSpeed + layer.noiseSeed
        )) / 2.0 + 0.5
      );
      v_color = blendNormal(v_color, layer.color, pow(layerNoise, 4.));
    }
  }

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`;

/* u_active_colors is a vec4 in the original, so indices 1…3 are the ones a
   loop can meaningfully test — the component effectively ever uses three
   layers. Three layers are compiled and filled here, deterministically. */
const FRAG = `
precision highp float;
uniform vec2 resolution;
uniform float u_darken_top;
uniform float u_shadow_power;
varying vec3 v_color;

void main() {
  vec3 color = v_color;
  if (u_darken_top == 1.0) {
    vec2 st = gl_FragCoord.xy/resolution.xy;
    color.g -= pow(st.y + sin(-12.0) * st.x, u_shadow_power) * 0.4;
  }
  gl_FragColor = vec4(color, 1.0);
}`;

function normalizeColor(hexNumber) {
  return [
    ((hexNumber >> 16) & 255) / 255,
    ((hexNumber >> 8) & 255) / 255,
    (255 & hexNumber) / 255,
  ];
}

/* the component's own prop defaults, so a plain mount() animates exactly
   like the published demo */
const DEFAULTS = {
  colors: ['#38bdf8', '#ffffff', '#38bdf8', '#ffffff', '#38bdf8', '#ffffff'],
  isPlaying: true,
  shadowPower: 8,
  darkenTop: false,
  noiseSpeed: 0.00001,
  noiseFrequency: [0.0001, 0.0009],
  deform: { incline: 0.5, noiseAmp: 250, noiseFlow: 5 },
};

/* how tall the wave frame stands relative to the band it is cropped into;
   2.6 keeps the frame's own aspect near the component's demo window
   (1400×800 ≈ 1.75:1) at typical band heights */
const FRAME_SCALE = 2.6;

function compile(gl, type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error('gradient-wave shader error: ' + log);
  }
  return s;
}

/* minigl's PlaneGeometry.setTopology(xSegs, ySegs) + setSize(w, h),
   verbatim */
function buildGeometry(w, h) {
  const xSeg = Math.max(1, Math.ceil(w * 0.02));   /* 2% of width across */
  const ySeg = Math.max(1, Math.ceil(h * 0.05));   /* 5% of height vertical */
  const vertCount = (xSeg + 1) * (ySeg + 1);

  const position = new Float32Array(3 * vertCount);
  const uv = new Float32Array(2 * vertCount);
  const uvNorm = new Float32Array(2 * vertCount);

  for (let y = 0; y <= ySeg; y++) {
    for (let x = 0; x <= xSeg; x++) {
      const i = y * (xSeg + 1) + x;
      uv[2 * i] = x / xSeg;
      uv[2 * i + 1] = 1 - y / ySeg;
      uvNorm[2 * i] = (x / xSeg) * 2 - 1;
      uvNorm[2 * i + 1] = 1 - (y / ySeg) * 2;
      /* positions are centred on the origin; negated Y puts the top row at
         uv.y = 1, exactly as minigl stores it */
      position[3 * i] = -w / 2 + (w / xSeg) * x;
      position[3 * i + 1] = h / 2 - (h / ySeg) * y;
      position[3 * i + 2] = 0;
    }
  }

  /* minigl's index order */
  const index = new Uint16Array(xSeg * ySeg * 6);
  for (let y = 0; y < ySeg; y++) {
    for (let x = 0; x < xSeg; x++) {
      const i = y * (xSeg + 1) + x;
      const s = y * xSeg + x;
      index[6 * s] = i;
      index[6 * s + 1] = i + 1 + xSeg;
      index[6 * s + 2] = i + 1;
      index[6 * s + 3] = i + 1;
      index[6 * s + 4] = i + 1 + xSeg;
      index[6 * s + 5] = i + 2 + xSeg;
    }
  }
  return { position, uv, uvNorm, index };
}

function mount(container, options) {
  const o = Object.assign({}, DEFAULTS, options || {});
  if (!container) return null;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block';
  container.appendChild(canvas);

  let gl = null, prog = null;
  const loc = {};
  const bufs = {};
  const indexCount = { count: 0, type: null };
  let time = 0, last = 0, raf = 0, playing = false;

  const setF = (name, v) => gl.uniform1f(loc[name], v);
  const setVec = (name, v) =>
    gl[v.length === 2 ? 'uniform2fv' : v.length === 3 ? 'uniform3fv' : 'uniform4fv'](loc[name], v);

  function init() {
    try {
      gl = canvas.getContext('webgl', { antialias: true });
      if (!gl) return false;

      const layers = Math.min(3, Math.max(1, o.colors.length - 1));
      const vert = VERT.replace(/__LAYERS__/g, String(layers));

      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vert));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link error: ' + gl.getProgramInfoLog(prog));
      gl.useProgram(prog);

      /* attributes + locations */
      loc.a_position = gl.getAttribLocation(prog, 'position');
      loc.a_uv = gl.getAttribLocation(prog, 'uv');
      loc.a_uvNorm = gl.getAttribLocation(prog, 'uvNorm');
      ['projectionMatrix', 'modelViewMatrix', 'resolution', 'u_time',
       'u_shadow_power', 'u_darken_top', 'u_active_colors', 'u_baseColor',
       'u_global.noiseFreq', 'u_global.noiseSpeed',
       'u_vertDeform.incline', 'u_vertDeform.offsetTop', 'u_vertDeform.offsetBottom',
       'u_vertDeform.noiseFreq', 'u_vertDeform.noiseAmp', 'u_vertDeform.noiseSpeed',
       'u_vertDeform.noiseFlow', 'u_vertDeform.noiseSeed']
        .forEach(name => { loc[name] = gl.getUniformLocation(prog, name); });
      for (let i = 0; i < layers; i++) {
        ['color', 'noiseFreq', 'noiseSpeed', 'noiseFlow', 'noiseSeed', 'noiseFloor', 'noiseCeil']
          .forEach(f => loc[`u_waveLayers[${i}].` + f] = gl.getUniformLocation(prog, `u_waveLayers[${i}].` + f));
      }

      bufs.position = { buf: gl.createBuffer(), target: gl.ARRAY_BUFFER, loc: loc.a_position, size: 3 };
      bufs.uv = { buf: gl.createBuffer(), target: gl.ARRAY_BUFFER, loc: loc.a_uv, size: 2 };
      bufs.uvNorm = { buf: gl.createBuffer(), target: gl.ARRAY_BUFFER, loc: loc.a_uvNorm, size: 2 };
      bufs.index = { buf: gl.createBuffer(), target: gl.ELEMENT_ARRAY_BUFFER };

      /* ── uniforms: the component defaults, overridden by its props ── */
      const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const sectionColors = o.colors.map(hex => normalizeColor(parseInt(hex.replace('#', '0x'), 16)));

      gl.uniformMatrix4fv(loc['projectionMatrix'], false, identity);
      gl.uniformMatrix4fv(loc['modelViewMatrix'], false, identity);
      setVec('u_active_colors', [1, 1, 1, 1]);
      setVec('u_baseColor', sectionColors[0]);
      setVec('u_global.noiseFreq', o.noiseFrequency);
      setF('u_global.noiseSpeed', o.noiseSpeed);
      setF('u_darken_top', o.darkenTop ? 1 : 0);
      setF('u_shadow_power', o.shadowPower);
      const vd = Object.assign({
        incline: 0, offsetTop: -0.5, offsetBottom: -0.5,
        noiseFreq: [3, 4], noiseAmp: 320, noiseSpeed: 10, noiseFlow: 3, noiseSeed: 5,
      }, o.deform);
      setF('u_vertDeform.incline', vd.incline);
      setF('u_vertDeform.offsetTop', vd.offsetTop);
      setF('u_vertDeform.offsetBottom', vd.offsetBottom);
      setVec('u_vertDeform.noiseFreq', vd.noiseFreq);
      setF('u_vertDeform.noiseAmp', vd.noiseAmp);
      setF('u_vertDeform.noiseSpeed', vd.noiseSpeed);
      setF('u_vertDeform.noiseFlow', vd.noiseFlow);
      setF('u_vertDeform.noiseSeed', vd.noiseSeed);
      for (let i = 0; i < layers; i++) {
        const n = o.colors.length;
        const k = `u_waveLayers[${i}].`;
        setVec(k + 'color', sectionColors[i + 1]);
        setVec(k + 'noiseFreq', [2 + (i + 1) / n, 3 + (i + 1) / n]);
        setF(k + 'noiseSpeed', 11 + 0.3 * (i + 1));
        setF(k + 'noiseFlow', 6.5 + 0.3 * (i + 1));
        setF(k + 'noiseSeed', 5 + 10 * (i + 1));
        setF(k + 'noiseFloor', 0.1);
        setF(k + 'noiseCeil', 0.63 + 0.07 * (i + 1));
      }
      return true;
    } catch (err) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      if (gl) gl = null;
      return false;
    }
  }

  function bindAttrib(e, values) {
    gl.bindBuffer(e.target, e.buf);
    gl.bufferData(e.target, values, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(e.loc);
    gl.vertexAttribPointer(e.loc, e.size, gl.FLOAT, false, 0, 0);
  }

  function resize() {
    if (!gl) return;
    const r = container.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height * FRAME_SCALE));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);

    /* orthographic camera in CSS pixels; the dpr scaling is done by the
       viewport alone, so nothing else in the math needs to know about it */
    gl.uniformMatrix4fv(loc['projectionMatrix'], false,
      [2 / w, 0, 0, 0, 0, 2 / h, 0, 0, 0, 0, -0.001, 0, 0, 0, 0, 1]);
    gl.uniform2fv(loc['resolution'], [w, h]);

    const g = buildGeometry(w, h);
    bindAttrib(bufs.position, g.position);
    bindAttrib(bufs.uv, g.uv);
    bindAttrib(bufs.uvNorm, g.uvNorm);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.index.buf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.index, gl.STATIC_DRAW);
    indexCount.count = g.index.length;
    indexCount.type = gl.UNSIGNED_SHORT;
  }

  function frame(ts) {
    if (!playing) return;
    time += Math.min(ts - last, 1000 / 15);   /* the component's time step */
    last = ts;
    gl.uniform1f(loc['u_time'], time);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, indexCount.count, indexCount.type, 0);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (playing) return;
    playing = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  if (init() !== true) return null;
  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  window.addEventListener('resize', resize);

  if (o.isPlaying !== false) start();

  return {
    start, stop, resize,
    destroy() {
      stop(); ro.disconnect();
      window.removeEventListener('resize', resize);
      canvas.remove();
    },
  };
}

global.GradientWaveMarquee = { mount, DEFAULTS };
})(window);

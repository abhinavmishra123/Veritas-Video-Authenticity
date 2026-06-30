// engine/animator.js
// Canvas-based particle animation system for the code-flow visualizer.
// Renders glowing data-packets travelling along cubic Bézier curves between
// hardware zones on a dark dashboard.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cubic ease-in-out (smooth acceleration/deceleration). */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Evaluate a cubic Bézier at parameter `t` for a single axis. */
function cubicBezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/** Return {x, y} on a cubic Bézier defined by four {x,y} points at `t`. */
function bezierPoint(a, b, c, d, t) {
  return {
    x: cubicBezier(a.x, b.x, c.x, d.x, t),
    y: cubicBezier(a.y, b.y, c.y, d.y, t),
  };
}

/** Hex colour string → {r, g, b} integers. */
function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

// ---------------------------------------------------------------------------
// Colour map – keyed by "from→to"
// ---------------------------------------------------------------------------

const FLOW_COLOURS = {
  'disk→engine': '#00f0ff',
  'disk→ram': '#00f0ff',
  'engine→ram': '#a855f7',
  'ram→engine': '#2dd4bf',
  'engine→output': '#f472b6',
  'ram→output': '#fb923c',
};
const DEFAULT_COLOUR = '#00f0ff';

function flowColour(from, to) {
  return FLOW_COLOURS[`${from}→${to}`] || DEFAULT_COLOUR;
}

// ---------------------------------------------------------------------------
// Glow texture cache (pre-rendered offscreen canvases)
// ---------------------------------------------------------------------------

const GLOW_RADIUS = 28; // texture half-size (px) — drawn as 6-8 px core
const GLOW_SIZE = GLOW_RADIUS * 2;

/** Create an offscreen glow sprite for the given hex colour. */
function createGlowTexture(hex) {
  const oc = document.createElement('canvas');
  oc.width = GLOW_SIZE;
  oc.height = GLOW_SIZE;
  const g = oc.getContext('2d');
  const rgb = hexToRgb(hex);

  const grad = g.createRadialGradient(
    GLOW_RADIUS, GLOW_RADIUS, 0,
    GLOW_RADIUS, GLOW_RADIUS, GLOW_RADIUS
  );
  grad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},1)`);
  grad.addColorStop(0.15, `rgba(${rgb.r},${rgb.g},${rgb.b},0.85)`);
  grad.addColorStop(0.4, `rgba(${rgb.r},${rgb.g},${rgb.b},0.35)`);
  grad.addColorStop(0.7, `rgba(${rgb.r},${rgb.g},${rgb.b},0.10)`);
  grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);

  g.fillStyle = grad;
  g.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
  return oc;
}

// ---------------------------------------------------------------------------
// Ambient dust mote
// ---------------------------------------------------------------------------

class AmbientMote {
  constructor(w, h) {
    this.reset(w, h, true);
  }

  reset(w, h, scatter = false) {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.vx = (Math.random() - 0.5) * 0.15;
    this.vy = (Math.random() - 0.5) * 0.12;
    this.radius = 1 + Math.random() * 1.2;
    this.alpha = 0.06 + Math.random() * 0.10;
    this.phase = Math.random() * Math.PI * 2;
    this.phaseSpeed = 0.0003 + Math.random() * 0.0006;
    if (scatter) this.phase = Math.random() * Math.PI * 2;
  }

  update(dt, w, h) {
    this.phase += this.phaseSpeed * dt;
    this.x += this.vx * (dt / 16);
    this.y += this.vy * (dt / 16);
    // wrap around
    if (this.x < -10) this.x = w + 5;
    if (this.x > w + 10) this.x = -5;
    if (this.y < -10) this.y = h + 5;
    if (this.y > h + 10) this.y = -5;
  }

  draw(ctx) {
    const pulse = 0.7 + 0.3 * Math.sin(this.phase);
    const a = this.alpha * pulse;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(120, 160, 200, ${a.toFixed(3)})`;
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Active particle (data packet travelling along a Bézier curve)
// ---------------------------------------------------------------------------

class Particle {
  /**
   * @param {object} opts
   * @param {object} opts.p0  Start point {x,y}
   * @param {object} opts.p1  Control point 1
   * @param {object} opts.p2  Control point 2
   * @param {object} opts.p3  End point
   * @param {string} opts.colour  Hex colour
   * @param {string} opts.label   Text label to draw near particle
   * @param {number} opts.duration  Travel time (ms)
   * @param {OffscreenCanvas|HTMLCanvasElement} opts.glowTexture
   * @param {HTMLElement} opts.srcEl   Source zone DOM element
   * @param {HTMLElement} opts.dstEl   Destination zone DOM element
   * @param {function} opts.onSpawn   Callback when particle spawns
   * @param {function} opts.onArrive  Callback when particle arrives
   */
  constructor(opts) {
    this.p0 = opts.p0;
    this.p1 = opts.p1;
    this.p2 = opts.p2;
    this.p3 = opts.p3;
    this.colour = opts.colour;
    this.rgb = hexToRgb(opts.colour);
    this.label = opts.label || '';
    this.duration = opts.duration;
    this.glowTexture = opts.glowTexture;
    this.srcEl = opts.srcEl;
    this.dstEl = opts.dstEl;
    this.onSpawn = opts.onSpawn;
    this.onArrive = opts.onArrive;

    this.elapsed = 0;
    this.t = 0;
    this.alive = true;
    this.spawned = false;
    this.arrived = false;
    this.pos = { x: this.p0.x, y: this.p0.y };
  }

  update(dt) {
    if (!this.alive) return;

    if (!this.spawned) {
      this.spawned = true;
      if (this.onSpawn) this.onSpawn();
    }

    this.elapsed += dt;
    const raw = Math.min(this.elapsed / this.duration, 1);
    this.t = easeInOutCubic(raw);
    this.pos = bezierPoint(this.p0, this.p1, this.p2, this.p3, this.t);

    if (raw >= 1) {
      this.alive = false;
      if (!this.arrived) {
        this.arrived = true;
        if (this.onArrive) this.onArrive();
      }
    }
  }

  /** Draw the faint dashed path line. */
  drawPath(ctx) {
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = `rgba(${this.rgb.r},${this.rgb.g},${this.rgb.b},0.10)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.p0.x, this.p0.y);
    ctx.bezierCurveTo(this.p1.x, this.p1.y, this.p2.x, this.p2.y, this.p3.x, this.p3.y);
    ctx.stroke();
    ctx.restore();
  }

  /** Draw particle glow + label. */
  draw(ctx) {
    if (!this.alive && this.elapsed > this.duration) return;
    const { x, y } = this.pos;

    // Draw glow orb via pre-rendered texture (additive blend)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(
      this.glowTexture,
      x - GLOW_RADIUS,
      y - GLOW_RADIUS,
      GLOW_SIZE,
      GLOW_SIZE
    );
    ctx.restore();

    // Bright core
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Label
    if (this.label) {
      ctx.save();
      ctx.font = '600 10px "JetBrains Mono", "Fira Code", "Cascadia Code", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      // slight dark outline for readability
      ctx.strokeStyle = 'rgba(10, 14, 23, 0.8)';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeText(this.label, x, y - 12);

      ctx.fillStyle = `rgba(${this.rgb.r},${this.rgb.g},${this.rgb.b},0.95)`;
      ctx.fillText(this.label, x, y - 12);
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------------------
// Zone glow ring animation
// ---------------------------------------------------------------------------

class ZoneGlow {
  /**
   * @param {DOMRect} rect   Zone bounding rect relative to canvas CSS coords
   * @param {string}  colour Hex colour
   * @param {number}  duration ms
   */
  constructor(rect, colour, duration = 700) {
    this.rect = rect;
    this.rgb = hexToRgb(colour);
    this.duration = duration;
    this.elapsed = 0;
    this.alive = true;
  }

  update(dt) {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) this.alive = false;
  }

  draw(ctx) {
    if (!this.alive) return;
    const progress = this.elapsed / this.duration;
    const alpha = (1 - progress) * 0.35;
    const expand = progress * 8; // expand outward

    const r = this.rect;
    const pad = 3 + expand;
    const rx = r.x - pad;
    const ry = r.y - pad;
    const rw = r.width + pad * 2;
    const rh = r.height + pad * 2;
    const borderRadius = 12 + expand;

    ctx.save();
    ctx.strokeStyle = `rgba(${this.rgb.r},${this.rgb.g},${this.rgb.b},${alpha.toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, borderRadius);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Animator – public API
// ---------------------------------------------------------------------------

export class Animator {
  /**
   * @param {HTMLCanvasElement} canvasElement
   */
  constructor(canvasElement) {
    /** @type {HTMLCanvasElement} */
    this.canvas = canvasElement;
    /** @type {CanvasRenderingContext2D} */
    this.ctx = canvasElement.getContext('2d');

    // Zone DOM element references (set via setZoneElements)
    this._zones = { disk: null, engine: null, ram: null, output: null };

    // DPI
    this._dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Dimensions in CSS pixels
    this._width = 0;
    this._height = 0;

    // Animation state
    /** @type {Particle[]} */
    this._particles = [];
    /** @type {ZoneGlow[]} */
    this._glows = [];
    /** @type {AmbientMote[]} */
    this._ambientMotes = [];
    this._rafId = null;
    this._lastTime = 0;
    this._running = false;
    this._destroyed = false;

    // Frame counter for periodic full clear
    this._frameSinceLastClear = 0;

    // Glow texture cache: hex → offscreen canvas
    /** @type {Map<string, HTMLCanvasElement>} */
    this._glowCache = new Map();

    // Pre-build textures for all known colours
    const knownColours = new Set(Object.values(FLOW_COLOURS));
    knownColours.add(DEFAULT_COLOUR);
    for (const c of knownColours) {
      this._glowCache.set(c, createGlowTexture(c));
    }

    // Pending CSS-class removal timers (so we can clear on destroy)
    /** @type {Set<number>} */
    this._classTimers = new Set();

    // Bind methods
    this._tick = this._tick.bind(this);
    this._onResize = this.resize.bind(this);

    // Initial sizing + ambient setup
    this.resize();
    this._initAmbient();

    // Start the loop (ambient particles keep it alive initially)
    this._startLoop();

    // Listen for resize
    window.addEventListener('resize', this._onResize);
  }

  // -----------------------------------------------------------------------
  // Public methods
  // -----------------------------------------------------------------------

  /**
   * Register the four zone DOM elements.
   * @param {{ disk: HTMLElement, engine: HTMLElement, ram: HTMLElement, output: HTMLElement }} zones
   */
  setZoneElements({ disk, engine, ram, output }) {
    this._zones.disk = disk;
    this._zones.engine = engine;
    this._zones.ram = ram;
    this._zones.output = output;
  }

  /**
   * Animate a batch of flow animations. Resolves when every particle in this
   * batch has completed (particles from other batches are independent).
   *
   * @param {{ from: string, to: string, label: string, delay: number }[]} flowAnimations
   * @returns {Promise<void>}
   */
  animate(flowAnimations) {
    if (!flowAnimations || flowAnimations.length === 0) return Promise.resolve();

    return new Promise((resolve) => {
      let remaining = flowAnimations.length;
      const done = () => {
        remaining--;
        if (remaining <= 0) resolve();
      };

      for (const flow of flowAnimations) {
        const delay = flow.delay || 0;
        const spawnFn = () => this._spawnParticle(flow, done);

        if (delay > 0) {
          setTimeout(spawnFn, delay);
        } else {
          spawnFn();
        }
      }

      // Make sure the loop is running
      this._startLoop();
    });
  }

  /** Remove all active particles and glows immediately. */
  clear() {
    this._particles.length = 0;
    this._glows.length = 0;
    this._fullClear();
  }

  /** Recalculate canvas size for current layout. */
  resize() {
    const rect = this.canvas.parentElement
      ? this.canvas.parentElement.getBoundingClientRect()
      : this.canvas.getBoundingClientRect();

    this._dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._width = rect.width;
    this._height = rect.height;

    this.canvas.width = rect.width * this._dpr;
    this.canvas.height = rect.height * this._dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this._dpr, this._dpr);

    // Re-scatter ambient motes
    for (const m of this._ambientMotes) {
      m.reset(this._width, this._height, true);
    }
  }

  /** Full cleanup – call when unmounting. */
  destroy() {
    this._destroyed = true;
    this._stopLoop();
    window.removeEventListener('resize', this._onResize);
    for (const tid of this._classTimers) clearTimeout(tid);
    this._classTimers.clear();
    this._particles.length = 0;
    this._glows.length = 0;
    this._ambientMotes.length = 0;
    this._glowCache.clear();
  }

  // -----------------------------------------------------------------------
  // Internal — particle spawning
  // -----------------------------------------------------------------------

  /**
   * Spawn a single particle for a flow animation.
   * @param {{ from: string, to: string, label: string }} flow
   * @param {function} onComplete  Called when this particle finishes
   */
  _spawnParticle(flow, onComplete) {
    const srcEl = this._zones[flow.from];
    const dstEl = this._zones[flow.to];
    if (!srcEl || !dstEl) {
      onComplete();
      return;
    }

    const colour = flowColour(flow.from, flow.to);
    const glowTex = this._getGlowTexture(colour);

    // Compute positions relative to canvas
    const canvasRect = this.canvas.getBoundingClientRect();
    const srcRect = srcEl.getBoundingClientRect();
    const dstRect = dstEl.getBoundingClientRect();

    const src = {
      x: srcRect.left + srcRect.width / 2 - canvasRect.left,
      y: srcRect.top + srcRect.height / 2 - canvasRect.top,
    };
    const dst = {
      x: dstRect.left + dstRect.width / 2 - canvasRect.left,
      y: dstRect.top + dstRect.height / 2 - canvasRect.top,
    };

    // Build cubic Bézier control points
    const { cp1, cp2 } = this._computeControlPoints(src, dst);

    // Zone glow rects (relative to canvas)
    const srcZoneRect = {
      x: srcRect.left - canvasRect.left,
      y: srcRect.top - canvasRect.top,
      width: srcRect.width,
      height: srcRect.height,
    };
    const dstZoneRect = {
      x: dstRect.left - canvasRect.left,
      y: dstRect.top - canvasRect.top,
      width: dstRect.width,
      height: dstRect.height,
    };

    const particle = new Particle({
      p0: src,
      p1: cp1,
      p2: cp2,
      p3: dst,
      colour,
      label: flow.label || '',
      duration: 800,
      glowTexture: glowTex,
      srcEl,
      dstEl,
      onSpawn: () => {
        this._addZoneClass(srcEl, 'zone--sending', 600);
        this._glows.push(new ZoneGlow(srcZoneRect, colour, 700));
      },
      onArrive: () => {
        this._addZoneClass(dstEl, 'zone--receiving', 600);
        this._glows.push(new ZoneGlow(dstZoneRect, colour, 700));
        onComplete();
      },
    });

    this._particles.push(particle);
    this._startLoop();
  }

  /**
   * Compute two control points for a smooth cubic Bézier between src and dst.
   * Arcs upward for mostly-horizontal flows, arcs sideways for vertical.
   */
  _computeControlPoints(src, dst) {
    const dx = dst.x - src.x;
    const dy = dst.y - src.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curvature = Math.max(50, dist * 0.35);

    const isHorizontal = Math.abs(dx) > Math.abs(dy);

    let cp1, cp2;

    if (isHorizontal) {
      // Arc upward (negative Y)
      cp1 = { x: src.x + dx * 0.3, y: src.y - curvature };
      cp2 = { x: src.x + dx * 0.7, y: dst.y - curvature };
    } else {
      // Arc sideways – choose left or right depending on layout
      const sideSign = dx >= 0 ? 1 : -1;
      // If mostly vertical with little horizontal offset, pick a consistent side
      const sideOffset = Math.abs(dx) < 30 ? curvature : curvature * sideSign;
      cp1 = { x: src.x + sideOffset, y: src.y + dy * 0.3 };
      cp2 = { x: dst.x + sideOffset, y: src.y + dy * 0.7 };
    }

    return { cp1, cp2 };
  }

  // -----------------------------------------------------------------------
  // Internal — glow texture management
  // -----------------------------------------------------------------------

  _getGlowTexture(hex) {
    if (!this._glowCache.has(hex)) {
      this._glowCache.set(hex, createGlowTexture(hex));
    }
    return this._glowCache.get(hex);
  }

  // -----------------------------------------------------------------------
  // Internal — ambient particles
  // -----------------------------------------------------------------------

  _initAmbient() {
    const count = 18;
    this._ambientMotes = [];
    for (let i = 0; i < count; i++) {
      this._ambientMotes.push(new AmbientMote(this._width || 800, this._height || 600));
    }
  }

  // -----------------------------------------------------------------------
  // Internal — zone CSS class helpers
  // -----------------------------------------------------------------------

  _addZoneClass(el, cls, duration) {
    if (!el) return;
    el.classList.add(cls);
    const tid = setTimeout(() => {
      el.classList.remove(cls);
      this._classTimers.delete(tid);
    }, duration);
    this._classTimers.add(tid);
  }

  // -----------------------------------------------------------------------
  // Internal — animation loop
  // -----------------------------------------------------------------------

  _startLoop() {
    if (this._running || this._destroyed) return;
    this._running = true;
    this._lastTime = performance.now();
    this._rafId = requestAnimationFrame(this._tick);
  }

  _stopLoop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _tick(now) {
    if (this._destroyed) return;

    const dt = Math.min(now - this._lastTime, 50); // cap delta to avoid spiral
    this._lastTime = now;

    const ctx = this.ctx;
    const w = this._width;
    const h = this._height;

    const hasActiveParticles = this._particles.length > 0;

    // --- Background / trail ---
    // Fade existing particles to create trail (without painting solid background)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    if (hasActiveParticles) {
      this._frameSinceLastClear = 0;
    } else {
      this._frameSinceLastClear++;
      // Fully clear when idle every few frames to avoid residual trails
      if (this._frameSinceLastClear <= 3 || this._frameSinceLastClear % 60 === 0) {
        this._fullClear();
      }
    }

    // --- Ambient motes (always) ---
    for (const mote of this._ambientMotes) {
      mote.update(dt, w, h);
      mote.draw(ctx);
    }

    // --- Zone glows ---
    for (let i = this._glows.length - 1; i >= 0; i--) {
      this._glows[i].update(dt);
      this._glows[i].draw(ctx);
      if (!this._glows[i].alive) this._glows.splice(i, 1);
    }

    // --- Active particles ---
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.update(dt);
      p.drawPath(ctx);
      p.draw(ctx);
      if (!p.alive) this._particles.splice(i, 1);
    }

    // Continue running while there are particles, glows, or (always) ambient motes
    this._rafId = requestAnimationFrame(this._tick);
  }

  /** Clear the canvas completely. */
  _fullClear() {
    this.ctx.clearRect(0, 0, this._width, this._height);
  }
}

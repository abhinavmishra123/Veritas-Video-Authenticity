/* ============================================
   ATLAS AI CLOUD — Particle System
   Sparse constellation background for hero
   ============================================ */

(function () {
  'use strict';

  const PARTICLE_COUNT = 60;
  const MAX_SPEED = 0.3;
  const CONNECTION_DISTANCE = 140;
  const PARTICLE_RADIUS = 1.5;
  const LINE_OPACITY = 0.08;
  const DOT_OPACITY = 0.25;

  class ParticleCanvas {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext('2d');
      this.particles = [];
      this.animationId = null;
      this.isVisible = true;

      this.resize();
      this.createParticles();
      this.bindEvents();
      this.animate();
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
      this.ctx.scale(dpr, dpr);
      this.width = rect.width;
      this.height = rect.height;
    }

    createParticles() {
      this.particles = [];
      const count = Math.min(PARTICLE_COUNT, Math.floor((this.width * this.height) / 15000));
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          vx: (Math.random() - 0.5) * MAX_SPEED,
          vy: (Math.random() - 0.5) * MAX_SPEED,
          radius: PARTICLE_RADIUS + Math.random() * 0.8,
          opacity: DOT_OPACITY * (0.5 + Math.random() * 0.5),
        });
      }
    }

    bindEvents() {
      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          this.resize();
          this.createParticles();
        }, 200);
      });

      // Pause when off screen
      const observer = new IntersectionObserver(
        (entries) => {
          this.isVisible = entries[0].isIntersecting;
          if (this.isVisible && !this.animationId) {
            this.animate();
          }
        },
        { threshold: 0 }
      );
      observer.observe(this.canvas);
    }

    update() {
      for (const p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < -10) p.x = this.width + 10;
        if (p.x > this.width + 10) p.x = -10;
        if (p.y < -10) p.y = this.height + 10;
        if (p.y > this.height + 10) p.y = -10;
      }
    }

    draw() {
      this.ctx.clearRect(0, 0, this.width, this.height);

      // Draw connections
      for (let i = 0; i < this.particles.length; i++) {
        for (let j = i + 1; j < this.particles.length; j++) {
          const a = this.particles[i];
          const b = this.particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            const opacity = LINE_OPACITY * (1 - dist / CONNECTION_DISTANCE);
            this.ctx.beginPath();
            this.ctx.moveTo(a.x, a.y);
            this.ctx.lineTo(b.x, b.y);
            this.ctx.strokeStyle = `rgba(59, 130, 246, ${opacity})`;
            this.ctx.lineWidth = 0.5;
            this.ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of this.particles) {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(160, 160, 168, ${p.opacity})`;
        this.ctx.fill();
      }
    }

    animate() {
      if (!this.isVisible) {
        this.animationId = null;
        return;
      }
      this.update();
      this.draw();
      this.animationId = requestAnimationFrame(() => this.animate());
    }

    destroy() {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    }
  }

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new ParticleCanvas('heroParticles'));
  } else {
    new ParticleCanvas('heroParticles');
  }
})();

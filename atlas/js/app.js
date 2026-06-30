/* ============================================
   ATLAS AI CLOUD — Shared Utilities
   Scroll animations, counters, nav, terminal
   ============================================ */

(function () {
  'use strict';

  /* ---- Scroll-based animation observer ---- */
  function initScrollAnimations() {
    const elements = document.querySelectorAll('.animate-on-scroll');
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    elements.forEach((el) => observer.observe(el));
  }

  /* ---- Counter animation for metrics ---- */
  function initCounters() {
    const counters = document.querySelectorAll('[data-counter]');
    if (!counters.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );

    counters.forEach((el) => observer.observe(el));
  }

  function animateCounter(el) {
    const target = el.getAttribute('data-counter');
    const prefix = el.getAttribute('data-prefix') || '';
    const suffix = el.getAttribute('data-suffix') || '';
    const duration = 2000;
    const start = performance.now();

    // Parse target: could be "200000", "99.99", "50", "10000"
    const isDecimal = target.includes('.');
    const targetNum = parseFloat(target);

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * targetNum;

      if (isDecimal) {
        el.textContent = prefix + current.toFixed(2) + suffix;
      } else {
        el.textContent = prefix + Math.floor(current).toLocaleString('en-US') + suffix;
      }

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        // Ensure final value is exact
        if (isDecimal) {
          el.textContent = prefix + targetNum.toFixed(2) + suffix;
        } else {
          var finalVal = el.getAttribute('data-final');
          el.textContent = finalVal ? finalVal : (prefix + targetNum.toLocaleString('en-US') + suffix);
        }
      }
    }

    requestAnimationFrame(update);
  }

  /* ---- Navbar scroll effect ---- */
  function initNavScroll() {
    const nav = document.querySelector('.topnav');
    if (!nav) return;

    let lastScroll = 0;
    const scrollThreshold = 20;

    function onScroll() {
      const scrollY = window.scrollY;

      if (scrollY > scrollThreshold) {
        nav.classList.add('topnav--scrolled');
      } else {
        nav.classList.remove('topnav--scrolled');
      }

      lastScroll = scrollY;
    }

    // Add dynamic style for scrolled state
    if (!document.getElementById('navScrollStyle')) {
      const style = document.createElement('style');
      style.id = 'navScrollStyle';
      style.textContent = `
        .topnav--scrolled {
          background: rgba(10, 10, 10, 0.98) !important;
          border-bottom-color: rgba(255, 255, 255, 0.1) !important;
        }
      `;
      document.head.appendChild(style);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // Run once on load
  }

  /* ---- Mobile nav toggle ---- */
  function initMobileNav() {
    const toggle = document.querySelector('.topnav__mobile-toggle');
    const links = document.querySelector('.topnav__links');
    if (!toggle || !links) return;

    toggle.addEventListener('click', () => {
      links.classList.toggle('topnav__links--open');
      const isOpen = links.classList.contains('topnav__links--open');
      toggle.textContent = isOpen ? '✕' : '☰';
      toggle.setAttribute('aria-expanded', isOpen);
    });

    // Close on link click
    links.querySelectorAll('.topnav__link').forEach((link) => {
      link.addEventListener('click', () => {
        links.classList.remove('topnav__links--open');
        toggle.textContent = '☰';
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---- Smooth scroll for anchor links ---- */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const targetId = anchor.getAttribute('href');
        if (targetId === '#') return;

        const targetEl = document.querySelector(targetId);
        if (!targetEl) return;

        e.preventDefault();
        const navHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 64;
        const targetPos = targetEl.getBoundingClientRect().top + window.scrollY - navHeight;

        window.scrollTo({
          top: targetPos,
          behavior: 'smooth',
        });
      });
    });
  }

  /* ---- Terminal typing animation ---- */
  function initTerminal() {
    const terminalEl = document.getElementById('heroTerminal');
    if (!terminalEl) return;

    const lines = [
      { type: 'command', text: '$ atlas deploy --model gpt-neo-2.7b --gpu a100 --replicas 3' },
      { type: 'output', text: '▸ Validating model configuration...', delay: 600 },
      { type: 'output', text: '▸ Provisioning 3× NVIDIA A100 instances', delay: 400, class: 'accent' },
      { type: 'output', text: '▸ Building container image (2.7GB)', delay: 500 },
      { type: 'output', text: '▸ Deploying to us-east-1 cluster', delay: 400 },
      { type: 'output', text: '▸ Health checks passed (3/3 replicas)', delay: 500, class: 'success' },
      { type: 'output', text: '', delay: 200 },
      { type: 'output', text: '✓ Deployment complete in 34s', delay: 300, class: 'success' },
      { type: 'output', text: '  Endpoint: https://api.atlas.ai/v1/gpt-neo-2.7b', delay: 200, class: 'accent' },
    ];

    const body = terminalEl.querySelector('.terminal__body');
    if (!body) return;

    // Clear existing content
    body.innerHTML = '';

    let lineIndex = 0;

    function typeCommand(text, container, callback) {
      let charIndex = 0;
      const promptSpan = document.createElement('span');
      promptSpan.className = 'terminal__prompt';
      promptSpan.textContent = '$';

      const commandSpan = document.createElement('span');
      commandSpan.className = 'terminal__command';

      const lineDiv = document.createElement('div');
      lineDiv.className = 'terminal__line';
      lineDiv.appendChild(promptSpan);
      lineDiv.appendChild(commandSpan);
      container.appendChild(lineDiv);

      // Type text after the "$ "
      const commandText = text.substring(2); // Remove "$ "
      const cursor = document.createElement('span');
      cursor.className = 'terminal__cursor';
      commandSpan.appendChild(cursor);

      function typeChar() {
        if (charIndex < commandText.length) {
          cursor.before(document.createTextNode(commandText[charIndex]));
          charIndex++;
          setTimeout(typeChar, 25 + Math.random() * 35);
        } else {
          cursor.remove();
          if (callback) setTimeout(callback, 400);
        }
      }

      setTimeout(typeChar, 300);
    }

    function addOutputLine(text, container, cssClass, callback) {
      const span = document.createElement('span');
      span.className = 'terminal__output-line';
      if (cssClass === 'success') span.classList.add('terminal__output-line--success');
      if (cssClass === 'accent') span.classList.add('terminal__output-line--accent');
      if (cssClass === 'warning') span.classList.add('terminal__output-line--warning');
      span.textContent = text;

      // Find or create output container
      let outputDiv = container.querySelector('.terminal__output');
      if (!outputDiv) {
        outputDiv = document.createElement('div');
        outputDiv.className = 'terminal__output';
        container.appendChild(outputDiv);
      }

      outputDiv.appendChild(span);
      if (callback) setTimeout(callback, lines[lineIndex] ? lines[lineIndex].delay || 300 : 300);
    }

    function processNextLine() {
      if (lineIndex >= lines.length) {
        // Add a final cursor blink on new line
        const finalLine = document.createElement('div');
        finalLine.className = 'terminal__line';
        finalLine.style.marginTop = 'var(--space-sm)';
        const promptSpan = document.createElement('span');
        promptSpan.className = 'terminal__prompt';
        promptSpan.textContent = '$';
        const cursor = document.createElement('span');
        cursor.className = 'terminal__cursor';
        finalLine.appendChild(promptSpan);
        finalLine.appendChild(cursor);
        body.appendChild(finalLine);
        return;
      }

      const line = lines[lineIndex];
      lineIndex++;

      if (line.type === 'command') {
        typeCommand(line.text, body, processNextLine);
      } else {
        addOutputLine(line.text, body, line.class, processNextLine);
      }
    }

    // Start animation when terminal scrolls into view
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          processNextLine();
          observer.unobserve(terminalEl);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(terminalEl);
  }

  /* ---- Init everything on DOM ready ---- */
  function init() {
    initScrollAnimations();
    initCounters();
    initNavScroll();
    initMobileNav();
    initSmoothScroll();
    initTerminal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

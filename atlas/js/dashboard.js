/* ============================================
   ATLAS AI CLOUD — Dashboard JS
   Stats animation, chart, live updates, sidebar
   ============================================ */

(function () {
  'use strict';

  /* ---- Utility ---- */
  function formatNumber(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000) return n.toLocaleString('en-US');
    return String(n);
  }

  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /* ==================================================
     1. Animate Stat Counters
     ================================================== */
  function animateCounter(el, target, duration) {
    const start = 0;
    const startTime = performance.now();
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (target - start) * eased);
      el.textContent = prefix + formatNumber(current) + suffix;
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }

  function initStatCounters() {
    const statValues = document.querySelectorAll('[data-counter]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const target = parseInt(el.dataset.counter, 10);
            const duration = parseInt(el.dataset.duration || '1200', 10);
            animateCounter(el, target, duration);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.3 }
    );

    statValues.forEach((el) => observer.observe(el));
  }

  /* ==================================================
     2. Activity Bar Chart
     ================================================== */
  // Base hourly request data (realistic pattern: lower at night, peak during work hours)
  const hourlyData = [
    12400, 8900, 5600, 4200, 3800, 5100,    // 00-05 (night/early morning)
    14200, 28500, 42100, 51200, 48700, 46300, // 06-11 (morning ramp)
    44800, 47200, 50100, 52300, 49800, 45100, // 12-17 (afternoon)
    38200, 34100, 28700, 22400, 18600, 15100  // 18-23 (evening decline)
  ];

  function renderChart() {
    const barsContainer = document.getElementById('chartBars');
    if (!barsContainer) return;

    // Add slight randomness for realism
    const data = hourlyData.map((v) => v + randomBetween(-v * 0.08, v * 0.08));
    const maxVal = Math.max(...data);

    barsContainer.innerHTML = '';

    data.forEach((value, i) => {
      const bar = document.createElement('div');
      bar.className = 'chart-bars__bar';
      const heightPct = (value / maxVal) * 100;
      bar.style.height = '0%';
      bar.dataset.value = formatNumber(Math.round(value)) + ' req';
      bar.dataset.hour = i;

      barsContainer.appendChild(bar);

      // Staggered animation
      setTimeout(() => {
        bar.style.height = heightPct + '%';
      }, 40 * i);
    });

    // Update summary numbers
    const totalRequests = data.reduce((a, b) => a + b, 0);
    const peakHour = data.indexOf(Math.max(...data));
    const avgPerHour = Math.round(totalRequests / 24);

    const totalEl = document.getElementById('chartTotal');
    const peakEl = document.getElementById('chartPeak');
    const avgEl = document.getElementById('chartAvg');

    if (totalEl) totalEl.textContent = formatNumber(Math.round(totalRequests));
    if (peakEl) peakEl.textContent = String(peakHour).padStart(2, '0') + ':00';
    if (avgEl) avgEl.textContent = formatNumber(avgPerHour);
  }

  /* ==================================================
     3. Table Row Interactions
     ================================================== */
  function initTableInteractions() {
    const tableRows = document.querySelectorAll('#deploymentsTable tbody tr');

    tableRows.forEach((row) => {
      // Highlight effect on hover
      row.addEventListener('mouseenter', () => {
        row.style.transition = 'background 200ms ease';
      });

      // Click on row (except action buttons) to navigate
      row.addEventListener('click', (e) => {
        if (e.target.closest('.table-actions')) return;
        const modelName = row.querySelector('.table-model__name');
        if (modelName) {
          row.style.background = 'rgba(59, 130, 246, 0.05)';
          setTimeout(() => {
            row.style.background = '';
          }, 300);
        }
      });
    });

    // Action button handlers
    document.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const model = btn.closest('tr')?.querySelector('.table-model__name')?.textContent;

        if (action === 'delete') {
          btn.textContent = 'Confirm?';
          btn.classList.remove('btn--ghost');
          btn.classList.add('btn--danger');
          setTimeout(() => {
            btn.textContent = 'Delete';
            btn.classList.remove('btn--danger');
            btn.classList.add('btn--ghost');
          }, 2000);
        } else if (action === 'scale') {
          btn.textContent = 'Scaling...';
          btn.disabled = true;
          setTimeout(() => {
            btn.textContent = 'Scale';
            btn.disabled = false;
          }, 1500);
        }
      });
    });
  }

  /* ==================================================
     4. Live Data Updates (Simulated)
     ================================================== */
  function initLiveUpdates() {
    const requestCounter = document.getElementById('statRequests');
    if (!requestCounter) return;

    let currentRequests = parseInt(requestCounter.dataset.counter, 10);

    setInterval(() => {
      // Simulate incoming requests
      const increment = randomBetween(12, 78);
      currentRequests += increment;
      requestCounter.textContent = formatNumber(currentRequests);

      // Brief flash effect
      requestCounter.style.color = '#3B82F6';
      setTimeout(() => {
        requestCounter.style.color = '';
        requestCounter.style.transition = 'color 400ms ease';
      }, 150);
    }, 3000);

    // Occasionally update latency
    const latencyEl = document.getElementById('statLatency');
    if (latencyEl) {
      setInterval(() => {
        const jitter = randomBetween(-2, 2);
        const base = 23;
        const newLatency = Math.max(18, base + jitter);
        latencyEl.textContent = newLatency + 'ms';
      }, 5000);
    }
  }

  /* ==================================================
     5. Sidebar Active State
     ================================================== */
  function initSidebar() {
    const sidebarItems = document.querySelectorAll('.sidebar__item');

    sidebarItems.forEach((item) => {
      item.addEventListener('click', function (e) {
        // If it's a real link with href to another page, let it navigate
        const href = this.getAttribute('href');
        if (href && href !== '#' && !href.startsWith('javascript')) {
          return;
        }

        e.preventDefault();

        // Update active state
        sidebarItems.forEach((si) => si.classList.remove('sidebar__item--active'));
        this.classList.add('sidebar__item--active');

        // Update page title
        const label = this.querySelector('.sidebar__item-label');
        const titleEl = document.getElementById('pageTitle');
        if (label && titleEl) {
          titleEl.textContent = label.textContent;
        }
      });
    });
  }

  /* ==================================================
     6. Mobile Sidebar Toggle
     ================================================== */
  function initMobileSidebar() {
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (!toggleBtn || !sidebar) return;

    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('sidebar--mobile-open');
      if (overlay) overlay.classList.toggle('sidebar-overlay--visible');
    });

    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('sidebar--mobile-open');
        overlay.classList.remove('sidebar-overlay--visible');
      });
    }
  }

  /* ==================================================
     7. Scroll-based Animations
     ================================================== */
  function initScrollAnimations() {
    const animatedEls = document.querySelectorAll('.animate-on-scroll');
    if (!animatedEls.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    animatedEls.forEach((el) => observer.observe(el));
  }

  /* ==================================================
     8. Search Functionality (Filter Table)
     ================================================== */
  function initSearch() {
    const searchInput = document.getElementById('dashSearch');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const rows = document.querySelectorAll('#deploymentsTable tbody tr');

      rows.forEach((row) => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
      });
    });
  }

  /* ==================================================
     Initialize Everything on DOM Ready
     ================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    initStatCounters();
    renderChart();
    initTableInteractions();
    initSidebar();
    initMobileSidebar();
    initScrollAnimations();
    initSearch();

    // Delay live updates so initial animations finish
    setTimeout(initLiveUpdates, 2000);
  });
})();

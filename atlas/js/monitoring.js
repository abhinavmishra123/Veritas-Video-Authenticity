/* ============================================
   ATLAS AI CLOUD — Monitoring JS
   Live data simulation, charts, interactions
   ============================================ */

(function () {
  'use strict';

  // ---- Utility Helpers ----
  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function formatTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return h + ':' + m + ':' + s;
  }

  function formatNumber(n) {
    return n.toLocaleString('en-US');
  }

  // ---- Constants ----
  const ENDPOINTS = [
    { path: '/v1/gpt-neo/completions', method: 'POST', model: 'gpt-neo' },
    { path: '/v1/gpt-neo/completions', method: 'POST', model: 'gpt-neo' },
    { path: '/v1/gpt-neo/completions', method: 'POST', model: 'gpt-neo' },
    { path: '/v1/sdxl/generate', method: 'POST', model: 'sdxl' },
    { path: '/v1/sdxl/generate', method: 'POST', model: 'sdxl' },
    { path: '/v1/sdxl/inpaint', method: 'POST', model: 'sdxl' },
    { path: '/v1/whisper/transcribe', method: 'POST', model: 'whisper' },
    { path: '/v1/whisper/transcribe', method: 'POST', model: 'whisper' },
    { path: '/v1/models', method: 'GET', model: 'all' },
    { path: '/v1/gpt-neo/health', method: 'GET', model: 'gpt-neo' },
    { path: '/v1/sdxl/health', method: 'GET', model: 'sdxl' },
    { path: '/v1/whisper/health', method: 'GET', model: 'whisper' },
    { path: '/v1/gpt-neo/embeddings', method: 'POST', model: 'gpt-neo' },
    { path: '/v1/sdxl/upscale', method: 'POST', model: 'sdxl' },
    { path: '/v1/whisper/translate', method: 'POST', model: 'whisper' },
  ];

  const STATUS_WEIGHTS = [
    { code: 200, badge: 'success', weight: 78 },
    { code: 201, badge: 'success', weight: 8 },
    { code: 429, badge: 'warning', weight: 8 },
    { code: 500, badge: 'danger', weight: 3 },
    { code: 503, badge: 'danger', weight: 3 },
  ];

  function pickWeighted(items) {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = Math.random() * total;
    for (const item of items) {
      r -= item.weight;
      if (r <= 0) return item;
    }
    return items[0];
  }

  function generateLatency(endpoint) {
    if (endpoint.method === 'GET') return rand(3, 15);
    if (endpoint.path.includes('sdxl')) return rand(80, 320);
    if (endpoint.path.includes('whisper')) return rand(40, 220);
    return rand(12, 65);
  }

  // ---- Initialize Sparkline ----
  function initSparkline() {
    const container = document.getElementById('throughputSparkline');
    if (!container) return;
    const bars = [];
    for (let i = 0; i < 16; i++) {
      const bar = document.createElement('div');
      bar.className = 'sparkline__bar';
      const h = rand(8, 28);
      bar.style.height = h + 'px';
      container.appendChild(bar);
      bars.push(bar);
    }
    return bars;
  }

  // ---- Initialize Bar Chart ----
  function initBarChart() {
    const chart = document.getElementById('throughputChart');
    const xaxis = document.getElementById('throughputXaxis');
    if (!chart) return [];

    const now = new Date();
    const bars = [];

    for (let i = 29; i >= 0; i--) {
      const bar = document.createElement('div');
      bar.className = 'bar-chart__bar';
      const value = rand(800, 1600);
      const heightPercent = (value / 1800) * 100;
      bar.style.height = heightPercent + '%';
      bar.setAttribute('data-value', formatNumber(value) + ' req/s');
      chart.appendChild(bar);
      bars.push({ el: bar, value: value });
    }

    // X-axis labels: every 5 bars
    if (xaxis) {
      for (let i = 0; i < 7; i++) {
        const label = document.createElement('span');
        const mins = 30 - i * 5;
        const t = new Date(now.getTime() - mins * 60000);
        label.textContent = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
        xaxis.appendChild(label);
      }
    }

    return bars;
  }

  // ---- Initialize Latency Chart ----
  function initLatencyChart() {
    const data = { P50: 18, P75: 24, P90: 38, P95: 45, P99: 89 };
    const maxVal = 120; // scale reference

    Object.entries(data).forEach(([key, val]) => {
      const id = 'lat' + key;
      const fill = document.getElementById(id);
      if (fill) {
        // Animate in after a short delay
        setTimeout(() => {
          fill.style.width = (val / maxVal * 100) + '%';
        }, 300);
      }
    });
  }

  // ---- Generate Initial Log Rows ----
  function generateRow(timestamp) {
    const ep = ENDPOINTS[rand(0, ENDPOINTS.length - 1)];
    const status = pickWeighted(STATUS_WEIGHTS);
    const latency = generateLatency(ep);

    return {
      timestamp: timestamp || new Date(),
      endpoint: ep.path,
      method: ep.method,
      statusCode: status.code,
      statusBadge: status.badge,
      latency: latency,
      model: ep.model,
    };
  }

  function createRowEl(rowData, isNew) {
    const tr = document.createElement('tr');
    if (isNew) tr.className = 'log-row-new';

    tr.innerHTML =
      '<td class="mono">' + formatTime(rowData.timestamp) + '</td>' +
      '<td><code style="font-size: var(--text-xs); color: var(--text-secondary);">' + rowData.endpoint + '</code></td>' +
      '<td><span class="badge badge--' + (rowData.method === 'POST' ? 'info' : 'neutral') + '">' + rowData.method + '</span></td>' +
      '<td><span class="badge badge--' + rowData.statusBadge + '">' + rowData.statusCode + '</span></td>' +
      '<td class="mono">' + rowData.latency + 'ms</td>';

    return tr;
  }

  function initLogTable() {
    const tbody = document.getElementById('logBody');
    if (!tbody) return;

    const now = new Date();
    const rows = [];

    for (let i = 0; i < 15; i++) {
      const ts = new Date(now.getTime() - (i * rand(2000, 8000)));
      const row = generateRow(ts);
      rows.push(row);
    }

    // Sort by newest first
    rows.sort((a, b) => b.timestamp - a.timestamp);

    rows.forEach((row) => {
      tbody.appendChild(createRowEl(row, false));
    });
  }

  // ---- Live Simulation ----
  function startLiveSimulation(sparklineBars, chartBars) {
    const tbody = document.getElementById('logBody');
    const throughputEl = document.getElementById('throughputValue');
    const logCountEl = document.getElementById('logCount');
    let currentThroughput = 1247;

    // Add new log row every 2-3 seconds
    function addLogRow() {
      if (!tbody) return;
      const row = generateRow(new Date());
      const tr = createRowEl(row, true);
      tbody.insertBefore(tr, tbody.firstChild);

      // Remove animation class after animation completes
      setTimeout(() => {
        tr.classList.remove('log-row-new');
      }, 400);

      // Keep max 20 rows
      while (tbody.children.length > 20) {
        tbody.removeChild(tbody.lastChild);
      }

      // Update count
      if (logCountEl) {
        logCountEl.textContent = tbody.children.length + ' entries';
      }

      // Schedule next
      setTimeout(addLogRow, rand(2000, 3500));
    }

    // Update throughput stat
    function updateThroughput() {
      currentThroughput += rand(-30, 35);
      currentThroughput = Math.max(900, Math.min(1800, currentThroughput));

      if (throughputEl) {
        throughputEl.innerHTML = formatNumber(currentThroughput) +
          '<span style="font-size: var(--text-sm); color: var(--text-tertiary); font-weight: 500;"> req/s</span>';
      }

      // Update sparkline
      if (sparklineBars && sparklineBars.length > 0) {
        // Shift bars left
        for (let i = 0; i < sparklineBars.length - 1; i++) {
          sparklineBars[i].style.height = sparklineBars[i + 1].style.height;
        }
        sparklineBars[sparklineBars.length - 1].style.height = Math.round((currentThroughput / 1800) * 28) + 'px';
      }

      // Update one chart bar (shift left, add new on right)
      if (chartBars && chartBars.length > 0) {
        for (let i = 0; i < chartBars.length - 1; i++) {
          chartBars[i].value = chartBars[i + 1].value;
          chartBars[i].el.style.height = (chartBars[i].value / 1800 * 100) + '%';
          chartBars[i].el.setAttribute('data-value', formatNumber(chartBars[i].value) + ' req/s');
        }
        const last = chartBars[chartBars.length - 1];
        last.value = currentThroughput;
        last.el.style.height = (currentThroughput / 1800 * 100) + '%';
        last.el.setAttribute('data-value', formatNumber(currentThroughput) + ' req/s');
      }

      setTimeout(updateThroughput, rand(2500, 4000));
    }

    // Update GPU utilization occasionally
    const gpuState = [78, 65, 82, 71];

    function updateGPUs() {
      const gpuIndex = rand(0, 3);
      gpuState[gpuIndex] += rand(-5, 5);
      gpuState[gpuIndex] = Math.max(40, Math.min(98, gpuState[gpuIndex]));

      const row = document.getElementById('gpu' + gpuIndex);
      if (row) {
        const fill = row.querySelector('.gpu-bar-fill');
        const valueEl = row.querySelector('.gpu-row__value');
        const val = gpuState[gpuIndex];

        fill.style.width = val + '%';
        valueEl.textContent = val + '%';

        // Update color class
        fill.className = 'gpu-bar-fill';
        if (val > 80) {
          fill.classList.add('gpu-bar-fill--red');
        } else if (val >= 60) {
          fill.classList.add('gpu-bar-fill--amber');
        } else {
          fill.classList.add('gpu-bar-fill--blue');
        }
      }

      // Update aggregate stat
      const avg = Math.round(gpuState.reduce((a, b) => a + b, 0) / gpuState.length);
      const gpuUtilValue = document.getElementById('gpuUtilValue');
      const gpuUtilBar = document.getElementById('gpuUtilBar');
      if (gpuUtilValue) {
        gpuUtilValue.innerHTML = avg +
          '<span style="font-size: var(--text-sm); color: var(--text-tertiary); font-weight: 500;">%</span>';
      }
      if (gpuUtilBar) {
        gpuUtilBar.style.width = avg + '%';
      }

      setTimeout(updateGPUs, rand(3000, 6000));
    }

    // Start all simulations with slight delays
    setTimeout(addLogRow, 2500);
    setTimeout(updateThroughput, 3000);
    setTimeout(updateGPUs, 4000);
  }

  // ---- Time Range Selector ----
  function initTimeRange() {
    const container = document.getElementById('timeRange');
    if (!container) return;

    container.addEventListener('click', function (e) {
      const btn = e.target.closest('.time-range__btn');
      if (!btn) return;

      container.querySelectorAll('.time-range__btn').forEach(function (b) {
        b.classList.remove('time-range__btn--active');
      });
      btn.classList.add('time-range__btn--active');

      // Visual-only: could update chart title, labels, etc.
    });
  }

  // ---- Model Selector ----
  function initModelSelector() {
    const select = document.getElementById('modelSelector');
    if (!select) return;

    select.addEventListener('change', function () {
      // Visual-only filtering — in production, this would re-fetch data
      const value = select.value;
      const title = document.querySelector('.page-header__title');
      if (title) {
        if (value === 'all') {
          title.textContent = 'Monitoring';
        } else {
          const nameMap = {
            'gpt-neo': 'GPT-Neo 2.7B',
            'sdxl': 'Stable Diffusion XL',
            'whisper': 'Whisper Large V3',
          };
          title.textContent = 'Monitoring — ' + (nameMap[value] || value);
        }
      }
    });
  }

  // ---- Scroll Animations ----
  function initScrollAnimations() {
    const elements = document.querySelectorAll('.animate-on-scroll');
    if (!elements.length) return;

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px',
    });

    elements.forEach(function (el) {
      observer.observe(el);
    });
  }

  // ---- Sidebar Mobile Toggle ----
  function initSidebar() {
    const toggle = document.querySelector('.topnav__mobile-toggle');
    const sidebar = document.getElementById('sidebar');
    if (!toggle || !sidebar) return;

    toggle.addEventListener('click', function () {
      sidebar.classList.toggle('sidebar--open');
    });
  }

  // ---- Initialize Everything ----
  document.addEventListener('DOMContentLoaded', function () {
    const sparklineBars = initSparkline();
    const chartBars = initBarChart();
    initLatencyChart();
    initLogTable();
    initTimeRange();
    initModelSelector();
    initScrollAnimations();
    initSidebar();
    startLiveSimulation(sparklineBars, chartBars);
  });

})();

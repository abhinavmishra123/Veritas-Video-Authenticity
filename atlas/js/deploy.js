/* ============================================
   ATLAS AI CLOUD — Deploy Wizard Logic
   ============================================ */

(function () {
  'use strict';

  /* ---- State ---- */
  let currentStep = 1;
  const totalSteps = 4;
  const state = {
    modelSource: null,     // 'upload' | 'marketplace'
    selectedModel: null,   // model name string
    gpuType: '',
    replicas: 1,
    autoScale: false,
    autoScaleMin: 1,
    autoScaleMax: 10,
    memory: '',
    region: '',
    envVars: [],
    containerPort: 8080,
  };

  /* ---- DOM Refs ---- */
  const panels = document.querySelectorAll('.wizard__panel');
  const stepEls = document.querySelectorAll('.wizard__step');
  const connectors = document.querySelectorAll('.wizard__step-connector');
  const btnBack = document.getElementById('btn-back');
  const btnNext = document.getElementById('btn-next');
  const btnDeploy = document.getElementById('btn-deploy');

  /* ---- Step Navigation ---- */
  function goToStep(step) {
    if (step < 1 || step > totalSteps) return;
    currentStep = step;
    updatePanels();
    updateStepIndicators();
    updateNavButtons();
    if (step === 4) buildSummary();
  }

  function updatePanels() {
    panels.forEach(function (panel, i) {
      panel.classList.toggle('wizard__panel--active', i + 1 === currentStep);
    });
  }

  function updateStepIndicators() {
    stepEls.forEach(function (el, i) {
      var stepNum = i + 1;
      el.classList.remove('wizard__step--active', 'wizard__step--completed');
      if (stepNum === currentStep) {
        el.classList.add('wizard__step--active');
      } else if (stepNum < currentStep) {
        el.classList.add('wizard__step--completed');
        // Replace number with checkmark
        el.querySelector('.wizard__step-number').textContent = '✓';
      }
      // Restore number if going back
      if (stepNum >= currentStep) {
        el.querySelector('.wizard__step-number').textContent = stepNum;
      }
    });
    connectors.forEach(function (conn, i) {
      conn.classList.toggle('wizard__step-connector--completed', i + 1 < currentStep);
    });
  }

  function updateNavButtons() {
    btnBack.style.display = currentStep === 1 ? 'none' : '';
    btnNext.style.display = currentStep >= totalSteps ? 'none' : '';
    btnDeploy.style.display = currentStep === totalSteps ? '' : 'none';
  }

  /* ---- Validation ---- */
  function validateStep(step) {
    switch (step) {
      case 1:
        if (!state.modelSource) {
          shakeElement(document.querySelector('.grid--2'));
          return false;
        }
        if (state.modelSource === 'marketplace' && !state.selectedModel) {
          shakeElement(document.getElementById('mini-model-grid'));
          return false;
        }
        return true;
      case 2:
        var gpu = document.getElementById('gpu-type');
        var mem = document.getElementById('memory');
        if (!gpu.value) { shakeElement(gpu); return false; }
        if (!mem.value) { shakeElement(mem); return false; }
        collectStep2();
        return true;
      case 3:
        var region = document.getElementById('region');
        if (!region.value) { shakeElement(region); return false; }
        collectStep3();
        return true;
      default:
        return true;
    }
  }

  function shakeElement(el) {
    if (!el) return;
    el.style.animation = 'none';
    el.offsetHeight; // trigger reflow
    el.style.animation = 'shake 0.4s ease';
    setTimeout(function () { el.style.animation = ''; }, 400);
  }

  /* ---- Collect Form Data ---- */
  function collectStep2() {
    state.gpuType = document.getElementById('gpu-type').value;
    state.replicas = parseInt(document.getElementById('replicas').value, 10) || 1;
    state.autoScale = document.getElementById('autoscale-toggle').checked;
    state.memory = document.getElementById('memory').value;
    if (state.autoScale) {
      state.autoScaleMin = parseInt(document.getElementById('autoscale-min').value, 10) || 1;
      state.autoScaleMax = parseInt(document.getElementById('autoscale-max').value, 10) || 10;
    }
  }

  function collectStep3() {
    state.region = document.getElementById('region').value;
    state.containerPort = parseInt(document.getElementById('container-port').value, 10) || 8080;
    // Collect env vars
    state.envVars = [];
    var rows = document.querySelectorAll('.env-var-row');
    rows.forEach(function (row) {
      var key = row.querySelector('.env-key').value.trim();
      var val = row.querySelector('.env-value').value.trim();
      if (key) state.envVars.push({ key: key, value: val });
    });
  }

  /* ---- Build Summary ---- */
  function buildSummary() {
    document.getElementById('sum-model').textContent = state.selectedModel || 'Custom Upload';
    document.getElementById('sum-gpu').textContent = state.gpuType;
    document.getElementById('sum-replicas').textContent = state.autoScale
      ? state.replicas + ' (auto-scale ' + state.autoScaleMin + '-' + state.autoScaleMax + ')'
      : String(state.replicas);
    document.getElementById('sum-memory').textContent = state.memory;
    document.getElementById('sum-region').textContent = state.region;
    document.getElementById('sum-port').textContent = state.containerPort;

    // Env vars
    var envDisplay = document.getElementById('sum-env');
    if (state.envVars.length === 0) {
      envDisplay.textContent = 'None';
    } else {
      envDisplay.textContent = state.envVars.map(function (ev) { return ev.key + '=' + ev.value; }).join(', ');
    }

    // Calculate estimated cost
    var gpuCosts = {
      'a100-40gb': 2.21, 'a100-80gb': 3.67, 'h100-80gb': 4.89, 'l40': 1.49, 't4': 0.76
    };
    var baseCost = gpuCosts[state.gpuType] || 2.00;
    var memMultiplier = { '16gb': 1.0, '32gb': 1.3, '64gb': 1.8, '128gb': 2.5 };
    var totalHourly = (baseCost * (memMultiplier[state.memory] || 1.0) * state.replicas).toFixed(2);
    document.getElementById('cost-value').textContent = '$' + totalHourly;
    document.getElementById('cost-breakdown').textContent =
      'GPU $' + baseCost.toFixed(2) + '/hr × ' + state.replicas + ' replica' + (state.replicas > 1 ? 's' : '') + ' + memory';
  }

  /* ---- Model Source Selection ---- */
  var optUpload = document.getElementById('opt-upload');
  var optMarketplace = document.getElementById('opt-marketplace');
  var uploadZone = document.getElementById('upload-zone');
  var miniGrid = document.getElementById('mini-model-grid');

  function selectSource(source) {
    state.modelSource = source;
    state.selectedModel = null;
    optUpload.classList.toggle('model-option--selected', source === 'upload');
    optMarketplace.classList.toggle('model-option--selected', source === 'marketplace');
    uploadZone.classList.toggle('upload-zone--visible', source === 'upload');
    miniGrid.classList.toggle('mini-model-grid--visible', source === 'marketplace');
    // Clear mini model selections
    document.querySelectorAll('.mini-model').forEach(function (m) {
      m.classList.remove('mini-model--selected');
    });
  }

  optUpload.addEventListener('click', function () { selectSource('upload'); });
  optMarketplace.addEventListener('click', function () { selectSource('marketplace'); });

  /* ---- Mini Model Selection ---- */
  document.querySelectorAll('.mini-model').forEach(function (el) {
    el.addEventListener('click', function () {
      document.querySelectorAll('.mini-model').forEach(function (m) {
        m.classList.remove('mini-model--selected');
      });
      el.classList.add('mini-model--selected');
      state.selectedModel = el.getAttribute('data-model');
    });
  });

  /* ---- Upload Zone ---- */
  if (uploadZone) {
    uploadZone.addEventListener('click', function () {
      state.selectedModel = 'Custom Model (uploaded)';
      uploadZone.querySelector('.upload-zone__text').textContent = 'Model file selected';
      uploadZone.style.borderColor = 'var(--success)';
    });

    uploadZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      uploadZone.style.borderColor = 'var(--accent-blue)';
      uploadZone.style.background = 'rgba(59, 130, 246, 0.04)';
    });

    uploadZone.addEventListener('dragleave', function () {
      uploadZone.style.borderColor = '';
      uploadZone.style.background = '';
    });

    uploadZone.addEventListener('drop', function (e) {
      e.preventDefault();
      state.selectedModel = 'Custom Model (uploaded)';
      uploadZone.querySelector('.upload-zone__text').textContent = 'Model file selected';
      uploadZone.style.borderColor = 'var(--success)';
      uploadZone.style.background = '';
    });
  }

  /* ---- Auto-scale Toggle ---- */
  var autoToggle = document.getElementById('autoscale-toggle');
  var autoFields = document.getElementById('autoscale-fields');
  if (autoToggle && autoFields) {
    autoToggle.addEventListener('change', function () {
      autoFields.classList.toggle('autoscale-fields--visible', autoToggle.checked);
    });
  }

  /* ---- Environment Variables ---- */
  var envContainer = document.getElementById('env-vars-container');
  var addEnvBtn = document.getElementById('btn-add-env');

  function createEnvRow(key, value) {
    var row = document.createElement('div');
    row.className = 'env-var-row';
    row.innerHTML =
      '<input type="text" class="input input--mono env-key" placeholder="KEY" value="' + (key || '') + '">' +
      '<input type="text" class="input input--mono env-value" placeholder="value" value="' + (value || '') + '">' +
      '<button type="button" class="btn--remove" title="Remove">✕</button>';
    row.querySelector('.btn--remove').addEventListener('click', function () {
      row.remove();
    });
    return row;
  }

  if (addEnvBtn && envContainer) {
    addEnvBtn.addEventListener('click', function () {
      envContainer.appendChild(createEnvRow('', ''));
    });
  }

  // Setup initial remove buttons
  document.querySelectorAll('.env-var-row .btn--remove').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.closest('.env-var-row').remove();
    });
  });

  /* ---- Next / Back Buttons ---- */
  btnNext.addEventListener('click', function () {
    if (validateStep(currentStep)) {
      goToStep(currentStep + 1);
    }
  });

  btnBack.addEventListener('click', function () {
    goToStep(currentStep - 1);
  });

  /* ---- Deploy Button ---- */
  btnDeploy.addEventListener('click', function () {
    btnDeploy.disabled = true;
    btnDeploy.textContent = 'Deploying…';
    startDeployAnimation();
  });

  /* ---- Deploy Animation ---- */
  function startDeployAnimation() {
    var progress = document.getElementById('deploy-progress');
    var fill = document.getElementById('deploy-progress-fill');
    var statusText = document.getElementById('deploy-status');
    var logEl = document.getElementById('deploy-log');
    var successEl = document.getElementById('deploy-success');

    progress.classList.add('deploy-progress--active');

    var steps = [
      { pct: 8,   status: 'Initializing deployment…',          log: '> Validating configuration...',      delay: 600 },
      { pct: 18,  status: 'Pulling container image…',          log: '> Pulling base image: nvidia/cuda:12.4-runtime', delay: 900 },
      { pct: 30,  status: 'Pulling container image…',          log: '> Layer 1/7: sha256:a3ed95...  ✓',    delay: 700 },
      { pct: 42,  status: 'Loading model weights…',            log: '> Layer 4/7: sha256:8d2b13...  ✓',    delay: 600 },
      { pct: 55,  status: 'Loading model weights…',            log: '> Downloading model weights (4.2 GB)...', delay: 1200 },
      { pct: 68,  status: 'Configuring GPU resources…',        log: '> Allocating ' + state.gpuType.toUpperCase().replace('-', ' ') + '...', delay: 800 },
      { pct: 78,  status: 'Setting up auto-scaling…',          log: '> Health check endpoint: /health  ✓',  delay: 600 },
      { pct: 88,  status: 'Running health checks…',            log: '> Container started on port ' + state.containerPort, delay: 700 },
      { pct: 95,  status: 'Assigning endpoint…',               log: '> TLS certificate provisioned  ✓',    delay: 500 },
      { pct: 100, status: 'Deployment complete!',              log: '> ✓ Deployment live at https://api.atlas.ai/v1/' + (state.selectedModel || 'model').toLowerCase().replace(/[\s()]/g, '-'), delay: 400 },
    ];

    var i = 0;
    function runStep() {
      if (i >= steps.length) {
        // Show success
        setTimeout(function () {
          progress.classList.remove('deploy-progress--active');
          successEl.classList.add('deploy-success--active');
          btnDeploy.style.display = 'none';
          btnBack.style.display = 'none';
        }, 600);
        return;
      }
      var s = steps[i];
      fill.style.width = s.pct + '%';
      statusText.textContent = s.status;

      var logLine = document.createElement('div');
      logLine.className = 'deploy-progress__log-line';
      if (s.log.includes('✓')) logLine.classList.add('deploy-progress__log-line--success');
      if (s.log.includes('Allocating') || s.log.includes('Downloading')) logLine.classList.add('deploy-progress__log-line--info');
      logLine.textContent = s.log;
      logEl.appendChild(logLine);
      logEl.scrollTop = logEl.scrollHeight;

      i++;
      setTimeout(runStep, s.delay);
    }
    runStep();
  }

  /* ---- Shake Keyframe (injected) ---- */
  var style = document.createElement('style');
  style.textContent = '@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }';
  document.head.appendChild(style);

  /* ---- Init ---- */
  updateNavButtons();

  /* ---- Scroll Animations ---- */
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.animate-on-scroll').forEach(function (el) {
    observer.observe(el);
  });

})();

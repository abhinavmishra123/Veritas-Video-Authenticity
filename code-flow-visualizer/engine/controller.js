/**
 * controller.js — Main Application Controller
 * Orchestrates the code editor, interpreter, animator, and zone displays.
 */

import { Interpreter } from './interpreter.js?v=2';
import { highlightCode } from './highlighter.js?v=2';
import { Animator } from './animator.js?v=2';
import { SAMPLES } from '../samples.js?v=2';

class Controller {
  constructor() {
    // State
    this.interpreter = new Interpreter();
    this.animator = null;
    this.isPlaying = false;
    this.playTimer = null;
    this.isEditing = true;
    this.isLoaded = false;
    this.highlightedLines = [];
    this.animationSpeed = 5; // 1-10 scale

    // Cache DOM elements
    this.els = {
      // Code panel
      codeInput: document.getElementById('codeInput'),
      codeDisplay: document.getElementById('codeDisplay'),
      lineNumbers: document.getElementById('lineNumbers'),
      sampleSelect: document.getElementById('sampleSelect'),
      btnEdit: document.getElementById('btnEdit'),
      btnLoad: document.getElementById('btnLoad'),

      // Hardware zones
      zoneDisk: document.getElementById('zoneDisk'),
      zoneEngine: document.getElementById('zoneEngine'),
      zoneRam: document.getElementById('zoneRam'),
      zoneOutput: document.getElementById('zoneOutput'),
      diskBody: document.getElementById('diskBody'),
      engineBody: document.getElementById('engineBody'),
      ramBody: document.getElementById('ramBody'),
      outputBody: document.getElementById('outputBody'),

      // Controls
      btnPrev: document.getElementById('btnPrev'),
      btnNext: document.getElementById('btnNext'),
      btnPlay: document.getElementById('btnPlay'),
      btnReset: document.getElementById('btnReset'),
      playIcon: document.getElementById('playIcon'),
      speedSlider: document.getElementById('speedSlider'),
      speedValue: document.getElementById('speedValue'),

      // Status
      statusIndicator: document.getElementById('statusIndicator'),
      statusText: document.querySelector('.status-text'),
      stepNum: document.getElementById('stepNum'),
      stepTotal: document.getElementById('stepTotal'),

      // Canvas
      canvas: document.getElementById('particleCanvas'),

      // Timeline
      timelineScrubber: document.getElementById('timelineScrubber'),

      // Input modal
      inputModal: document.getElementById('inputModal'),
      inputPrompt: document.getElementById('inputPrompt'),
      inputField: document.getElementById('inputField'),
      btnSubmitInput: document.getElementById('btnSubmitInput'),
    };

    this.init();
  }

  init() {
    // Initialize animator
    this.animator = new Animator(this.els.canvas);
    this.animator.setZoneElements({
      disk: this.els.zoneDisk,
      engine: this.els.zoneEngine,
      ram: this.els.zoneRam,
      output: this.els.zoneOutput,
    });

    // Populate sample selector
    this.populateSamples();

    // Bind events
    this.bindEvents();

    // Set initial state
    this.updateLineNumbers();
    this.updateControlStates();

    // Handle resize
    window.addEventListener('resize', () => {
      this.animator.resize();
    });

    // Load first sample by default
    if (SAMPLES.length > 0) {
      this.els.codeInput.value = SAMPLES[0].code;
      this.updateLineNumbers();
    }
  }

  populateSamples() {
    SAMPLES.forEach((sample, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${sample.name} — ${sample.description}`;
      this.els.sampleSelect.appendChild(opt);
    });
  }

  bindEvents() {
    // Sample selector
    this.els.sampleSelect.addEventListener('change', (e) => {
      const idx = parseInt(e.target.value);
      if (!isNaN(idx) && SAMPLES[idx]) {
        this.resetAll();
        this.els.codeInput.value = SAMPLES[idx].code;
        this.updateLineNumbers();
      }
    });

    // Code editing
    this.els.codeInput.addEventListener('input', () => {
      this.updateLineNumbers();
    });

    this.els.codeInput.addEventListener('scroll', () => {
      this.els.lineNumbers.scrollTop = this.els.codeInput.scrollTop;
    });

    // Tab key support in textarea
    this.els.codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        e.target.value = e.target.value.substring(0, start) + '    ' + e.target.value.substring(end);
        e.target.selectionStart = e.target.selectionEnd = start + 4;
        this.updateLineNumbers();
      }
    });

    // Buttons
    this.els.btnLoad.addEventListener('click', () => this.loadCode());
    this.els.btnEdit.addEventListener('click', () => this.enterEditMode());
    this.els.btnNext.addEventListener('click', () => this.stepForward());
    this.els.btnPrev.addEventListener('click', () => this.stepBack());
    this.els.btnPlay.addEventListener('click', () => this.togglePlay());
    this.els.btnReset.addEventListener('click', () => this.resetAll());

    // Speed slider
    this.els.speedSlider.addEventListener('input', (e) => {
      this.animationSpeed = parseInt(e.target.value);
      this.els.speedValue.textContent = `${this.animationSpeed}x`;
      // If playing, restart with new speed
      if (this.isPlaying) {
        this.stopPlay();
        this.startPlay();
      }
    });

    // Timeline Scrubber
    this.els.timelineScrubber.addEventListener('input', (e) => {
      if (!this.isLoaded) return;
      const targetStep = parseInt(e.target.value);
      this.scrubToStep(targetStep);
    });

    // Input modal
    this.els.btnSubmitInput.addEventListener('click', () => this.submitInput());
    this.els.inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submitInput();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

      switch (e.key) {
        case 'ArrowRight':
        case 'n':
          e.preventDefault();
          if (!this.els.btnNext.disabled) this.stepForward();
          break;
        case 'ArrowLeft':
        case 'p':
          e.preventDefault();
          if (!this.els.btnPrev.disabled) this.stepBack();
          break;
        case ' ':
          e.preventDefault();
          if (!this.els.btnPlay.disabled) this.togglePlay();
          break;
        case 'r':
          e.preventDefault();
          this.resetAll();
          break;
        case 'Escape':
          this.stopPlay();
          break;
      }
    });
  }

  // ===== Code Loading =====

  loadCode() {
    const code = this.els.codeInput.value.trim();
    if (!code) return;

    try {
      this.interpreter.load(code);
      this.isLoaded = true;
      this.isEditing = false;

      // Build highlighted display
      this.highlightedLines = highlightCode(code);
      this.renderCodeDisplay();

      // Switch to display mode
      this.els.codeInput.style.display = 'none';
      this.els.codeDisplay.style.display = 'block';

      // Reset zones
      this.resetZoneDisplays();

      // Update controls
      this.updateControlStates();
      this.setStatus('ready');

      // Update step counter
      this.els.stepTotal.textContent = '?';
      this.els.stepNum.textContent = '0';

    } catch (err) {
      console.error('Parse error:', err);
      this.showError(`Parse Error: ${err.message}`);
    }
  }

  enterEditMode() {
    this.stopPlay();
    this.isEditing = true;
    this.isLoaded = false;

    this.els.codeInput.style.display = 'block';
    this.els.codeDisplay.style.display = 'none';

    this.updateControlStates();
    this.setStatus('idle');
    this.animator.clear();
  }

  renderCodeDisplay() {
    let html = '';
    this.highlightedLines.forEach((lineHtml, i) => {
      html += `<span class="code-line" data-line="${i + 1}">${lineHtml || ' '}</span>\n`;
    });
    this.els.codeDisplay.innerHTML = html;

    // Update line numbers for display mode
    this.updateLineNumbers();
  }

  updateLineNumbers() {
    const text = this.isEditing ? this.els.codeInput.value : '';
    const lineCount = this.isEditing
      ? (text.split('\n').length || 1)
      : this.highlightedLines.length;

    let html = '';
    for (let i = 1; i <= lineCount; i++) {
      html += `<span class="line-num" data-line="${i}">${i}</span>`;
    }
    this.els.lineNumbers.innerHTML = html;
  }

  highlightActiveLine(lineNumber) {
    // Remove previous highlights
    this.els.codeDisplay.querySelectorAll('.code-line').forEach(el => {
      el.classList.remove('active-line');
    });

    // Remove previous active line number
    this.els.lineNumbers.querySelectorAll('.line-num').forEach(el => {
      el.classList.remove('active');
    });

    if (lineNumber > 0) {
      const codeLine = this.els.codeDisplay.querySelector(`.code-line[data-line="${lineNumber}"]`);
      if (codeLine) {
        codeLine.classList.add('active-line');
        codeLine.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }

      const lineNum = this.els.lineNumbers.querySelector(`.line-num[data-line="${lineNumber}"]`);
      if (lineNum) {
        lineNum.classList.add('active');
      }
    }
  }

  // ===== Stepping =====

  async stepForward() {
    if (!this.isLoaded || !this.interpreter.canStepForward()) return;

    if (this.interpreter.needsInput()) {
      this.showInputModal();
      return;
    }

    try {
      const snapshot = this.interpreter.step();
      this.applySnapshot(snapshot, true);
    } catch (err) {
      console.error('Runtime error:', err);
      this.showError(`Runtime Error: ${err.message}`);
      this.stopPlay();
    }
  }

  stepBack() {
    if (!this.isLoaded || !this.interpreter.canStepBack()) return;

    this.stopPlay();
    const snapshot = this.interpreter.stepBack();
    this.applySnapshot(snapshot, false);
  }

  async applySnapshot(snapshot, animate) {
    if (!snapshot) return;

    // Update step counter
    this.els.stepNum.textContent = snapshot.step + 1;

    // Highlight current line
    this.highlightActiveLine(snapshot.lineNumber);

    // Update zones
    this.updateDiskZone(snapshot);
    this.updateEngineZone(snapshot);
    this.updateRamZone(snapshot);
    this.updateOutputZone(snapshot);

    // Update status
    if (snapshot.isComplete) {
      this.setStatus('finished');
      this.stopPlay();
    } else if (snapshot.error) {
      this.setStatus('error');
      this.stopPlay();
    } else {
      this.setStatus('running');
    }

    // Update controls
    this.updateControlStates();

    // Animate data flow
    if (animate && snapshot.flowAnimations && snapshot.flowAnimations.length > 0) {
      try {
        await this.animator.animate(snapshot.flowAnimations);
      } catch (e) {
        // Animation errors are non-fatal
      }
    }
  }

  // ===== Zone Updates =====

  updateDiskZone(snapshot) {
    if (!snapshot.imports || snapshot.imports.length === 0) {
      this.els.diskBody.innerHTML = `
        <div class="zone-placeholder">
          <span class="placeholder-icon">📦</span>
          <span class="placeholder-text">No modules loaded</span>
        </div>`;
      return;
    }

    let html = '';
    snapshot.imports.forEach(mod => {
      html += `<div class="disk-module">
        <span class="disk-module-icon">📚</span>
        <span>${this.escapeHtml(mod)}</span>
      </div>`;
    });
    this.els.diskBody.innerHTML = html;
  }

  updateEngineZone(snapshot) {
    const lineNum = snapshot.lineNumber;
    const action = snapshot.cpuAction || 'Processing...';
    const rawLine = snapshot.lineDescriptor ? snapshot.lineDescriptor.raw.trim() : '';

    let actionIcon = '⚡';
    if (action.includes('Reading')) actionIcon = '📖';
    else if (action.includes('Math') || action.includes('Calculat')) actionIcon = '🔢';
    else if (action.includes('Storing') || action.includes('Assign')) actionIcon = '💾';
    else if (action.includes('Print') || action.includes('Output')) actionIcon = '🖨️';
    else if (action.includes('Loading') || action.includes('Import')) actionIcon = '📥';
    else if (action.includes('Condition') || action.includes('Evaluat')) actionIcon = '🔀';
    else if (action.includes('Loop') || action.includes('Iterat')) actionIcon = '🔄';
    else if (action.includes('Function') || action.includes('Call')) actionIcon = '📞';
    else if (action.includes('Return')) actionIcon = '↩️';

    let html = `
      <div class="engine-line-num">LINE ${lineNum}</div>
      <div class="engine-current-line">${this.escapeHtml(rawLine)}</div>
      <div class="engine-action">
        <span class="engine-action-icon">${actionIcon}</span>
        <div>
          <div class="engine-action-label">CPU Action</div>
          <div class="engine-action-text">${this.escapeHtml(action)}</div>
        </div>
      </div>`;

    if (snapshot.callStack && snapshot.callStack.length > 0) {
      html += `<div class="engine-call-stack">
        <div class="stack-header">CALL STACK</div>`;
      // Render stack top-down
      const stack = [...snapshot.callStack].reverse();
      stack.forEach((frame) => {
        html += `<div class="stack-frame">
          <span class="frame-icon">↳</span>
          <span class="frame-name">${this.escapeHtml(frame.funcName)}()</span>
        </div>`;
      });
      html += `</div>`;
    }

    this.els.engineBody.innerHTML = html;
  }

  updateRamZone(snapshot) {
    const vars = snapshot.variables;
    const varKeys = Object.keys(vars || {});

    if (varKeys.length === 0) {
      this.els.ramBody.innerHTML = `
        <div class="zone-placeholder">
          <span class="placeholder-icon">📊</span>
          <span class="placeholder-text">No variables in memory</span>
        </div>`;
      return;
    }

    let html = `<table class="ram-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>`;

    varKeys.forEach(name => {
      const v = vars[name];
      const changed = v.changed ? ' ram-row-changed' : '';
      const visualHtml = this.renderVisualMemory(v.value, v.type);

      html += `<tr class="${changed}">
        <td class="ram-var-name">${this.escapeHtml(name)}</td>
        <td class="ram-var-type">${this.escapeHtml(v.type || 'unknown')}</td>
        <td class="ram-var-value">${visualHtml}</td>
      </tr>`;
    });

    html += '</tbody></table>';
    this.els.ramBody.innerHTML = html;
  }

  renderVisualMemory(val, type) {
    if (type === 'list' && Array.isArray(val)) {
      if (val.length === 0) return '<div class="ram-visual-list empty">[]</div>';
      let html = '<div class="ram-visual-list">';
      val.forEach((item, idx) => {
        html += `<div class="ram-list-cell">
          <div class="ram-list-idx">${idx}</div>
          <div class="ram-list-val" title="${this.escapeHtml(String(item))}">${this.escapeHtml(this.formatValue(item))}</div>
        </div>`;
      });
      html += '</div>';
      return html;
    }
    if (type === 'dict' && typeof val === 'object' && val !== null) {
      const entries = Object.entries(val);
      if (entries.length === 0) return '<div class="ram-visual-dict empty">{}</div>';
      let html = '<div class="ram-visual-dict">';
      entries.forEach(([k, v]) => {
        html += `<div class="ram-dict-entry">
          <div class="ram-dict-key">${this.escapeHtml(k)}</div>
          <div class="ram-dict-arrow">→</div>
          <div class="ram-dict-val" title="${this.escapeHtml(String(v))}">${this.escapeHtml(this.formatValue(v))}</div>
        </div>`;
      });
      html += '</div>';
      return html;
    }
    if (typeof val === 'object' && val !== null && val.__userClass__) {
      const entries = Object.entries(val).filter(([k]) => k !== '__userClass__');
      let html = `<div class="ram-visual-object">
        <div class="ram-object-header">${this.escapeHtml(val.__userClass__)} Instance</div>`;
      if (entries.length === 0) {
        html += '<div class="ram-object-empty">(no attributes)</div>';
      } else {
        html += '<div class="ram-object-body">';
        entries.forEach(([k, v]) => {
          html += `<div class="ram-dict-entry">
            <div class="ram-dict-key">${this.escapeHtml(k)}</div>
            <div class="ram-dict-arrow">→</div>
            <div class="ram-dict-val" title="${this.escapeHtml(String(v))}">${this.escapeHtml(this.formatValue(v))}</div>
          </div>`;
        });
        html += '</div>';
      }
      html += '</div>';
      return html;
    }
    // Fallback to basic text
    const displayValue = this.formatValue(val);
    const truncated = displayValue.length > 80 ? displayValue.slice(0, 80) + '...' : displayValue;
    return `<span title="${this.escapeHtml(String(val))}">${this.escapeHtml(truncated)}</span>`;
  }

  updateOutputZone(snapshot) {
    const output = snapshot.output || [];
    const error = snapshot.error;

    if (output.length === 0 && !error) {
      this.els.outputBody.innerHTML = `
        <div class="console-output" id="consoleOutput">
          <span class="console-prompt">$&gt; </span>
          <span class="console-cursor">_</span>
        </div>`;
      return;
    }

    let html = '<div class="console-output">';

    output.forEach(line => {
      html += `<span class="console-line">${this.escapeHtml(line)}</span>`;
    });

    if (error) {
      html += `<span class="console-line console-error">${this.escapeHtml(error)}</span>`;
    }

    html += `<span class="console-prompt">$&gt; </span>`;
    html += `<span class="console-cursor">_</span>`;
    html += '</div>';

    this.els.outputBody.innerHTML = html;

    // Auto-scroll to bottom
    this.els.outputBody.scrollTop = this.els.outputBody.scrollHeight;
  }

  resetZoneDisplays() {
    this.els.diskBody.innerHTML = `
      <div class="zone-placeholder">
        <span class="placeholder-icon">📦</span>
        <span class="placeholder-text">No modules loaded</span>
      </div>`;

    this.els.engineBody.innerHTML = `
      <div class="zone-placeholder">
        <span class="placeholder-icon">⏳</span>
        <span class="placeholder-text">Awaiting code execution</span>
      </div>`;

    this.els.ramBody.innerHTML = `
      <div class="zone-placeholder">
        <span class="placeholder-icon">📊</span>
        <span class="placeholder-text">No variables in memory</span>
      </div>`;

    this.els.outputBody.innerHTML = `
      <div class="console-output" id="consoleOutput">
        <span class="console-prompt">$&gt; </span>
        <span class="console-cursor">_</span>
      </div>`;
  }

  // ===== Playback =====

  togglePlay() {
    if (this.isPlaying) {
      this.stopPlay();
    } else {
      this.startPlay();
    }
  }

  startPlay() {
    if (!this.isLoaded || this.interpreter.isFinished()) return;

    this.isPlaying = true;
    this.els.btnPlay.classList.add('playing');
    this.els.playIcon.textContent = '⏸';
    this.setStatus('running');

    this.playLoop();
  }

  async playLoop() {
    if (!this.isPlaying) return;

    if (this.interpreter.needsInput()) {
      this.stopPlay();
      this.showInputModal();
      return;
    }

    if (!this.interpreter.canStepForward()) {
      this.stopPlay();
      return;
    }

    await this.stepForward();

    if (this.isPlaying && this.interpreter.canStepForward()) {
      // Speed: 1 = 2000ms, 5 = 800ms, 10 = 100ms
      const delay = Math.max(100, 2200 - (this.animationSpeed * 220));
      this.playTimer = setTimeout(() => this.playLoop(), delay);
    } else {
      this.stopPlay();
    }
  }

  stopPlay() {
    this.isPlaying = false;
    if (this.playTimer) {
      clearTimeout(this.playTimer);
      this.playTimer = null;
    }
    this.els.btnPlay.classList.remove('playing');
    this.els.playIcon.textContent = '▶';

    if (this.isLoaded && !this.interpreter.isFinished()) {
      this.setStatus('paused');
    }
  }

  // ===== Input Handling =====

  showInputModal() {
    this.els.inputModal.style.display = 'flex';
    this.els.inputField.value = '';
    this.els.inputField.focus();
  }

  submitInput() {
    const value = this.els.inputField.value;
    this.els.inputModal.style.display = 'none';

    this.interpreter.provideInput(value);

    // Continue stepping
    this.stepForward();

    // Resume auto-play if it was playing
    if (this.isPlaying) {
      const delay = Math.max(100, 2200 - (this.animationSpeed * 220));
      this.playTimer = setTimeout(() => this.playLoop(), delay);
    }
  }

  // ===== Reset =====

  resetAll() {
    this.stopPlay();
    this.interpreter.reset();
    this.animator.clear();
    this.resetZoneDisplays();
    this.highlightActiveLine(0);

    this.els.stepNum.textContent = '0';
    this.els.stepTotal.textContent = '?';

    if (this.isLoaded) {
      this.setStatus('ready');
    } else {
      this.setStatus('idle');
    }

    this.updateControlStates();
  }

  // ===== Timeline Scrubber =====

  scrubToStep(targetStep) {
    if (targetStep === this.interpreter.stepCount) return;

    this.stopPlay();
    this.animator.clear();

    if (targetStep < this.interpreter.stepCount) {
      while (this.interpreter.stepCount > targetStep && this.interpreter.canStepBack()) {
        this.interpreter.stepBack();
      }
    } else {
      while (this.interpreter.stepCount < targetStep && this.interpreter.canStepForward()) {
        this.interpreter.step();
      }
    }

    const snap = this.interpreter.getSnapshot(this.interpreter.stepCount);
    if (snap) {
      this.updateUI(snap, false); // Update without animation
    }
  }

  // ===== UI State Management =====

  updateControlStates() {
    const loaded = this.isLoaded && !this.isEditing;
    const canForward = loaded && this.interpreter.canStepForward();
    const canBack = loaded && this.interpreter.canStepBack();

    this.els.btnNext.disabled = !canForward;
    this.els.btnPrev.disabled = !canBack;
    this.els.btnPlay.disabled = !canForward;
    this.els.btnEdit.disabled = false;
    this.els.btnLoad.disabled = false;

    this.els.timelineScrubber.disabled = !loaded;
    if (loaded) {
      this.els.timelineScrubber.max = this.interpreter.snapshots.length > 0 ? this.interpreter.snapshots.length - 1 : 0;
      this.els.timelineScrubber.value = this.interpreter.stepCount;
    }
  }

  setStatus(status) {
    const indicator = this.els.statusIndicator;
    indicator.className = 'status-indicator';

    switch (status) {
      case 'idle':
        this.els.statusText.textContent = 'IDLE';
        break;
      case 'ready':
        indicator.classList.add('paused');
        this.els.statusText.textContent = 'READY';
        break;
      case 'running':
        indicator.classList.add('running');
        this.els.statusText.textContent = 'RUNNING';
        break;
      case 'paused':
        indicator.classList.add('paused');
        this.els.statusText.textContent = 'PAUSED';
        break;
      case 'finished':
        indicator.classList.add('finished');
        this.els.statusText.textContent = 'COMPLETE';
        break;
      case 'error':
        this.els.statusText.textContent = 'ERROR';
        break;
    }
  }

  // ===== Utilities =====

  formatValue(value) {
    if (value === null || value === undefined) return 'None';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    if (Array.isArray(value)) {
      const items = value.map(v => this.formatValue(v)).join(', ');
      return `[${items}]`;
    }
    if (typeof value === 'object') {
      try {
        const entries = Object.entries(value).map(([k, v]) =>
          `${this.formatValue(k)}: ${this.formatValue(v)}`
        ).join(', ');
        return `{${entries}}`;
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showError(message) {
    // Show error in output console
    const currentOutput = this.els.outputBody.querySelector('.console-output');
    if (currentOutput) {
      const errSpan = document.createElement('span');
      errSpan.className = 'console-line console-error';
      errSpan.textContent = message;
      currentOutput.insertBefore(errSpan, currentOutput.querySelector('.console-prompt'));
    }
    this.setStatus('error');
    this.stopPlay();
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  window.app = new Controller();
});

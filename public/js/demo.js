/**
 * ============================================================================
 * Smart Borewell Water Level Monitoring System
 * Interactive Demo Mode & Test Harness Simulator
 * ============================================================================
 */

class DemoManager {
  constructor() {
    this.isRunning = false;
    this.timer = null;
    this.stepIndex = 0;

    // Simulation steps as requested by user
    this.demoSequence = [
      {
        name: "NORMAL",
        distance: 100,
        waterLevel: 100,
        percentage: 50,
        status: "NORMAL",
        pump: false,
        buzzer: false,
        source: "DEMO_SIMULATION"
      },
      {
        name: "LOW",
        distance: 180,
        waterLevel: 20,
        percentage: 10,
        status: "LOW",
        pump: true,
        buzzer: false,
        source: "DEMO_SIMULATION"
      },
      {
        name: "CRITICAL",
        distance: 195,
        waterLevel: 5,
        percentage: 2.5,
        status: "CRITICAL",
        pump: false,
        buzzer: true,
        source: "DEMO_SIMULATION"
      }
    ];
  }

  init() {
    this.bindButtons();
    this.bindSlider();
  }

  bindButtons() {
    const btnToggle = document.getElementById('btnToggleDemo');
    const labelToggle = document.getElementById('demoBtnLabel');

    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        if (this.isRunning) {
          this.stopDemo();
        } else {
          this.startDemo();
        }
      });
    }

    // NORMAL TEST buttons
    const btnNormal1 = document.getElementById('btnQuickNormal');
    const btnNormal2 = document.getElementById('btnTestNormal');
    const triggerNormal = () => {
      this.stopDemo();
      this.applyReading({
        distance: 100,
        waterLevel: 100,
        percentage: 50,
        status: "NORMAL",
        pump: false,
        buzzer: false,
        source: "NORMAL_TEST"
      });
    };
    if (btnNormal1) btnNormal1.addEventListener('click', triggerNormal);
    if (btnNormal2) btnNormal2.addEventListener('click', triggerNormal);

    // LOW TEST buttons
    const btnLow1 = document.getElementById('btnQuickLow');
    const btnLow2 = document.getElementById('btnTestLow');
    const triggerLow = () => {
      this.stopDemo();
      this.applyReading({
        distance: 180,
        waterLevel: 20,
        percentage: 10,
        status: "LOW",
        pump: true,
        buzzer: false,
        source: "LOW_TEST"
      });
    };
    if (btnLow1) btnLow1.addEventListener('click', triggerLow);
    if (btnLow2) btnLow2.addEventListener('click', triggerLow);

    // CRITICAL TEST buttons
    const btnCrit1 = document.getElementById('btnQuickCritical');
    const btnCrit2 = document.getElementById('btnTestCritical');
    const triggerCrit = () => {
      this.stopDemo();
      this.applyReading({
        distance: 195,
        waterLevel: 5,
        percentage: 2.5,
        status: "CRITICAL",
        pump: false,
        buzzer: true,
        source: "CRITICAL_TEST"
      });
    };
    if (btnCrit1) btnCrit1.addEventListener('click', triggerCrit);
    if (btnCrit2) btnCrit2.addEventListener('click', triggerCrit);
  }

  bindSlider() {
    const slider = document.getElementById('distanceRangeSlider');
    const display = document.getElementById('sliderValueDisplay');

    if (slider) {
      slider.addEventListener('input', (e) => {
        this.stopDemo();
        const dist = Number(e.target.value);
        if (display) display.textContent = dist;

        const level = Math.max(0, 200 - dist);
        const pct = Number(((level / 200) * 100).toFixed(1));

        let status = "NORMAL";
        let pump = false;
        let buzzer = false;

        if (level >= 30) {
          status = "NORMAL";
          pump = false;
          buzzer = false;
        } else if (level >= 15) {
          status = "LOW";
          pump = true;
          buzzer = false;
        } else {
          status = "CRITICAL";
          pump = false;
          buzzer = true;
        }

        this.applyReading({
          distance: dist,
          waterLevel: level,
          percentage: pct,
          status,
          pump,
          buzzer,
          source: "MANUAL_SLIDER"
        });
      });
    }
  }

  startDemo() {
    this.isRunning = true;
    const btnToggle = document.getElementById('btnToggleDemo');
    const labelToggle = document.getElementById('demoBtnLabel');

    if (btnToggle) btnToggle.classList.add('active');
    if (labelToggle) labelToggle.textContent = 'Stop Demo';

    setConnectionStatus('demo', '● DEMO SIMULATION');

    // Run first step immediately
    this.stepIndex = 0;
    this.executeStep();

    // Loop through steps every 4 seconds
    this.timer = setInterval(() => {
      this.stepIndex = (this.stepIndex + 1) % this.demoSequence.length;
      this.executeStep();
    }, 4000);
  }

  stopDemo() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;

    const btnToggle = document.getElementById('btnToggleDemo');
    const labelToggle = document.getElementById('demoBtnLabel');
    if (btnToggle) btnToggle.classList.remove('active');
    if (labelToggle) labelToggle.textContent = 'Start Demo';

    // Revert connection status based on API reachability
    if (window.ApiConfig && ApiConfig.isApiReachable) {
      setConnectionStatus('connected', '● ESP32 CONNECTED');
    } else {
      setConnectionStatus('offline', '● ESP32 OFFLINE');
    }
  }

  executeStep() {
    const item = this.demoSequence[this.stepIndex];
    this.applyReading(item);
  }

  applyReading(payload) {
    updateDashboard(payload);
    // Also send to backend if alive to store in backend history
    if (typeof postReadingToApi === 'function') {
      postReadingToApi(payload);
    }
  }
}

// Global instance for cross-script control
window.demoManager = new DemoManager();

document.addEventListener('DOMContentLoaded', () => {
  window.demoManager.init();
});

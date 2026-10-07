/**
 * ============================================================================
 * Smart Borewell Water Level Monitoring System
 * Dashboard Logic, Visualizations, Canvas Chart & Web Audio Buzzer
 * ============================================================================
 */

// Global Dashboard State
const dashboardState = {
  waterLevel: 100,
  percentage: 50,
  distance: 100,
  status: "NORMAL",
  pump: false,
  buzzer: false,
  greenLed: true,
  redLed: false,
  lastUpdated: new Date(),
  source: "INITIAL_DEMO",
  isEspConnected: false,
  soundEnabled: false, // Default false until user interacts
  audioCtx: null,
  buzzerOscillator: null,
  history: []
};

// Depth Specification
const BOREWELL_DEPTH = 200.0; // cm
const LOW_THRESHOLD = 30.0;   // cm
const CRITICAL_THRESHOLD = 15.0; // cm

// Web Audio API Buzzer Alarm Generator
function initAudio() {
  if (!dashboardState.audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      dashboardState.audioCtx = new AudioContext();
    }
  }
}

function playBuzzerTone(enable) {
  if (!dashboardState.soundEnabled) {
    stopBuzzerTone();
    return;
  }
  
  initAudio();
  if (!dashboardState.audioCtx) return;

  if (enable) {
    if (!dashboardState.buzzerOscillator) {
      try {
        const osc = dashboardState.audioCtx.createOscillator();
        const gain = dashboardState.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, dashboardState.audioCtx.currentTime); // 880Hz Beep
        gain.gain.setValueAtTime(0.08, dashboardState.audioCtx.currentTime);

        osc.connect(gain);
        gain.connect(dashboardState.audioCtx.destination);
        osc.start();
        dashboardState.buzzerOscillator = osc;
      } catch (e) {
        console.warn('Audio playback error', e);
      }
    }
  } else {
    stopBuzzerTone();
  }
}

function stopBuzzerTone() {
  if (dashboardState.buzzerOscillator) {
    try {
      dashboardState.buzzerOscillator.stop();
      dashboardState.buzzerOscillator.disconnect();
    } catch (e) {}
    dashboardState.buzzerOscillator = null;
  }
}

/**
 * CORE FUNCTION: updateDashboard(data)
 * As requested: Accepts JSON payload and automatically updates all UI elements
 *
 * Example data:
 * {
 *   "waterLevel": 100,
 *   "percentage": 50,
 *   "distance": 100,
 *   "status": "NORMAL",
 *   "pump": false,
 *   "buzzer": false
 * }
 */
function updateDashboard(data) {
  if (!data) return;

  // 1. Calculate and normalize values if needed
  let distance = typeof data.distance !== 'undefined' ? Number(data.distance) : dashboardState.distance;
  let waterLevel = typeof data.waterLevel !== 'undefined' ? Number(data.waterLevel) : (BOREWELL_DEPTH - distance);

  // Bounds checks
  waterLevel = Math.max(0, Math.min(BOREWELL_DEPTH, waterLevel));
  distance = Math.max(0, Math.min(BOREWELL_DEPTH, distance));

  let percentage = typeof data.percentage !== 'undefined' 
    ? Number(data.percentage) 
    : Number(((waterLevel / BOREWELL_DEPTH) * 100).toFixed(1));
  percentage = Math.max(0, Math.min(100, percentage));

  // Determine status & rules
  let status = data.status;
  let pump = typeof data.pump !== 'undefined' ? Boolean(data.pump) : false;
  let buzzer = typeof data.buzzer !== 'undefined' ? Boolean(data.buzzer) : false;

  if (!status) {
    if (waterLevel >= LOW_THRESHOLD) {
      status = "NORMAL";
      pump = false;
      buzzer = false;
    } else if (waterLevel >= CRITICAL_THRESHOLD) {
      status = "LOW";
      pump = true;
      buzzer = false;
    } else {
      status = "CRITICAL";
      pump = false;
      buzzer = true;
    }
  }

  // Update internal state
  dashboardState.waterLevel = Number(waterLevel.toFixed(1));
  dashboardState.percentage = Number(percentage.toFixed(1));
  dashboardState.distance = Number(distance.toFixed(1));
  dashboardState.status = status;
  dashboardState.pump = pump;
  dashboardState.buzzer = buzzer;
  dashboardState.greenLed = (status === "NORMAL");
  dashboardState.redLed = (status === "LOW" || status === "CRITICAL");
  dashboardState.lastUpdated = data.timestamp ? new Date(data.timestamp) : new Date();
  if (data.source) dashboardState.source = data.source;

  // 2. Update KPI 1: WATER LEVEL
  const elWaterLevel = document.getElementById('valWaterLevel');
  if (elWaterLevel) elWaterLevel.textContent = dashboardState.waterLevel.toFixed(1);

  // 3. Update KPI 2: WATER PERCENTAGE
  const elPercentage = document.getElementById('valPercentage');
  if (elPercentage) elPercentage.textContent = dashboardState.percentage.toFixed(1);

  const elKpiProgress = document.getElementById('kpiProgressFill');
  if (elKpiProgress) {
    elKpiProgress.style.width = dashboardState.percentage + '%';
    elKpiProgress.className = 'progress-bar-fill ' + status.toLowerCase();
  }

  // 4. Update KPI 3: WATER STATUS
  const elStatusBadge = document.getElementById('valStatusBadge');
  if (elStatusBadge) {
    elStatusBadge.textContent = status;
    elStatusBadge.className = 'status-badge ' + status.toLowerCase();
  }

  const elStatusText = document.getElementById('statusConditionText');
  if (elStatusText) {
    if (status === 'NORMAL') {
      elStatusText.innerHTML = '<span>Level &ge; 30 cm &bull; Safe Condition</span>';
    } else if (status === 'LOW') {
      elStatusText.innerHTML = '<span style="color: var(--status-low);">15 &le; Level &lt; 30 cm &bull; Low Water Alert</span>';
    } else {
      elStatusText.innerHTML = '<span style="color: var(--status-critical);">Level &lt; 15 cm &bull; Critical Dry Alert</span>';
    }
  }

  // 5. Update KPI 4: SENSOR DISTANCE
  const elDistance = document.getElementById('valDistance');
  if (elDistance) elDistance.textContent = dashboardState.distance.toFixed(1);

  // 6. Update KPI 5: PUMP STATUS
  const elPumpBadge = document.getElementById('valPumpBadge');
  const elPumpIcon = document.getElementById('kpiPumpIcon');
  const elPumpSub = document.getElementById('pumpSubtext');
  if (elPumpBadge) {
    elPumpBadge.textContent = pump ? 'ON' : 'OFF';
    elPumpBadge.className = 'pump-badge ' + (pump ? 'on' : 'off');
  }
  if (elPumpIcon) {
    if (pump) elPumpIcon.classList.add('spinning-pump');
    else elPumpIcon.classList.remove('spinning-pump');
  }
  if (elPumpSub) {
    elPumpSub.innerHTML = pump 
      ? '<span style="color: var(--accent-blue);">Relay GPIO 26: Pumping Active</span>' 
      : '<span>Relay GPIO 26: Idle</span>';
  }

  // 7. Update KPI 6: LAST UPDATED
  const elLastUpdated = document.getElementById('valLastUpdated');
  if (elLastUpdated) {
    elLastUpdated.textContent = dashboardState.lastUpdated.toLocaleTimeString();
  }

  const elSource = document.getElementById('valDataSourceTag');
  if (elSource) {
    elSource.textContent = `Source: ${dashboardState.source}`;
  }

  // 8. Update Tank Visualization
  updateTankVisualization(dashboardState.percentage, dashboardState.distance, status, pump);

  // 9. Update Alert Notifications & Web Audio
  renderAlertBanner(status);
  playBuzzerTone(buzzer);

  // 10. Update System Status & Hardware Indicators
  updateHardwareStatus(status, pump, buzzer);

  // 11. Sync Manual Slider without recursion
  const rangeSlider = document.getElementById('distanceRangeSlider');
  const sliderDisplay = document.getElementById('sliderValueDisplay');
  if (rangeSlider && document.activeElement !== rangeSlider) {
    rangeSlider.value = dashboardState.distance;
  }
  if (sliderDisplay) {
    sliderDisplay.textContent = Math.round(dashboardState.distance);
  }

  // 12. Save Reading to History
  recordHistory({
    waterLevel: dashboardState.waterLevel,
    percentage: dashboardState.percentage,
    distance: dashboardState.distance,
    status: dashboardState.status,
    pump: dashboardState.pump,
    buzzer: dashboardState.buzzer,
    timestamp: dashboardState.lastUpdated.toISOString()
  });
}

/**
 * Update the vertical Borewell Tank visualization
 */
function updateTankVisualization(percentage, distance, status, pump) {
  const liquid = document.getElementById('tankLiquidBody');
  const beamLine = document.getElementById('sensorBeamLine');
  const readoutPct = document.getElementById('readoutPercentage');
  const readoutLevel = document.getElementById('readoutWaterLevel');
  const readoutBar = document.getElementById('readoutProgressBar');
  const readoutAir = document.getElementById('readoutAirGap');
  const readoutPump = document.getElementById('readoutPumpState');
  const readoutBuzzer = document.getElementById('readoutBuzzerState');
  const pumpGraphic = document.getElementById('submersiblePumpGraphic');

  // Height of water inside vertical tank
  if (liquid) {
    liquid.style.height = `${percentage}%`;
  }

  // Length of sensor beam line representing air gap
  if (beamLine) {
    const beamPct = (distance / BOREWELL_DEPTH) * 100;
    beamLine.style.height = `${Math.min(220, beamPct * 2.2)}px`;
  }

  // Readout numbers
  if (readoutPct) readoutPct.textContent = `${percentage.toFixed(1)}%`;
  if (readoutLevel) readoutLevel.textContent = (BOREWELL_DEPTH * (percentage / 100)).toFixed(1);
  if (readoutBar) {
    readoutBar.style.width = `${percentage}%`;
    readoutBar.className = 'progress-bar-fill ' + status.toLowerCase();
  }
  if (readoutAir) readoutAir.textContent = `${distance.toFixed(1)} cm`;
  if (readoutPump) {
    readoutPump.textContent = pump ? 'ON (Active)' : 'OFF (Idle)';
    readoutPump.style.color = pump ? 'var(--accent-blue)' : 'var(--text-muted)';
  }
  if (readoutBuzzer) {
    readoutBuzzer.textContent = dashboardState.buzzer ? 'ON (ALARM)' : 'OFF';
    readoutBuzzer.style.color = dashboardState.buzzer ? 'var(--status-critical)' : 'var(--text-muted)';
  }

  // Submersible pump glow
  if (pumpGraphic) {
    if (pump) pumpGraphic.classList.add('active');
    else pumpGraphic.classList.remove('active');
  }
}

/**
 * Render Top Alert Notification Banners
 */
function renderAlertBanner(status) {
  const container = document.getElementById('alertBannerContainer');
  const navBadge = document.getElementById('navAlertBadge');
  if (!container) return;

  if (status === 'LOW') {
    container.innerHTML = `
      <div class="alert-banner low">
        <div class="alert-icon-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <div class="alert-banner-text">
          <div class="alert-banner-title">Warning: Borewell water level is low.</div>
          <div class="alert-banner-desc">Current level is below 30 cm threshold. Submersible pump has been engaged.</div>
        </div>
        <button class="alert-banner-close" onclick="this.parentElement.remove()" title="Dismiss">&times;</button>
      </div>
    `;
    if (navBadge) {
      navBadge.style.display = 'inline-block';
      navBadge.textContent = 'LOW';
      navBadge.style.background = 'rgba(245, 158, 11, 0.2)';
      navBadge.style.color = 'var(--status-low)';
    }
    logAlert('Warning: Borewell water level is low (Pump Started)');
  } else if (status === 'CRITICAL') {
    container.innerHTML = `
      <div class="alert-banner critical">
        <div class="alert-icon-box">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
        </div>
        <div class="alert-banner-text">
          <div class="alert-banner-title">Critical Alert: Borewell water level is critically low.</div>
          <div class="alert-banner-desc">Danger of pump dry running (&lt; 15 cm). Pump halted immediately & buzzer audio alert activated.</div>
        </div>
        <button class="alert-banner-close" onclick="this.parentElement.remove()" title="Dismiss">&times;</button>
      </div>
    `;
    if (navBadge) {
      navBadge.style.display = 'inline-block';
      navBadge.textContent = 'CRITICAL';
      navBadge.style.background = 'rgba(239, 68, 68, 0.2)';
      navBadge.style.color = 'var(--status-critical)';
    }
    logAlert('Critical Alert: Borewell water level is critically low (Dry-Run Protection Active)');
  } else {
    // NORMAL
    container.innerHTML = '';
    if (navBadge) navBadge.style.display = 'none';
  }
}

// Log alert items into the Alerts tab
const alertLogs = [];
function logAlert(message) {
  const time = new Date().toLocaleTimeString();
  if (alertLogs.length > 0 && alertLogs[0].message === message) return; // avoid duplicate consecutive logs
  alertLogs.unshift({ message, time });
  if (alertLogs.length > 20) alertLogs.pop();

  const list = document.getElementById('alertsLogList');
  if (list) {
    list.innerHTML = alertLogs.map(item => `
      <div style="background: rgba(0,0,0,0.25); border: 1px solid var(--border-color); padding: 10px 14px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
        <span style="color: #fff;">${item.message}</span>
        <span style="color: var(--text-muted); font-size: 0.75rem;">${item.time}</span>
      </div>
    `).join('');
  }
}

/**
 * Update Hardware Indicators in System Status Tab
 */
function updateHardwareStatus(status, pump, buzzer) {
  const hwGreenLed = document.getElementById('hwGreenLedBulb');
  const hwGreenStatus = document.getElementById('hwGreenLedStatus');
  const hwRedLed = document.getElementById('hwRedLedBulb');
  const hwRedStatus = document.getElementById('hwRedLedStatus');
  const hwBuzzer = document.getElementById('hwBuzzerBulb');
  const hwBuzzerStatus = document.getElementById('hwBuzzerStatus');
  const hwRelayStatus = document.getElementById('hwRelayStatus');

  if (status === 'NORMAL') {
    if (hwGreenLed) hwGreenLed.className = 'led-indicator-bulb green-on';
    if (hwGreenStatus) { hwGreenStatus.textContent = 'ON'; hwGreenStatus.className = 'status-tag active'; }

    if (hwRedLed) hwRedLed.className = 'led-indicator-bulb';
    if (hwRedStatus) { hwRedStatus.textContent = 'OFF'; hwRedStatus.className = 'status-tag inactive'; }
  } else {
    if (hwGreenLed) hwGreenLed.className = 'led-indicator-bulb';
    if (hwGreenStatus) { hwGreenStatus.textContent = 'OFF'; hwGreenStatus.className = 'status-tag inactive'; }

    if (hwRedLed) hwRedLed.className = 'led-indicator-bulb red-on';
    if (hwRedStatus) { hwRedStatus.textContent = 'ON'; hwRedStatus.className = 'status-tag active'; }
  }

  if (hwBuzzer) hwBuzzer.className = buzzer ? 'led-indicator-bulb buzzer-on' : 'led-indicator-bulb';
  if (hwBuzzerStatus) {
    hwBuzzerStatus.textContent = buzzer ? 'ON' : 'OFF';
    hwBuzzerStatus.className = buzzer ? 'status-tag active' : 'status-tag inactive';
  }

  if (hwRelayStatus) {
    hwRelayStatus.textContent = pump ? 'ON' : 'OFF';
    hwRelayStatus.className = pump ? 'status-tag active' : 'status-tag inactive';
  }
}

/**
 * Connection Status Pill Controller
 */
function setConnectionStatus(type, label) {
  const pill = document.getElementById('connectionPill');
  const text = document.getElementById('connectionLabel');
  const sideDot = document.getElementById('sidebarDot');
  const sideText = document.getElementById('sidebarStatusText');
  const hwEsp = document.getElementById('hwEsp32Status');
  if (!pill || !text) return;

  pill.className = 'connection-pill ' + type;
  text.textContent = label;

  if (type === 'connected') {
    dashboardState.isEspConnected = true;
    if (sideDot) sideDot.className = 'esp-status-dot online';
    if (sideText) sideText.textContent = 'ESP32 Connected';
    if (hwEsp) { hwEsp.className = 'status-tag active'; hwEsp.textContent = 'Connected'; }
  } else if (type === 'demo') {
    if (sideDot) sideDot.className = 'esp-status-dot online';
    if (sideText) sideText.textContent = 'Demo Active';
    if (hwEsp) { hwEsp.className = 'status-tag active'; hwEsp.textContent = 'Demo Mode'; }
  } else {
    dashboardState.isEspConnected = false;
    if (sideDot) sideDot.className = 'esp-status-dot offline';
    if (sideText) sideText.textContent = 'ESP32 Offline';
    if (hwEsp) { hwEsp.className = 'status-tag inactive'; hwEsp.textContent = 'Offline'; }
  }
}

/**
 * ============================================================================
 * History & HTML5 Canvas Line Chart
 * ============================================================================
 */

function recordHistory(entry) {
  dashboardState.history.push(entry);
  if (dashboardState.history.length > 50) {
    dashboardState.history.shift();
  }

  try {
    localStorage.setItem('borewell_history', JSON.stringify(dashboardState.history));
  } catch (e) {}

  renderHistoryTable();
  drawHistoryChart();
}

function loadHistoryFromStorage() {
  try {
    const raw = localStorage.getItem('borewell_history');
    if (raw) {
      dashboardState.history = JSON.parse(raw);
    }
  } catch (e) {}

  if (!dashboardState.history || dashboardState.history.length === 0) {
    // Populate realistic initial data
    const now = Date.now();
    for (let i = 10; i >= 0; i--) {
      dashboardState.history.push({
        waterLevel: 95 + Math.round(Math.sin(i) * 15),
        percentage: 47.5 + Number((Math.sin(i) * 7.5).toFixed(1)),
        distance: 105 - Math.round(Math.sin(i) * 15),
        status: "NORMAL",
        pump: false,
        buzzer: false,
        timestamp: new Date(now - i * 60000).toISOString()
      });
    }
  }

  renderHistoryTable();
  drawHistoryChart();
}

function renderHistoryTable() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  const recent = [...dashboardState.history].reverse().slice(0, 10);
  tbody.innerHTML = recent.map(row => {
    const timeStr = new Date(row.timestamp).toLocaleTimeString();
    const statusClass = (row.status || 'NORMAL').toLowerCase();
    return `
      <tr>
        <td>${timeStr}</td>
        <td>${row.distance} cm</td>
        <td><strong>${row.waterLevel} cm</strong></td>
        <td>${row.percentage}%</td>
        <td><span class="status-badge ${statusClass}" style="font-size: 0.72rem; padding: 2px 8px;">${row.status}</span></td>
        <td>${row.pump ? '<span style="color: var(--accent-blue);">ON</span>' : 'OFF'}</td>
        <td>${row.buzzer ? '<span style="color: var(--status-critical);">ON</span>' : 'OFF'}</td>
      </tr>
    `;
  }).join('');
}

// Canvas Line Chart Renderer with High-DPI support
function drawHistoryChart() {
  const canvas = document.getElementById('historyCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  if (rect.width === 0 || rect.height === 0) return;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 35;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  ctx.clearRect(0, 0, width, height);

  const history = dashboardState.history;
  if (history.length < 2) return;

  // Grid Lines & Axis Labels
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#64748b';
  ctx.font = '10px Inter, sans-serif';

  const stepsY = 4;
  for (let i = 0; i <= stepsY; i++) {
    const yVal = Math.round((200 / stepsY) * (stepsY - i));
    const yPos = padTop + (plotHeight / stepsY) * i;

    ctx.beginPath();
    ctx.moveTo(padLeft, yPos);
    ctx.lineTo(width - padRight, yPos);
    ctx.stroke();

    ctx.fillText(`${yVal}cm`, 8, yPos + 3);
  }

  // Draw Line 1: Water Level (cm) - Cyan Blue
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();

  history.forEach((pt, idx) => {
    const x = padLeft + (idx / (history.length - 1)) * plotWidth;
    const y = padTop + plotHeight - (pt.waterLevel / 200) * plotHeight;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Draw Line 2: Water Percentage (%) - Green
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();

  history.forEach((pt, idx) => {
    const x = padLeft + (idx / (history.length - 1)) * plotWidth;
    const y = padTop + plotHeight - (pt.percentage / 100) * plotHeight;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]); // Reset dash

  // Points on latest reading
  const lastPt = history[history.length - 1];
  const lastX = width - padRight;
  const lastY = padTop + plotHeight - (lastPt.waterLevel / 200) * plotHeight;

  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(lastX, lastY, 2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * ============================================================================
 * DOM Initialization & Navigation Tab Switching
 * ============================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Navigation Tab Switching
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.tab-section');

  function switchTab(tabId) {
    navItems.forEach(item => {
      if (item.dataset.tab === tabId) item.classList.add('active');
      else item.classList.remove('active');
    });

    sections.forEach(sec => {
      if (sec.id === `sec-${tabId}`) sec.classList.add('active');
      else sec.classList.remove('active');
    });

    if (tabId === 'history') {
      setTimeout(drawHistoryChart, 100);
    }

    // Close mobile menu
    const sidebar = document.getElementById('appSidebar');
    if (sidebar) sidebar.classList.remove('open');
  }

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(item.dataset.tab);
    });
  });

  // Mobile menu toggle
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('appSidebar');
  if (mobileBtn && sidebar) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // 2. Sound Toggle Button
  const soundBtn = document.getElementById('btnToggleSound');
  const iconOn = document.getElementById('soundIconOn');
  const iconOff = document.getElementById('soundIconOff');

  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      initAudio();
      dashboardState.soundEnabled = !dashboardState.soundEnabled;
      if (dashboardState.soundEnabled) {
        iconOn.style.display = 'block';
        iconOff.style.display = 'none';
        soundBtn.style.color = 'var(--accent-cyan)';
      } else {
        iconOn.style.display = 'none';
        iconOff.style.display = 'block';
        soundBtn.style.color = 'var(--text-muted)';
        stopBuzzerTone();
      }
    });
  }

  // 3. Clear History Button
  const btnClearHist = document.getElementById('btnClearHistory');
  if (btnClearHist) {
    btnClearHist.addEventListener('click', () => {
      dashboardState.history = [
        {
          waterLevel: dashboardState.waterLevel,
          percentage: dashboardState.percentage,
          distance: dashboardState.distance,
          status: dashboardState.status,
          pump: dashboardState.pump,
          buzzer: dashboardState.buzzer,
          timestamp: new Date().toISOString()
        }
      ];
      localStorage.removeItem('borewell_history');
      renderHistoryTable();
      drawHistoryChart();
    });
  }

  // 4. Export CSV Button
  const btnExport = document.getElementById('btnExportCsv');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      if (!dashboardState.history.length) return;
      let csv = 'Timestamp,Distance_cm,WaterLevel_cm,Percentage,Status,Pump,Buzzer\n';
      dashboardState.history.forEach(r => {
        csv += `${r.timestamp},${r.distance},${r.waterLevel},${r.percentage},${r.status},${r.pump},${r.buzzer}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `borewell_readings_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // 5. Populate Wokwi Code Viewer
  loadWokwiCodeIntoViewer();

  // 6. Handle Resize for Canvas
  window.addEventListener('resize', () => {
    drawHistoryChart();
  });

  // 7. Initialize Initial State & Storage
  loadHistoryFromStorage();
  updateDashboard(dashboardState);
});

// Load the Arduino sketch into the viewer in the Wokwi tab
async function loadWokwiCodeIntoViewer() {
  const viewer = document.getElementById('wokwiCodeViewerContent');
  const copyBtn1 = document.getElementById('btnCopyWokwiCode');
  const copyBtn2 = document.getElementById('btnCopyCodeViewer');
  if (!viewer) return;

  const sampleSketch = `// =========================================================================
// SMART BOREWELL WATER LEVEL MONITORING SYSTEM (ESP32)
// Ready for Wokwi Simulation (https://wokwi.com/projects/477225704074108929)
// =========================================================================

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFi.h>
#include <HTTPClient.h>

#define TRIG_PIN 5
#define ECHO_PIN 18
#define GREEN_LED 19
#define RED_LED 4
#define BUZZER_PIN 23
#define RELAY_PIN 26

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

const float BOREWELL_DEPTH = 200.0;
const float LOW_LEVEL = 30.0;
const float CRITICAL_LEVEL = 15.0;

// Wi-Fi Setup for Wokwi or Real Hardware
const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";

// Active Live Public Tunnel (reaches your local dashboard from Wokwi):
const char* API_URL = "http://490d6dcf187347.lhr.life/api/water-level";

float getDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return -1;
  return duration / 58.0;
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);

  Wire.begin(21, 22);
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(15, 20);
  display.println("SMART BOREWELL");
  display.display();

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void loop() {
  float distance = getDistance();
  if (distance < 0) return;
  if (distance > BOREWELL_DEPTH) distance = BOREWELL_DEPTH;

  float waterLevel = BOREWELL_DEPTH - distance;
  if (waterLevel < 0) waterLevel = 0;
  if (waterLevel > BOREWELL_DEPTH) waterLevel = BOREWELL_DEPTH;
  float percentage = (waterLevel / BOREWELL_DEPTH) * 100.0;

  String status = "NORMAL";
  bool pump = false;
  bool buzzer = false;

  if (waterLevel >= LOW_LEVEL) {
    status = "NORMAL";
    pump = false; buzzer = false;
    digitalWrite(GREEN_LED, HIGH);
    digitalWrite(RED_LED, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(RELAY_PIN, LOW);
  } else if (waterLevel >= CRITICAL_LEVEL) {
    status = "LOW";
    pump = true; buzzer = false;
    digitalWrite(GREEN_LED, LOW);
    digitalWrite(RED_LED, HIGH);
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(RELAY_PIN, HIGH);
  } else {
    status = "CRITICAL";
    pump = false; buzzer = true;
    digitalWrite(GREEN_LED, LOW);
    digitalWrite(RED_LED, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
    digitalWrite(RELAY_PIN, LOW);
  }

  // Send REST API POST immediately if distance changed by >= 0.8cm or every 1.5s
  static float lastSentDist = -999.0;
  bool changed = abs(distance - lastSentDist) >= 0.8;

  if ((changed || (millis() - lastSendTime >= 1500)) && WiFi.status() == WL_CONNECTED) {
    lastSendTime = millis();
    lastSentDist = distance;
    HTTPClient http;
    http.begin(API_URL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Bypass-Tunnel-Reminder", "true");
    String body = "{\\"waterLevel\\":" + String(waterLevel, 1) + 
                  ",\\"percentage\\":" + String(percentage, 1) + 
                  ",\\"distance\\":" + String(distance, 1) + 
                  ",\\"status\\":\\"" + status + "\\"" +
                  ",\\"pump\\":" + String(pump ? "true" : "false") + 
                  ",\\"buzzer\\":" + String(buzzer ? "true" : "false") + "}";
    http.POST(body);
    http.end();
  }

  delay(60);
}`;

  viewer.textContent = sampleSketch;

  const copyFn = () => {
    navigator.clipboard.writeText(sampleSketch).then(() => {
      alert('✅ ESP32 Arduino code copied to clipboard! Paste it directly into Wokwi sketch.ino.');
    });
  };

  if (copyBtn1) copyBtn1.addEventListener('click', copyFn);
  if (copyBtn2) copyBtn2.addEventListener('click', copyFn);
}

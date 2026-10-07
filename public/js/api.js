/**
 * ============================================================================
 * Smart Borewell Water Level Monitoring System
 * REST API Client & Server-Sent Events (SSE) Stream Manager
 * ============================================================================
 */

const ApiConfig = {
  // Use current host automatically or configured targets
  apiUrl: localStorage.getItem('cfg_api_url') || (window.location.origin.startsWith('http') ? `${window.location.origin}/api/water-level` : 'http://localhost:3000/api/water-level'),
  esp32Ip: localStorage.getItem('cfg_esp32_ip') || '192.168.1.150',
  wifiServerUrl: localStorage.getItem('cfg_wifi_server_url') || (window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:3000'),
  pollingIntervalMs: Number(localStorage.getItem('cfg_poll_interval')) || 1000,

  // Stream & polling state
  eventSource: null,
  pollTimer: null,
  isApiReachable: false,
  offlineFailureCount: 0
};

/**
 * Initialize API connections and listeners
 */
function initApiConnection() {
  bindConfigForm();
  connectEventStream();
  startPollingFallback();
}

/**
 * Server-Sent Events (SSE) for zero-latency instant updates
 */
function connectEventStream() {
  if (ApiConfig.eventSource) {
    ApiConfig.eventSource.close();
    ApiConfig.eventSource = null;
  }

  // Derive stream URL
  const baseUrl = ApiConfig.wifiServerUrl.replace(/\/api\/water-level\/?$/, '');
  const streamUrl = `${baseUrl}/api/stream`;

  try {
    const es = new EventSource(streamUrl);
    ApiConfig.eventSource = es;

    es.onopen = () => {
      ApiConfig.isApiReachable = true;
      ApiConfig.offlineFailureCount = 0;
      const label = dashboardState.source === 'ESP32_WOKWI' ? '● ESP32 CONNECTED' : '● REST API LIVE';
      setConnectionStatus('connected', label);
      updateApiHardwareStatus(true);
    };

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload) {
          // If demo is running, real sensor data overrides demo
          if (window.demoManager && window.demoManager.isRunning) {
            window.demoManager.stopDemo();
          }

          updateDashboard(payload);
          setConnectionStatus('connected', '● ESP32 CONNECTED');
        }
      } catch (err) {
        console.error('SSE JSON parse error:', err);
      }
    };

    es.onerror = () => {
      // Stream lost, will fall back to polling
      es.close();
      ApiConfig.eventSource = null;
      // Do not mark completely offline yet, polling will verify
    };
  } catch (err) {
    console.warn('SSE unsupported or restricted:', err);
  }
}

/**
 * Polling Fallback (GET /api/water-level)
 */
async function fetchLatestWaterLevel() {
  // If demo is running locally, skip remote fetch
  if (window.demoManager && window.demoManager.isRunning) {
    return;
  }

  try {
    const res = await fetch(ApiConfig.apiUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-cache'
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    ApiConfig.isApiReachable = true;
    ApiConfig.offlineFailureCount = 0;
    updateApiHardwareStatus(true);

    if (data && typeof data.waterLevel !== 'undefined') {
      const isConnected = data.connected === true || (data.source && data.source.includes('ESP32'));
      setConnectionStatus(
        isConnected ? 'connected' : 'connected',
        isConnected ? '● ESP32 CONNECTED' : '● REST API LIVE'
      );
      updateDashboard(data);
    }
  } catch (err) {
    ApiConfig.offlineFailureCount++;
    if (ApiConfig.offlineFailureCount >= 2) {
      ApiConfig.isApiReachable = false;
      updateApiHardwareStatus(false);
      setConnectionStatus('offline', '● ESP32 OFFLINE');
    }
  }
}

function startPollingFallback() {
  if (ApiConfig.pollTimer) clearInterval(ApiConfig.pollTimer);
  // Initial check
  fetchLatestWaterLevel();
  // Repeated interval
  ApiConfig.pollTimer = setInterval(fetchLatestWaterLevel, ApiConfig.pollingIntervalMs);
}

function updateApiHardwareStatus(isOnline) {
  const hwApi = document.getElementById('hwApiStatus');
  if (hwApi) {
    hwApi.textContent = isOnline ? 'Connected' : 'Offline';
    hwApi.className = 'status-tag ' + (isOnline ? 'active' : 'inactive');
  }
}

/**
 * Configuration Form Handlers
 */
function bindConfigForm() {
  const form = document.getElementById('configForm');
  const inputApiUrl = document.getElementById('cfgApiUrl');
  const inputEsp32Ip = document.getElementById('cfgEsp32Ip');
  const inputWifiServer = document.getElementById('cfgWifiServerUrl');
  const inputPoll = document.getElementById('cfgPollingInterval');
  const msgBox = document.getElementById('cfgFeedbackMsg');
  const btnTest = document.getElementById('btnTestApiConnection');
  const btnReset = document.getElementById('btnResetConfig');

  // Load existing values into form fields
  if (inputApiUrl) inputApiUrl.value = ApiConfig.apiUrl;
  if (inputEsp32Ip) inputEsp32Ip.value = ApiConfig.esp32Ip;
  if (inputWifiServer) inputWifiServer.value = ApiConfig.wifiServerUrl;
  if (inputPoll) inputPoll.value = ApiConfig.pollingIntervalMs;

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      ApiConfig.apiUrl = inputApiUrl.value.trim();
      ApiConfig.esp32Ip = inputEsp32Ip.value.trim();
      ApiConfig.wifiServerUrl = inputWifiServer.value.trim();
      ApiConfig.pollingIntervalMs = Number(inputPoll.value) || 2000;

      localStorage.setItem('cfg_api_url', ApiConfig.apiUrl);
      localStorage.setItem('cfg_esp32_ip', ApiConfig.esp32Ip);
      localStorage.setItem('cfg_wifi_server_url', ApiConfig.wifiServerUrl);
      localStorage.setItem('cfg_poll_interval', ApiConfig.pollingIntervalMs);

      if (msgBox) {
        msgBox.textContent = '✅ Settings saved successfully! Reconnecting...';
        msgBox.style.color = '#10b981';
      }

      connectEventStream();
      startPollingFallback();
    });
  }

  // Test API Connection button
  if (btnTest) {
    btnTest.addEventListener('click', async () => {
      if (msgBox) {
        msgBox.textContent = 'Testing connection to ' + inputApiUrl.value + '...';
        msgBox.style.color = 'var(--accent-blue)';
      }
      try {
        const testRes = await fetch(inputApiUrl.value, { method: 'GET' });
        if (testRes.ok) {
          const testData = await testRes.json();
          if (msgBox) {
            msgBox.textContent = `✅ Connection Successful! Received waterLevel = ${testData.waterLevel} cm.`;
            msgBox.style.color = '#10b981';
          }
        } else {
          throw new Error('HTTP ' + testRes.status);
        }
      } catch (e) {
        if (msgBox) {
          msgBox.textContent = '❌ Failed to reach API: ' + e.message + '. (Make sure backend server is running)';
          msgBox.style.color = '#ef4444';
        }
      }
    });
  }

  // Reset defaults button
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      localStorage.removeItem('cfg_api_url');
      localStorage.removeItem('cfg_esp32_ip');
      localStorage.removeItem('cfg_wifi_server_url');
      localStorage.removeItem('cfg_poll_interval');

      ApiConfig.apiUrl = 'http://localhost:3000/api/water-level';
      ApiConfig.esp32Ip = '192.168.1.150';
      ApiConfig.wifiServerUrl = 'http://localhost:3000';
      ApiConfig.pollingIntervalMs = 2000;

      if (inputApiUrl) inputApiUrl.value = ApiConfig.apiUrl;
      if (inputEsp32Ip) inputEsp32Ip.value = ApiConfig.esp32Ip;
      if (inputWifiServer) inputWifiServer.value = ApiConfig.wifiServerUrl;
      if (inputPoll) inputPoll.value = ApiConfig.pollingIntervalMs;

      if (msgBox) {
        msgBox.textContent = 'Restored default settings.';
        msgBox.style.color = 'var(--text-muted)';
      }
    });
  }
}

/**
 * Public helper: Post reading to REST API
 * (Can be called from demo or test buttons to write to backend)
 */
async function postReadingToApi(payload) {
  try {
    await fetch(ApiConfig.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    // Backend may not be running yet, local dashboard will still update directly
  }
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initApiConnection();
});

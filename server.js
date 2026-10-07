const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins (supports Wokwi, ESP32, local dev, mobile browsers)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Graceful error handler for bad JSON payloads (prevents server crashes)
app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
  }
  next();
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// In-memory data store for borehole monitoring
const BOREWELL_DEPTH = 200; // cm
const LOW_THRESHOLD = 30;   // cm
const CRITICAL_THRESHOLD = 15; // cm

// Keep track of latest reading and historical log
let latestData = {
  waterLevel: 100,
  percentage: 50,
  distance: 100,
  status: "NORMAL",
  pump: false,
  buzzer: false,
  greenLed: true,
  redLed: false,
  timestamp: new Date().toISOString(),
  source: "INITIAL_DEMO"
};

let readingHistory = [
  {
    waterLevel: 95,
    percentage: 47.5,
    distance: 105,
    status: "NORMAL",
    pump: false,
    buzzer: false,
    timestamp: new Date(Date.now() - 300000).toISOString()
  },
  {
    waterLevel: 98,
    percentage: 49,
    distance: 102,
    status: "NORMAL",
    pump: false,
    buzzer: false,
    timestamp: new Date(Date.now() - 200000).toISOString()
  },
  {
    waterLevel: 100,
    percentage: 50,
    distance: 100,
    status: "NORMAL",
    pump: false,
    buzzer: false,
    timestamp: new Date().toISOString()
  }
];

// Connected SSE clients for instantaneous real-time push
const sseClients = new Set();

function broadcastToClients(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

// Helper to compute status, pump, LEDs based on physical rules
function computeWaterMetrics(rawDistance, rawWaterLevel) {
  let distance = Number(rawDistance);
  let waterLevel = Number(rawWaterLevel);

  if (isNaN(waterLevel) && !isNaN(distance)) {
    waterLevel = BOREWELL_DEPTH - distance;
  } else if (isNaN(distance) && !isNaN(waterLevel)) {
    distance = BOREWELL_DEPTH - waterLevel;
  }

  // Constrain limits
  waterLevel = Math.max(0, Math.min(BOREWELL_DEPTH, waterLevel));
  distance = Math.max(0, Math.min(BOREWELL_DEPTH, distance));

  const percentage = Number(((waterLevel / BOREWELL_DEPTH) * 100).toFixed(1));

  let status = "NORMAL";
  let pump = false;
  let buzzer = false;
  let greenLed = false;
  let redLed = false;

  if (waterLevel >= LOW_THRESHOLD) {
    status = "NORMAL";
    pump = false;
    buzzer = false;
    greenLed = true;
    redLed = false;
  } else if (waterLevel >= CRITICAL_THRESHOLD) {
    status = "LOW";
    pump = true;
    buzzer = false;
    greenLed = false;
    redLed = true;
  } else {
    status = "CRITICAL";
    pump = false;
    buzzer = true;
    greenLed = false;
    redLed = true;
  }

  return {
    waterLevel: Number(waterLevel.toFixed(1)),
    percentage,
    distance: Number(distance.toFixed(1)),
    status,
    pump,
    buzzer,
    greenLed,
    redLed
  };
}

/**
 * GET /api/water-level
 * Returns the current live borewell reading
 */
app.get('/api/water-level', (req, res) => {
  const isStale = (Date.now() - new Date(latestData.timestamp).getTime()) > 30000;
  res.json({
    success: true,
    ...latestData,
    connected: !isStale && latestData.source !== 'INITIAL_DEMO',
    serverTime: new Date().toISOString()
  });
});

/**
 * POST /api/water-level
 * Endpoint for ESP32 / Wokwi / Demo simulator to push sensor data
 */
app.post('/api/water-level', (req, res) => {
  const body = req.body || {};

  // Compute metrics dynamically or allow explicit values
  const computed = computeWaterMetrics(body.distance, body.waterLevel);

  const newReading = {
    waterLevel: typeof body.waterLevel !== 'undefined' ? Number(body.waterLevel) : computed.waterLevel,
    percentage: typeof body.percentage !== 'undefined' ? Number(body.percentage) : computed.percentage,
    distance: typeof body.distance !== 'undefined' ? Number(body.distance) : computed.distance,
    status: body.status || computed.status,
    pump: typeof body.pump === 'boolean' ? body.pump : (body.pump === 1 || body.pump === 'ON' || computed.pump),
    buzzer: typeof body.buzzer === 'boolean' ? body.buzzer : (body.buzzer === 1 || body.buzzer === 'ON' || computed.buzzer),
    greenLed: typeof body.greenLed === 'boolean' ? body.greenLed : computed.greenLed,
    redLed: typeof body.redLed === 'boolean' ? body.redLed : computed.redLed,
    timestamp: new Date().toISOString(),
    source: body.source || (req.headers['user-agent'] && req.headers['user-agent'].includes('ESP32') ? 'ESP32' : 'API')
  };

  latestData = newReading;

  // Append to history (keep max 100 entries)
  readingHistory.push(newReading);
  if (readingHistory.length > 100) {
    readingHistory.shift();
  }

  // Push to SSE browser clients
  broadcastToClients(latestData);

  res.status(200).json({
    success: true,
    message: "Water level updated successfully",
    data: latestData
  });
});

/**
 * GET /api/history
 * Returns historical logs for the dashboard chart
 */
app.get('/api/history', (req, res) => {
  res.json({
    success: true,
    count: readingHistory.length,
    history: readingHistory
  });
});

/**
 * POST /api/history/clear
 * Clears historical readings
 */
app.post('/api/history/clear', (req, res) => {
  readingHistory = [
    {
      ...latestData,
      timestamp: new Date().toISOString()
    }
  ];
  res.json({
    success: true,
    message: "History cleared successfully",
    history: readingHistory
  });
});

/**
 * GET /api/stream
 * Server-Sent Events (SSE) for instantaneous real-time dashboard updates
 */
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send current state immediately on connection
  res.write(`data: ${JSON.stringify(latestData)}\n\n`);

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

/**
 * GET /api/status
 * Health check endpoint
 */
app.get('/api/status', (req, res) => {
  res.json({
    name: "Smart Borewell Water Level Monitoring System API",
    status: "ONLINE",
    port: PORT,
    borewellDepthCm: BOREWELL_DEPTH,
    lowThresholdCm: LOW_THRESHOLD,
    criticalThresholdCm: CRITICAL_THRESHOLD,
    latestData,
    connectedClients: sseClients.size
  });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Smart Borewell Water Level Server is RUNNING!`);
  console.log(`🌐 Dashboard URL: http://localhost:${PORT}`);
  console.log(`📡 REST API Endpoint: POST/GET http://localhost:${PORT}/api/water-level`);
  console.log(`====================================================`);
});

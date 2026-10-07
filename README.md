# Smart Borewell Water Level Monitoring System 💧
### IoT Web Dashboard & ESP32 REST API Integration

A professional, real-time IoT water management and borewell telemetry dashboard engineered with HTML, CSS, JavaScript, and an Express.js REST API.

Compatible out-of-the-box with **Wokwi Simulator Project**:  
🔗 **[https://wokwi.com/projects/477225704074108929](https://wokwi.com/projects/477225704074108929)**

---

## 🚀 Key Features

- **Real-Time Dynamic Telemetry:**
  - 📏 **Water Level:** Continuous measurement in centimeters (0 to 200 cm)
  - 📊 **Water Percentage:** Precise reservoir percentage calculation (\(0\%\) to \(100\%\))
  - 🛡️ **Water Status:** `NORMAL`, `LOW`, and `CRITICAL` with animated visual alert badges
  - 📡 **Sensor Distance:** Real-time HC-SR04 ultrasonic echo air gap
  - ⚙️ **Pump Status:** Submersible pump relay state (`ON` / `OFF`) with animated spinning icon
  - 🕒 **Last Updated:** Live clock and telemetry heartbeat timestamp

- **Interactive Borewell Tank Visualization:**
  - Scaled cylindrical borewell tank with depth ruler tick marks (0 cm to 200 cm)
  - Liquid water level animated with dynamic gradient, waves, and rising bubbles
  - Ultrasonic sensor transducer head emitting radar echo waves down to the water surface
  - Submersible pump at the bottom with active motor discharge glow

- **Automated Control Logic & Safety Rules:**
  - **NORMAL:** Water Level $\ge 30\text{ cm}$ $\rightarrow$ Green Status / LED, Pump `OFF`, Buzzer `OFF`
  - **LOW:** $15\text{ cm} \le \text{Water Level} < 30\text{ cm}$ $\rightarrow$ Orange Status, Pump `ON` (recharging), Buzzer `OFF`
  - **CRITICAL:** Water Level $< 15\text{ cm}$ $\rightarrow$ Red Status, Pump `OFF` (dry-run motor burnout prevention), Buzzer `ON` (audio alarm)

- **Interactive Demo & Simulation Harness:**
  - **Start Demo:** Automatically loops through `NORMAL` (100 cm / 50%), `LOW` (20 cm / 10%), and `CRITICAL` (5 cm / 2.5%)
  - **1-Click Test Buttons:** `NORMAL TEST`, `LOW TEST`, and `CRITICAL TEST`
  - **Manual Ultrasonic Distance Slider:** Drag from 0 to 200 cm to simulate real-time water levels

- **Historical Logging & Analytics:**
  - HTML5 Canvas dual-metric line chart (Water Level cm & Percentage %)
  - Browser `localStorage` persistence
  - Export Telemetry to CSV & Clear History controls

- **Hardware Status & System Architecture:**
  - Real-time indicator bulbs for Green LED, Red LED, Piezo Buzzer, Relay Switch, and OLED Display
  - Interactive System Architecture diagram: `HC-SR04 -> ESP32 -> Wi-Fi -> REST API -> Website Dashboard`

---

## 🛠️ Project Structure

```text
smart-borewell-system/
│
├── package.json                   # Dependencies (express, cors)
├── server.js                      # REST API Server & SSE stream
├── README.md                      # Project documentation
│
├── public/                        # Frontend Web Application
│   ├── index.html                 # Semantic responsive dashboard UI
│   ├── css/
│   │   └── style.css              # Vanilla CSS dark navy IoT theme
│   └── js/
│       ├── dashboard.js           # Core updateDashboard() function & chart
│       ├── api.js                 # REST API, SSE streaming, config
│       └── demo.js                # Demo mode & simulation buttons
│
└── esp32/                         # ESP32 Microcontroller Firmware & Wokwi
    ├── smart_borewell_esp32.ino   # Complete Arduino sketch with Wi-Fi HTTP POST
    ├── diagram.json               # Wokwi circuit diagram
    ├── libraries.txt              # Wokwi Arduino library dependencies
    └── README.md                  # Step-by-step Wokwi connection instructions
```

---

## ⚡ Quick Start (Running Locally)

### 1. Install Dependencies & Start Server
```powershell
# Navigate to the project directory
cd C:\Users\raksh\.gemini\antigravity-ide\scratch\smart-borewell-system

# Install dependencies (only express and cors)
npm install

# Start the dashboard & REST API server
npm start
```

Open your browser to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 📡 REST API Specification

### 1. Update Water Level (Push from ESP32 or Simulator)
- **Endpoint:** `POST /api/water-level`
- **Content-Type:** `application/json`
- **Request Body:**
```json
{
  "waterLevel": 100,
  "percentage": 50,
  "distance": 100,
  "status": "NORMAL",
  "pump": false,
  "buzzer": false
}
```

### 2. Fetch Latest Water Level
- **Endpoint:** `GET /api/water-level`
- **Response:**
```json
{
  "success": true,
  "waterLevel": 100,
  "percentage": 50,
  "distance": 100,
  "status": "NORMAL",
  "pump": false,
  "buzzer": false,
  "timestamp": "2026-10-07T18:20:00.000Z",
  "connected": true
}
```

### 3. Real-Time Event Stream (SSE)
- **Endpoint:** `GET /api/stream`
- Pushes instant JSON updates to connected dashboards whenever an ESP32 posts data.

---

## 🔌 Connecting to Wokwi Simulator (Project 477225704074108929)

1. Open your Wokwi project:  
   👉 [https://wokwi.com/projects/477225704074108929](https://wokwi.com/projects/477225704074108929)
2. In your terminal, expose your local port 3000:
   ```powershell
   npx localtunnel --port 3000
   ```
   *This outputs a URL like: `https://rapid-water-45.loca.lt`*
3. Open `esp32/smart_borewell_esp32.ino` and copy the code into Wokwi's `sketch.ino`.
4. Update line 47 in Wokwi's `sketch.ino`:
   ```cpp
   const char* API_URL = "https://rapid-water-45.loca.lt/api/water-level";
   ```
5. Click **Start Simulation** in Wokwi.
6. Click the HC-SR04 sensor in Wokwi and drag the distance slider. Watch your dashboard update live!

# ESP32 & Wokwi Connection Guide
### Smart Borewell Water Level Monitoring System

This project is tailored to work directly with your Wokwi Simulation:
🔗 **Wokwi Project:** [https://wokwi.com/projects/477225704074108929](https://wokwi.com/projects/477225704074108929)

---

## 📡 How to Connect Wokwi to Your Local Dashboard

Wokwi simulates an ESP32 in your browser running isolated virtual Wi-Fi (`Wokwi-GUEST`). To send data from Wokwi to this local website running at `http://localhost:3000`:

### Option A: Using a Free Tunnel (Recommended & Easiest)
Because Wokwi runs in the cloud, exposing your local port 3000 allows Wokwi to reach your computer:

1. In a new PowerShell terminal, run:
   ```powershell
   npx localtunnel --port 3000
   ```
   *(or use `ngrok http 3000`)*
2. It gives you a public URL, for example:
   `https://borewell-stream-xyz.loca.lt`
3. In Wokwi [project 477225704074108929](https://wokwi.com/projects/477225704074108929), open `sketch.ino` and replace:
   ```cpp
   const char* API_URL = "https://borewell-stream-xyz.loca.lt/api/water-level";
   ```
4. Copy the code from `esp32/smart_borewell_esp32.ino` into Wokwi's `sketch.ino`.
5. Press the green **Start Simulation** button in Wokwi!
6. Click on the **HC-SR04 ultrasonic sensor** in Wokwi and move the distance slider (e.g., 20 cm, 100 cm, 190 cm).
7. Watch your Web Dashboard update in real time!

---

### Option B: Real ESP32 Physical Hardware
1. Connect ESP32 to your PC via USB.
2. Open `esp32/smart_borewell_esp32.ino` in Arduino IDE.
3. Install required libraries via Library Manager:
   - Adafruit SSD1306
   - Adafruit GFX Library
4. Set your Wi-Fi credentials:
   ```cpp
   const char* WIFI_SSID = "Your_Home_WiFi";
   const char* WIFI_PASSWORD = "Your_Password";
   ```
5. Find your computer's local IPv4 address (run `ipconfig` in CMD or PowerShell):
   ```cpp
   const char* API_URL = "http://192.168.1.50:3000/api/water-level";
   ```
6. Select `ESP32 Dev Module`, select your COM port, and click **Upload**.

---

### ⚙️ Status & Relay Thresholds
- **NORMAL:** Water Level $\ge$ 30 cm $\rightarrow$ Green LED ON, Relay/Pump OFF, Buzzer OFF
- **LOW:** Water Level $\ge$ 15 cm and $<$ 30 cm $\rightarrow$ Red LED ON, Relay/Pump ON, Buzzer OFF
- **CRITICAL:** Water Level $<$ 15 cm $\rightarrow$ Red LED ON, Relay/Pump OFF (Dry Run Protection), Buzzer ON

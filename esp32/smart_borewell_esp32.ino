/*
 * =====================================================================================
 * PROJECT: Smart Borewell Water Level Monitoring System
 * TARGET: ESP32 DevKit V1 / DevKitC (Compatible with Wokwi Project: 477225704074108929)
 * 
 * HARDWARE PIN CONNECTIONS:
 * - HC-SR04 Ultrasonic Sensor:
 *     VCC  -> VIN (5V)
 *     GND  -> GND
 *     TRIG -> GPIO 5
 *     ECHO -> GPIO 18
 * 
 * - SSD1306 0.96" OLED Display (I2C):
 *     VCC  -> 3.3V
 *     GND  -> GND
 *     SDA  -> GPIO 21
 *     SCL  -> GPIO 22
 * 
 * - Actuators & Indicators:
 *     Green LED -> GPIO 19 (via 220Ω resistor)
 *     Red LED   -> GPIO 4  (via 220Ω resistor)
 *     Buzzer    -> GPIO 23
 *     Relay (Pump) -> GPIO 26
 * 
 * WOKWI SIMULATION COMPATIBILITY:
 * - In Wokwi, WiFi connects automatically to: SSID: "Wokwi-GUEST", Password: ""
 * - To send data from Wokwi to your local computer, use an ngrok or localtunnel URL:
 *     e.g., https://your-tunnel-url.ngrok-free.app/api/water-level
 *   Or run Wokwi IoT Gateway to reach http://localhost:3000/api/water-level directly.
 * =====================================================================================
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFi.h>
#include <HTTPClient.h>

// PIN DEFINITIONS
#define TRIG_PIN 5
#define ECHO_PIN 18

#define GREEN_LED 19
#define RED_LED 4

#define BUZZER_PIN 23
#define RELAY_PIN 26

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

Adafruit_SSD1306 display(
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  &Wire,
  -1
);

// CONFIGURATION PARAMETERS
const float BOREWELL_DEPTH = 200.0; // cm
const float LOW_LEVEL = 30.0;       // cm: threshold for LOW status
const float CRITICAL_LEVEL = 15.0;  // cm: threshold for CRITICAL status

// WI-FI & REST API CONFIGURATION
// For Wokwi Simulator:
const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";

// For Real Physical ESP32 (replace with your home/college Wi-Fi):
// const char* WIFI_SSID = "YOUR_WIFI_NAME";
// const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Active Live Public Tunnel URL (connects Wokwi directly to your local dashboard):
const char* API_URL = "http://490d6dcf187347.lhr.life/api/water-level";



// Non-blocking transmission timer (send every 2 seconds)
unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL_MS = 2000;

// Read distance from HC-SR04 in centimeters
float getDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);

  if (duration == 0) {
    return -1; // Timeout or sensor disconnected
  }

  return duration / 58.0;
}

// Connect to WiFi network
void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n WiFi Connected!");
    Serial.print("ESP32 IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n⚠️ WiFi Connection Failed (Will retry in loop)");
  }
}

// Send reading to REST API
void sendDataToAPI(float waterLevel, float percentage, float distance, String status, bool pump, bool buzzer) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ Cannot POST: WiFi not connected");
    return;
  }

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Bypass-Tunnel-Reminder", "true");

  // Construct JSON Payload
  String payload = "{";
  payload += "\"waterLevel\":" + String(waterLevel, 1) + ",";
  payload += "\"percentage\":" + String(percentage, 1) + ",";
  payload += "\"distance\":" + String(distance, 1) + ",";
  payload += "\"status\":\"" + status + "\",";
  payload += "\"pump\":" + String(pump ? "true" : "false") + ",";
  payload += "\"buzzer\":" + String(buzzer ? "true" : "false") + ",";
  payload += "\"source\":\"ESP32_WOKWI\"";
  payload += "}";

  Serial.print("Sending POST to API: ");
  Serial.println(API_URL);
  Serial.println(payload);

  int httpResponseCode = http.POST(payload);

  if (httpResponseCode > 0) {
    Serial.print("✅ API Response Code: ");
    Serial.println(httpResponseCode);
    String response = http.getString();
    Serial.println(response);
  } else {
    Serial.print("❌ HTTP Error: ");
    Serial.println(httpResponseCode);
    Serial.println(http.errorToString(httpResponseCode).c_str());
  }

  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.println("\n=========================================");
  Serial.println("Smart Borewell Water Level Monitoring");
  Serial.println("ESP32 IoT Node Initializing...");
  Serial.println("=========================================");

  // Initialize GPIO Pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);

  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(RELAY_PIN, LOW);

  // Initialize I2C for SSD1306
  Wire.begin(21, 22);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("❌ OLED SSD1306 Allocation Failed");
  } else {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(15, 10);
    display.println("SMART BOREWELL");
    display.setCursor(18, 28);
    display.println("MONITORING SYSTEM");
    display.setCursor(20, 46);
    display.println("Connecting WiFi...");
    display.display();
  }

  // Connect to WiFi
  connectWiFi();

  delay(1500);
}

void loop() {
  // Ensure WiFi remains connected
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }

  float distance = getDistance();

  // If distance reading timed out or invalid
  if (distance < 0) {
    delay(100);
    return;
  }

  // If slider is moved past 200 cm, clamp to 200 cm (Borewell bottom / 0% empty)
  if (distance > BOREWELL_DEPTH) {
    distance = BOREWELL_DEPTH;
  }

  // Calculate water level: Water Level = Borewell Depth - Ultrasonic Distance
  float waterLevel = BOREWELL_DEPTH - distance;
  if (waterLevel < 0) waterLevel = 0;
  if (waterLevel > BOREWELL_DEPTH) waterLevel = BOREWELL_DEPTH;

  // Calculate percentage: (waterLevel / 200) * 100
  float percentage = (waterLevel / BOREWELL_DEPTH) * 100.0;
  if (percentage > 100) percentage = 100;
  if (percentage < 0) percentage = 0;

  // Determine System Status & Actuator states based on requirements:
  String status = "NORMAL";
  bool pumpState = false;
  bool buzzerState = false;

  // NORMAL: Water level >= 30 cm -> Green LED ON, Pump OFF, Buzzer OFF
  if (waterLevel >= LOW_LEVEL) {
    status = "NORMAL";
    pumpState = false;
    buzzerState = false;
    digitalWrite(GREEN_LED, HIGH);
    digitalWrite(RED_LED, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(RELAY_PIN, LOW);
  }
  // LOW: Water level >= 15 cm and < 30 cm -> Yellow/Orange status, Pump ON, Buzzer OFF
  else if (waterLevel >= CRITICAL_LEVEL) {
    status = "LOW";
    pumpState = true;
    buzzerState = false;
    digitalWrite(GREEN_LED, LOW);
    digitalWrite(RED_LED, HIGH);
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(RELAY_PIN, HIGH); // Relay activated to pump water
  }
  // CRITICAL: Water level < 15 cm -> Red status, Pump OFF, Buzzer ON
  else {
    status = "CRITICAL";
    pumpState = false;
    buzzerState = true;
    digitalWrite(GREEN_LED, LOW);
    digitalWrite(RED_LED, HIGH);
    digitalWrite(BUZZER_PIN, HIGH); // Buzzer audio alarm
    digitalWrite(RELAY_PIN, LOW);  // Turn off pump to prevent dry run
  }

  // Diagnostics
  Serial.print("Dist: "); Serial.print(distance, 1);
  Serial.print(" cm | Water Level: "); Serial.print(waterLevel, 1);
  Serial.print(" cm | Status: "); Serial.println(status);

  // Update OLED Display immediately
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0); display.println("SMART BOREWELL");
  display.setCursor(0, 14); display.print("Level: "); display.print(waterLevel, 1); display.println(" cm");
  display.setCursor(0, 27); display.print("Perc : "); display.print(percentage, 1); display.println("%");
  display.setCursor(0, 40); display.print("Status: "); display.println(status);
  display.setCursor(0, 53); display.print("Pump:"); display.print(pumpState ? "ON " : "OFF");
  display.print(" WiFi: OK");
  display.display();

  // INSTANT TRANSMISSION: Send immediately if slider moved by >= 0.8 cm, OR heartbeat every 1.5s
  static float lastSentDist = -999.0;
  bool distanceChanged = abs(distance - lastSentDist) >= 0.8;

  if (distanceChanged || (millis() - lastSendTime >= 1500)) {
    lastSendTime = millis();
    lastSentDist = distance;
    sendDataToAPI(waterLevel, percentage, distance, status, pumpState, buzzerState);
  }

  delay(60); // Ultra-responsive 60ms loop!
}

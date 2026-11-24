import type { TinyMlPacket } from '../sim/types';

const VALID_STATES = new Set(['SAFE', 'TRIGGER', 'EXOTHERMIC', 'FAILSAFE']);

/**
 * Formats outgoing telemetry packet for Arduino Uno at 9600 baud:
 * DATA:${h2.toFixed(2)},${rate.toFixed(2)},${sTemp.toFixed(1)},${bTemp.toFixed(1)}\n
 */
export function formatOutgoingDataPacket(
  h2: number,
  rate: number,
  sTemp: number,
  bTemp: number
): string {
  const safeH2 = Number.isFinite(h2) ? Math.max(0, h2) : 0;
  const safeRate = Number.isFinite(rate) ? rate : 0;
  const safeSTemp = Number.isFinite(sTemp) ? sTemp : 25;
  const safeBTemp = Number.isFinite(bTemp) ? bTemp : 25;
  return `DATA:${safeH2.toFixed(2)},${safeRate.toFixed(2)},${safeSTemp.toFixed(1)},${safeBTemp.toFixed(1)}\n`;
}

export function formatResetCommand(): string {
  return 'RESET\n';
}

/**
 * Parses a single newline-delimited JSON packet from Arduino Uno:
 * {"decision": 1, "state": "TRIGGER", "pulse": 1, "us": 44}
 */
export function parseIncomingSerialLine(rawLine: string): TinyMlPacket | null {
  const trimmed = rawLine.trim();
  if (!trimmed || !trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const decision = Number(parsed.decision);
    const state = typeof parsed.state === 'string' ? parsed.state.toUpperCase() : '';
    const pulse = Number(parsed.pulse);
    const us = Number(parsed.us);

    if (
      (decision !== 0 && decision !== 1 && decision !== 2 && decision !== 3) ||
      !VALID_STATES.has(state) ||
      (pulse !== 0 && pulse !== 1) ||
      !Number.isFinite(us) ||
      us < 0
    ) {
      return null;
    }

    return {
      decision: decision as 0 | 1 | 2 | 3,
      state: state as TinyMlPacket['state'],
      pulse: pulse as 0 | 1,
      us: Math.round(us),
    };
  } catch {
    return null;
  }
}

export const ARDUINO_REFERENCE_SKETCH = `// IgniteSafe Smart-Hybrid PAR — Arduino Uno Eloquent RandomForest (9600 Baud)
// White LED (Pin 8): RF Induction (TRIGGER=1 & FAILSAFE=3)
// Red LED   (Pin 7): Thermal Glow / Emergency (EXOTHERMIC=2 & FAILSAFE=3)
// Protocol RX: DATA:h2,rate,sTemp,bTemp\\n | RESET\\n
// Protocol TX: {"decision":0..3,"state":"SAFE|TRIGGER|EXOTHERMIC|FAILSAFE","pulse":0|1,"us":44}

#include <Arduino.h>
// Paste Eloquent::ML::Port::RandomForest tinyML; here (5 trees, 4 features)

const int RED_LED_PIN   = 7;
const int WHITE_LED_PIN = 8;
int lastDecision = -1;

void executeAndReport(int decision, unsigned long us) {
  int pulseActive = 0;
  switch (decision) {
    case 0: // SAFE
      digitalWrite(WHITE_LED_PIN, LOW);  digitalWrite(RED_LED_PIN, LOW);  pulseActive = 0; break;
    case 1: // TRIGGER
      digitalWrite(WHITE_LED_PIN, HIGH); digitalWrite(RED_LED_PIN, LOW);  pulseActive = 1; break;
    case 2: // EXOTHERMIC
      digitalWrite(WHITE_LED_PIN, LOW);  digitalWrite(RED_LED_PIN, HIGH); pulseActive = 0; break;
    case 3: // FAILSAFE
      digitalWrite(WHITE_LED_PIN, HIGH); digitalWrite(RED_LED_PIN, HIGH); pulseActive = 1; break;
  }
  const char* labels[] = {"SAFE", "TRIGGER", "EXOTHERMIC", "FAILSAFE"};
  Serial.print("{\\"decision\\":"); Serial.print(decision);
  Serial.print(",\\"state\\":\\""); Serial.print(labels[decision]);
  Serial.print("\\",\\"pulse\\":"); Serial.print(pulseActive);
  Serial.print(",\\"us\\":"); Serial.print(us);
  Serial.println("}");
}`;

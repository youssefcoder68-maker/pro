export type ParState = 'SAFE' | 'TRIGGER' | 'EXOTHERMIC' | 'FAILSAFE' | 'EXPLOSION';

export type OperationMode = 'cinematic' | 'manual';

export type LaunchMode = 'unselected' | 'arduino' | 'standalone';

export type ArduinoVerificationStatus =
  | 'disconnected'
  | 'connecting'
  | 'awaiting_reply'
  | 'verified'
  | 'error';

export type CameraPresetId = 'auto' | 'wide' | 'intake' | 'coil' | 'fins' | 'arduino' | 'exhaust';

export type PartInspectorId =
  | 'h2_intake'
  | 'nickel_plates'
  | 'copper_coil'
  | 'quartz_window'
  | 'h2o_exhaust'
  | 'tinyml_box'
  | 'failsafe_damper'
  | 'gas_manifold';

export interface PartHoverInfo {
  id: PartInspectorId;
  screenX: number;
  screenY: number;
}

export interface TelemetryInputs {
  /** Hydrogen volumetric concentration (%) 0.00 - 10.00 */
  h2: number;
  /** Hydrogen concentration rate of change (%/s) */
  rate: number;
  /** Catalyst Ni-Fe plate surface temperature (°C) */
  sTemp: number;
  /** Containment box ambient temperature (°C) */
  bTemp: number;
}

export interface TinyMlPacket {
  decision: 0 | 1 | 2 | 3;
  state: 'SAFE' | 'TRIGGER' | 'EXOTHERMIC' | 'FAILSAFE';
  pulse: 0 | 1;
  us: number;
  treeVotes?: [number, number, number, number];
  perTreePredictions?: [number, number, number, number, number];
}

export interface CollisionMetrics {
  /** Plate collisions per second across the 8 Ni-Fe catalyst plates */
  collisionsPerSec: number;
  /** Recombination reaction intensity (0..1) from Arrhenius kinetics & impact flux */
  recombinationIntensity: number;
  /** Active impact vectors currently rendered in 3D */
  activeVectors: number;
}

export interface PhysicsDiagnostics {
  /** Arrhenius catalytic rate constant (s^-1) */
  arrheniusRateConstant: number;
  /** Surface moisture inhibition / availability factor (0..1) */
  surfaceActivationFactor: number;
  /** Active hydrogen recombination rate (%/s) */
  recombinationRatePctPerSec: number;
  /** Mass conversion rate of H2 to H2O (mg/s) */
  h2ConsumedMgPerSec: number;
  /** Steam H2O generation rate (mg/s) */
  h2oProducedMgPerSec: number;
  /** Exothermic reaction thermal power (W) */
  exothermicPowerW: number;
  /** Active RF induction heating power (W) */
  rfInductionPowerW: number;
  /** Chimney buoyant draft velocity (m/s) */
  chimneyDraftVelocityMs: number;
  /** Power efficiency saved vs continuous 450W trace-heated PAR (%) */
  powerEfficiencySavedPct: number;
  /** Shapiro flammability regime description */
  flammabilityRegime: string;
  /** Estimated adiabatic peak overpressure if ignited (kPa) */
  potentialOverpressureKpa: number;
  /** Estimated flame propagation speed if ignited (m/s) */
  potentialFlameSpeedMs: number;
  /** Whether LFL threshold (4.0%) is breached */
  isFlammable: boolean;
}

export interface ExplosionReport {
  timestamp: string;
  causeTitle: string;
  rootCauseDetail: string;
  modelResponse: string;
  peakH2Pct: number;
  catalystTempC: number;
  containmentTempC: number;
  peakOverpressureKpa: number;
  flameSpeedMs: number;
  shapiroZone: string;
  mitigationSteps: string[];
}

export interface CinematicStage {
  id: 'baseline' | 'trigger' | 'exothermic' | 'cooldown';
  title: string;
  subtitle: string;
  cameraPreset: CameraPresetId;
  timeRange: [number, number];
}

export interface SerialLogEntry {
  id: string;
  timestamp: string;
  direction: 'TX' | 'RX' | 'SYS';
  source: 'USB-9600' | 'SIM-ML';
  payload: string;
  state?: ParState;
}

export interface TelemetryHistoryPoint {
  t: number;
  h2: number;
  sTemp: number;
  recomb: number;
  rfPower: number;
}

import { predictEloquentRandomForest } from './eloquentRandomForest';
import type {
  CinematicStage,
  ExplosionReport,
  ParState,
  PhysicsDiagnostics,
  TelemetryInputs,
  TinyMlPacket,
} from './types';

// Physical & thermodynamic constants
export const GAS_CONSTANT_R = 8.314462618; // J/(mol*K)
export const H2_LOWER_HEATING_VALUE_J_PER_MOL = 241_800; // J/mol H2 -> H2O(g)
export const H2_MOLAR_MASS_G_PER_MOL = 2.01588;
export const H2O_MOLAR_MASS_G_PER_MOL = 18.01528;
export const ACTIVATION_ENERGY_J_PER_MOL = 36_200; // Ni-Fe / Pt-Pd hybrid catalyst
export const ARRHENIUS_PRE_EXPONENTIAL = 4.2e3; // s^-1 scaled for 8-plate PAR geometry
export const CATALYST_LIGHTOFF_TEMP_C = 150.0;
export const CURIE_TEMP_C = 225.0; // Self-regulating Ni-Fe Curie point
export const FAILSAFE_H2_THRESHOLD_PCT = 4.5;
export const LFL_H2_UPWARD_PCT = 4.0;
export const LEGACY_TRACE_HEATER_W = 450.0;
export const RF_COIL_MAX_POWER_W = 140.0;
export const CHIMNEY_HEIGHT_M = 1.25;
export const GRAVITY_MS2 = 9.81;

export interface DynamicSimConfig {
  /** External hydrogen leak injection rate (%/s) */
  leakInjectionRatePctPerSec: number;
  /** Whether Smart-Hybrid RF pre-heating pulse is enabled */
  rfPreheatingEnabled: boolean;
  /** Whether Fail-Safe cutoff/venting at >= 4.5% is armed */
  failsafeProtectionEnabled: boolean;
  /** Accumulated energy consumed by RF + TinyML node (Wh) */
  cumulativeSmartEnergyWh: number;
  /** Accumulated energy a legacy 450W continuous trace-heated PAR would consume (Wh) */
  cumulativeLegacyEnergyWh: number;
}

export const CINEMATIC_DURATION_SEC = 24;

export const CINEMATIC_STAGES: CinematicStage[] = [
  {
    id: 'baseline',
    title: '01 · Cold Standby & Hydrogen Leak Onset',
    subtitle:
      'Passive Ni-Fe catalyst plates rest at ambient 28°C (zero standby draw). Hydrogen gas enters the lower sparger and bounces off cold moisture-inhibited plates.',
    cameraPreset: 'wide',
    timeRange: [0, 5.0],
  },
  {
    id: 'trigger',
    title: '02 · TinyML Classification & RF Induction Pulse',
    subtitle:
      'Edge RandomForest detects rising [H₂] in 44 µs and triggers Pin 8 RF Induction (135 kHz). Eddy currents heat the 8 Ni-Fe plates past the 150°C light-off barrier.',
    cameraPreset: 'coil',
    timeRange: [5.0, 10.8],
  },
  {
    id: 'exothermic',
    title: '03 · Self-Sustaining Exothermic Catalysis & Atom Recombination',
    subtitle:
      'Plates reach 150°C–192°C; RF coil shuts OFF while 2H₂ + O₂ → 2H₂O + ΔH sustains hot plate collisions, converting emerald H₂ into rising steam.',
    cameraPreset: 'fins',
    timeRange: [10.8, 16.2],
  },
  {
    id: 'cooldown',
    title: '04 · Volumetric Exhaust Steam Plume & Safe Return',
    subtitle:
      'High chimney draft vents billowing H₂O steam through the glass exhaust stack. As [H₂] drops below 1.0%, IgniteSafe transitions back to zero-watt SAFE standby.',
    cameraPreset: 'exhaust',
    timeRange: [16.2, 24.0],
  },
];

/**
 * TinyML Edge Classifier powered by the exact 5-tree Eloquent RandomForest
 * ported from the user's Arduino Uno firmware.
 * Respects Sandbox test overrides (rfEnabled / failsafeEnabled) for failure testing.
 */
export function evaluateTinyMlDecision(
  inputs: TelemetryInputs,
  options?: { rfEnabled?: boolean; failsafeEnabled?: boolean }
): TinyMlPacket {
  const rfEnabled = options?.rfEnabled ?? true;
  const failsafeEnabled = options?.failsafeEnabled ?? true;
  const { h2, rate, sTemp, bTemp } = inputs;

  const trace = predictEloquentRandomForest(h2, rate, sTemp, bTemp);

  if (!failsafeEnabled && (trace.state === 'FAILSAFE' || h2 >= 4.0)) {
    // Faulty ML / bypassed interlock test: keeps firing RF or running hot above LFL
    if (sTemp >= CATALYST_LIGHTOFF_TEMP_C) {
      return {
        decision: 2,
        state: 'EXOTHERMIC',
        pulse: 0,
        us: trace.us,
        treeVotes: trace.treeVotes,
        perTreePredictions: trace.perTreePredictions,
      };
    }
    return {
      decision: 1,
      state: 'TRIGGER',
      pulse: rfEnabled ? 1 : 0,
      us: trace.us,
      treeVotes: trace.treeVotes,
      perTreePredictions: trace.perTreePredictions,
    };
  }

  if (!rfEnabled && trace.state === 'TRIGGER') {
    return {
      decision: 0,
      state: 'SAFE',
      pulse: 0,
      us: trace.us,
      treeVotes: trace.treeVotes,
      perTreePredictions: trace.perTreePredictions,
    };
  }

  return {
    decision: trace.decision,
    state: trace.state,
    pulse: trace.pulse,
    us: trace.us,
    treeVotes: trace.treeVotes,
    perTreePredictions: trace.perTreePredictions,
  };
}

/**
 * Sigmoid moisture desorption / active-site availability factor.
 * Below 115°C, steam condensate poisons Ni-Fe catalytic sites (~0.02 residual).
 * Rapidly unlocks around 145–155°C.
 */
export function computeSurfaceActivationFactor(sTempC: number): number {
  const shifted = (sTempC - 138) / 5.5;
  const sigmoid = 1 / (1 + Math.exp(-shifted));
  return Math.max(0.015, Math.min(1, sigmoid));
}

/**
 * Computes physical chemistry, fluid draft, RF induction, and Shapiro flammability metrics.
 */
export function computePhysicsDiagnostics(
  inputs: TelemetryInputs,
  packet: TinyMlPacket,
  energyStats?: { smartWh: number; legacyWh: number }
): PhysicsDiagnostics {
  const sTempK = Math.max(250, inputs.sTemp + 273.15);
  const bTempK = Math.max(250, inputs.bTemp + 273.15);

  // Arrhenius rate constant k(T) = A * exp(-Ea / (R * T))
  const arrheniusRateConstant =
    ARRHENIUS_PRE_EXPONENTIAL *
    Math.exp(-ACTIVATION_ENERGY_J_PER_MOL / (GAS_CONSTANT_R * sTempK));

  const surfaceActivationFactor = computeSurfaceActivationFactor(inputs.sTemp);

  // Effective recombination rate (%/s) proportional to [H2] and oxygen availability
  const o2Factor = Math.max(0.2, Math.min(1.0, (21 - inputs.h2 * 0.5) / 21));
  const rawRecomb =
    inputs.h2 > 0.02
      ? Math.min(
          inputs.h2 * 0.55,
          arrheniusRateConstant * surfaceActivationFactor * inputs.h2 * o2Factor * 1.12
        )
      : 0;
  const recombinationRatePctPerSec = Number(rawRecomb.toFixed(4));

  // Scale PAR chamber volume (~0.18 m^3 active flow equivalent) to mg/s H2 & H2O
  // 1% H2 in 0.18 m^3 at STP ~ 0.074 mol H2 ~ 149 mg H2
  const molH2PerSec = recombinationRatePctPerSec * 0.074;
  const h2ConsumedMgPerSec = molH2PerSec * H2_MOLAR_MASS_G_PER_MOL * 1000;
  const h2oProducedMgPerSec = molH2PerSec * H2O_MOLAR_MASS_G_PER_MOL * 1000;

  // Exothermic heat release: Q = n_dot * dH
  const exothermicPowerW = molH2PerSec * H2_LOWER_HEATING_VALUE_J_PER_MOL;

  // Curie-point self-limiting RF induction power
  // Physical RF coil energizes on TRIGGER (1). On FAILSAFE (3), Pin 8 & Pin 7 alarm LEDs light up
  // while the hardware fail-safe relay cuts RF coil power to prevent ignition.
  const rfCoilEnergized = packet.state === 'TRIGGER' && packet.pulse === 1;
  const curieRatio = Math.min(1, Math.max(0, inputs.sTemp / CURIE_TEMP_C));
  const rfInductionPowerW = rfCoilEnergized
    ? RF_COIL_MAX_POWER_W * Math.max(0, 1 - curieRatio * curieRatio)
    : 0;

  // Buoyant chimney draft velocity v = Cd * sqrt(2 * g * H * dT / T_b)
  const deltaT = Math.max(0, inputs.sTemp - inputs.bTemp);
  const chimneyDraftVelocityMs =
    0.62 * Math.sqrt(2 * GRAVITY_MS2 * CHIMNEY_HEIGHT_M * (deltaT / bTempK));

  // Power efficiency saved vs legacy 450W continuous trace heater
  let powerEfficiencySavedPct = 92.4;
  if (energyStats && energyStats.legacyWh > 0.001) {
    const ratio = 1 - energyStats.smartWh / energyStats.legacyWh;
    powerEfficiencySavedPct = Math.max(70, Math.min(99.8, ratio * 100));
  } else if (packet.pulse === 1) {
    powerEfficiencySavedPct = 92.0;
  } else {
    powerEfficiencySavedPct = 97.6;
  }

  // Shapiro Diagram Flammability Assessment (Air-H2-Steam approximation)
  let flammabilityRegime = 'Inert / Sub-LFL (< 4.0% H₂)';
  let potentialFlameSpeedMs = 0;
  let potentialOverpressureKpa = 0;

  if (inputs.h2 >= 8.0) {
    flammabilityRegime = 'Fast Deflagration / DDT Risk (≥ 8.0% H₂)';
    potentialFlameSpeedMs = 12.5 + (inputs.h2 - 8.0) * 6.5;
    potentialOverpressureKpa = 280 + (inputs.h2 - 8.0) * 55;
  } else if (inputs.h2 >= FAILSAFE_H2_THRESHOLD_PCT) {
    flammabilityRegime = 'LFL Breached — Upward Flame Regime (≥ 4.5% H₂)';
    potentialFlameSpeedMs = 2.1 + (inputs.h2 - 4.0) * 2.4;
    potentialOverpressureKpa = 95 + (inputs.h2 - 4.0) * 46;
  } else if (inputs.h2 >= LFL_H2_UPWARD_PCT) {
    flammabilityRegime = 'Lower Flammability Threshold (4.0–4.5% H₂)';
    potentialFlameSpeedMs = 1.4 + (inputs.h2 - 4.0) * 1.4;
    potentialOverpressureKpa = 55 + (inputs.h2 - 4.0) * 80;
  } else if (inputs.h2 >= 1.5) {
    flammabilityRegime = 'Controllable Recombination Band (1.5–4.0% H₂)';
  }

  return {
    arrheniusRateConstant,
    surfaceActivationFactor,
    recombinationRatePctPerSec,
    h2ConsumedMgPerSec,
    h2oProducedMgPerSec,
    exothermicPowerW,
    rfInductionPowerW,
    chimneyDraftVelocityMs,
    powerEfficiencySavedPct,
    flammabilityRegime,
    potentialOverpressureKpa,
    potentialFlameSpeedMs,
    isFlammable: inputs.h2 >= LFL_H2_UPWARD_PCT,
  };
}

/**
 * Evaluates whether unmitigated physical conditions trigger an actual containment explosion/deflagration.
 * Explosion happens ONLY when fail-safe cutoff is disabled or overwhelmed AND:
 * - [H2] >= 5.2% with an ignition energy source (catalyst >= 155°C or active RF coil arc/hot-spot), OR
 * - [H2] >= 7.2% (critical deflagration buildup in confined chimney).
 */
export function checkExplosionCondition(
  inputs: TelemetryInputs,
  packet: TinyMlPacket,
  failsafeProtectionEnabled: boolean
): { exploded: boolean; reason: 'hot_surface_lfl' | 'critical_deflagration' | null } {
  if (failsafeProtectionEnabled && packet.state === 'FAILSAFE' && inputs.h2 < 6.8) {
    // Active fail-safe cuts RF and vents containment before ignition!
    return { exploded: false, reason: null };
  }

  if (inputs.h2 >= 7.2) {
    return { exploded: true, reason: 'critical_deflagration' };
  }

  if (!failsafeProtectionEnabled && inputs.h2 >= 5.2 && (inputs.sTemp >= 150 || packet.state === 'TRIGGER')) {
    return { exploded: true, reason: 'hot_surface_lfl' };
  }

  return { exploded: false, reason: null };
}

export function buildExplosionReport(
  inputs: TelemetryInputs,
  diagnostics: PhysicsDiagnostics,
  reason: 'hot_surface_lfl' | 'critical_deflagration' | 'manual_stress_test',
  failsafeWasEnabled: boolean
): ExplosionReport {
  const isHotSurface = reason === 'hot_surface_lfl';
  const causeTitle =
    reason === 'critical_deflagration'
      ? 'Unmitigated Hydrogen Accumulation Exceeded Critical Deflagration Limit'
      : isHotSurface
      ? 'Hot-Surface LFL Ignition (Fail-Safe Cutoff Bypassed)'
      : 'Containment Overpressure Deflagration Event';

  const rootCauseDetail = isHotSurface
    ? `Hydrogen concentration reached ${inputs.h2.toFixed(2)}% (above the 4.0% upward Lower Flammability Limit) while catalyst plates were thermally active at ${inputs.sTemp.toFixed(1)}°C. Because the Fail-Safe RF/Venting interlock was disabled, hot Ni-Fe surfaces acted as an ignition source inside the flammable H₂-air mixture.`
    : `Hydrogen injection rate overwhelmed passive recombination capacity, driving volumetric concentration to ${inputs.h2.toFixed(2)}% inside the containment chimney. At this Shapiro Diagram level, upward flame propagation transitions into rapid deflagration with an estimated peak overpressure of ${diagnostics.potentialOverpressureKpa.toFixed(0)} kPa.`;

  const modelResponse = failsafeWasEnabled
    ? `TinyML edge inference flagged FAILSAFE (decision: 2) at 4.50% H₂ in 41 µs, immediately cutting RF Coil Pin 8 (pulse: 0) and energizing Red Alert / Venting Pin 7. However, extreme external leak injection exceeded emergency vent relief capacity.`
    : `TinyML flagged the LFL breach at ${inputs.h2.toFixed(2)}% H₂, but because the Fail-Safe Interlock was manually bypassed in Sandbox testing, emergency RF cutoff and containment inerting were not executed.`;

  return {
    timestamp: new Date().toLocaleTimeString(),
    causeTitle,
    rootCauseDetail,
    modelResponse,
    peakH2Pct: inputs.h2,
    catalystTempC: inputs.sTemp,
    containmentTempC: inputs.bTemp,
    peakOverpressureKpa: Math.max(98, diagnostics.potentialOverpressureKpa),
    flameSpeedMs: Math.max(2.4, diagnostics.potentialFlameSpeedMs),
    shapiroZone: diagnostics.flammabilityRegime,
    mitigationSteps: [
      'Keep Fail-Safe Interlock (Pin 7) armed so RF Induction (Pin 8) automatically locks out at ≥ 4.50% H₂.',
      'Trigger RF pre-heating early (≥ 0.35% H₂ with rising d[H₂]/dt) before gas approaches the 4.0% LFL boundary.',
      'Reset containment chamber to purge residual gas and inspect catalyst plates prior to restarting experiment.',
    ],
  };
}

/**
 * Evaluates the deterministic 24-second Auto Cinematic Experiment timeline.
 */
export function evaluateCinematicTimeline(elapsedSec: number): {
  inputs: TelemetryInputs;
  stage: CinematicStage;
  progress: number;
} {
  const t = ((elapsedSec % CINEMATIC_DURATION_SEC) + CINEMATIC_DURATION_SEC) % CINEMATIC_DURATION_SEC;

  let h2 = 0.12;
  let rate = 0.01;
  let sTemp = 28;
  let bTemp = 27.5;

  if (t < 5.0) {
    // Stage 1: SAFE -> incipient leak onset below 1.0% threshold
    const u = t / 5.0;
    h2 = 0.14 + 0.78 * Math.pow(u, 1.45);
    rate = 0.02 + 0.24 * Math.pow(u, 1.2);
    sTemp = 28 + 3.5 * u;
    bTemp = 27.5 + 1.5 * u;
  } else if (t < 10.8) {
    // Stage 2: TRIGGER -> RandomForest crosses H2 > 1.0%, fires Pin 8 RF induction, sTemp heats 31.5 -> 155°C
    const u = (t - 5.0) / 5.8;
    h2 = 1.08 + 1.18 * Math.sin(u * Math.PI * 0.65);
    rate = 0.28 * (1 - u * 0.65);
    sTemp = 31.5 + 124.5 * (1 - Math.pow(1 - u, 1.42));
    bTemp = 29 + 14 * u;
  } else if (t < 19.2) {
    // Stage 3 + early Exhaust camera: EXOTHERMIC catalysis peaking at ~192°C while H2 consumes 2.15 -> 1.02%
    const u = (t - 10.8) / 8.4;
    h2 = 2.15 * Math.exp(-0.74 * u);
    rate = -0.26 * Math.exp(-0.75 * u);
    sTemp = 156 + 36 * Math.sin(u * Math.PI * 0.85);
    bTemp = 43 + 12 * Math.sin(u * Math.PI * 0.65);
  } else {
    // Stage 4 late: SAFE cooldown -> residual steam clears, H2 drops 0.75 -> 0.14%, sTemp cools 164 -> 44°C
    const u = (t - 19.2) / 4.8;
    h2 = 0.75 * (1 - u) + 0.14 * u;
    rate = -0.06 * (1 - u);
    sTemp = 164 - 120 * Math.pow(u, 0.75);
    bTemp = 50 - 20 * u;
  }

  const stage =
    CINEMATIC_STAGES.find((s) => t >= s.timeRange[0] && t < s.timeRange[1]) ??
    CINEMATIC_STAGES[0];

  return {
    inputs: {
      h2: Number(h2.toFixed(2)),
      rate: Number(rate.toFixed(2)),
      sTemp: Number(sTemp.toFixed(1)),
      bTemp: Number(bTemp.toFixed(1)),
    },
    stage,
    progress: t / CINEMATIC_DURATION_SEC,
  };
}

/**
 * Real-time ODE integration step for Live Accumulation mode & 4.5% Fail-Safe scenario.
 * Accepts an optional external TinyMlPacket (e.g., live from Arduino Uno over Web Serial)
 * so the physical simulation acts strictly on what the connected hardware/model commands.
 */
export function stepDynamicPhysics(
  current: TelemetryInputs,
  config: DynamicSimConfig,
  dtSec: number,
  externalPacket?: TinyMlPacket | null
): {
  nextInputs: TelemetryInputs;
  packet: TinyMlPacket;
  diagnostics: PhysicsDiagnostics;
  smartEnergyDeltaWh: number;
  legacyEnergyDeltaWh: number;
  explosion: { exploded: boolean; reason: 'hot_surface_lfl' | 'critical_deflagration' | null };
} {
  const dt = Math.min(0.1, Math.max(0.001, dtSec));

  const packet =
    externalPacket ??
    evaluateTinyMlDecision(current, {
      rfEnabled: config.rfPreheatingEnabled,
      failsafeEnabled: config.failsafeProtectionEnabled,
    });

  // Respect hardware/config interlock: if external Arduino sends pulse=1 during >=4.5% H2
  // while failsafe is disabled or Arduino failed to cut off, RF remains energized (ignition hazard!)
  const effectivePacket: TinyMlPacket = {
    ...packet,
    pulse:
      externalPacket !== undefined && externalPacket !== null
        ? packet.pulse
        : config.rfPreheatingEnabled
        ? packet.pulse
        : 0,
  };

  const diagnostics = computePhysicsDiagnostics(current, effectivePacket, {
    smartWh: config.cumulativeSmartEnergyWh,
    legacyWh: config.cumulativeLegacyEnergyWh,
  });

  // 1. Hydrogen concentration balance: dH2/dt = leak - recombination - failsafe_vent
  const ventActive = effectivePacket.state === 'FAILSAFE' && config.failsafeProtectionEnabled;
  const ventRate = ventActive ? Math.max(0, (current.h2 - 1.2) * 0.22) : 0;
  const netRate =
    config.leakInjectionRatePctPerSec - diagnostics.recombinationRatePctPerSec - ventRate;
  const nextH2 = Math.max(0, Math.min(10.0, current.h2 + netRate * dt));

  // Smooth derivative readout (%/s)
  const nextRate = current.rate * 0.72 + netRate * 0.28;

  // 2. Catalyst plate thermal balance: C_th * dTs/dt = P_RF + f_wall * P_exo - P_loss
  // Thin Ni-Fe foil fins heat rapidly via RF eddy currents (~10.5 J/K) and peak naturally under H2 catalysis
  const thermalMassJPerK = 10.5;
  const plateExothermicW = diagnostics.exothermicPowerW * 0.032;
  const convCoolingW =
    (0.34 + diagnostics.chimneyDraftVelocityMs * 0.16) * (current.sTemp - current.bTemp) +
    0.18 * Math.pow(Math.max(0, current.sTemp - 155), 1.65);
  const netHeatW = diagnostics.rfInductionPowerW + plateExothermicW - convCoolingW;
  const nextSTemp = Math.max(24, Math.min(240, current.sTemp + (netHeatW / thermalMassJPerK) * dt));

  // 3. Containment ambient temperature balance
  const boxHeatTransferW = 0.22 * (nextSTemp - current.bTemp) - 0.12 * (current.bTemp - 25);
  const nextBTemp = Math.max(22, Math.min(100, current.bTemp + boxHeatTransferW * dt));

  const nextInputs: TelemetryInputs = {
    h2: Number(nextH2.toFixed(3)),
    rate: Number(nextRate.toFixed(3)),
    sTemp: Number(nextSTemp.toFixed(2)),
    bTemp: Number(nextBTemp.toFixed(2)),
  };

  // Energy accounting (Wh)
  const activeSmartW = 0.4 + diagnostics.rfInductionPowerW;
  const smartEnergyDeltaWh = (activeSmartW * dt) / 3600;
  const legacyEnergyDeltaWh = (LEGACY_TRACE_HEATER_W * dt) / 3600;

  // Explosion check: if external Arduino fails to switch to FAILSAFE at >=4.5% (or runs unmitigated at LFL),
  // ignition / critical deflagration occurs!
  const failsafeHonored =
    config.failsafeProtectionEnabled && effectivePacket.state === 'FAILSAFE';
  const explosion = checkExplosionCondition(nextInputs, effectivePacket, failsafeHonored);

  return {
    nextInputs,
    packet: effectivePacket,
    diagnostics,
    smartEnergyDeltaWh,
    legacyEnergyDeltaWh,
    explosion,
  };
}

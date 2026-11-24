import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExplosionReport,
  checkExplosionCondition,
  computePhysicsDiagnostics,
  evaluateCinematicTimeline,
  evaluateTinyMlDecision,
  stepDynamicPhysics,
} from './physics';
import {
  formatOutgoingDataPacket,
  formatResetCommand,
  parseIncomingSerialLine,
} from '../serial/protocol';

test('Eloquent RandomForest classifier transitions across SAFE (0), TRIGGER (1), EXOTHERMIC (2), and FAILSAFE (3)', () => {
  const safe = evaluateTinyMlDecision({ h2: 0.2, rate: 0.01, sTemp: 28, bTemp: 26 });
  assert.equal(safe.state, 'SAFE');
  assert.equal(safe.pulse, 0);
  assert.equal(safe.decision, 0);
  assert.equal(safe.treeVotes?.reduce((a, b) => a + b, 0), 5);

  const trigger = evaluateTinyMlDecision({ h2: 1.25, rate: 0.18, sTemp: 35, bTemp: 28 });
  assert.equal(trigger.state, 'TRIGGER');
  assert.equal(trigger.pulse, 1);
  assert.equal(trigger.decision, 1);

  const exo = evaluateTinyMlDecision({ h2: 1.65, rate: -0.1, sTemp: 162, bTemp: 40 });
  assert.equal(exo.state, 'EXOTHERMIC');
  assert.equal(exo.pulse, 0);
  assert.equal(exo.decision, 2);

  const failsafe = evaluateTinyMlDecision({ h2: 4.5, rate: 0.3, sTemp: 170, bTemp: 48 });
  assert.equal(failsafe.state, 'FAILSAFE');
  assert.equal(failsafe.pulse, 1);
  assert.equal(failsafe.decision, 3);
});

test('Web Serial protocol formats exact 9600-baud DATA strings and parses JSON decision 0..3 packets', () => {
  const out = formatOutgoingDataPacket(1.234, 0.456, 152.34, 38.91);
  assert.equal(out, 'DATA:1.23,0.46,152.3,38.9\n');
  assert.equal(formatResetCommand(), 'RESET\n');

  const triggerPkt = parseIncomingSerialLine('{"decision": 1, "state": "TRIGGER", "pulse": 1, "us": 44}\n');
  assert.deepEqual(triggerPkt, { decision: 1, state: 'TRIGGER', pulse: 1, us: 44 });

  const failsafePkt = parseIncomingSerialLine('{"decision":3,"state":"FAILSAFE","pulse":1,"us":42}\n');
  assert.deepEqual(failsafePkt, { decision: 3, state: 'FAILSAFE', pulse: 1, us: 42 });

  assert.equal(parseIncomingSerialLine('partial garbage'), null);
  assert.equal(parseIncomingSerialLine('{"decision": 9, "state": "SAFE", "pulse": 0, "us": 10}'), null);
});

test('Arrhenius kinetics suppress cold recombination and unlock above 150C', () => {
  const coldInputs = { h2: 2.0, rate: 0.1, sTemp: 30, bTemp: 28 };
  const coldPacket = evaluateTinyMlDecision(coldInputs);
  const coldDiag = computePhysicsDiagnostics(coldInputs, coldPacket);

  const hotInputs = { h2: 2.0, rate: 0.0, sTemp: 175, bTemp: 40 };
  const hotPacket = evaluateTinyMlDecision(hotInputs);
  const hotDiag = computePhysicsDiagnostics(hotInputs, hotPacket);

  assert.ok(coldDiag.recombinationRatePctPerSec < 0.05);
  assert.ok(hotDiag.recombinationRatePctPerSec > coldDiag.recombinationRatePctPerSec * 10);
  assert.ok(hotDiag.exothermicPowerW > 10);
  assert.ok(hotDiag.chimneyDraftVelocityMs > coldDiag.chimneyDraftVelocityMs);
});

test('Explosion condition triggers when fail-safe is bypassed at LFL + hot surface', () => {
  const inputs = { h2: 5.4, rate: 0.4, sTemp: 165, bTemp: 55 };
  const bypassedPacket = evaluateTinyMlDecision(inputs, { failsafeEnabled: false });
  const armedPacket = evaluateTinyMlDecision(inputs, { failsafeEnabled: true });

  const bypassedCheck = checkExplosionCondition(inputs, bypassedPacket, false);
  const armedCheck = checkExplosionCondition(inputs, armedPacket, true);

  assert.equal(bypassedCheck.exploded, true);
  assert.equal(bypassedCheck.reason, 'hot_surface_lfl');
  assert.equal(armedCheck.exploded, false);

  const diag = computePhysicsDiagnostics(inputs, bypassedPacket);
  const report = buildExplosionReport(inputs, diag, 'hot_surface_lfl', false);
  assert.ok(report.peakOverpressureKpa > 90);
  assert.ok(report.mitigationSteps.length >= 2);
});

test('24s cinematic timeline covers SAFE -> TRIGGER -> EXOTHERMIC -> SAFE', () => {
  const s1 = evaluateCinematicTimeline(1.0);
  const s2 = evaluateCinematicTimeline(7.5);
  const s3 = evaluateCinematicTimeline(14.0);
  const s4 = evaluateCinematicTimeline(22.5);

  assert.equal(evaluateTinyMlDecision(s1.inputs).state, 'SAFE');
  assert.equal(evaluateTinyMlDecision(s2.inputs).state, 'TRIGGER');
  assert.equal(evaluateTinyMlDecision(s3.inputs).state, 'EXOTHERMIC');
  assert.equal(evaluateTinyMlDecision(s4.inputs).state, 'SAFE');
});

test('Dynamic ODE step heats catalyst via RF induction when H2 leaks', () => {
  let state = { h2: 1.35, rate: 0.25, sTemp: 30, bTemp: 26 };
  const cfg = {
    leakInjectionRatePctPerSec: 0.15,
    rfPreheatingEnabled: true,
    failsafeProtectionEnabled: true,
    cumulativeSmartEnergyWh: 0,
    cumulativeLegacyEnergyWh: 0,
  };

  for (let i = 0; i < 60; i++) {
    const res = stepDynamicPhysics(state, cfg, 0.05);
    state = res.nextInputs;
  }

  assert.ok(state.sTemp > 38, 'RF induction should heat catalyst plates');
});

test('External faulty Arduino packet at >=5.2% H2 triggers explosion if FAILSAFE is missed', () => {
  const cfg = {
    leakInjectionRatePctPerSec: 0.4,
    rfPreheatingEnabled: true,
    failsafeProtectionEnabled: true,
    cumulativeSmartEnergyWh: 0,
    cumulativeLegacyEnergyWh: 0,
  };
  const state = { h2: 5.35, rate: 0.35, sTemp: 158, bTemp: 50 };

  // Faulty Arduino mistakenly keeps pulsing RF instead of FAILSAFE
  const faultyPacket = { decision: 1 as const, state: 'TRIGGER' as const, pulse: 1 as const, us: 44 };
  const badRes = stepDynamicPhysics(state, cfg, 0.1, faultyPacket);
  assert.equal(badRes.explosion.exploded, true);

  // Correct Arduino sends FAILSAFE (decision: 3, pulse: 1 alarm LED)
  const safePacket = { decision: 3 as const, state: 'FAILSAFE' as const, pulse: 1 as const, us: 42 };
  const goodRes = stepDynamicPhysics(state, cfg, 0.1, safePacket);
  assert.equal(goodRes.explosion.exploded, false);
});

test('Manual H2 injection triggers RF heating, reaches realistic exothermic peak, consumes H2, and returns to SAFE', () => {
  let state = { h2: 1.85, rate: 0.35, sTemp: 32, bTemp: 28 };
  const cfg = {
    leakInjectionRatePctPerSec: 0,
    rfPreheatingEnabled: true,
    failsafeProtectionEnabled: true,
    cumulativeSmartEnergyWh: 0,
    cumulativeLegacyEnergyWh: 0,
  };

  let peakTemp = 0;
  let sawTrigger = false;
  let sawExothermic = false;
  let finalState = 'SAFE';

  for (let i = 0; i < 240; i++) {
    const res = stepDynamicPhysics(state, cfg, 0.1);
    state = res.nextInputs;
    peakTemp = Math.max(peakTemp, state.sTemp);
    if (res.packet.state === 'TRIGGER') sawTrigger = true;
    if (res.packet.state === 'EXOTHERMIC') sawExothermic = true;
    finalState = res.packet.state;
  }

  assert.equal(sawTrigger, true, 'Should enter RF TRIGGER stage');
  assert.equal(sawExothermic, true, 'Should reach >=150C EXOTHERMIC catalysis stage');
  assert.ok(peakTemp >= 162 && peakTemp <= 230, `Peak catalyst temp ${peakTemp}C should stay physically realistic`);
  assert.ok(state.bTemp >= 22 && state.bTemp <= 100, `Box temp ${state.bTemp}C should stay within 22..100C`);
  assert.ok(state.h2 < 0.95, `H2 should be consumed by recombination (got ${state.h2}%)`);
  assert.equal(finalState, 'SAFE', 'Should return to SAFE standby once H2 is consumed');

  const traceCheck = evaluateTinyMlDecision({ h2: 1.5, rate: 0.25, sTemp: 35, bTemp: 28 });
  assert.equal(traceCheck.perTreePredictions?.length, 5);
});

test('Strict external Arduino packet never falls back to simulated RF heating when Arduino reports SAFE', () => {
  const cfg = {
    leakInjectionRatePctPerSec: 0,
    rfPreheatingEnabled: true,
    failsafeProtectionEnabled: true,
    cumulativeSmartEnergyWh: 0,
    cumulativeLegacyEnergyWh: 0,
  };
  let state = { h2: 2.2, rate: 0.35, sTemp: 30, bTemp: 27 };
  const standbyArduino = { decision: 0 as const, state: 'SAFE' as const, pulse: 0 as const, us: 0 };

  for (let i = 0; i < 30; i++) {
    const res = stepDynamicPhysics(state, cfg, 0.1, standbyArduino);
    assert.equal(res.packet.pulse, 0);
    assert.equal(res.diagnostics.rfInductionPowerW, 0);
    state = res.nextInputs;
  }
  assert.ok(state.sTemp <= 31, `Expected plates to stay cold without Arduino TRIGGER, got ${state.sTemp}C`);
});


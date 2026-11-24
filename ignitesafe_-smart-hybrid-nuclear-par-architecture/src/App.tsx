/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minimize2 } from 'lucide-react';
import { soundEngine } from './audio/soundEngine';
import { BottomControlDock } from './components/BottomControlDock';
import { CauseEffectCard } from './components/CauseEffectCard';
import { ExplosionModal } from './components/ExplosionModal';
import { HowItWorksDrawer } from './components/HowItWorksDrawer';
import { LaunchModeOverlay } from './components/LaunchModeOverlay';
import { MatrixPresentationModal } from './components/MatrixPresentationModal';
import { PhysicsSopDrawer } from './components/PhysicsSopDrawer';
import {
  ScientificMatrixPanel,
  type ModelAuthorityMode,
  type ValidationStageResult,
} from './components/ScientificMatrixPanel';
import { SerialMonitorDrawer } from './components/SerialMonitorDrawer';
import { TopBar } from './components/TopBar';
import { formatOutgoingDataPacket } from './serial/protocol';
import { ArduinoSerialClient } from './serial/webSerial';
import { PART_CATALOG } from './sim/partCatalog';
import {
  buildExplosionReport,
  CINEMATIC_STAGES,
  computePhysicsDiagnostics,
  evaluateCinematicTimeline,
  evaluateTinyMlDecision,
  stepDynamicPhysics,
} from './sim/physics';
import type {
  ArduinoVerificationStatus,
  CameraPresetId,
  CollisionMetrics,
  ExplosionReport,
  LaunchMode,
  OperationMode,
  ParState,
  PartHoverInfo,
  PartInspectorId,
  SerialLogEntry,
  TelemetryHistoryPoint,
  TelemetryInputs,
  TinyMlPacket,
} from './sim/types';
import {
  mountParScene,
  type ParSceneController,
  type ProjectedLabel,
} from './three/parScene';

const INITIAL_INPUTS: TelemetryInputs = {
  h2: 0.12,
  rate: 0.02,
  sTemp: 28.0,
  bTemp: 27.5,
};

const STANDBY_UNVERIFIED_PACKET: TinyMlPacket = {
  decision: 0,
  state: 'SAFE',
  pulse: 0,
  us: 0,
};

const VALIDATION_STAGES: {
  targetState: 'SAFE' | 'TRIGGER' | 'EXOTHERMIC' | 'FAILSAFE';
  inputs: TelemetryInputs;
}[] = [
  { targetState: 'SAFE', inputs: { h2: 0.2, rate: 0.01, sTemp: 29.0, bTemp: 27.0 } },
  { targetState: 'TRIGGER', inputs: { h2: 1.45, rate: 0.28, sTemp: 42.0, bTemp: 29.0 } },
  { targetState: 'EXOTHERMIC', inputs: { h2: 1.85, rate: -0.14, sTemp: 168.0, bTemp: 46.0 } },
  { targetState: 'FAILSAFE', inputs: { h2: 4.55, rate: 0.45, sTemp: 158.0, bTemp: 48.0 } },
];

const INITIAL_VALIDATION_RESULTS: ValidationStageResult[] = VALIDATION_STAGES.map((s) => ({
  targetState: s.targetState,
  observedState: null,
  passed: null,
  latencyUs: null,
}));

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<ParSceneController | null>(null);
  const serialRef = useRef<ArduinoSerialClient | null>(null);

  const autostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [launchMode, setLaunchMode] = useState<LaunchMode>(autostart ? 'standalone' : 'unselected');
  const [launchGateOpen, setLaunchGateOpen] = useState<boolean>(!autostart);
  const [arduinoStatus, setArduinoStatus] = useState<ArduinoVerificationStatus>('disconnected');
  const [cinemaMode, setCinemaMode] = useState(false);

  const [mode, setMode] = useState<OperationMode>(autostart ? 'cinematic' : 'manual');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(autostart);
  const [isFailsafeScenario, setIsFailsafeScenario] = useState(false);
  const [cinematicTimeSec, setCinematicTimeSec] = useState(0);

  const [inputs, setInputs] = useState<TelemetryInputs>(INITIAL_INPUTS);
  const [arduinoPacketOverride, setArduinoPacketOverride] = useState<TinyMlPacket | null>(null);
  const [authorityMode, setAuthorityMode] = useState<ModelAuthorityMode>('smart_ml');
  const [exploded, setExploded] = useState(false);
  const [explosionReport, setExplosionReport] = useState<ExplosionReport | null>(null);

  // Manual Sandbox Dynamic Physics Config
  const [liveAccumulation, setLiveAccumulation] = useState(true);
  const [leakInjectionRate, setLeakInjectionRate] = useState(0.0);
  const [rfPreheatingEnabled, setRfPreheatingEnabled] = useState(true);
  const [failsafeProtectionEnabled, setFailsafeProtectionEnabled] = useState(true);
  const [energyStats, setEnergyStats] = useState({ smartWh: 0, legacyWh: 0 });

  // Model Validation Sweep State
  const [validationRunning, setValidationRunning] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationStageResult[]>(
    INITIAL_VALIDATION_RESULTS
  );

  // Camera, Labels, Hover & UI Chrome
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('wide');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [serialConnected, setSerialConnected] = useState(false);
  const [serialStatusLabel, setSerialStatusLabel] = useState('Disconnected');
  const [serialErrorHint, setSerialErrorHint] = useState<string | null>(null);
  const [activeDrawer, setActiveDrawer] = useState<'none' | 'physics' | 'serial'>('none');
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  // Keep 3D stage open by default; Matrix toggles cleanly on click
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [matrixExplorerOpen, setMatrixExplorerOpen] = useState(false);
  const [show3dLabels, setShow3dLabels] = useState(false);
  const [partHover, setPartHover] = useState<PartHoverInfo | null>(null);
  const [selectedPart, setSelectedPart] = useState<PartInspectorId | null>(null);
  const [projectedLabels, setProjectedLabels] = useState<ProjectedLabel[]>([]);
  const [collisionMetrics, setCollisionMetrics] = useState<CollisionMetrics>({
    collisionsPerSec: 0,
    recombinationIntensity: 0.02,
    activeVectors: 0,
  });
  const [history, setHistory] = useState<TelemetryHistoryPoint[]>([]);
  const [serialLogs, setSerialLogs] = useState<SerialLogEntry[]>([]);
  const [lastTxPayload, setLastTxPayload] = useState<string>(() =>
    formatOutgoingDataPacket(
      INITIAL_INPUTS.h2,
      INITIAL_INPUTS.rate,
      INITIAL_INPUTS.sTemp,
      INITIAL_INPUTS.bTemp
    ).trim()
  );
  const [lastRxPayload, setLastRxPayload] = useState<string>('No response yet');

  const lastLoggedStateRef = useRef<ParState>('SAFE');
  const inputsRef = useRef(inputs);
  inputsRef.current = inputs;
  const energyRef = useRef(energyStats);
  energyRef.current = energyStats;
  const arduinoPacketRef = useRef(arduinoPacketOverride);
  arduinoPacketRef.current = arduinoPacketOverride;
  const launchModeRef = useRef(launchMode);
  launchModeRef.current = launchMode;
  const lastCinematicCamStageRef = useRef<string>('');
  const historyTickRef = useRef(0);
  const sweepTimersRef = useRef<number[]>([]);

  const pushLog = useCallback(
    (
      direction: 'TX' | 'RX' | 'SYS',
      source: 'USB-9600' | 'SIM-ML',
      payload: string,
      state?: ParState
    ) => {
      if (direction === 'TX') {
        setLastTxPayload(payload);
      } else if (direction === 'RX') {
        setLastRxPayload(payload);
      }
      const entry: SerialLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toLocaleTimeString(),
        direction,
        source,
        payload,
        state,
      };
      setSerialLogs((prev) => [entry, ...prev].slice(0, 80));
    },
    []
  );

  // Derived TinyML Packet based strictly on LaunchMode:
  // - In 'arduino' hardware mode: NEVER use browser simulated AI fallback!
  // - In 'unselected' standby: stay at neutral standby packet
  // - In 'standalone' mode: run exact 5-tree Eloquent RandomForest twin
  const fallbackPacket = useMemo(() => {
    if (launchMode !== 'standalone') {
      return STANDBY_UNVERIFIED_PACKET;
    }
    if (authorityMode === 'faulty_model') {
      return evaluateTinyMlDecision(inputs, {
        rfEnabled: true,
        failsafeEnabled: false,
      });
    }
    return evaluateTinyMlDecision(inputs, {
      rfEnabled: mode === 'manual' ? rfPreheatingEnabled : true,
      failsafeEnabled: mode === 'manual' ? failsafeProtectionEnabled : true,
    });
  }, [launchMode, inputs, mode, rfPreheatingEnabled, failsafeProtectionEnabled, authorityMode]);

  const activePacket =
    launchMode === 'arduino'
      ? arduinoPacketOverride ?? STANDBY_UNVERIFIED_PACKET
      : serialConnected && arduinoPacketOverride
      ? arduinoPacketOverride
      : fallbackPacket;

  const awaitingArduino = launchMode === 'arduino' && arduinoStatus !== 'verified';
  const activeState: ParState = exploded ? 'EXPLOSION' : activePacket.state;

  const diagnostics = useMemo(
    () => computePhysicsDiagnostics(inputs, activePacket, energyStats),
    [inputs, activePacket, energyStats]
  );

  const cinematicEval = useMemo(
    () => evaluateCinematicTimeline(cinematicTimeSec),
    [cinematicTimeSec]
  );

  const recombinationIntensity = useMemo(() => {
    if (inputs.sTemp < 150) {
      return Math.min(0.18, diagnostics.surfaceActivationFactor * 0.4 + inputs.h2 * 0.02);
    }
    return Math.min(
      1,
      Math.max(0.25, diagnostics.surfaceActivationFactor * (0.35 + inputs.h2 * 0.26))
    );
  }, [inputs.sTemp, inputs.h2, diagnostics.surfaceActivationFactor]);

  // Sync body attribute for deterministic verification
  useEffect(() => {
    document.body.dataset.state = activeState;
    document.body.dataset.mode = mode;
    document.body.dataset.launch = launchMode;
  }, [activeState, mode, launchMode]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 768) {
        setMatrixOpen(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Mount Three.js 3D Viewport once
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const controller = mountParScene(mountEl, {
      onRecombinationVisual: () => {
        soundEngine.playRecombinationDroplet();
      },
      onPartHover: (hover) => {
        setPartHover(hover);
      },
      onPartClick: (partId) => {
        soundEngine.playUiClick();
        setSelectedPart((prev) => (prev === partId ? null : partId));
      },
      onProjectedLabels: (labels) => {
        setProjectedLabels(labels);
      },
      onCollisionMetrics: (metrics) => {
        setCollisionMetrics(metrics);
      },
    });
    sceneRef.current = controller;

    return () => {
      controller.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Initialize Web Serial Client once
  useEffect(() => {
    const client = new ArduinoSerialClient({
      onPacket: (packet, rawLine) => {
        setArduinoPacketOverride(packet);
        pushLog('RX', 'USB-9600', rawLine, packet.state);
      },
      onLog: (dir, payload) => {
        pushLog(dir, 'USB-9600', payload);
      },
      onStatusChange: (connected, label, errorHint) => {
        setSerialConnected(connected);
        setSerialStatusLabel(label);
        setSerialErrorHint(errorHint ?? null);
        if (connected) {
          setAuthorityMode('arduino_hardware');
        } else {
          setArduinoPacketOverride(null);
          setArduinoStatus(errorHint ? 'error' : 'disconnected');
          setAuthorityMode((prev) =>
            prev === 'arduino_hardware' && launchModeRef.current === 'standalone'
              ? 'smart_ml'
              : prev
          );
        }
      },
      onVerificationChange: (verified) => {
        setArduinoStatus(
          verified ? 'verified' : client.isConnected() ? 'awaiting_reply' : 'disconnected'
        );
      },
    });
    serialRef.current = client;
    pushLog(
      'SYS',
      'SIM-ML',
      'IgniteSafe Reactor ready. Select Physical Arduino USB or Standalone Simulation.'
    );

    return () => {
      sweepTimersRef.current.forEach((id) => window.clearTimeout(id));
      void client.disconnect();
    };
  }, [pushLog]);

  const toggleCinemaMode = useCallback(() => {
    soundEngine.playUiClick();
    setCinemaMode((prev) => {
      const next = !prev;
      if (next) {
        if (document.documentElement.requestFullscreen) {
          void document.documentElement.requestFullscreen().catch(() => undefined);
        }
        setActiveDrawer('none');
        setHowItWorksOpen(false);
        setMatrixOpen(false);
      } else if (document.fullscreenElement && document.exitFullscreen) {
        void document.exitFullscreen().catch(() => undefined);
      }
      return next;
    });
  }, []);

  // Keyboard shortcuts: 'H' toggles bottom dock, 'F' toggles Fullscreen Cinema, 'Escape' exits Cinema
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (launchGateOpen) return;
      const key = e.key.toLowerCase();
      if (key === 'h') {
        setDockCollapsed((c) => !c);
      } else if (key === 'f') {
        toggleCinemaMode();
      } else if (key === 'escape' && cinemaMode) {
        setCinemaMode(false);
        if (document.fullscreenElement && document.exitFullscreen) {
          void document.exitFullscreen().catch(() => undefined);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [launchGateOpen, cinemaMode, toggleCinemaMode]);

  // Push telemetry into 3D scene & Web Audio synthesizer
  useEffect(() => {
    const rfEnergized = activeState === 'TRIGGER';
    sceneRef.current?.updateTelemetry({
      h2: inputs.h2,
      rate: inputs.rate,
      sTemp: inputs.sTemp,
      bTemp: inputs.bTemp,
      state: activeState,
      pulse: activePacket.pulse,
      rfCoilEnergized: rfEnergized,
      recombinationIntensity,
      chimneyDraftVelocityMs: diagnostics.chimneyDraftVelocityMs,
      cameraPreset,
      manualOverrideActive: mode === 'manual',
    });
    sceneRef.current?.setHighlightedPart(partHover?.id ?? selectedPart);

    // Keep audio silent while waiting on initial launch gate
    if (launchMode === 'unselected' || launchGateOpen) {
      soundEngine.updateTelemetry(0, 'SAFE', 0);
    } else {
      soundEngine.updateTelemetry(inputs.h2, activeState, rfEnergized ? 1 : 0);
    }

    if (launchMode === 'standalone' && !serialConnected && activeState !== 'EXPLOSION') {
      const compactPkt = {
        decision: activePacket.decision,
        state: activePacket.state,
        pulse: activePacket.pulse,
        us: activePacket.us,
      };
      if (lastLoggedStateRef.current !== activeState) {
        lastLoggedStateRef.current = activeState;
        pushLog('RX', 'SIM-ML', JSON.stringify(compactPkt), activeState);
      } else {
        setLastRxPayload(JSON.stringify(compactPkt));
      }
    }
  }, [
    inputs,
    activeState,
    activePacket,
    recombinationIntensity,
    diagnostics.chimneyDraftVelocityMs,
    cameraPreset,
    mode,
    launchMode,
    launchGateOpen,
    serialConnected,
    partHover?.id,
    selectedPart,
    pushLog,
  ]);

  // Auto-Director Camera Glide in Cinematic Mode
  useEffect(() => {
    if (launchGateOpen || mode !== 'cinematic' || cameraPreset !== 'auto') return;
    if (isFailsafeScenario) {
      if (lastCinematicCamStageRef.current !== 'failsafe') {
        lastCinematicCamStageRef.current = 'failsafe';
        sceneRef.current?.setCameraPreset('wide', true);
      }
      return;
    }
    const stageId = cinematicEval.stage.id;
    if (lastCinematicCamStageRef.current !== stageId) {
      lastCinematicCamStageRef.current = stageId;
      sceneRef.current?.setCameraPreset(cinematicEval.stage.cameraPreset, true);
    }
  }, [launchGateOpen, mode, cameraPreset, isFailsafeScenario, cinematicEval.stage]);

  // Simulation Ticker (100ms step) — PAUSED while launchMode === 'unselected' or launchGateOpen
  useEffect(() => {
    if (exploded || launchMode === 'unselected' || launchGateOpen) return;

    const interval = window.setInterval(() => {
      historyTickRef.current += 1;

      if (mode === 'cinematic') {
        if (!isPlaying) return;
        if (isFailsafeScenario) {
          setInputs((prev) => {
            const nextH2 = Math.min(4.85, prev.h2 + 0.08);
            const nextRate = nextH2 < 4.8 ? 0.55 : 0.02;
            const nextSTemp = Math.max(36, prev.sTemp - 0.8);
            return {
              h2: Number(nextH2.toFixed(2)),
              rate: Number(nextRate.toFixed(2)),
              sTemp: Number(nextSTemp.toFixed(1)),
              bTemp: 44.5,
            };
          });
        } else {
          setCinematicTimeSec((prevT) => {
            const nextT = (prevT + 0.1) % 24;
            const nextEval = evaluateCinematicTimeline(nextT);
            setInputs(nextEval.inputs);
            return nextT;
          });
        }
      } else if (mode === 'manual' && liveAccumulation) {
        // Strict hardware check: in 'arduino' launchMode, NEVER substitute simulated AI decisions!
        const externalActuation =
          launchMode === 'arduino'
            ? arduinoPacketRef.current ?? STANDBY_UNVERIFIED_PACKET
            : serialConnected && arduinoPacketRef.current
            ? arduinoPacketRef.current
            : authorityMode === 'faulty_model'
            ? evaluateTinyMlDecision(inputsRef.current, { rfEnabled: true, failsafeEnabled: false })
            : null;

        const res = stepDynamicPhysics(
          inputsRef.current,
          {
            leakInjectionRatePctPerSec: leakInjectionRate,
            rfPreheatingEnabled:
              launchMode === 'arduino'
                ? true
                : authorityMode === 'faulty_model'
                ? true
                : rfPreheatingEnabled,
            failsafeProtectionEnabled:
              launchMode === 'arduino'
                ? true
                : authorityMode === 'faulty_model'
                ? false
                : failsafeProtectionEnabled,
            cumulativeSmartEnergyWh: energyRef.current.smartWh,
            cumulativeLegacyEnergyWh: energyRef.current.legacyWh,
          },
          0.1,
          externalActuation
        );

        setInputs(res.nextInputs);
        setEnergyStats((prev) => ({
          smartWh: prev.smartWh + res.smartEnergyDeltaWh,
          legacyWh: prev.legacyWh + res.legacyEnergyDeltaWh,
        }));

        if (res.explosion.exploded && res.explosion.reason) {
          const report = buildExplosionReport(
            res.nextInputs,
            res.diagnostics,
            res.explosion.reason,
            launchMode === 'arduino'
              ? res.packet.state === 'FAILSAFE'
              : authorityMode !== 'faulty_model' && failsafeProtectionEnabled
          );
          setExploded(true);
          setExplosionReport(report);
          sceneRef.current?.triggerExplosionVisual();
          pushLog(
            'SYS',
            launchMode === 'arduino' ? 'USB-9600' : 'SIM-ML',
            `CRITICAL: ${report.causeTitle}`,
            'EXPLOSION'
          );
        }
      }

      if (historyTickRef.current % 3 === 0) {
        const cur = inputsRef.current;
        setHistory((prev) => [
          ...prev.slice(-59),
          {
            t: Date.now(),
            h2: cur.h2,
            sTemp: cur.sTemp,
            recomb: diagnostics.recombinationRatePctPerSec,
            rfPower: diagnostics.rfInductionPowerW,
          },
        ]);
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [
    launchMode,
    launchGateOpen,
    mode,
    isPlaying,
    isFailsafeScenario,
    liveAccumulation,
    leakInjectionRate,
    rfPreheatingEnabled,
    failsafeProtectionEnabled,
    authorityMode,
    serialConnected,
    exploded,
    diagnostics.recombinationRatePctPerSec,
    diagnostics.rfInductionPowerW,
    pushLog,
  ]);

  // Periodic Outgoing Web Serial TX every 500ms during active run
  useEffect(() => {
    if (launchMode === 'unselected' || launchGateOpen || exploded) return;
    const shouldStream =
      (mode === 'cinematic' && isPlaying) || (mode === 'manual' && liveAccumulation);
    if (!shouldStream) return;

    const timer = window.setInterval(() => {
      const cur = inputsRef.current;
      if (serialRef.current?.isConnected()) {
        void serialRef.current.sendData(cur.h2, cur.rate, cur.sTemp, cur.bTemp);
      } else if (launchMode === 'standalone') {
        pushLog(
          'TX',
          'SIM-ML',
          formatOutgoingDataPacket(cur.h2, cur.rate, cur.sTemp, cur.bTemp).trim()
        );
      }
    }, 500);

    return () => window.clearInterval(timer);
  }, [launchMode, launchGateOpen, mode, isPlaying, liveAccumulation, exploded, pushLog]);

  const clearSweepTimers = () => {
    sweepTimersRef.current.forEach((id) => window.clearTimeout(id));
    sweepTimersRef.current = [];
    setValidationRunning(false);
  };

  // Handlers
  const handleToggleSound = () => {
    const next = !soundEnabled;
    soundEngine.setEnabled(next);
    setSoundEnabled(next);
    if (next) soundEngine.playUiClick();
  };

  const handleToggleSerialConnect = async (baudRate = 9600) => {
    soundEngine.playUiClick();
    if (serialConnected) {
      await serialRef.current?.disconnect();
    } else {
      setArduinoStatus('connecting');
      const ok = await serialRef.current?.connect(baudRate, inputsRef.current);
      if (ok) {
        setArduinoStatus(serialRef.current?.isVerified() ? 'verified' : 'awaiting_reply');
      } else {
        setArduinoStatus('error');
        if (!launchGateOpen) {
          setActiveDrawer('serial');
        }
      }
    }
  };

  const handleRetryHandshake = () => {
    soundEngine.playUiClick();
    if (serialRef.current?.isConnected()) {
      void serialRef.current.pingHandshake(inputsRef.current);
    }
  };

  const handleSendDataNow = () => {
    soundEngine.playUiClick();
    const cur = inputsRef.current;
    if (serialRef.current?.isConnected()) {
      void serialRef.current.sendData(cur.h2, cur.rate, cur.sTemp, cur.bTemp);
    }
  };

  const handleStartArduinoMode = () => {
    soundEngine.playUiClick();
    clearSweepTimers();
    setLaunchMode('arduino');
    setAuthorityMode('arduino_hardware');
    setLaunchGateOpen(false);
    setMode('manual');
    setLiveAccumulation(true);
    setIsPlaying(false);
    setIsFailsafeScenario(false);
    setCameraPreset('wide');
    sceneRef.current?.setCameraPreset('wide', true);
    if (serialRef.current?.isConnected()) {
      const cur = inputsRef.current;
      void serialRef.current.sendData(cur.h2, cur.rate, cur.sTemp, cur.bTemp);
    }
  };

  const handleStartStandaloneMode = (initialOpMode: OperationMode) => {
    soundEngine.playUiClick();
    clearSweepTimers();
    setLaunchMode('standalone');
    setAuthorityMode('smart_ml');
    setLaunchGateOpen(false);
    setExploded(false);
    setExplosionReport(null);
    setIsFailsafeScenario(false);
    setMode(initialOpMode);
    if (initialOpMode === 'cinematic') {
      setCinematicTimeSec(0);
      setIsPlaying(true);
      setCameraPreset('auto');
      lastCinematicCamStageRef.current = '';
      sceneRef.current?.setCameraPreset('wide', true);
    } else {
      setLiveAccumulation(true);
      setIsPlaying(false);
      setCameraPreset('wide');
      sceneRef.current?.setCameraPreset('wide', true);
    }
  };

  const handleSelectMode = (nextMode: OperationMode) => {
    soundEngine.playUiClick();
    clearSweepTimers();
    setMode(nextMode);
    setIsFailsafeScenario(false);
    if (nextMode === 'manual') {
      setLiveAccumulation(true);
      setCameraPreset('wide');
      sceneRef.current?.setCameraPreset('wide', true);
    } else {
      setCameraPreset('auto');
      lastCinematicCamStageRef.current = '';
      setIsPlaying(true);
    }
  };

  const handleReset = () => {
    soundEngine.playUiClick();
    clearSweepTimers();
    setExploded(false);
    setExplosionReport(null);
    setIsFailsafeScenario(false);
    setCinematicTimeSec(0);
    setInputs(INITIAL_INPUTS);
    setHistory([]);
    setValidationResults(INITIAL_VALIDATION_RESULTS);
    setEnergyStats({ smartWh: 0, legacyWh: 0 });
    lastCinematicCamStageRef.current = '';
    sceneRef.current?.resetVisuals();
    sceneRef.current?.setCameraPreset('wide', true);

    if (serialRef.current?.isConnected()) {
      void serialRef.current.sendReset();
    } else {
      pushLog('TX', 'SIM-ML', 'RESET');
    }
  };

  const handleRunFailsafeScenario = () => {
    soundEngine.playUiClick();
    clearSweepTimers();
    setExploded(false);
    setExplosionReport(null);
    setMode('cinematic');
    setIsPlaying(true);
    setIsFailsafeScenario(true);
    setInputs({ h2: 4.55, rate: 0.45, sTemp: 158.0, bTemp: 44.5 });
    sceneRef.current?.setCameraPreset('wide', true);
  };

  const handleSelectCameraPreset = (preset: CameraPresetId) => {
    soundEngine.playUiClick();
    setCameraPreset(preset);
    if (preset === 'auto') {
      lastCinematicCamStageRef.current = '';
      sceneRef.current?.setCameraPreset(cinematicEval.stage.cameraPreset, true);
    } else {
      sceneRef.current?.setCameraPreset(preset, true);
    }
  };

  const handleSelectComponentGuide = (
    partId: PartInspectorId,
    preset: Exclude<CameraPresetId, 'auto'>
  ) => {
    soundEngine.playUiClick();
    setSelectedPart(partId);
    setCameraPreset(preset);
    sceneRef.current?.setCameraPreset(preset, true);
  };

  const handleManualSliderChange = (field: keyof TelemetryInputs, value: number) => {
    const prev = inputsRef.current;
    const next: TelemetryInputs = { ...prev, [field]: value };
    if (field === 'h2' && value > prev.h2) {
      next.rate = Number(
        Math.max(prev.rate, Math.min(0.85, Math.max(0.24, (value - prev.h2) * 0.65))).toFixed(2)
      );
    }
    setInputs(next);
    if (serialRef.current?.isConnected()) {
      void serialRef.current.sendData(next.h2, next.rate, next.sTemp, next.bTemp);
    } else if (launchMode === 'standalone') {
      pushLog(
        'TX',
        'SIM-ML',
        formatOutgoingDataPacket(next.h2, next.rate, next.sTemp, next.bTemp).trim()
      );
    }
  };

  const applyValidationStage = useCallback(
    (stageKey: 'SAFE' | 'TRIGGER' | 'EXOTHERMIC' | 'FAILSAFE', indexForRecord?: number) => {
      const spec = VALIDATION_STAGES.find((s) => s.targetState === stageKey)!;
      setExploded(false);
      setExplosionReport(null);
      setMode('manual');
      setLiveAccumulation(false);
      setInputs(spec.inputs);

      if (serialRef.current?.isConnected()) {
        void serialRef.current.sendData(
          spec.inputs.h2,
          spec.inputs.rate,
          spec.inputs.sTemp,
          spec.inputs.bTemp
        );
      } else if (launchModeRef.current === 'standalone') {
        pushLog(
          'TX',
          'SIM-ML',
          formatOutgoingDataPacket(
            spec.inputs.h2,
            spec.inputs.rate,
            spec.inputs.sTemp,
            spec.inputs.bTemp
          ).trim()
        );
      }

      const checkTimer = window.setTimeout(() => {
        // In Arduino hardware mode, strictly read Arduino's reply (or report failure if no USB reply!)
        let pkt: TinyMlPacket | null = null;
        if (launchModeRef.current === 'arduino') {
          pkt = serialRef.current?.isConnected() ? arduinoPacketRef.current : null;
        } else {
          pkt =
            serialRef.current?.isConnected() && arduinoPacketRef.current
              ? arduinoPacketRef.current
              : evaluateTinyMlDecision(spec.inputs, {
                  rfEnabled: rfPreheatingEnabled,
                  failsafeEnabled:
                    authorityMode === 'faulty_model' ? false : failsafeProtectionEnabled,
                });
        }

        setValidationResults((prev) =>
          prev.map((row, idx) =>
            idx === indexForRecord || row.targetState === stageKey
              ? {
                  targetState: row.targetState,
                  observedState: pkt ? pkt.state : null,
                  passed: pkt ? pkt.state === row.targetState : false,
                  latencyUs: pkt ? pkt.us : null,
                }
              : row
          )
        );
      }, 360);
      sweepTimersRef.current.push(checkTimer);
    },
    [authorityMode, failsafeProtectionEnabled, rfPreheatingEnabled, pushLog]
  );

  const handleRunValidationSweep = () => {
    soundEngine.playUiClick();
    clearSweepTimers();
    setValidationRunning(true);
    setValidationResults(INITIAL_VALIDATION_RESULTS);

    VALIDATION_STAGES.forEach((stage, idx) => {
      const t = window.setTimeout(() => {
        applyValidationStage(stage.targetState, idx);
        if (idx === VALIDATION_STAGES.length - 1) {
          const endTimer = window.setTimeout(() => {
            setValidationRunning(false);
          }, 900);
          sweepTimersRef.current.push(endTimer);
        }
      }, idx * 1400);
      sweepTimersRef.current.push(t);
    });
  };

  const handleJumpValidationStage = (stage: 'SAFE' | 'TRIGGER' | 'EXOTHERMIC' | 'FAILSAFE') => {
    soundEngine.playUiClick();
    clearSweepTimers();
    applyValidationStage(stage);
  };

  const handleLoadSandboxPreset = (preset: 'cold' | 'rf_lightoff' | 'failsafe') => {
    soundEngine.playUiClick();
    clearSweepTimers();
    setExploded(false);
    setExplosionReport(null);
    setMode('manual');
    setLiveAccumulation(true);
    let next: TelemetryInputs = INITIAL_INPUTS;
    if (preset === 'cold') {
      setLeakInjectionRate(0.0);
      next = { h2: 1.85, rate: 0.35, sTemp: 32.0, bTemp: 28.0 };
    } else if (preset === 'rf_lightoff') {
      setLeakInjectionRate(0.0);
      next = { h2: 1.95, rate: -0.14, sTemp: 168.0, bTemp: 44.0 };
    } else {
      setLeakInjectionRate(0.15);
      next = { h2: 4.55, rate: 0.45, sTemp: 158.0, bTemp: 50.0 };
    }
    setInputs(next);
    if (serialRef.current?.isConnected()) {
      void serialRef.current.sendData(next.h2, next.rate, next.sTemp, next.bTemp);
    } else if (launchMode === 'standalone') {
      pushLog(
        'TX',
        'SIM-ML',
        formatOutgoingDataPacket(next.h2, next.rate, next.sTemp, next.bTemp).trim()
      );
    }
  };

  const handleTriggerExplosionTest = () => {
    soundEngine.playUiClick();
    clearSweepTimers();
    setFailsafeProtectionEnabled(false);
    setAuthorityMode('faulty_model');
    setMode('manual');
    setLiveAccumulation(true);
    const stressInputs: TelemetryInputs = {
      h2: 5.65,
      rate: 0.62,
      sTemp: 168.0,
      bTemp: 62.0,
    };
    setInputs(stressInputs);
    const pkt = evaluateTinyMlDecision(stressInputs, {
      rfEnabled: rfPreheatingEnabled,
      failsafeEnabled: false,
    });
    const diag = computePhysicsDiagnostics(stressInputs, pkt, energyStats);
    const report = buildExplosionReport(stressInputs, diag, 'hot_surface_lfl', false);
    setExploded(true);
    setExplosionReport(report);
    sceneRef.current?.triggerExplosionVisual();
    pushLog('SYS', 'SIM-ML', `DEFLAGRATION TEST: ${report.causeTitle}`, 'EXPLOSION');
  };

  const handleChangeAuthorityMode = (nextAuth: ModelAuthorityMode) => {
    soundEngine.playUiClick();
    clearSweepTimers();
    if (nextAuth === 'arduino_hardware') {
      setLaunchMode('arduino');
      if (!serialConnected) {
        void handleToggleSerialConnect(9600);
      } else {
        setAuthorityMode('arduino_hardware');
      }
      return;
    }
    setLaunchMode('standalone');
    setAuthorityMode(nextAuth);
    if (nextAuth === 'faulty_model') {
      setMode('manual');
      setLiveAccumulation(true);
      setFailsafeProtectionEnabled(false);
      setLeakInjectionRate(0.42);
    } else if (nextAuth === 'smart_ml') {
      setFailsafeProtectionEnabled(true);
      setRfPreheatingEnabled(true);
    }
  };

  const handleSimulateIncomingJson = (st: 'SAFE' | 'TRIGGER' | 'EXOTHERMIC' | 'FAILSAFE') => {
    soundEngine.playUiClick();
    setLaunchMode('standalone');
    const packetMap: Record<'SAFE' | 'TRIGGER' | 'EXOTHERMIC' | 'FAILSAFE', TinyMlPacket> = {
      SAFE: { decision: 0, state: 'SAFE', pulse: 0, us: 39 },
      TRIGGER: { decision: 1, state: 'TRIGGER', pulse: 1, us: 44 },
      EXOTHERMIC: { decision: 2, state: 'EXOTHERMIC', pulse: 0, us: 43 },
      FAILSAFE: { decision: 3, state: 'FAILSAFE', pulse: 1, us: 42 },
    };
    const pkt = packetMap[st];
    pushLog('RX', 'SIM-ML', JSON.stringify(pkt), pkt.state);
    if (st === 'SAFE') setInputs({ h2: 0.2, rate: 0.01, sTemp: 29, bTemp: 27 });
    if (st === 'TRIGGER') setInputs({ h2: 1.45, rate: 0.28, sTemp: 42, bTemp: 29 });
    if (st === 'EXOTHERMIC') setInputs({ h2: 1.85, rate: -0.14, sTemp: 168, bTemp: 46 });
    if (st === 'FAILSAFE') setInputs({ h2: 4.55, rate: 0.45, sTemp: 158, bTemp: 48 });
  };

  const hoveredDescriptor = partHover ? PART_CATALOG[partHover.id] : null;
  const uiVisible = !cinemaMode && !launchGateOpen;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#090E1A] text-slate-100">
      {/* Full-Bleed 100vw × 100vh WebGL 3D Reactor Canvas */}
      <div
        ref={canvasMountRef}
        data-testid="par-webgl-viewport"
        className="absolute inset-0 h-full w-full"
      />

      {/* Fullscreen Cinema Minimal Overlay */}
      {cinemaMode && (
        <>
          <button
            type="button"
            onClick={toggleCinemaMode}
            data-testid="exit-cinema-btn"
            className="fixed top-4 right-4 z-30 inline-flex items-center gap-1.5 rounded-md border border-[#24324D] bg-[#0B111E]/90 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-lg hover:border-sky-400 cursor-pointer"
          >
            <Minimize2 className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
            <span>Exit Cinema (Esc / F)</span>
          </button>

          <div
            className="fixed bottom-4 left-4 z-30 flex flex-wrap items-center gap-3 rounded-lg border border-[#24324D] bg-[#0B111E]/90 px-3.5 py-2 font-mono-tabular text-xs shadow-xl"
            data-testid="cinema-telemetry-pill"
          >
            <span className="font-semibold text-sky-300">{activeState}</span>
            <span className="text-slate-400">|</span>
            <span className="text-emerald-400">H₂ {inputs.h2.toFixed(2)}%</span>
            <span className="text-rose-400">T_s {inputs.sTemp.toFixed(1)}°C</span>
            <span className="text-slate-300">
              H₂O {diagnostics.h2oProducedMgPerSec.toFixed(0)} mg/s
            </span>
          </div>
        </>
      )}

      {/* Projected 3D Component Callout Pins */}
      {uiVisible && show3dLabels && activeDrawer === 'none' && !explosionReport && (
        <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
          {projectedLabels
            .filter((lbl) => {
              if (!lbl.visible) return false;
              const winW = typeof window !== 'undefined' ? window.innerWidth : 1440;
              const winH = typeof window !== 'undefined' ? window.innerHeight : 900;
              if (lbl.y < 62) return false;
              const bottomCutoff = dockCollapsed ? winH - 48 : winH - 235;
              if (lbl.y > bottomCutoff) return false;
              if (matrixOpen && lbl.x > winW - 380) return false;
              if (howItWorksOpen && lbl.x < 390) return false;
              return true;
            })
            .map((lbl) => {
              const part = PART_CATALOG[lbl.id];
              const isSelected = selectedPart === lbl.id || partHover?.id === lbl.id;
              return (
                <button
                  key={lbl.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setSelectedPart((prev) => (prev === lbl.id ? null : lbl.id));
                  }}
                  style={{
                    transform: `translate3d(${Math.round(lbl.x)}px, ${Math.round(lbl.y)}px, 0) translate(-50%, -50%)`,
                  }}
                  className={`pointer-events-auto absolute top-0 left-0 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'border-sky-400 bg-[#0A0F1A]/95 text-sky-200 shadow-lg'
                      : 'border-[#22304A] bg-[#0A0F1A]/85 text-slate-300 hover:border-sky-400/70 hover:text-white'
                  }`}
                >
                  {part.nameEn.split('(')[0].trim()}
                </button>
              );
            })}
        </div>
      )}

      {/* Interactive Hover / Selected Part Scientific Inspector Tooltip */}
      {!cinemaMode &&
        !launchGateOpen &&
        (hoveredDescriptor || (selectedPart && !howItWorksOpen)) && (
        <div
          style={
            partHover
              ? {
                  left: Math.min(window.innerWidth - 310, Math.max(12, partHover.screenX + 16)),
                  top: Math.min(window.innerHeight - 190, Math.max(60, partHover.screenY + 14)),
                }
              : { left: howItWorksOpen ? 392 : 14, top: 96 }
          }
          className="pointer-events-none fixed z-30 w-[295px] rounded-lg border border-sky-400/50 bg-[#0A0F1A]/96 p-3 shadow-2xl"
          data-testid="part-hover-tooltip"
        >
          {(() => {
            const desc = hoveredDescriptor ?? PART_CATALOG[selectedPart!];
            return (
              <div className="space-y-1 text-xs">
                <div className="font-semibold text-sky-300">{desc.nameEn}</div>
                <div className="text-[11px] text-slate-300" dir="rtl">
                  {desc.nameAr}
                </div>
                <div className="font-mono-tabular text-[10px] text-emerald-400">
                  {desc.getLiveMetric(inputs, activePacket, activeState, diagnostics)}
                </div>
                <div className="text-[10px] text-slate-400">{desc.material}</div>
                <p className="pt-1 text-[11px] leading-snug text-slate-200">{desc.roleEn}</p>
                <p className="text-[11px] leading-snug text-slate-400" dir="rtl">
                  {desc.roleAr}
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {/* Top Navigation & Telemetry Bar */}
      {uiVisible && (
        <TopBar
          inputs={inputs}
          packet={activePacket}
          activeState={activeState}
          diagnostics={diagnostics}
          launchMode={launchMode}
          arduinoStatus={arduinoStatus}
          soundEnabled={soundEnabled}
          serialConnected={serialConnected}
          serialStatusLabel={serialStatusLabel}
          matrixOpen={matrixOpen}
          show3dLabels={show3dLabels}
          howItWorksOpen={howItWorksOpen}
          activeDrawer={activeDrawer}
          onToggleSound={handleToggleSound}
          onToggleSerialConnect={() => void handleToggleSerialConnect(9600)}
          onOpenLaunchGate={() => {
            soundEngine.playUiClick();
            setLaunchGateOpen(true);
          }}
          onToggleHowItWorks={() => {
            soundEngine.playUiClick();
            setHowItWorksOpen((o) => !o);
          }}
          onToggleCinemaMode={toggleCinemaMode}
          onToggleMatrix={() => {
            soundEngine.playUiClick();
            setMatrixOpen((m) => {
              const next = !m;
              if (next && window.innerWidth < 768) setDockCollapsed(true);
              return next;
            });
          }}
          onToggle3dLabels={() => {
            soundEngine.playUiClick();
            setShow3dLabels((l) => !l);
          }}
          onToggleDrawer={(d) => {
            soundEngine.playUiClick();
            setActiveDrawer((prev) => (prev === d ? 'none' : d));
          }}
        />
      )}

      {/* Left-Hand Collapsible Cause -> Decision -> Hardware Guide */}
      <CauseEffectCard
        inputs={inputs}
        packet={activePacket}
        activeState={activeState}
        diagnostics={diagnostics}
        authorityMode={authorityMode}
        serialConnected={serialConnected}
        awaitingArduino={awaitingArduino}
        failsafeArmed={authorityMode !== 'faulty_model' && failsafeProtectionEnabled}
        lastTxPayload={lastTxPayload}
        lastRxPayload={lastRxPayload}
        onOpenMatrixExplorer={() => {
          soundEngine.playUiClick();
          setMatrixExplorerOpen(true);
        }}
        visible={uiVisible && activeDrawer === 'none' && !howItWorksOpen && !explosionReport}
      />

      {/* Dedicated Components & Working Principle Interactive Tour Drawer */}
      <HowItWorksDrawer
        open={uiVisible && howItWorksOpen}
        inputs={inputs}
        packet={activePacket}
        activeState={activeState}
        diagnostics={diagnostics}
        selectedPart={selectedPart}
        onSelectComponent={handleSelectComponentGuide}
        onJumpStagePreview={handleJumpValidationStage}
        canJumpStages={launchMode === 'standalone'}
        onClose={() => setHowItWorksOpen(false)}
      />

      {/* Right-Hand Live Scientific Matrix, RandomForest Votes & Validation Bench */}
      <ScientificMatrixPanel
        open={uiVisible && matrixOpen && activeDrawer === 'none'}
        inputs={inputs}
        packet={activePacket}
        activeState={activeState}
        diagnostics={diagnostics}
        collisionMetrics={collisionMetrics}
        history={history}
        serialConnected={serialConnected}
        authorityMode={authorityMode}
        lastTxPayload={lastTxPayload}
        lastRxPayload={lastRxPayload}
        validationRunning={validationRunning}
        validationResults={validationResults}
        onChangeAuthorityMode={handleChangeAuthorityMode}
        onRunValidationSweep={handleRunValidationSweep}
        onJumpValidationStage={handleJumpValidationStage}
        onOpenMatrixExplorer={() => {
          soundEngine.playUiClick();
          setMatrixExplorerOpen(true);
        }}
        onClose={() => setMatrixOpen(false)}
      />

      {/* Bottom Collapsible Control Dock */}
      {uiVisible && (
        <BottomControlDock
          mode={mode}
          launchMode={launchMode}
          arduinoStatus={arduinoStatus}
          collapsed={dockCollapsed}
          isPlaying={isPlaying}
          cinematicProgress={cinematicEval.progress}
          cinematicStage={cinematicEval.stage ?? CINEMATIC_STAGES[0]}
          isFailsafeScenario={isFailsafeScenario}
          cameraPreset={cameraPreset}
          inputs={inputs}
          diagnostics={diagnostics}
          liveAccumulation={liveAccumulation}
          leakInjectionRate={leakInjectionRate}
          rfPreheatingEnabled={rfPreheatingEnabled}
          failsafeProtectionEnabled={failsafeProtectionEnabled}
          matrixOpen={matrixOpen && activeDrawer === 'none'}
          activeState={activeState}
          packet={activePacket}
          lastTxPayload={lastTxPayload}
          lastRxPayload={lastRxPayload}
          serialConnected={serialConnected}
          onToggleCollapse={() => {
            soundEngine.playUiClick();
            setDockCollapsed((c) => {
              const next = !c;
              if (!next && window.innerWidth < 768) setMatrixOpen(false);
              return next;
            });
          }}
          onSelectMode={handleSelectMode}
          onTogglePlay={() => {
            soundEngine.playUiClick();
            setIsPlaying((p) => !p);
          }}
          onReset={handleReset}
          onRunFailsafeScenario={handleRunFailsafeScenario}
          onSelectCameraPreset={handleSelectCameraPreset}
          onManualSliderChange={handleManualSliderChange}
          onToggleLiveAccumulation={(enabled) => {
            soundEngine.playUiClick();
            setLiveAccumulation(enabled);
          }}
          onLeakInjectionChange={setLeakInjectionRate}
          onToggleRfEnabled={(enabled) => {
            soundEngine.playUiClick();
            setRfPreheatingEnabled(enabled);
          }}
          onToggleFailsafeEnabled={(enabled) => {
            soundEngine.playUiClick();
            setFailsafeProtectionEnabled(enabled);
          }}
          onTriggerExplosionTest={handleTriggerExplosionTest}
          onLoadSandboxPreset={handleLoadSandboxPreset}
          onOpenMatrixExplorer={() => {
            soundEngine.playUiClick();
            setMatrixExplorerOpen(true);
          }}
          onRetryHandshake={handleRetryHandshake}
          onSendDataNow={handleSendDataNow}
        />
      )}

      {/* Scientific Equations & Step-by-Step SOP Drawer */}
      <PhysicsSopDrawer
        open={uiVisible && activeDrawer === 'physics'}
        inputs={inputs}
        packet={activePacket}
        diagnostics={diagnostics}
        onClose={() => setActiveDrawer('none')}
      />

      {/* 9600-Baud Web Serial Monitor Drawer */}
      <SerialMonitorDrawer
        open={uiVisible && activeDrawer === 'serial'}
        connected={serialConnected}
        serialErrorHint={serialErrorHint}
        logs={serialLogs}
        onConnect={(baud) => void handleToggleSerialConnect(baud)}
        onDisconnect={() => void serialRef.current?.disconnect()}
        onClear={() => setSerialLogs([])}
        onSimulateIncomingJson={handleSimulateIncomingJson}
        onClose={() => setActiveDrawer('none')}
      />

      {/* Full Presentation Matrix Explorer Modal */}
      <MatrixPresentationModal
        open={matrixExplorerOpen}
        inputs={inputs}
        packet={activePacket}
        activeState={activeState}
        diagnostics={diagnostics}
        serialConnected={serialConnected}
        authorityMode={authorityMode}
        lastTxPayload={lastTxPayload}
        lastRxPayload={lastRxPayload}
        validationRunning={validationRunning}
        validationResults={validationResults}
        onRunValidationSweep={handleRunValidationSweep}
        onJumpValidationStage={handleJumpValidationStage}
        onConnectArduino={() => void handleToggleSerialConnect(9600)}
        onOpenSerialDrawer={() => setActiveDrawer('serial')}
        onClose={() => setMatrixExplorerOpen(false)}
      />

      {/* Launch Gate Modal (Physical Arduino Verified vs Standalone Simulation) */}
      <LaunchModeOverlay
        open={launchGateOpen}
        serialConnected={serialConnected}
        arduinoStatus={arduinoStatus}
        serialErrorHint={serialErrorHint}
        lastRxPayload={lastRxPayload}
        onConnectArduino={() => void handleToggleSerialConnect(9600)}
        onRetryHandshake={handleRetryHandshake}
        onStartArduinoMode={handleStartArduinoMode}
        onStartStandaloneMode={handleStartStandaloneMode}
      />

      {/* Explosion / Deflagration Forensics Report Modal */}
      <ExplosionModal
        report={explosionReport}
        onResetContainment={handleReset}
        onDismiss={() => setExplosionReport(null)}
      />
    </div>
  );
}

import React from 'react';
import {
  Activity,
  CheckCircle2,
  Cpu,
  Flame,
  Maximize2,
  Play,
  Plug,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  CollisionMetrics,
  ParState,
  PhysicsDiagnostics,
  TelemetryHistoryPoint,
  TelemetryInputs,
  TinyMlPacket,
} from '../sim/types';

export type ModelAuthorityMode = 'smart_ml' | 'faulty_model' | 'arduino_hardware';

export interface ValidationStageResult {
  targetState: 'SAFE' | 'TRIGGER' | 'EXOTHERMIC' | 'FAILSAFE';
  observedState: ParState | null;
  passed: boolean | null;
  latencyUs: number | null;
}

interface ScientificMatrixPanelProps {
  open: boolean;
  inputs: TelemetryInputs;
  packet: TinyMlPacket;
  activeState: ParState;
  diagnostics: PhysicsDiagnostics;
  collisionMetrics: CollisionMetrics;
  history: TelemetryHistoryPoint[];
  serialConnected: boolean;
  authorityMode: ModelAuthorityMode;
  lastTxPayload: string;
  lastRxPayload: string;
  validationRunning: boolean;
  validationResults: ValidationStageResult[];
  onChangeAuthorityMode: (mode: ModelAuthorityMode) => void;
  onRunValidationSweep: () => void;
  onJumpValidationStage: (stage: 'SAFE' | 'TRIGGER' | 'EXOTHERMIC' | 'FAILSAFE') => void;
  onOpenMatrixExplorer: () => void;
  onClose: () => void;
}

const TREE_CLASS_SHORT = ['S0', 'T1', 'E2', 'F3'] as const;
const TREE_CLASS_BADGE = [
  'border-emerald-500/50 bg-emerald-950/50 text-emerald-300',
  'border-sky-500/50 bg-sky-950/50 text-sky-300',
  'border-rose-500/50 bg-rose-950/50 text-rose-300',
  'border-amber-500/50 bg-amber-950/50 text-amber-300',
] as const;

export const ScientificMatrixPanel: React.FC<ScientificMatrixPanelProps> = ({
  open,
  inputs,
  packet,
  activeState,
  diagnostics,
  collisionMetrics,
  history,
  serialConnected,
  authorityMode,
  lastTxPayload,
  lastRxPayload,
  validationRunning,
  validationResults,
  onChangeAuthorityMode,
  onRunValidationSweep,
  onJumpValidationStage,
  onOpenMatrixExplorer,
  onClose,
}) => {
  if (!open) return null;

  // Build SVG polyline points for H2 (0..6%) and Surface Temp (20..220°C)
  const w = 316;
  const h = 84;
  const pts =
    history.length > 1
      ? history
      : [{ t: 0, h2: inputs.h2, sTemp: inputs.sTemp, recomb: 0, rfPower: 0 }];

  const h2Points = pts
    .map((p, idx) => {
      const x = pts.length === 1 ? w : (idx / (pts.length - 1)) * w;
      const y = h - Math.min(1, Math.max(0, p.h2 / 6.0)) * (h - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const tempPoints = pts
    .map((p, idx) => {
      const x = pts.length === 1 ? w : (idx / (pts.length - 1)) * w;
      const y = h - Math.min(1, Math.max(0, (p.sTemp - 20) / 200)) * (h - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const lflY = h - (4.5 / 6.0) * (h - 8) - 4;
  const lightOffY = h - ((150 - 20) / 200) * (h - 8) - 4;

  // Exact match to user's Arduino Uno switch statement:
  const pin8White = activeState === 'TRIGGER' || activeState === 'FAILSAFE';
  const pin7Red =
    activeState === 'EXOTHERMIC' || activeState === 'FAILSAFE' || activeState === 'EXPLOSION';

  const votes = packet.treeVotes ?? [
    packet.decision === 0 ? 5 : 0,
    packet.decision === 1 ? 5 : 0,
    packet.decision === 2 ? 5 : 0,
    packet.decision === 3 ? 5 : 0,
  ];
  const perTree = packet.perTreePredictions ?? [
    packet.decision,
    packet.decision,
    packet.decision,
    packet.decision,
    packet.decision,
  ];

  const intensityPct = Math.round(collisionMetrics.recombinationIntensity * 100);

  return (
    <aside
      aria-label="Live Scientific Matrix and Telemetry"
      className="fixed top-[54px] right-3 z-20 w-[min(362px,94vw)] max-h-[calc(100vh-70px)] xl:max-h-[calc(100vh-68px)] flex flex-col rounded-lg border border-[#22304A] bg-[#0A0F1A]/95 shadow-2xl overflow-hidden"
      data-testid="scientific-matrix-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#22304A] bg-[#111928] px-3.5 py-2">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
          <span className="text-xs font-semibold text-slate-100">
            Scientific Matrix &amp; TinyML
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenMatrixExplorer}
            className="inline-flex items-center gap-1 rounded border border-sky-500/50 bg-sky-950/50 px-2 py-0.5 text-[10px] font-semibold text-sky-200 hover:bg-sky-900/60 cursor-pointer"
          >
            <Maximize2 className="h-3 w-3" aria-hidden="true" />
            <span>Full Matrix</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Collapse telemetry matrix"
            className="rounded p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="cad-scroll flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
        {/* 1. Dual-Trace Oscilloscope Waveform */}
        <div className="rounded border border-[#22304A] bg-[#0F172A] p-2.5">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="font-medium text-emerald-400">H₂ {inputs.h2.toFixed(2)}%</span>
            <span className="text-slate-500 font-mono-tabular">LFL 4.5% · 150°C</span>
            <span className="font-medium text-rose-400">T_s {inputs.sTemp.toFixed(1)}°C</span>
          </div>
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="w-full h-[80px] rounded bg-[#070B13] border border-[#1E2A42]"
            role="img"
            aria-label="Real-time H2 concentration and Catalyst temperature waveform"
          >
            <line
              x1={0}
              y1={lflY}
              x2={w}
              y2={lflY}
              stroke="rgba(251, 191, 36, 0.35)"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <line
              x1={0}
              y1={lightOffY}
              x2={w}
              y2={lightOffY}
              stroke="rgba(251, 113, 133, 0.35)"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            {pts.length > 1 && (
              <>
                <polyline
                  fill="none"
                  stroke="#34D399"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  points={h2Points}
                />
                <polyline
                  fill="none"
                  stroke="#FB7185"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  points={tempPoints}
                />
              </>
            )}
          </svg>
        </div>

        {/* 2. AI Engine Source + Live TX/AI/RX Stream + 4-Stage Validation */}
        <div className="rounded border border-[#22304A] bg-[#0F172A] p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-300">
              <Cpu className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>AI Execution Source</span>
            </span>
            <span
              className={`font-mono-tabular text-[10px] font-semibold ${
                serialConnected
                  ? 'text-emerald-400'
                  : authorityMode === 'faulty_model'
                  ? 'text-rose-400'
                  : 'text-sky-300'
              }`}
              data-testid="ai-source-badge"
            >
              {serialConnected
                ? 'PHYSICAL ARDUINO USB'
                : authorityMode === 'faulty_model'
                ? 'FAULTY ML TEST'
                : 'BROWSER TWIN (NO USB)'}
            </span>
          </div>

          <p className="text-[10px] leading-snug text-slate-400">
            {serialConnected
              ? 'USB 9600 Baud live: sliders & ticks send DATA packets to Arduino Uno and apply its JSON decisions.'
              : authorityMode === 'faulty_model'
              ? 'Simulated defective AI (Fail-Safe disabled) to verify LFL explosion behavior.'
              : 'No USB plugged in — running exact 5-tree Arduino C++ RandomForest mirror in browser.'}
          </p>

          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => onChangeAuthorityMode('smart_ml')}
              className={`inline-flex items-center justify-center gap-1 rounded border px-1.5 py-1 text-[10px] font-medium cursor-pointer ${
                authorityMode === 'smart_ml'
                  ? 'border-emerald-500/70 bg-emerald-950/50 text-emerald-200'
                  : 'border-[#22304A] bg-[#0A0F1A] text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Browser Twin</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeAuthorityMode('faulty_model')}
              title="Simulates a defective AI model that fails to cut off RF / Failsafe"
              className={`inline-flex items-center justify-center gap-1 rounded border px-1.5 py-1 text-[10px] font-medium cursor-pointer ${
                authorityMode === 'faulty_model'
                  ? 'border-rose-500/70 bg-rose-950/50 text-rose-200'
                  : 'border-[#22304A] bg-[#0A0F1A] text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Faulty ML</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeAuthorityMode('arduino_hardware')}
              className={`inline-flex items-center justify-center gap-1 rounded border px-1.5 py-1 text-[10px] font-medium cursor-pointer ${
                authorityMode === 'arduino_hardware' && serialConnected
                  ? 'border-emerald-500/70 bg-emerald-950/50 text-emerald-200'
                  : authorityMode === 'arduino_hardware'
                  ? 'border-sky-500/70 bg-sky-950/50 text-sky-200'
                  : 'border-[#22304A] bg-[#0A0F1A] text-slate-400 hover:text-slate-200'
              }`}
            >
              <Plug className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{serialConnected ? 'USB Live' : 'Connect USB'}</span>
            </button>
          </div>

          {/* Live TX -> AI Decision -> RX Strip */}
          <div
            className="rounded border border-[#1E2A42] bg-[#070B13] px-2 py-1.5 font-mono-tabular text-[10px] space-y-0.5"
            data-testid="live-tx-rx-strip"
          >
            <div className="flex items-center justify-between gap-1 text-slate-300">
              <span className="text-sky-400 shrink-0">TX</span>
              <span className="truncate">{lastTxPayload}</span>
            </div>
            <div className="flex items-center justify-between gap-1 text-slate-300">
              <span className="text-emerald-400 shrink-0">AI/RX</span>
              <span className="truncate">{lastRxPayload}</span>
            </div>
          </div>

          {/* Interactive 4-Class Response Test Sweep */}
          <div className="pt-1 border-t border-[#1E2A42] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Verify Model / Arduino Response:</span>
              <button
                type="button"
                onClick={onRunValidationSweep}
                disabled={validationRunning}
                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold cursor-pointer ${
                  validationRunning
                    ? 'border-sky-500/40 bg-sky-950/40 text-sky-300'
                    : 'border-sky-500/60 bg-sky-950/60 text-sky-200 hover:bg-sky-900/60'
                }`}
              >
                <Play className="h-2.5 w-2.5" aria-hidden="true" />
                <span>{validationRunning ? 'Sweeping...' : 'Run 4-Stage Test'}</span>
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {validationResults.map((res) => (
                <button
                  key={res.targetState}
                  type="button"
                  onClick={() => onJumpValidationStage(res.targetState)}
                  className={`flex flex-col items-center rounded border px-1 py-1 font-mono-tabular text-[10px] cursor-pointer transition-colors ${
                    res.passed === true
                      ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300'
                      : res.passed === false
                      ? 'border-rose-500/60 bg-rose-950/40 text-rose-300'
                      : activeState === res.targetState
                      ? 'border-sky-400 bg-sky-950/50 text-sky-200'
                      : 'border-[#22304A] bg-[#0A0F1A] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="inline-flex items-center gap-0.5 font-semibold">
                    {res.passed === true && (
                      <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" aria-hidden="true" />
                    )}
                    {res.targetState === 'EXOTHERMIC'
                      ? 'EXO'
                      : res.targetState === 'FAILSAFE'
                      ? 'FAIL'
                      : res.targetState === 'TRIGGER'
                      ? 'TRIG'
                      : 'SAFE'}
                  </span>
                  <span className="text-[9px] opacity-80">
                    {res.latencyUs !== null ? `${res.latencyUs}µs` : 'Test'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Live 5-Tree Random Forest Voting Matrix */}
        <div className="rounded border border-[#22304A] bg-[#0F172A] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#22304A] bg-[#141F35] px-2.5 py-1.5 text-[11px] font-semibold text-slate-200">
            <span>RandomForest Matrix (5 Trees)</span>
            <span className="font-mono-tabular text-[10px] text-sky-300">
              [{votes.join(' / ')}]
            </span>
          </div>
          <div className="p-2 space-y-2">
            <div className="grid grid-cols-5 gap-1">
              {perTree.map((cls, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col items-center rounded border py-1 font-mono-tabular text-[10px] ${
                    TREE_CLASS_BADGE[cls] ?? TREE_CLASS_BADGE[0]
                  }`}
                >
                  <span className="text-[9px] opacity-75">T#{idx + 1}</span>
                  <span className="font-semibold">{TREE_CLASS_SHORT[cls] ?? 'S0'}</span>
                </div>
              ))}
            </div>
            <table className="w-full text-[11px] font-mono-tabular">
              <tbody className="divide-y divide-[#1E2A42]">
                <tr>
                  <td className="py-1 text-slate-400 whitespace-nowrap">Features x[0..3]</td>
                  <td className="py-1 text-right text-slate-200 whitespace-nowrap">
                    [{inputs.h2.toFixed(2)}, {inputs.rate.toFixed(2)}, {inputs.sTemp.toFixed(0)}, {inputs.bTemp.toFixed(0)}]
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-slate-400 whitespace-nowrap">ML Decision</td>
                  <td className="py-1 text-right text-sky-300 whitespace-nowrap">
                    d={packet.decision} · {activeState} ({packet.us}µs)
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-slate-400 whitespace-nowrap">Pin 8 White LED</td>
                  <td className={`py-1 text-right whitespace-nowrap ${pin8White ? 'text-sky-200' : 'text-slate-500'}`}>
                    {pin8White ? `HIGH · RF ${diagnostics.rfInductionPowerW.toFixed(0)}W` : 'LOW · 0 W'}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-slate-400 whitespace-nowrap">Pin 7 Red LED</td>
                  <td className={`py-1 text-right whitespace-nowrap ${pin7Red ? 'text-rose-400' : 'text-slate-500'}`}>
                    {activeState === 'FAILSAFE' || activeState === 'EXPLOSION'
                      ? 'HIGH · EMERGENCY VENT'
                      : pin7Red
                      ? 'HIGH · THERMAL ACTIVE'
                      : 'LOW · STANDBY'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. 3D Collision Vector & Recombination Intensity Feedback */}
        <div className="rounded border border-[#22304A] bg-[#0F172A] p-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-300">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>3D Plate Impact &amp; Reaction Intensity</span>
            </span>
            <span className="font-mono-tabular text-slate-200">{intensityPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-[#070B13] border border-[#1E2A42]">
            <div
              className={`h-full transition-[width] duration-150 ${
                inputs.sTemp >= 150 ? 'bg-gradient-to-r from-amber-400 to-rose-500' : 'bg-emerald-400/70'
              }`}
              style={{ width: `${intensityPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between font-mono-tabular text-[10px] text-slate-400">
            <span>Impacts: {collisionMetrics.collisionsPerSec}/s</span>
            <span>Vectors: {collisionMetrics.activeVectors}</span>
            <span>
              {inputs.sTemp >= 150 ? 'Catalytic H₂→H₂O' : 'Elastic Bounce'}
            </span>
          </div>
        </div>

        {/* 5. Reaction Kinetics & Mass Balance Matrix */}
        <div className="rounded border border-[#22304A] bg-[#0F172A] overflow-hidden">
          <div className="border-b border-[#22304A] bg-[#141F35] px-2.5 py-1.5 text-[11px] font-semibold text-slate-200">
            Reaction Kinetics &amp; Mass Balance
          </div>
          <table className="w-full text-[11px] font-mono-tabular">
            <tbody className="divide-y divide-[#1E2A42]">
              <tr>
                <td className="px-2.5 py-1.5 text-slate-400 whitespace-nowrap">Arrhenius k(T)</td>
                <td className="px-2.5 py-1.5 text-right text-slate-200 whitespace-nowrap">
                  {diagnostics.arrheniusRateConstant.toFixed(3)} s⁻¹ (η={diagnostics.surfaceActivationFactor.toFixed(2)})
                </td>
              </tr>
              <tr>
                <td className="px-2.5 py-1.5 text-slate-400 whitespace-nowrap">H₂ → H₂O Rate</td>
                <td className="px-2.5 py-1.5 text-right text-emerald-400 whitespace-nowrap">
                  {diagnostics.h2ConsumedMgPerSec.toFixed(1)} → {diagnostics.h2oProducedMgPerSec.toFixed(1)} mg/s
                </td>
              </tr>
              <tr>
                <td className="px-2.5 py-1.5 text-slate-400 whitespace-nowrap">Exothermic Heat</td>
                <td className="px-2.5 py-1.5 text-right text-rose-400 whitespace-nowrap">
                  {diagnostics.exothermicPowerW.toFixed(1)} W
                </td>
              </tr>
              <tr>
                <td className="px-2.5 py-1.5 text-slate-400 whitespace-nowrap">Chimney Draft</td>
                <td className="px-2.5 py-1.5 text-right text-sky-300 whitespace-nowrap">
                  {diagnostics.chimneyDraftVelocityMs.toFixed(2)} m/s
                </td>
              </tr>
              <tr>
                <td className="px-2.5 py-1.5 text-slate-400 whitespace-nowrap">Shapiro Zone</td>
                <td
                  className={`px-2.5 py-1.5 text-right whitespace-nowrap ${
                    diagnostics.isFlammable ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {diagnostics.isFlammable ? 'FLAMMABLE (≥4%)' : 'SUB-LFL SAFE'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </aside>
  );
};

import React from 'react';
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  ChevronUp,
  Flame,
  Grid,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  Sliders,
  Video,
} from 'lucide-react';
import type {
  ArduinoVerificationStatus,
  CameraPresetId,
  CinematicStage,
  LaunchMode,
  OperationMode,
  ParState,
  PhysicsDiagnostics,
  TelemetryInputs,
  TinyMlPacket,
} from '../sim/types';

interface BottomControlDockProps {
  mode: OperationMode;
  launchMode: LaunchMode;
  arduinoStatus: ArduinoVerificationStatus;
  collapsed: boolean;
  isPlaying: boolean;
  cinematicProgress: number;
  cinematicStage: CinematicStage;
  isFailsafeScenario: boolean;
  cameraPreset: CameraPresetId;
  inputs: TelemetryInputs;
  diagnostics: PhysicsDiagnostics;
  liveAccumulation: boolean;
  leakInjectionRate: number;
  rfPreheatingEnabled: boolean;
  failsafeProtectionEnabled: boolean;
  matrixOpen: boolean;
  activeState: ParState;
  packet: TinyMlPacket;
  lastTxPayload: string;
  lastRxPayload: string;
  serialConnected: boolean;
  onToggleCollapse: () => void;
  onSelectMode: (mode: OperationMode) => void;
  onTogglePlay: () => void;
  onReset: () => void;
  onRunFailsafeScenario: () => void;
  onSelectCameraPreset: (preset: CameraPresetId) => void;
  onManualSliderChange: (field: keyof TelemetryInputs, value: number) => void;
  onToggleLiveAccumulation: (enabled: boolean) => void;
  onLeakInjectionChange: (rate: number) => void;
  onToggleRfEnabled: (enabled: boolean) => void;
  onToggleFailsafeEnabled: (enabled: boolean) => void;
  onTriggerExplosionTest: () => void;
  onLoadSandboxPreset: (preset: 'cold' | 'rf_lightoff' | 'failsafe') => void;
  onOpenMatrixExplorer: () => void;
  onRetryHandshake: () => void;
  onSendDataNow: () => void;
}

const CAMERA_LABELS: { id: CameraPresetId; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'wide', label: 'Wide' },
  { id: 'intake', label: 'Sparger' },
  { id: 'fins', label: 'Ni-Fe Matrix' },
  { id: 'coil', label: 'RF Coil' },
  { id: 'arduino', label: 'Arduino' },
  { id: 'exhaust', label: 'Exhaust' },
];

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  mode,
  launchMode,
  arduinoStatus,
  collapsed,
  isPlaying,
  cinematicProgress,
  cinematicStage,
  isFailsafeScenario,
  cameraPreset,
  inputs,
  diagnostics,
  liveAccumulation,
  leakInjectionRate,
  rfPreheatingEnabled,
  failsafeProtectionEnabled,
  matrixOpen,
  activeState,
  packet,
  lastTxPayload,
  lastRxPayload,
  serialConnected,
  onToggleCollapse,
  onSelectMode,
  onTogglePlay,
  onReset,
  onRunFailsafeScenario,
  onSelectCameraPreset,
  onManualSliderChange,
  onToggleLiveAccumulation,
  onLeakInjectionChange,
  onToggleRfEnabled,
  onToggleFailsafeEnabled,
  onTriggerExplosionTest,
  onLoadSandboxPreset,
  onOpenMatrixExplorer,
  onRetryHandshake,
  onSendDataNow,
}) => {
  const awaitingArduino = launchMode === 'arduino' && arduinoStatus !== 'verified';

  return (
    <div
      className={`fixed bottom-3 z-20 -translate-x-1/2 select-none transition-[left] duration-200 ${
        matrixOpen
          ? 'left-1/2 lg:left-[calc(50%-180px)] w-[min(740px,95vw)] lg:w-[min(740px,calc(100vw-400px))]'
          : 'left-1/2 w-[min(820px,95vw)]'
      }`}
    >
      {/* Molecular & Collision Vector Legend + Hover Tip */}
      {!collapsed && (
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 rounded border border-[#22304A] bg-[#0A0F1A]/94 px-3 py-1 text-[11px] text-slate-300">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
              <span>H₂ + Trail</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-400" aria-hidden="true" />
              <span>H₂O Steam</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-300" aria-hidden="true" />
              <span>Collision Vector</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-400" aria-hidden="true" />
              <span>Hot Ni-Fe (≥150°C)</span>
            </span>
          </div>
          <span className="hidden md:inline text-slate-400">
            Hover 3D parts to inspect · Press F for Fullscreen Cinema
          </span>
        </div>
      )}

      {/* Cinematic Floating Subtitle Card */}
      {!collapsed && mode === 'cinematic' && (
        <div
          className="mb-1.5 rounded-lg border border-[#24324D] bg-[#0B111E]/95 px-3.5 py-2"
          data-testid="cinematic-subtitle-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-sky-300">
              {isFailsafeScenario
                ? 'Emergency Scenario · 4.5% Lower Flammability Limit Cutoff'
                : cinematicStage.title}
            </span>
            <span className="hidden sm:inline font-mono-tabular text-[11px] text-slate-400">
              Draft {diagnostics.chimneyDraftVelocityMs.toFixed(2)} m/s · Recomb{' '}
              {diagnostics.recombinationRatePctPerSec.toFixed(2)} %/s
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-300">
            {isFailsafeScenario
              ? 'Hydrogen breached the 4.5% LFL emergency threshold. TinyML opens Pin 7 Fail-Safe Venting and locks out Pin 8 RF Induction to eliminate ignition sources.'
              : cinematicStage.subtitle}
          </p>
        </div>
      )}

      {/* Collapse / Expand Toggle Handle */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          className="inline-flex items-center gap-1.5 rounded-t-md border border-b-0 border-[#24324D] bg-[#131C2E]/95 px-3 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:text-white cursor-pointer"
        >
          {collapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
              <span>Show Controls (H)</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <span>Hide Controls (H)</span>
            </>
          )}
        </button>
      </div>

      {/* Main Dock Panel */}
      {!collapsed && (
        <section
          aria-label="PAR Simulation Controls"
          className="cad-scroll max-h-[46vh] overflow-y-auto rounded-lg border border-[#24324D] bg-[#131C2E]/95 p-3 shadow-2xl"
        >
          {/* Top Row: Mode Switcher + Camera Presets + Matrix & Reset */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#24324D] pb-2.5">
            <div
              role="tablist"
              aria-label="Operation Mode"
              className="flex flex-wrap items-center gap-1 rounded-md border border-[#24324D] bg-[#0B111E] p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'cinematic'}
                onClick={() => onSelectMode('cinematic')}
                className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'cinematic'
                    ? 'bg-[#1D2B44] text-sky-200'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Video className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{launchMode === 'arduino' ? 'Auto Hardware Cycle' : 'Auto Cinematic'}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'manual'}
                onClick={() => onSelectMode('manual')}
                className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'manual'
                    ? 'bg-[#1D2B44] text-sky-200'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{launchMode === 'arduino' ? 'Manual Arduino Test' : 'Manual Sandbox'}</span>
              </button>
            </div>

            {/* Camera Angle Selector */}
            <div className="flex flex-wrap items-center gap-1">
              <Camera className="mr-0.5 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              {CAMERA_LABELS.map((cam) => {
                if (mode === 'manual' && cam.id === 'auto') return null;
                return (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => onSelectCameraPreset(cam.id)}
                    className={`rounded border px-1.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      cameraPreset === cam.id
                        ? 'border-sky-400/70 bg-sky-950/60 text-sky-200'
                        : 'border-[#24324D] bg-[#0B111E] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cam.label}
                  </button>
                );
              })}
            </div>

            {/* Matrix Explorer & Reset Actions */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenMatrixExplorer}
                className="inline-flex items-center gap-1 rounded border border-sky-500/50 bg-sky-950/50 px-2 py-1 text-[11px] font-medium text-sky-200 transition-colors hover:bg-sky-900/60 whitespace-nowrap cursor-pointer"
              >
                <Grid className="h-3 w-3" aria-hidden="true" />
                <span>AI Matrix</span>
              </button>
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1 rounded border border-[#24324D] bg-[#0B111E] px-2 py-1 text-[11px] font-medium text-slate-200 transition-colors hover:border-slate-500 whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Mode A: Auto Cinematic Experiment Controls */}
          {mode === 'cinematic' ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onTogglePlay}
                  className="inline-flex items-center gap-1.5 rounded border border-sky-500/60 bg-sky-950/50 px-3.5 py-1.5 text-xs font-semibold text-sky-200 transition-colors hover:bg-sky-900/60 whitespace-nowrap cursor-pointer"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Pause Run</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Resume Run</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onRunFailsafeScenario}
                  className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    isFailsafeScenario
                      ? 'border-amber-400 bg-amber-950/70 text-amber-200'
                      : 'border-amber-500/50 bg-[#0B111E] text-amber-300 hover:bg-amber-950/40'
                  }`}
                >
                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>4.5% Fail-Safe Scenario</span>
                </button>
              </div>

              <div className="flex flex-1 min-w-[240px] items-center gap-3">
                <span className="font-mono-tabular text-[11px] text-slate-400 whitespace-nowrap">
                  24s Cycle
                </span>
                <div className="relative h-2 flex-1 overflow-hidden rounded bg-[#0B111E] border border-[#24324D]">
                  <div
                    className="h-full bg-sky-400 transition-[width] duration-150"
                    style={{
                      width: `${isFailsafeScenario ? 100 : Math.round(cinematicProgress * 100)}%`,
                    }}
                  />
                </div>
                <span className="font-mono-tabular text-[11px] text-slate-300 whitespace-nowrap">
                  {isFailsafeScenario
                    ? 'LFL CUTOFF'
                    : `${(cinematicProgress * 24).toFixed(1)}s / 24.0s`}
                </span>
              </div>
            </div>
          ) : (
            /* Mode B: Manual Sandbox / Physical Arduino Hardware Test */
            <div className="mt-3 space-y-2.5">
              {/* Strict Arduino Verification Alert if Hardware Mode selected but board hasn't replied yet */}
              {launchMode === 'arduino' && (
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-1.5 text-xs ${
                    awaitingArduino
                      ? 'border-amber-500/60 bg-amber-950/40 text-amber-200'
                      : 'border-emerald-500/50 bg-emerald-950/35 text-emerald-200'
                  }`}
                  data-testid="arduino-strict-banner"
                >
                  <span>
                    {awaitingArduino
                      ? 'Hardware-Only Mode (No Fake Fallback): Waiting for real JSON reply from Arduino Uno...'
                      : 'Hardware-Only Mode Verified ✅ — Reactor obeys ONLY live Arduino Uno JSON decisions.'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={onRetryHandshake}
                      className="inline-flex items-center gap-1 rounded border border-[#24324D] bg-[#0B111E] px-2 py-0.5 text-[11px] text-slate-200 hover:border-sky-400 cursor-pointer"
                    >
                      <RefreshCw className="h-3 w-3" aria-hidden="true" />
                      <span>Ping RESET</span>
                    </button>
                    <button
                      type="button"
                      onClick={onSendDataNow}
                      className="inline-flex items-center gap-1 rounded border border-sky-500/50 bg-sky-950/60 px-2 py-0.5 text-[11px] text-sky-200 hover:bg-sky-900/60 cursor-pointer"
                    >
                      <Send className="h-3 w-3" aria-hidden="true" />
                      <span>Send DATA</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-bar: Physics Mode & Quick Test Scenarios */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={liveAccumulation}
                      onChange={(e) => onToggleLiveAccumulation(e.target.checked)}
                      className="h-3.5 w-3.5 accent-sky-400 cursor-pointer"
                    />
                    <span className="font-medium text-slate-200">
                      Real Thermodynamic ODE
                    </span>
                  </label>

                  {launchMode !== 'arduino' && (
                    <>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rfPreheatingEnabled}
                          onChange={(e) => onToggleRfEnabled(e.target.checked)}
                          className="h-3.5 w-3.5 accent-sky-400 cursor-pointer"
                        />
                        <span className="text-slate-300">RF Coil (Pin 8)</span>
                      </label>

                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={failsafeProtectionEnabled}
                          onChange={(e) => onToggleFailsafeEnabled(e.target.checked)}
                          className="h-3.5 w-3.5 accent-amber-400 cursor-pointer"
                        />
                        <span className="text-slate-300">Fail-Safe (Pin 7)</span>
                      </label>
                    </>
                  )}
                </div>

                {/* Quick Test Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onLoadSandboxPreset('cold')}
                    className="rounded border border-[#24324D] bg-[#0B111E] px-2 py-1 text-[11px] text-sky-300 hover:border-sky-400 cursor-pointer"
                  >
                    Inject H₂ 1.85%
                  </button>
                  <button
                    type="button"
                    onClick={() => onLoadSandboxPreset('rf_lightoff')}
                    className="rounded border border-[#24324D] bg-[#0B111E] px-2 py-1 text-[11px] text-rose-300 hover:border-rose-400 cursor-pointer"
                  >
                    Exothermic 168°C
                  </button>
                  <button
                    type="button"
                    onClick={() => onLoadSandboxPreset('failsafe')}
                    className="rounded border border-amber-500/40 bg-[#0B111E] px-2 py-1 text-[11px] text-amber-300 hover:border-amber-400 cursor-pointer"
                  >
                    4.5% Fail-Safe
                  </button>
                  {launchMode !== 'arduino' && (
                    <button
                      type="button"
                      onClick={onTriggerExplosionTest}
                      className="inline-flex items-center gap-1 rounded border border-rose-500/50 bg-rose-950/40 px-2 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-900/50 cursor-pointer"
                    >
                      <Flame className="h-3 w-3" aria-hidden="true" />
                      <span>Test LFL Deflagration</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Manual Mode Live TX -> AI Decision / Arduino Reply Feedback Bar */}
              <div
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#1E2A42] bg-[#070B13] px-2.5 py-1.5 font-mono-tabular text-[11px]"
                data-testid="manual-ai-decision-strip"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sky-400 shrink-0">
                    {serialConnected ? 'USB TX →' : 'TX →'}
                  </span>
                  <span className="text-slate-300 truncate">{lastTxPayload}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-400">
                    {launchMode === 'arduino' ? 'Arduino Reply:' : 'AI Decision:'}
                  </span>
                  {awaitingArduino ? (
                    <span className="font-semibold text-amber-300">
                      NO ARDUINO REPLY YET ({lastRxPayload})
                    </span>
                  ) : (
                    <span
                      className={`font-semibold ${
                        activeState === 'EXPLOSION'
                          ? 'text-red-400'
                          : activeState === 'FAILSAFE'
                          ? 'text-amber-300'
                          : activeState === 'EXOTHERMIC'
                          ? 'text-rose-300'
                          : activeState === 'TRIGGER'
                          ? 'text-sky-300'
                          : 'text-emerald-300'
                      }`}
                    >
                      d={packet.decision} · {activeState} (P8:
                      {activeState === 'TRIGGER' || activeState === 'FAILSAFE' ? '1' : '0'}, P7:
                      {activeState === 'EXOTHERMIC' ||
                      activeState === 'FAILSAFE' ||
                      activeState === 'EXPLOSION'
                        ? '1'
                        : '0'}
                      )
                    </span>
                  )}
                </div>
              </div>

              {/* 4 Precision Tactile Sliders */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded border border-[#24324D] bg-[#0B111E] px-2.5 py-2">
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <label htmlFor="slider-h2" className="font-medium text-slate-300 truncate">
                      H₂ Level
                    </label>
                    <span className="font-mono-tabular font-semibold text-emerald-400 whitespace-nowrap">
                      {inputs.h2.toFixed(2)}%
                    </span>
                  </div>
                  <input
                    id="slider-h2"
                    type="range"
                    min={0}
                    max={6}
                    step={0.05}
                    value={Math.min(6, inputs.h2)}
                    onChange={(e) => onManualSliderChange('h2', parseFloat(e.target.value))}
                    className="cad-slider mt-2"
                  />
                  <div className="mt-1 flex justify-between gap-1 font-mono-tabular text-[10px] text-slate-500">
                    <span>0%</span>
                    <span className="text-amber-400/80">LFL 4%</span>
                    <span>6%</span>
                  </div>
                </div>

                <div className="rounded border border-[#24324D] bg-[#0B111E] px-2.5 py-2">
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <label htmlFor="slider-rate" className="font-medium text-slate-300 truncate">
                      {liveAccumulation ? 'H₂ Leak' : 'H₂ Rate'}
                    </label>
                    <span className="font-mono-tabular font-semibold text-sky-300 whitespace-nowrap">
                      {liveAccumulation
                        ? `${leakInjectionRate.toFixed(2)}%/s`
                        : `${inputs.rate.toFixed(2)}%/s`}
                    </span>
                  </div>
                  <input
                    id="slider-rate"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={liveAccumulation ? leakInjectionRate : Math.max(0, inputs.rate)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (liveAccumulation) {
                        onLeakInjectionChange(val);
                      } else {
                        onManualSliderChange('rate', val);
                      }
                    }}
                    className="cad-slider mt-2"
                  />
                  <div className="mt-1 flex justify-between gap-1 font-mono-tabular text-[10px] text-slate-500">
                    <span>0.0</span>
                    <span>≥0.12</span>
                    <span>1.0</span>
                  </div>
                </div>

                <div className="rounded border border-[#24324D] bg-[#0B111E] px-2.5 py-2">
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <label htmlFor="slider-stemp" className="font-medium text-slate-300 truncate">
                      Ni-Fe Temp
                    </label>
                    <span className="font-mono-tabular font-semibold text-rose-400 whitespace-nowrap">
                      {inputs.sTemp.toFixed(1)}°C
                    </span>
                  </div>
                  <input
                    id="slider-stemp"
                    type="range"
                    min={25}
                    max={220}
                    step={1}
                    value={Math.min(220, Math.max(25, inputs.sTemp))}
                    onChange={(e) => onManualSliderChange('sTemp', parseFloat(e.target.value))}
                    className="cad-slider mt-2"
                  />
                  <div className="mt-1 flex justify-between gap-1 font-mono-tabular text-[10px] text-slate-500">
                    <span>25°C</span>
                    <span className="text-rose-400/80">150°C</span>
                    <span>220°C</span>
                  </div>
                </div>

                <div className="rounded border border-[#24324D] bg-[#0B111E] px-2.5 py-2">
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <label htmlFor="slider-btemp" className="font-medium text-slate-300 truncate">
                      Box Temp
                    </label>
                    <span className="font-mono-tabular font-semibold text-slate-200 whitespace-nowrap">
                      {inputs.bTemp.toFixed(1)}°C
                    </span>
                  </div>
                  <input
                    id="slider-btemp"
                    type="range"
                    min={25}
                    max={100}
                    step={0.5}
                    value={Math.min(100, Math.max(25, inputs.bTemp))}
                    onChange={(e) => onManualSliderChange('bTemp', parseFloat(e.target.value))}
                    className="cad-slider mt-2"
                  />
                  <div className="mt-1 flex justify-between gap-1 font-mono-tabular text-[10px] text-slate-500">
                    <span>25°C</span>
                    <span>Amb</span>
                    <span>100°C</span>
                  </div>
                </div>
              </div>

              {!failsafeProtectionEnabled && launchMode !== 'arduino' && (
                <div className="flex items-center gap-2 rounded border border-amber-500/40 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                  <span>
                    Fail-Safe Interlock bypassed: H₂ ≥ 5.2% with hot plates or active RF coil will trigger an unmitigated deflagration.
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

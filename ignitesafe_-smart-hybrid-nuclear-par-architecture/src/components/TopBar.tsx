import React from 'react';
import {
  Activity,
  BarChart2,
  BookOpen,
  Layers,
  Maximize2,
  Plug,
  Tag,
  Terminal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  ArduinoVerificationStatus,
  LaunchMode,
  ParState,
  PhysicsDiagnostics,
  TelemetryInputs,
  TinyMlPacket,
} from '../sim/types';

interface TopBarProps {
  inputs: TelemetryInputs;
  packet: TinyMlPacket;
  activeState: ParState;
  diagnostics: PhysicsDiagnostics;
  launchMode: LaunchMode;
  arduinoStatus: ArduinoVerificationStatus;
  soundEnabled: boolean;
  serialConnected: boolean;
  serialStatusLabel: string;
  matrixOpen: boolean;
  show3dLabels: boolean;
  howItWorksOpen: boolean;
  activeDrawer: 'none' | 'physics' | 'serial';
  onToggleSound: () => void;
  onToggleSerialConnect: () => void;
  onOpenLaunchGate: () => void;
  onToggleHowItWorks: () => void;
  onToggleCinemaMode: () => void;
  onToggleMatrix: () => void;
  onToggle3dLabels: () => void;
  onToggleDrawer: (drawer: 'physics' | 'serial') => void;
}

const STATE_STYLES: Record<ParState, { label: string; colorClass: string; glyph: string }> = {
  SAFE: { label: 'SAFE', colorClass: 'text-emerald-400', glyph: '●' },
  TRIGGER: { label: 'TRIGGER · RF', colorClass: 'text-sky-400', glyph: '◆' },
  EXOTHERMIC: { label: 'EXOTHERMIC', colorClass: 'text-rose-400', glyph: '▲' },
  FAILSAFE: { label: 'FAILSAFE', colorClass: 'text-amber-400', glyph: '■' },
  EXPLOSION: { label: 'DEFLAGRATION', colorClass: 'text-red-400', glyph: '✖' },
};

export const TopBar: React.FC<TopBarProps> = ({
  inputs,
  packet,
  activeState,
  diagnostics,
  launchMode,
  arduinoStatus,
  soundEnabled,
  serialConnected,
  serialStatusLabel,
  matrixOpen,
  show3dLabels,
  howItWorksOpen,
  activeDrawer,
  onToggleSound,
  onToggleSerialConnect,
  onOpenLaunchGate,
  onToggleHowItWorks,
  onToggleCinemaMode,
  onToggleMatrix,
  onToggle3dLabels,
  onToggleDrawer,
}) => {
  const st = STATE_STYLES[activeState];
  const pin8On = activeState === 'TRIGGER' || activeState === 'FAILSAFE';
  const pin7On =
    activeState === 'EXOTHERMIC' || activeState === 'FAILSAFE' || activeState === 'EXPLOSION';
  const awaitingArduino = launchMode === 'arduino' && arduinoStatus !== 'verified';

  return (
    <header
      className="fixed top-0 left-0 right-0 z-20 border-b border-[#24324D] bg-[#0B111E]/95 px-3 py-2 select-none"
      data-testid="top-telemetry-bar"
    >
      <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-2">
        {/* Zone 1: Brand Title & Mode Switcher */}
        <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
          <Activity className="h-4 w-4 text-sky-400 shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold tracking-tight text-slate-100">
            IgniteSafe
          </span>
          <button
            type="button"
            onClick={onOpenLaunchGate}
            data-testid="topbar-mode-badge"
            className={`hidden sm:inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono-tabular cursor-pointer transition-colors ${
              launchMode === 'arduino'
                ? arduinoStatus === 'verified'
                  ? 'border-emerald-500/60 bg-emerald-950/50 text-emerald-300'
                  : 'border-amber-500/60 bg-amber-950/50 text-amber-300'
                : launchMode === 'standalone'
                ? 'border-sky-500/50 bg-sky-950/40 text-sky-300'
                : 'border-[#24324D] bg-[#131C2E] text-slate-300'
            }`}
            title="Switch between Physical Arduino USB and Standalone Simulation"
          >
            {launchMode === 'arduino'
              ? arduinoStatus === 'verified'
                ? 'USB VERIFIED'
                : 'USB AWAITING'
              : launchMode === 'standalone'
              ? 'SIM TWIN'
              : 'STANDBY'}
          </button>
        </div>

        {/* Zone 2: Inline Telemetry Strip */}
        <div className="hidden lg:flex items-center gap-2.5 text-xs overflow-x-auto">
          <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0" data-testid="telemetry-ai-state">
            <span className="text-slate-400">State</span>
            {awaitingArduino ? (
              <span className="font-mono-tabular font-semibold text-amber-300">
                ◌ AWAITING ARDUINO
              </span>
            ) : (
              <span className={`font-mono-tabular font-semibold ${st.colorClass}`}>
                <span aria-hidden="true" className="mr-1">{st.glyph}</span>
                {st.label}
              </span>
            )}
          </div>

          <span className="text-[#24324D]" aria-hidden="true">|</span>

          <div
            className="flex items-center gap-2 whitespace-nowrap shrink-0"
            data-testid="hardware-led-mirror"
          >
            <span className="flex items-center gap-1 font-mono-tabular">
              <span
                className={`inline-block h-2 w-2 rounded-full border ${
                  pin8On ? 'bg-sky-100 border-sky-300' : 'bg-slate-800 border-slate-600'
                }`}
                aria-hidden="true"
              />
              <span className={pin8On ? 'text-sky-200 font-medium' : 'text-slate-500'}>
                P8 {pin8On ? '1' : '0'}
              </span>
            </span>
            <span className="flex items-center gap-1 font-mono-tabular">
              <span
                className={`inline-block h-2 w-2 rounded-full border ${
                  pin7On ? 'bg-rose-500 border-rose-300' : 'bg-slate-800 border-slate-600'
                }`}
                aria-hidden="true"
              />
              <span className={pin7On ? 'text-rose-300 font-medium' : 'text-slate-500'}>
                P7 {pin7On ? '1' : '0'}
              </span>
            </span>
            <span className="font-mono-tabular text-slate-300" data-testid="tinyml-latency">
              {packet.us} µs
            </span>
          </div>

          <span className="text-[#24324D]" aria-hidden="true">|</span>

          <div className="flex items-center gap-1 whitespace-nowrap shrink-0">
            <span className="text-slate-400">H₂</span>
            <span
              className={`font-mono-tabular font-semibold ${
                inputs.h2 >= 4.0
                  ? 'text-amber-400'
                  : inputs.h2 >= 0.8
                  ? 'text-emerald-400'
                  : 'text-slate-200'
              }`}
              data-testid="telemetry-h2"
            >
              {inputs.h2.toFixed(2)}%
            </span>
          </div>

          <div className="flex items-center gap-1 whitespace-nowrap shrink-0">
            <span className="text-slate-400">T_s</span>
            <span
              className={`font-mono-tabular font-semibold ${
                inputs.sTemp >= 150 ? 'text-rose-400' : 'text-slate-200'
              }`}
              data-testid="telemetry-stemp"
            >
              {inputs.sTemp.toFixed(1)}°C
            </span>
          </div>

          <div className="hidden 2xl:flex items-center gap-1 whitespace-nowrap shrink-0">
            <span className="text-slate-400">Saved</span>
            <span className="font-mono-tabular font-semibold text-emerald-400">
              {diagnostics.powerEfficiencySavedPct.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleHowItWorks}
            data-testid="topbar-how-it-works-btn"
            aria-label="Toggle Components and How It Works guide"
            className={`inline-flex items-center gap-1 rounded border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              howItWorksOpen
                ? 'border-sky-400 bg-[#1A2842] text-sky-200'
                : 'border-[#24324D] bg-[#131C2E] text-slate-200 hover:border-sky-400/60'
            }`}
          >
            <Layers className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
            <span className="hidden sm:inline">Components</span>
          </button>

          <button
            type="button"
            onClick={onToggle3dLabels}
            aria-label="Toggle 3D component labels"
            className={`hidden sm:inline-flex items-center gap-1 rounded border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              show3dLabels
                ? 'border-sky-400 bg-[#1A2842] text-sky-200'
                : 'border-[#24324D] bg-[#131C2E] text-slate-300 hover:border-slate-500'
            }`}
          >
            <Tag className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden xl:inline">3D Labels</span>
          </button>

          <button
            type="button"
            onClick={onToggleMatrix}
            aria-label="Toggle Live Telemetry Matrix"
            className={`inline-flex items-center gap-1 rounded border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              matrixOpen
                ? 'border-sky-400 bg-[#1A2842] text-sky-200'
                : 'border-[#24324D] bg-[#131C2E] text-slate-300 hover:border-slate-500'
            }`}
          >
            <BarChart2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleDrawer('physics')}
            aria-label="Open Physics and Step-by-Step SOP"
            className={`hidden md:inline-flex items-center gap-1 rounded border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeDrawer === 'physics'
                ? 'border-sky-400 bg-[#1A2842] text-sky-200'
                : 'border-[#24324D] bg-[#131C2E] text-slate-200 hover:border-slate-500'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden xl:inline">SOP</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleDrawer('serial')}
            aria-label="Open 9600-baud Serial Monitor"
            className={`hidden sm:inline-flex items-center gap-1 rounded border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeDrawer === 'serial'
                ? 'border-sky-400 bg-[#1A2842] text-sky-200'
                : 'border-[#24324D] bg-[#131C2E] text-slate-200 hover:border-slate-500'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden xl:inline">Serial</span>
          </button>

          <button
            type="button"
            onClick={onToggleCinemaMode}
            data-testid="topbar-cinema-btn"
            aria-label="Enter Full-Screen Cinema View"
            title="Full-Screen Cinema Mode (F)"
            className="inline-flex items-center gap-1 rounded border border-[#24324D] bg-[#131C2E] px-2 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-sky-400/70 hover:text-sky-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Maximize2 className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
            <span className="hidden md:inline">Cinema</span>
          </button>

          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute procedural sound effects' : 'Enable procedural sound effects'}
            className="hidden sm:inline-flex items-center gap-1 rounded border border-[#24324D] bg-[#131C2E] px-2 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleSerialConnect}
            title={serialStatusLabel}
            className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              serialConnected && arduinoStatus === 'verified'
                ? 'border-emerald-500/70 bg-emerald-950/60 text-emerald-300'
                : serialConnected
                ? 'border-amber-500/70 bg-amber-950/60 text-amber-200'
                : 'border-sky-500/60 bg-sky-950/50 text-sky-200 hover:bg-sky-900/60'
            }`}
          >
            <Plug className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden md:inline">
              {serialConnected && arduinoStatus === 'verified'
                ? 'Arduino Verified ✅'
                : serialConnected
                ? 'Verifying USB...'
                : 'Connect Arduino'}
            </span>
            <span className="md:hidden">{serialConnected ? 'USB' : 'Arduino'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

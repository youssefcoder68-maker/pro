import React, { useState } from 'react';
import { AlertCircle, Check, Copy, ExternalLink, Plug, Trash2, X } from 'lucide-react';
import { ARDUINO_REFERENCE_SKETCH } from '../serial/protocol';
import { ArduinoSerialClient } from '../serial/webSerial';
import type { SerialLogEntry } from '../sim/types';

interface SerialMonitorDrawerProps {
  open: boolean;
  connected: boolean;
  serialErrorHint: string | null;
  logs: SerialLogEntry[];
  onConnect: (baudRate: number) => void;
  onDisconnect: () => void;
  onClear: () => void;
  onSimulateIncomingJson: (state: 'SAFE' | 'TRIGGER' | 'EXOTHERMIC' | 'FAILSAFE') => void;
  onClose: () => void;
}

export const SerialMonitorDrawer: React.FC<SerialMonitorDrawerProps> = ({
  open,
  connected,
  serialErrorHint,
  logs,
  onConnect,
  onDisconnect,
  onClear,
  onSimulateIncomingJson,
  onClose,
}) => {
  const [showSketch, setShowSketch] = useState(false);
  const [copied, setCopied] = useState(false);
  const [baudRate, setBaudRate] = useState(9600);

  if (!open) return null;

  const isIframe = ArduinoSerialClient.isIframeBlocked();
  const serialSupported = ArduinoSerialClient.isSupported();

  const handleCopySketch = async () => {
    try {
      await navigator.clipboard.writeText(ARDUINO_REFERENCE_SKETCH);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard restriction
    }
  };

  return (
    <aside
      aria-label="9600 Baud Web Serial Monitor"
      className="fixed top-[49px] right-0 bottom-0 z-30 w-[min(480px,95vw)] border-l border-[#24324D] bg-[#0B111E] flex flex-col shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-[#24324D] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            Arduino Web Serial Monitor ({baudRate} Baud)
          </h2>
          <p className="text-xs text-slate-400">
            {connected
              ? 'Physical Arduino Uno Connected · Live USB 9600-Baud Actuation'
              : 'Browser TinyML Twin Active (Exact 5-Tree C++ Mirror · No USB)'}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowSketch((s) => !s)}
            className="rounded border border-[#24324D] bg-[#131C2E] px-2.5 py-1 text-xs text-sky-300 hover:border-sky-400 cursor-pointer"
          >
            {showSketch ? 'View Stream' : 'Arduino Sketch'}
          </button>
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear serial logs"
            className="rounded border border-[#24324D] bg-[#131C2E] p-1.5 text-slate-300 hover:text-white cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close serial monitor drawer"
            className="rounded border border-[#24324D] bg-[#131C2E] p-1.5 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Hardware Connection Control & Iframe Permissions Notice */}
      <div className="border-b border-[#24324D] bg-[#131C2E] px-4 py-2.5 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label htmlFor="baud-select" className="text-slate-400">
              Baud:
            </label>
            <select
              id="baud-select"
              value={baudRate}
              onChange={(e) => setBaudRate(Number(e.target.value))}
              disabled={connected}
              className="rounded border border-[#24324D] bg-[#0B111E] px-2 py-1 font-mono-tabular text-xs text-slate-200"
            >
              <option value={9600}>9600</option>
              <option value={115200}>115200</option>
            </select>

            <button
              type="button"
              onClick={() => (connected ? onDisconnect() : onConnect(baudRate))}
              className={`inline-flex items-center gap-1.5 rounded border px-3 py-1 text-xs font-medium cursor-pointer ${
                connected
                  ? 'border-rose-500/60 bg-rose-950/50 text-rose-200'
                  : 'border-sky-500/60 bg-sky-950/50 text-sky-200 hover:bg-sky-900/60'
              }`}
            >
              <Plug className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{connected ? 'Disconnect USB' : 'Select USB Port'}</span>
            </button>
          </div>

          {isIframe && (
            <a
              href={typeof window !== 'undefined' ? window.location.href : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded border border-amber-500/50 bg-amber-950/40 px-2.5 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-900/50"
            >
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              <span>Open Full Tab for USB</span>
            </a>
          )}
        </div>

        {(serialErrorHint || !serialSupported || isIframe) && (
          <div className="flex items-start gap-2 rounded border border-amber-500/40 bg-[#0B111E] p-2 text-[11px] text-amber-200/90 leading-snug">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
            <span>
              {serialErrorHint ??
                (!serialSupported
                  ? 'Web Serial API requires Chrome or Edge on desktop. Built-in TinyML engine is active.'
                  : 'Running inside an embedded preview iframe. If USB Serial permission is blocked by Chrome, click "Open Full Tab for USB" above and close Arduino IDE Serial Monitor.')}
            </span>
          </div>
        )}
      </div>

      {showSketch ? (
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-slate-300">
              Arduino Uno Firmware (Pin 8 White LED, Pin 7 Red LED)
            </span>
            <button
              type="button"
              onClick={handleCopySketch}
              className="inline-flex items-center gap-1.5 rounded border border-[#24324D] bg-[#131C2E] px-2.5 py-1 text-xs text-slate-200 hover:border-sky-400 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
          <pre className="cad-scroll flex-1 overflow-auto rounded border border-[#24324D] bg-[#131C2E] p-3 font-mono-tabular text-[11px] leading-relaxed text-slate-200">
            {ARDUINO_REFERENCE_SKETCH}
          </pre>
        </div>
      ) : (
        <>
          <div className="border-b border-[#24324D] bg-[#11192A] px-4 py-2 text-[11px] space-y-0.5">
            <div className="font-mono-tabular text-slate-300">
              <span className="text-sky-400">TX (500ms / Slider):</span> DATA:h2,rate,sTemp,bTemp
            </div>
            <div className="font-mono-tabular text-slate-300">
              <span className="text-emerald-400">RX (On Change):</span>{' '}
              {'{"decision":1,"state":"TRIGGER","pulse":1,"us":44}'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-b border-[#24324D] px-4 py-2 text-[11px]">
            <span className="text-slate-400 mr-1">Simulate RX:</span>
            {(['SAFE', 'TRIGGER', 'EXOTHERMIC', 'FAILSAFE'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => onSimulateIncomingJson(st)}
                className="rounded border border-[#24324D] bg-[#131C2E] px-2 py-0.5 font-mono-tabular text-slate-300 hover:border-sky-400 cursor-pointer"
              >
                {st}
              </button>
            ))}
          </div>

          <div className="cad-scroll flex-1 overflow-y-auto p-3 space-y-1.5 font-mono-tabular text-[11px]">
            {logs.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                Waiting for serial telemetry frames...
              </div>
            ) : (
              logs.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded border border-[#1E2A42] bg-[#11192A] px-2.5 py-1.5"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>
                      {entry.timestamp} · {entry.source}
                    </span>
                    <span
                      className={
                        entry.direction === 'TX'
                          ? 'text-sky-400'
                          : entry.direction === 'RX'
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }
                    >
                      {entry.direction}
                    </span>
                  </div>
                  <div className="mt-0.5 break-all text-slate-200">{entry.payload}</div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </aside>
  );
};

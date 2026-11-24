import React, { useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Grid,
  Play,
  Plug,
  ShieldAlert,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import type { ParState, PhysicsDiagnostics, TelemetryInputs, TinyMlPacket } from '../sim/types';
import type { ModelAuthorityMode, ValidationStageResult } from './ScientificMatrixPanel';

interface MatrixPresentationModalProps {
  open: boolean;
  inputs: TelemetryInputs;
  packet: TinyMlPacket;
  activeState: ParState;
  diagnostics: PhysicsDiagnostics;
  serialConnected: boolean;
  authorityMode: ModelAuthorityMode;
  lastTxPayload: string;
  lastRxPayload: string;
  validationRunning: boolean;
  validationResults: ValidationStageResult[];
  onRunValidationSweep: () => void;
  onJumpValidationStage: (stage: 'SAFE' | 'TRIGGER' | 'EXOTHERMIC' | 'FAILSAFE') => void;
  onConnectArduino: () => void;
  onOpenSerialDrawer: () => void;
  onClose: () => void;
}

const CLASSES: {
  id: 0 | 1 | 2 | 3;
  key: 'SAFE' | 'TRIGGER' | 'EXOTHERMIC' | 'FAILSAFE';
  short: string;
  labelEn: string;
  labelAr: string;
  featureRuleEn: string;
  featureRuleAr: string;
  pin8: string;
  pin7: string;
  physicsEn: string;
  physicsAr: string;
  accentText: string;
  activeRowClass: string;
  cellClass: string;
}[] = [
  {
    id: 0,
    key: 'SAFE',
    short: 'S0',
    labelEn: 'SAFE · Standby',
    labelAr: 'آمن · استعداد (0 W)',
    featureRuleEn: 'H₂ ≤ 0.99% (sub-threshold leak) OR cooled post-reaction',
    featureRuleAr: 'تركيز الهيدروجين أقل من 1.0% (وضع الأمان السلمي)',
    pin8: 'LOW (0 W)',
    pin7: 'LOW',
    physicsEn: 'Elastic H₂ bounce on cold 28°C plates; zero standby trace power.',
    physicsAr: 'ارتداد مرن للجزيئات عن الصفائح الباردة بدون استهلاك طاقة.',
    accentText: 'text-emerald-300',
    activeRowClass: 'bg-emerald-950/35 ring-1 ring-inset ring-emerald-500/60',
    cellClass: 'border-emerald-500/50 bg-emerald-950/45 text-emerald-300',
  },
  {
    id: 1,
    key: 'TRIGGER',
    short: 'T1',
    labelEn: 'TRIGGER · RF Pulse',
    labelAr: 'تحفيز · نبضة الحث',
    featureRuleEn: '1.0% ≤ H₂ < 4.0% AND T_catalyst < 150°C',
    featureRuleAr: 'الهيدروجين بين 1.0% و 4.0% والصفائح أبرد من 150°C',
    pin8: 'HIGH (135 kHz RF)',
    pin7: 'LOW',
    physicsEn: 'Eddy currents rapidly heat Ni-Fe plates past 150°C moisture barrier.',
    physicsAr: 'التيارات الدوامية تسخن صفائح النيكل بسرعة لتجاوز عتبة 150°C.',
    accentText: 'text-sky-300',
    activeRowClass: 'bg-sky-950/35 ring-1 ring-inset ring-sky-500/60',
    cellClass: 'border-sky-500/50 bg-sky-950/45 text-sky-300',
  },
  {
    id: 2,
    key: 'EXOTHERMIC',
    short: 'E2',
    labelEn: 'EXOTHERMIC · Catalysis',
    labelAr: 'تفاعل ذاتي · بخار ماء',
    featureRuleEn: '1.0% ≤ H₂ < 4.0% AND T_catalyst ≥ 150°C',
    featureRuleAr: 'الهيدروجين بين 1.0% و 4.0% وحرارة الصفائح 150°C فأعلى',
    pin8: 'LOW (RF Cut)',
    pin7: 'HIGH (Glow)',
    physicsEn: '2H₂ + O₂ → 2H₂O + ΔH sustains hot collisions & rising steam plume.',
    physicsAr: 'اتحاد ذاتي يحول الهيدروجين لبخار ماء صاعد مع إيقاف ملف RF.',
    accentText: 'text-rose-300',
    activeRowClass: 'bg-rose-950/35 ring-1 ring-inset ring-rose-500/60',
    cellClass: 'border-rose-500/50 bg-rose-950/45 text-rose-300',
  },
  {
    id: 3,
    key: 'FAILSAFE',
    short: 'F3',
    labelEn: 'FAILSAFE · LFL Cutoff',
    labelAr: 'طوارئ · منع الانفجار',
    featureRuleEn: 'H₂ ≥ 4.0% (Shapiro LFL) OR rapid spike d[H₂]/dt ≥ 0.62%/s',
    featureRuleAr: 'الهيدروجين 4.0% فأعلى (حد الاشتعال) أو تسارع مفاجئ من 0.62%/ث فأكثر',
    pin8: 'ALARM (Relay Cut)',
    pin7: 'HIGH (Vent)',
    physicsEn: 'Top damper opens, RF coil relay isolates ignition, gas vents safely.',
    physicsAr: 'فتح بوابة التنفيس العلوية وعزل مصدر الحث لمنع أي انفجار.',
    accentText: 'text-amber-300',
    activeRowClass: 'bg-amber-950/35 ring-1 ring-inset ring-amber-500/60',
    cellClass: 'border-amber-500/50 bg-amber-950/45 text-amber-300',
  },
];

const TREE_FOCUS = [
  { name: 'Tree #1', focusEn: 'Rate & H₂ Guard', focusAr: 'مراقب معدل التسريب' },
  { name: 'Tree #2', focusEn: '150°C Light-Off', focusAr: 'عتبة حرارة 150°C' },
  { name: 'Tree #3', focusEn: 'Box Temp & H₂', focusAr: 'توازن الصندوق والغاز' },
  { name: 'Tree #4', focusEn: 'LFL & Thermal Split', focusAr: 'حد الاشتعال والحرارة' },
  { name: 'Tree #5', focusEn: 'High-Slope Safeguard', focusAr: 'حماية القفزات السريعة' },
];

export const MatrixPresentationModal: React.FC<MatrixPresentationModalProps> = ({
  open,
  inputs,
  packet,
  activeState,
  diagnostics,
  serialConnected,
  authorityMode,
  lastTxPayload,
  lastRxPayload,
  validationRunning,
  validationResults,
  onRunValidationSweep,
  onJumpValidationStage,
  onConnectArduino,
  onOpenSerialDrawer,
  onClose,
}) => {
  const [lang, setLang] = useState<'ar' | 'en'>('ar');

  if (!open) return null;

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

  const evaluatedCount = validationResults.filter((r) => r.observedState !== null).length;
  const passedCount = validationResults.filter((r) => r.passed === true).length;

  const activeSourceTitle = serialConnected
    ? lang === 'ar'
      ? 'المصدر النشط: الأردوينو الحقيقي (USB 9600 Baud)'
      : 'Active Source: Physical Arduino Uno (USB 9600 Baud)'
    : authorityMode === 'faulty_model'
    ? lang === 'ar'
      ? 'المصدر النشط: اختبار نموذج معطّل (بدون حماية Fail-Safe)'
      : 'Active Source: Faulty ML Test Override (Fail-Safe Bypassed)'
    : lang === 'ar'
    ? 'المصدر النشط: محاكي TinyML المدمج (نفس كود الأردوينو C++ بدون كابل USB)'
    : 'Active Source: Browser TinyML Twin (Exact 5-Tree C++ Port · No USB)';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="TinyML Decision and Validation Matrix Explorer"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5"
      data-testid="matrix-presentation-modal"
    >
      <div className="flex max-h-[92vh] w-full max-w-[1160px] flex-col overflow-hidden rounded-lg border border-[#24324D] bg-[#0B111E] text-slate-100 shadow-2xl">
        {/* Top Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#24324D] bg-[#131C2E] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Grid className="h-4 w-4 text-sky-400 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-100">
                {lang === 'ar'
                  ? 'مصفوفة القرارات والتحقق العلمي (IgniteSafe TinyML Matrix)'
                  : 'IgniteSafe TinyML Decision, Threshold & Confusion Matrix'}
              </h2>
              <p className="text-[11px] text-slate-400">{activeSourceTitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded border border-[#24324D] bg-[#0B111E] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setLang('ar')}
                className={`rounded px-2 py-1 cursor-pointer ${
                  lang === 'ar' ? 'bg-sky-900/70 text-sky-200 font-semibold' : 'text-slate-400'
                }`}
              >
                عربي
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`rounded px-2 py-1 cursor-pointer ${
                  lang === 'en' ? 'bg-sky-900/70 text-sky-200 font-semibold' : 'text-slate-400'
                }`}
              >
                EN
              </button>
            </div>

            <button
              type="button"
              onClick={onRunValidationSweep}
              disabled={validationRunning}
              className="inline-flex items-center gap-1.5 rounded border border-sky-500/60 bg-sky-950/60 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-900/60 whitespace-nowrap cursor-pointer"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {validationRunning
                  ? lang === 'ar'
                    ? 'جاري الاختبار...'
                    : 'Sweeping...'
                  : lang === 'ar'
                  ? 'تشغيل اختبار الـ 4 حالات'
                  : 'Run 4-Stage Validation'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Matrix Explorer"
              className="rounded border border-[#24324D] bg-[#0B111E] p-1.5 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div
          className="cad-scroll flex-1 overflow-y-auto p-4 space-y-4 text-xs"
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        >
          {/* 1. Arduino vs Browser Twin Source Clarification + Live TX/RX Pipeline */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="lg:col-span-7 rounded-md border border-[#24324D] bg-[#131C2E] p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-semibold text-sky-300">
                  <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {lang === 'ar'
                      ? 'كيف يعمل الذكاء الاصطناعي مع أو بدون الأردوينو؟'
                      : 'How AI Execution Works With & Without Physical Arduino'}
                  </span>
                </span>
                {!serialConnected && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={onConnectArduino}
                      className="inline-flex items-center gap-1 rounded border border-sky-500/60 bg-sky-950/60 px-2.5 py-1 text-[11px] font-medium text-sky-200 hover:bg-sky-900/60 cursor-pointer"
                    >
                      <Plug className="h-3 w-3" aria-hidden="true" />
                      <span>{lang === 'ar' ? 'توصيل أردوينو USB' : 'Connect Arduino USB'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenSerialDrawer();
                      }}
                      className="rounded border border-[#24324D] bg-[#0B111E] px-2 py-1 text-[11px] text-slate-300 hover:border-slate-500 cursor-pointer"
                    >
                      {lang === 'ar' ? 'فتح Serial' : 'Open Serial'}
                    </button>
                  </div>
                )}
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">
                {serialConnected
                  ? lang === 'ar'
                    ? 'الأردوينو الحقيقي متصل الآن عبر كابل USB بسرعة 9600 Baud. عند تحريك السلايدر أو أثناء التشغيل، يرسل المتصفح القراءات (DATA:h2,rate,sTemp,bTemp) للأردوينو، ويرد الأردوينو فوراً بقرار JSON لتنفيذه في المحاكاة ثلاثية الأبعاد.'
                    : 'Your physical Arduino Uno is live over 9600-baud USB Serial. Every manual slider move and 500ms tick streams DATA:h2,rate,sTemp,bTemp to the board, and the 3D reactor executes the Arduino JSON decision verbatim.'
                  : lang === 'ar'
                  ? 'لا يوجد كابل USB متصل حالياً — لذلك يعمل المتصفح بنسخة مطابقة حرفياً لنفس الـ 5 أشجار Random Forest الموجودة في كود الأردوينو C++ (نفس العتبات والأوزان والتصويت)، لتتمكن من شرح واختبار كل الحالات بدون الحاجة لتوصيل اللوحة، وعند توصيل الكابل يتحول التنفيذ فوراً للأردوينو الحقيقي.'
                  : 'No physical USB board is connected right now — so the browser runs a literal 1:1 port of your 5-tree Arduino C++ Eloquent RandomForest (identical thresholds & voting). Plug in your Arduino Uno via USB at any time to switch authority live to hardware.'}
              </p>
            </div>

            {/* Live TX -> AI -> RX Link Card */}
            <div
              className="lg:col-span-5 rounded-md border border-[#24324D] bg-[#0E1627] p-3 space-y-1.5 font-mono-tabular"
              dir="ltr"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-300">LIVE TX → AI → RX TRACE</span>
                <span
                  className={
                    serialConnected ? 'text-emerald-400 font-semibold' : 'text-sky-300 font-semibold'
                  }
                >
                  {serialConnected ? 'USB-9600 LIVE' : 'BROWSER TWIN'}
                </span>
              </div>
              <div className="rounded border border-[#1E2A42] bg-[#070B13] px-2.5 py-1.5 text-[11px]">
                <span className="text-sky-400">TX </span>
                <span className="text-slate-200 break-all">{lastTxPayload}</span>
              </div>
              <div className="rounded border border-[#1E2A42] bg-[#070B13] px-2.5 py-1.5 text-[11px]">
                <span className="text-emerald-400">RX </span>
                <span className="text-slate-200 break-all">{lastRxPayload}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                <span>
                  Decision d={packet.decision} ({activeState})
                </span>
                <span>
                  Pin8:{activeState === 'TRIGGER' || activeState === 'FAILSAFE' ? 'HIGH' : 'LOW'} ·
                  Pin7:
                  {activeState === 'EXOTHERMIC' ||
                  activeState === 'FAILSAFE' ||
                  activeState === 'EXPLOSION'
                    ? 'HIGH'
                    : 'LOW'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. 4x4 Validation / Confusion Matrix + 5-Tree Voting Matrix */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Left: 4x4 Confusion Matrix */}
            <div className="lg:col-span-6 rounded-md border border-[#24324D] bg-[#131C2E] overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#24324D] bg-[#172238] px-3 py-2">
                <span className="font-semibold text-slate-100">
                  {lang === 'ar'
                    ? 'مصفوفة الالتباس والتحقق (4×4 Confusion Matrix)'
                    : '4×4 Live Validation & Confusion Matrix'}
                </span>
                <span className="font-mono-tabular text-[11px] text-emerald-300">
                  {evaluatedCount > 0
                    ? `${passedCount}/${evaluatedCount} Matched (${Math.round(
                        (passedCount / evaluatedCount) * 100
                      )}%)`
                    : lang === 'ar'
                    ? 'اضغط تشغيل لاختبار الـ 4 حالات'
                    : 'Click Run to populate'}
                </span>
              </div>

              <div className="p-3 overflow-x-auto" dir="ltr">
                <table className="w-full border-collapse text-center font-mono-tabular text-[11px]">
                  <thead>
                    <tr className="text-[10px] text-slate-400">
                      <th className="border border-[#24324D] bg-[#0B111E] px-2 py-1.5 text-left">
                        Expected ↓ / Pred →
                      </th>
                      {CLASSES.map((col) => (
                        <th
                          key={col.key}
                          className={`border border-[#24324D] bg-[#0B111E] px-2 py-1.5 ${col.accentText}`}
                        >
                          {col.short} · {col.key.slice(0, 4)}
                        </th>
                      ))}
                      <th className="border border-[#24324D] bg-[#0B111E] px-2 py-1.5 text-slate-300">
                        Test
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {CLASSES.map((row) => {
                      const res = validationResults.find((r) => r.targetState === row.key);
                      return (
                        <tr key={row.key}>
                          <td
                            className={`border border-[#24324D] bg-[#0E1627] px-2 py-2 text-left font-semibold ${row.accentText}`}
                          >
                            {row.short} · {row.key}
                          </td>
                          {CLASSES.map((col) => {
                            const isDiagonal = row.key === col.key;
                            const isObserved = res?.observedState === col.key;
                            let cellTone = 'bg-[#0B111E] text-slate-600';
                            let cellContent: React.ReactNode = '·';

                            if (isObserved && isDiagonal) {
                              cellTone = 'bg-emerald-950/60 text-emerald-300 font-semibold';
                              cellContent = (
                                <span className="inline-flex items-center justify-center gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>{res?.latencyUs ?? 42}µs</span>
                                </span>
                              );
                            } else if (isObserved && !isDiagonal) {
                              cellTone = 'bg-rose-950/70 text-rose-300 font-semibold';
                              cellContent = (
                                <span className="inline-flex items-center justify-center gap-1">
                                  <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>MISS</span>
                                </span>
                              );
                            } else if (isDiagonal && activeState === row.key) {
                              cellTone = 'bg-sky-950/45 text-sky-200';
                              cellContent = 'ACTIVE';
                            } else if (isDiagonal) {
                              cellTone = 'bg-[#0F182A] text-slate-500';
                            }

                            return (
                              <td
                                key={col.key}
                                className={`border border-[#24324D] px-2 py-2 ${cellTone}`}
                              >
                                {cellContent}
                              </td>
                            );
                          })}
                          <td className="border border-[#24324D] bg-[#0B111E] px-1.5 py-1.5">
                            <button
                              type="button"
                              onClick={() => onJumpValidationStage(row.key)}
                              className="rounded border border-[#24324D] bg-[#131C2E] px-2 py-0.5 text-[10px] text-sky-300 hover:border-sky-400 cursor-pointer"
                            >
                              Send
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Live 5-Tree Voting Breakdown */}
            <div className="lg:col-span-6 rounded-md border border-[#24324D] bg-[#131C2E] overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#24324D] bg-[#172238] px-3 py-2">
                <span className="font-semibold text-slate-100">
                  {lang === 'ar'
                    ? 'مصفوفة تصويت الغابة العشوائية (5 أشجار قرار)'
                    : '5-Tree RandomForest Live Voting Matrix'}
                </span>
                <span className="font-mono-tabular text-[11px] text-sky-300" dir="ltr">
                  x = [{inputs.h2.toFixed(2)}, {inputs.rate.toFixed(2)}, {inputs.sTemp.toFixed(1)},{' '}
                  {inputs.bTemp.toFixed(1)}]
                </span>
              </div>

              <div className="p-3 space-y-3">
                <div className="grid grid-cols-5 gap-1.5" dir="ltr">
                  {perTree.map((pred, idx) => {
                    const cls = CLASSES[pred] ?? CLASSES[0];
                    const focus = TREE_FOCUS[idx];
                    return (
                      <div
                        key={idx}
                        className={`rounded border p-2 text-center ${cls.cellClass}`}
                      >
                        <div className="font-mono-tabular text-[10px] opacity-80">{focus.name}</div>
                        <div className="mt-0.5 font-mono-tabular text-sm font-bold">{cls.short}</div>
                        <div className="text-[10px] truncate">{cls.key}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Class Vote Distribution Bars */}
                <div className="space-y-1.5" dir="ltr">
                  {CLASSES.map((cls) => {
                    const v = votes[cls.id] ?? 0;
                    const pct = (v / 5) * 100;
                    const isWinner = packet.decision === cls.id;
                    return (
                      <div key={cls.id} className="flex items-center gap-2 font-mono-tabular text-[11px]">
                        <span className={`w-24 shrink-0 ${isWinner ? `${cls.accentText} font-semibold` : 'text-slate-400'}`}>
                          {cls.short} · {cls.key.slice(0, 4)}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded bg-[#070B13] border border-[#1E2A42]">
                          <div
                            className={`h-full transition-[width] duration-150 ${
                              cls.id === 0
                                ? 'bg-emerald-400'
                                : cls.id === 1
                                ? 'bg-sky-400'
                                : cls.id === 2
                                ? 'bg-rose-400'
                                : 'bg-amber-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-slate-300">{v}/5</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#24324D] pt-2 text-[11px] text-slate-300">
                  <span>
                    {lang === 'ar' ? 'سرعة الاستدلال:' : 'Inference Time:'}{' '}
                    <strong className="font-mono-tabular text-sky-300 inline-block" dir="ltr">
                      {packet.us} µs
                    </strong>
                  </span>
                  <span>
                    {lang === 'ar' ? 'توفير الطاقة:' : 'Power Saved:'}{' '}
                    <strong className="font-mono-tabular text-emerald-300 inline-block" dir="ltr">
                      {diagnostics.powerEfficiencySavedPct.toFixed(1)}%
                    </strong>
                  </span>
                  <span>
                    {lang === 'ar' ? 'كفاءة التفاعل:' : 'H₂→H₂O:'}{' '}
                    <strong className="font-mono-tabular text-rose-300 inline-block" dir="ltr">
                      {diagnostics.h2oProducedMgPerSec.toFixed(1)} mg/s
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Feature-Space Threshold & Hardware Mapping Matrix */}
          <div className="rounded-md border border-[#24324D] bg-[#131C2E] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#24324D] bg-[#172238] px-3 py-2">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-100">
                {activeState === 'FAILSAFE' ? (
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                )}
                <span>
                  {lang === 'ar'
                    ? 'مصفوفة العتبات الفيزيائية وأوامر الهاردوير (Pin 8 / Pin 7)'
                    : 'Feature-Space Threshold & Hardware Actuation Matrix'}
                </span>
              </span>
              <span className="text-[11px] text-slate-400">
                {lang === 'ar'
                  ? 'الصف المضيء يوضح الحالة الفيزيائية والقرار النشط الآن'
                  : 'Highlighted row marks the currently active reactor state'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#24324D] bg-[#0B111E] text-[11px] text-slate-400">
                    <th className="px-3 py-2 text-start">
                      {lang === 'ar' ? 'القرار (d)' : 'Decision'}
                    </th>
                    <th className="px-3 py-2 text-start">
                      {lang === 'ar' ? 'شرط المدخلات [H₂, Rate, T_s]' : 'Input Feature Condition'}
                    </th>
                    <th className="px-3 py-2 text-start whitespace-nowrap">Pin 8 (RF)</th>
                    <th className="px-3 py-2 text-start whitespace-nowrap">Pin 7 (Thermal/Vent)</th>
                    <th className="px-3 py-2 text-start">
                      {lang === 'ar' ? 'الاستجابة الفيزيائية داخل المفاعل' : 'Physical Reactor Response'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2A42]">
                  {CLASSES.map((row) => {
                    const isActive = activeState === row.key;
                    return (
                      <tr
                        key={row.id}
                        className={isActive ? row.activeRowClass : 'hover:bg-[#0E1627]/70'}
                      >
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className={`font-mono-tabular font-semibold ${row.accentText}`}>
                            d={row.id} · {row.key}
                          </div>
                          <div className="text-[11px] text-slate-300">
                            {lang === 'ar' ? row.labelAr : row.labelEn}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-slate-200">
                          {lang === 'ar' ? row.featureRuleAr : row.featureRuleEn}
                        </td>
                        <td className="px-3 py-2.5 font-mono-tabular text-[11px] text-sky-200 whitespace-nowrap" dir="ltr">
                          {row.pin8}
                        </td>
                        <td className="px-3 py-2.5 font-mono-tabular text-[11px] text-rose-200 whitespace-nowrap" dir="ltr">
                          {row.pin7}
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-slate-300">
                          {lang === 'ar' ? row.physicsAr : row.physicsEn}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { PhysicsDiagnostics, TelemetryInputs, TinyMlPacket } from '../sim/types';

interface PhysicsSopDrawerProps {
  open: boolean;
  inputs: TelemetryInputs;
  packet: TinyMlPacket;
  diagnostics: PhysicsDiagnostics;
  onClose: () => void;
}

export const PhysicsSopDrawer: React.FC<PhysicsSopDrawerProps> = ({
  open,
  inputs,
  packet,
  diagnostics,
  onClose,
}) => {
  const [lang, setLang] = useState<'en' | 'ar'>('en');

  if (!open) return null;

  return (
    <aside
      aria-label="Scientific Equations and Step-by-Step Guide"
      className="fixed top-[49px] right-0 bottom-0 z-30 w-[min(460px,95vw)] border-l border-[#24324D] bg-[#0B111E] flex flex-col shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-[#24324D] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            {lang === 'en'
              ? 'Thermodynamics & Operating Procedure'
              : 'المعادلات الفيزيائية وآلية التشغيل خطوة بخطوة'}
          </h2>
          <p className="text-xs text-slate-400">
            {lang === 'en'
              ? 'Arrhenius Kinetics · RF Curie Heating · Shapiro LFL'
              : 'حركية أرينيوس · التسخين الحثي · حدود الانفجار'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded border border-[#24324D] bg-[#131C2E] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`rounded px-2 py-0.5 font-medium cursor-pointer ${
                lang === 'en' ? 'bg-sky-900/70 text-sky-200' : 'text-slate-400'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang('ar')}
              className={`rounded px-2 py-0.5 font-medium cursor-pointer ${
                lang === 'ar' ? 'bg-sky-900/70 text-sky-200' : 'text-slate-400'
              }`}
            >
              AR
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Physics and SOP drawer"
            className="rounded border border-[#24324D] bg-[#131C2E] p-1.5 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="cad-scroll flex-1 overflow-y-auto p-4 space-y-5 text-xs leading-relaxed"
      >
        {/* Live Calculated Equations */}
        <section className="space-y-2.5">
          <h3 className="text-xs font-semibold text-sky-300">
            {lang === 'en' ? '1. Live Scientific Equations' : '١. المعادلات العلمية المباشرة'}
          </h3>

          <div className="space-y-2 rounded border border-[#24324D] bg-[#131C2E] p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-slate-300 font-medium">
                {lang === 'en' ? 'Arrhenius Reaction Rate' : 'معدل تفاعل أرينيوس'}
              </span>
              <span className="font-mono-tabular text-emerald-400 font-semibold">
                {diagnostics.recombinationRatePctPerSec.toFixed(3)} %/s
              </span>
            </div>
            <p className="font-mono-tabular text-[11px] text-slate-400">
              k(T) = A·exp(-Ea / R·T_K) · η_steam = {diagnostics.arrheniusRateConstant.toFixed(3)} s⁻¹ · η={diagnostics.surfaceActivationFactor.toFixed(2)}
            </p>
            <p className="text-slate-400">
              {lang === 'en'
                ? 'Below 150°C, condensed steam inhibits active Ni-Fe sites (H₂ bounces off). Above 150°C, 2H₂ + O₂ → 2H₂O releases 241.8 kJ/mol.'
                : 'تحت ١٥٠°م يمنع تكثف البخار التفاعل فترتد جزيئات الهيدروجين. فوق ١٥٠°م يتحول الهيدروجين لبخار ماء مع انطلاق طاقة ٢٤١.٨ كيلوجول/مول.'}
            </p>
          </div>

          <div className="space-y-2 rounded border border-[#24324D] bg-[#131C2E] p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-slate-300 font-medium">
                {lang === 'en' ? 'RF Curie-Point Heating' : 'التسخين الحثي الذاتي (نقطة كوري)'}
              </span>
              <span className="font-mono-tabular text-sky-400 font-semibold">
                {diagnostics.rfInductionPowerW.toFixed(1)} W
              </span>
            </div>
            <p className="font-mono-tabular text-[11px] text-slate-400">
              P_RF = P_max·[1 - (T_s / 225°C)²] · Pulse={packet.pulse}
            </p>
            <p className="text-slate-400">
              {lang === 'en'
                ? 'Ni-Fe alloy naturally loses ferromagnetism near 225°C, self-limiting eddy-current heating well below the 585°C auto-ignition point.'
                : 'سبيكة النيكل-حديد تفقد المغناطيسية ذاتياً عند ٢٢٥°م لمنع تجاوز درجة الاشتعال الذاتي (٥٨٥°م).'}
            </p>
          </div>

          <div className="space-y-2 rounded border border-[#24324D] bg-[#131C2E] p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-slate-300 font-medium">
                {lang === 'en' ? 'Exothermic Power & Mass Conversion' : 'الطاقة الطاردة ومعدل التحويل'}
              </span>
              <span className="font-mono-tabular text-rose-400 font-semibold">
                {diagnostics.exothermicPowerW.toFixed(1)} W
              </span>
            </div>
            <p className="font-mono-tabular text-[11px] text-slate-400">
              H₂ Consumed: {diagnostics.h2ConsumedMgPerSec.toFixed(1)} mg/s → H₂O Vapor: {diagnostics.h2oProducedMgPerSec.toFixed(1)} mg/s
            </p>
            <p className="font-mono-tabular text-[11px] text-slate-400">
              Chimney Buoyant Draft v_d = {diagnostics.chimneyDraftVelocityMs.toFixed(2)} m/s
            </p>
          </div>

          <div className="space-y-2 rounded border border-[#24324D] bg-[#131C2E] p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-slate-300 font-medium">
                {lang === 'en' ? 'Shapiro Flammability Regime' : 'نطاق الاشتعال (مخطط شابيرو)'}
              </span>
              <span
                className={`font-mono-tabular font-semibold ${
                  diagnostics.isFlammable ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {inputs.h2.toFixed(2)}% H₂
              </span>
            </div>
            <p className="text-slate-300">{diagnostics.flammabilityRegime}</p>
            {diagnostics.isFlammable && (
              <p className="font-mono-tabular text-[11px] text-amber-300">
                Adiabatic ΔP ≈ {diagnostics.potentialOverpressureKpa.toFixed(0)} kPa · Flame Speed ≈ {diagnostics.potentialFlameSpeedMs.toFixed(1)} m/s
              </p>
            )}
          </div>
        </section>

        {/* Step-by-Step Operating Sequence */}
        <section className="space-y-2.5">
          <h3 className="text-xs font-semibold text-sky-300">
            {lang === 'en'
              ? '2. Step-by-Step Operating Mechanism'
              : '٢. خطوات وآلية تشغيل النظام خطوة بخطوة'}
          </h3>

          <ol className="space-y-2.5">
            <li className="rounded border border-[#24324D] bg-[#131C2E] p-3">
              <div className="font-semibold text-slate-100">
                {lang === 'en'
                  ? 'Step 1 — Zero-Watt Passive Monitoring (SAFE)'
                  : 'الخطوة ١ — المراقبة الخاملة بصفر واط (SAFE)'}
              </div>
              <p className="mt-1 text-slate-400">
                {lang === 'en'
                  ? 'TinyML samples H₂ concentration and d[H₂]/dt at 44 µs latency while the RF coil stays off, saving 92%+ standby power vs legacy 450W trace heaters.'
                  : 'يراقب نموذج TinyML تركيز الهيدروجين ومعدل التغير بزمن استجابة ٤٤ ميكروثانية مع إبقاء ملف الحث مطفأ لتوفير ٩٢٪+ من الطاقة.'}
              </p>
            </li>

            <li className="rounded border border-[#24324D] bg-[#131C2E] p-3">
              <div className="font-semibold text-sky-300">
                {lang === 'en'
                  ? 'Step 2 — Predictive RF Pre-Heat Pulse (TRIGGER · Pin 8)'
                  : 'الخطوة ٢ — نبضة التسخين الحثي الاستباقية (TRIGGER · Pin 8)'}
              </div>
              <p className="mt-1 text-slate-400">
                {lang === 'en'
                  ? 'When H₂ ≥ 0.8% (or ≥ 0.35% with rapid acceleration ≥ 0.12 %/s) while plates are cold (< 150°C), Pin 8 energizes the copper RF coil to overcome cold-start moisture poisoning.'
                  : 'عند ارتفاع الهيدروجين (≥ 0.8% أو تسارع ≥ 0.12%/ث) والصفائح باردة، يطلق النظام نبضة تردد راديوي لتسخين الصفائح فوق ١٥٠°م.'}
              </p>
            </li>

            <li className="rounded border border-[#24324D] bg-[#131C2E] p-3">
              <div className="font-semibold text-rose-300">
                {lang === 'en'
                  ? 'Step 3 — Self-Sustaining Catalysis (EXOTHERMIC)'
                  : 'الخطوة ٣ — التفاعل الذاتي الطارد للحرارة (EXOTHERMIC)'}
              </div>
              <p className="mt-1 text-slate-400">
                {lang === 'en'
                  ? 'Once Ni-Fe plates cross 150°C, RF power cuts OFF. Exothermic recombination sustains plate temperature and creates buoyant upward draft exhausting harmless H₂O vapor.'
                  : 'بمجرد وصول الصفائح إلى ١٥٠°م ينفصل ملف الحث تلقائياً، وتستمر حرارة التفاعل ذاتياً في تحويل الهيدروجين إلى بخار ماء صاعد.'}
              </p>
            </li>

            <li className="rounded border border-[#24324D] bg-[#131C2E] p-3">
              <div className="font-semibold text-amber-300">
                {lang === 'en'
                  ? 'Step 4 — Emergency LFL Interlock (FAILSAFE · Pin 7)'
                  : 'الخطوة ٤ — قاطع الطوارئ عند حد الاشتعال (FAILSAFE · Pin 7)'}
              </div>
              <p className="mt-1 text-slate-400">
                {lang === 'en'
                  ? 'If H₂ reaches ≥ 4.5% (exceeding the 4.0% upward LFL), Pin 8 RF is locked out immediately to prevent ignition sparks and Pin 7 opens emergency containment venting.'
                  : 'إذا وصل الهيدروجين إلى ٤.٥٪ يغلق النظام ملف الحث فوراً لمنع حدوث شرارة اشتعال ويفتح صمام التنفيس الآمن.'}
              </p>
            </li>
          </ol>
        </section>
      </div>
    </aside>
  );
};

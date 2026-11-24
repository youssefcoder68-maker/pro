import React, { useState } from 'react';
import { AlertOctagon, RotateCcw, X } from 'lucide-react';
import type { ExplosionReport } from '../sim/types';

interface ExplosionModalProps {
  report: ExplosionReport | null;
  onResetContainment: () => void;
  onDismiss: () => void;
}

export const ExplosionModal: React.FC<ExplosionModalProps> = ({
  report,
  onResetContainment,
  onDismiss,
}) => {
  const [lang, setLang] = useState<'en' | 'ar'>('en');

  if (!report) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="explosion-report-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#050811]/80 p-4"
    >
      <div className="w-full max-w-2xl rounded-lg border border-rose-500/60 bg-[#0F172A] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#24324D] bg-rose-950/40 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <AlertOctagon className="h-5 w-5 text-rose-400 shrink-0" aria-hidden="true" />
            <div>
              <h2 id="explosion-report-title" className="text-sm font-semibold text-rose-100">
                {lang === 'en'
                  ? 'Containment Deflagration & Forensics Report'
                  : 'تقرير التحليل الفيزيائي لحادث الانفجار الهيدروجيني'}
              </h2>
              <p className="font-mono-tabular text-[11px] text-rose-300/80">
                Event Time: {report.timestamp} · {report.shapiroZone}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded border border-[#24324D] bg-[#0B111E] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`rounded px-2 py-0.5 font-medium cursor-pointer ${
                  lang === 'en' ? 'bg-rose-900/60 text-rose-100' : 'text-slate-400'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('ar')}
                className={`rounded px-2 py-0.5 font-medium cursor-pointer ${
                  lang === 'ar' ? 'bg-rose-900/60 text-rose-100' : 'text-slate-400'
                }`}
              >
                AR
              </button>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss report"
              className="rounded border border-[#24324D] bg-[#131C2E] p-1 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
          className="p-5 space-y-4 text-xs leading-relaxed"
        >
          {/* Key Metrics Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded border border-[#24324D] bg-[#131C2E] p-2.5">
              <div className="text-[11px] text-slate-400">
                {lang === 'en' ? 'Peak H₂' : 'أعلى نسبة H₂'}
              </div>
              <div className="mt-0.5 font-mono-tabular text-base font-semibold text-rose-400">
                {report.peakH2Pct.toFixed(2)}%
              </div>
            </div>
            <div className="rounded border border-[#24324D] bg-[#131C2E] p-2.5">
              <div className="text-[11px] text-slate-400">
                {lang === 'en' ? 'Catalyst Temp' : 'حرارة الصفائح'}
              </div>
              <div className="mt-0.5 font-mono-tabular text-base font-semibold text-amber-300">
                {report.catalystTempC.toFixed(1)} °C
              </div>
            </div>
            <div className="rounded border border-[#24324D] bg-[#131C2E] p-2.5">
              <div className="text-[11px] text-slate-400">
                {lang === 'en' ? 'Peak Overpressure' : 'ذروة الضغط'}
              </div>
              <div className="mt-0.5 font-mono-tabular text-base font-semibold text-slate-100">
                {report.peakOverpressureKpa.toFixed(0)} kPa
              </div>
            </div>
            <div className="rounded border border-[#24324D] bg-[#131C2E] p-2.5">
              <div className="text-[11px] text-slate-400">
                {lang === 'en' ? 'Flame Speed' : 'سرعة اللهب'}
              </div>
              <div className="mt-0.5 font-mono-tabular text-base font-semibold text-slate-100">
                {report.flameSpeedMs.toFixed(1)} m/s
              </div>
            </div>
          </div>

          {/* Why It Exploded */}
          <div className="rounded border border-[#24324D] bg-[#131C2E] p-3.5 space-y-1.5">
            <h3 className="font-semibold text-rose-300">
              {lang === 'en' ? `Root Cause: ${report.causeTitle}` : 'لماذا حدث الانفجار؟ (السبب الفيزيائي)'}
            </h3>
            <p className="text-slate-300">
              {lang === 'en'
                ? report.rootCauseDetail
                : `تجاوز تركيز الهيدروجين حد الاشتعال الأدنى (LFL 4.0%) ووصل إلى ${report.peakH2Pct.toFixed(2)}% بالتزامن مع وجود مصدر طاقة حراري (${report.catalystTempC.toFixed(1)}°م) أو تراكم يفوق قدرة التنفيس، مما أدى لاشتعال الخليط بضغط ذروة ${report.peakOverpressureKpa.toFixed(0)} كيلوباسكال.`}
            </p>
          </div>

          {/* TinyML Model Response */}
          <div className="rounded border border-[#24324D] bg-[#131C2E] p-3.5 space-y-1.5">
            <h3 className="font-semibold text-sky-300">
              {lang === 'en'
                ? 'Smart-Hybrid TinyML Model Response'
                : 'كيف استجاب نموذج الذكاء الاصطناعي TinyML؟'}
            </h3>
            <p className="text-slate-300">
              {lang === 'en'
                ? report.modelResponse
                : 'رصد نموذج TinyML تجاوز حد ٤.٥٪ خلال ٤١ ميكروثانية وأصدر أمر FAILSAFE (decision: 2) لإيقاف ملف الحث Pin 8 وتفعيل إنذار وتنفيس Pin 7، لكن تعطيل قاطع الأمان يدوياً أو ضخ تسرب فائق السرعة تسبب في الاشتعال.'}
            </p>
          </div>

          {/* Recovery Actions */}
          <div className="space-y-1.5">
            <h3 className="font-semibold text-slate-200">
              {lang === 'en' ? 'Preventive Safeguards' : 'إجراءات المنع والسلامة'}
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              {report.mitigationSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[#24324D] bg-[#0B111E] px-5 py-3">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded border border-[#24324D] bg-[#131C2E] px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
          >
            Inspect 3D Chamber
          </button>
          <button
            type="button"
            onClick={onResetContainment}
            className="inline-flex items-center gap-1.5 rounded border border-sky-500/60 bg-sky-950/60 px-4 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-900/70 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Purge &amp; Reset Containment</span>
          </button>
        </div>
      </div>
    </div>
  );
};

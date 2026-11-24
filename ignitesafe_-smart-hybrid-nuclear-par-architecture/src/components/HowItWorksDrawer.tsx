import React, { useState } from 'react';
import { Layers, PlayCircle, X } from 'lucide-react';
import { PART_CATALOG } from '../sim/partCatalog';
import type {
  CameraPresetId,
  ParState,
  PartInspectorId,
  PhysicsDiagnostics,
  TelemetryInputs,
  TinyMlPacket,
} from '../sim/types';

interface HowItWorksDrawerProps {
  open: boolean;
  inputs: TelemetryInputs;
  packet: TinyMlPacket;
  activeState: ParState;
  diagnostics: PhysicsDiagnostics;
  selectedPart: PartInspectorId | null;
  onSelectComponent: (partId: PartInspectorId, cameraPreset: Exclude<CameraPresetId, 'auto'>) => void;
  onJumpStagePreview?: (stage: 'SAFE' | 'TRIGGER' | 'EXOTHERMIC' | 'FAILSAFE') => void;
  canJumpStages: boolean;
  onClose: () => void;
}

const ORDERED_PART_IDS: PartInspectorId[] = [
  'gas_manifold',
  'h2_intake',
  'nickel_plates',
  'copper_coil',
  'tinyml_box',
  'h2o_exhaust',
  'failsafe_damper',
  'quartz_window',
];

const WORKFLOW_STAGES: {
  state: 'SAFE' | 'TRIGGER' | 'EXOTHERMIC' | 'FAILSAFE';
  badgeClass: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  camera: Exclude<CameraPresetId, 'auto'>;
}[] = [
  {
    state: 'SAFE',
    badgeClass: 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300',
    titleAr: '١. الاستعداد الصفري (SAFE · القرار 0)',
    titleEn: '1. Zero-Watt Standby (SAFE · d=0)',
    descAr:
      'عند غياب التسريب (<1.0% H₂)، تبقى ألواح النيكل باردة عند ٢٨°م دون استهلاك أي كهرباء، وترتد جزيئات الهيدروجين القليلة مرناً بسبب طبقة الرطوبة.',
    descEn:
      'With nominal H₂ (<1.0%), Ni-Fe plates rest at 28°C drawing 0 W while trace H₂ bounces elastically off moisture-covered fins.',
    camera: 'wide',
  },
  {
    state: 'TRIGGER',
    badgeClass: 'border-sky-500/50 bg-sky-950/40 text-sky-300',
    titleAr: '٢. نبضة التسخين الحثي (TRIGGER · Pin 8)',
    titleEn: '2. RF Induction Pre-Heat (TRIGGER · Pin 8)',
    descAr:
      'عند صعود الهيدروجين (≥1.0%) قبل وصول النيكل لـ١٥٠°م، يفعل TinyML المنفذ Pin 8 لتشغيل ملف الحث النحاسي (135 kHz) وتسخين الماتريكس بالتيارات الدوامية.',
    descEn:
      'When H₂ rises (≥1.0%) on cold plates (<150°C), TinyML triggers Pin 8 to energize the helical copper RF coil and eddy-heat the Ni-Fe matrix.',
    camera: 'coil',
  },
  {
    state: 'EXOTHERMIC',
    badgeClass: 'border-rose-500/50 bg-rose-950/40 text-rose-300',
    titleAr: '٣. اتحاد الهيدروجين الذاتي ≥150°م (EXOTHERMIC · Pin 7)',
    titleEn: '3. Exothermic Catalysis ≥150°C (EXOTHERMIC · Pin 7)',
    descAr:
      'بمجرد تخطي ١٥٠°م، يفصل Arduino ملف الحث (توفير >٩٢٪ طاقة) وتتحول جزيئات H₂ الخضراء عند تصادمها مع الماتريكس المتوهجة إلى بخار ماء H₂O أزرق وحرارة ذاتية.',
    descEn:
      'Above 150°C light-off, Pin 8 shuts OFF (>92% energy saved) and glowing Ni-Fe plates recombine 2H₂ + O₂ → 2H₂O steam + exothermic heat.',
    camera: 'fins',
  },
  {
    state: 'FAILSAFE',
    badgeClass: 'border-amber-500/50 bg-amber-950/40 text-amber-300',
    titleAr: '٤. حماية الطوارئ عند 4.5% LFL (FAILSAFE)',
    titleEn: '4. LFL Emergency Lockout ≥4.5% (FAILSAFE)',
    descAr:
      'إذا اقترب الغاز من حد الاشتعال (≥4.5%)، يفتح الأردوينو بوابة التنفيس العلوية ويعزل طاقة ملف الحث فوراً لمنع أي شرارة أو انفجار داخل الاحتواء.',
    descEn:
      'At ≥4.5% H₂ LFL breach, TinyML opens the upper relief damper and locks out RF heating power to eliminate ignition sources.',
    camera: 'exhaust',
  },
];

export const HowItWorksDrawer: React.FC<HowItWorksDrawerProps> = ({
  open,
  inputs,
  packet,
  activeState,
  diagnostics,
  selectedPart,
  onSelectComponent,
  onJumpStagePreview,
  canJumpStages,
  onClose,
}) => {
  const [tab, setTab] = useState<'components' | 'cycle'>('components');
  const [lang, setLang] = useState<'ar' | 'en'>('ar');

  if (!open) return null;

  return (
    <aside
      aria-label="Reactor Components and How It Works Guide"
      className="fixed top-[54px] left-3 bottom-3 z-30 flex w-[min(370px,93vw)] flex-col rounded-lg border border-[#24324D] bg-[#0B111E]/96 shadow-2xl overflow-hidden"
      data-testid="how-it-works-drawer"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#24324D] bg-[#111928] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-sky-400" aria-hidden="true" />
          <span className="text-xs font-semibold text-slate-100" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            {lang === 'ar' ? 'شرح المكونات وطريقة العمل' : 'Components & How It Works'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded border border-[#24324D] bg-[#070B13] p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => setLang('ar')}
              className={`rounded px-1.5 py-0.5 cursor-pointer ${
                lang === 'ar' ? 'bg-sky-900/70 text-sky-200 font-semibold' : 'text-slate-400'
              }`}
            >
              عربي
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`rounded px-1.5 py-0.5 cursor-pointer ${
                lang === 'en' ? 'bg-sky-900/70 text-sky-200 font-semibold' : 'text-slate-400'
              }`}
            >
              EN
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close How It Works guide"
            className="rounded p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 border-b border-[#24324D] bg-[#0F172A] p-1.5 text-xs">
        <button
          type="button"
          onClick={() => setTab('components')}
          className={`rounded py-1.5 font-medium transition-colors cursor-pointer ${
            tab === 'components'
              ? 'bg-[#1D2B44] text-sky-200'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {lang === 'ar' ? 'المكونات (٨ أجزاء)' : 'Components (8 Parts)'}
        </button>
        <button
          type="button"
          onClick={() => setTab('cycle')}
          className={`rounded py-1.5 font-medium transition-colors cursor-pointer ${
            tab === 'cycle'
              ? 'bg-[#1D2B44] text-sky-200'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {lang === 'ar' ? 'كيف يعمل؟ (٤ مراحل)' : 'How It Works (4 Stages)'}
        </button>
      </div>

      {/* Scrollable Content */}
      <div
        className="cad-scroll flex-1 overflow-y-auto p-3 space-y-2.5 text-xs"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        {tab === 'components' ? (
          <>
            <p className="text-[11px] text-slate-400 leading-snug">
              {lang === 'ar'
                ? 'اضغط على أي مكون لتوجيه الكاميرا ٣٦٠° إليه وإبراز دوره الفيزيائي مباشرة على المجسم:'
                : 'Click any subsystem below to glide the 3D camera directly to it and inspect live telemetry:'}
            </p>
            {ORDERED_PART_IDS.map((id) => {
              const part = PART_CATALOG[id];
              const isSelected = selectedPart === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectComponent(id, part.cameraPreset)}
                  className={`w-full text-start rounded-lg border p-2.5 transition-colors cursor-pointer space-y-1 ${
                    isSelected
                      ? 'border-sky-400 bg-sky-950/45 shadow-lg'
                      : 'border-[#22304A] bg-[#131C2E]/85 hover:border-sky-500/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sky-300">
                      {part.order}. {lang === 'ar' ? part.nameAr : part.nameEn}
                    </span>
                    <span className="rounded border border-[#24324D] bg-[#0B111E] px-1.5 py-0.5 text-[10px] text-slate-300 shrink-0">
                      {lang === 'ar' ? 'تقريب' : 'Focus'}
                    </span>
                  </div>
                  <div
                    className="font-mono-tabular text-[10px] text-emerald-400"
                    dir="ltr"
                  >
                    {part.getLiveMetric(inputs, packet, activeState, diagnostics)}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-200">
                    {lang === 'ar' ? part.roleAr : part.roleEn}
                  </p>
                </button>
              );
            })}
          </>
        ) : (
          <div className="space-y-2.5">
            <p className="text-[11px] text-slate-400 leading-snug">
              {lang === 'ar'
                ? 'دورة الحماية الهجينة من التسريب حتى التفاعل الذاتي وبخار الماء:'
                : 'Complete thermodynamic protection cycle from cold H₂ leak to steam recombination:'}
            </p>
            {WORKFLOW_STAGES.map((st) => {
              const isCurrent = activeState === st.state;
              return (
                <div
                  key={st.state}
                  className={`rounded-lg border p-3 space-y-2 ${
                    isCurrent
                      ? st.badgeClass
                      : 'border-[#22304A] bg-[#131C2E]/85 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs">
                      {lang === 'ar' ? st.titleAr : st.titleEn}
                    </span>
                    {canJumpStages && onJumpStagePreview && (
                      <button
                        type="button"
                        onClick={() => onJumpStagePreview(st.state)}
                        className="inline-flex items-center gap-1 rounded border border-sky-400/50 bg-[#0B111E] px-2 py-0.5 text-[10px] font-medium text-sky-200 hover:bg-sky-900/60 cursor-pointer shrink-0"
                      >
                        <PlayCircle className="h-3 w-3" aria-hidden="true" />
                        <span>{lang === 'ar' ? 'تجربة' : 'Test'}</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-200">
                    {lang === 'ar' ? st.descAr : st.descEn}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};

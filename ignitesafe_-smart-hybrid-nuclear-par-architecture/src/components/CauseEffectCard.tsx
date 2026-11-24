import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Cpu, Flame, Grid, ShieldAlert, ShieldCheck, Zap } from 'lucide-react';
import type { ParState, PhysicsDiagnostics, TelemetryInputs, TinyMlPacket } from '../sim/types';
import type { ModelAuthorityMode } from './ScientificMatrixPanel';

interface CauseEffectCardProps {
  inputs: TelemetryInputs;
  packet: TinyMlPacket;
  activeState: ParState;
  diagnostics: PhysicsDiagnostics;
  authorityMode: ModelAuthorityMode;
  serialConnected: boolean;
  awaitingArduino?: boolean;
  failsafeArmed: boolean;
  lastTxPayload: string;
  lastRxPayload: string;
  onOpenMatrixExplorer: () => void;
  visible: boolean;
}

export const CauseEffectCard: React.FC<CauseEffectCardProps> = ({
  inputs,
  packet,
  activeState,
  diagnostics,
  authorityMode,
  serialConnected,
  awaitingArduino = false,
  failsafeArmed,
  lastTxPayload,
  lastRxPayload,
  onOpenMatrixExplorer,
  visible,
}) => {
  const [collapsed, setCollapsed] = useState(true);
  const [lang, setLang] = useState<'ar' | 'en'>('ar');

  if (!visible) return null;

  const pin8White = activeState === 'TRIGGER' || activeState === 'FAILSAFE';
  const pin7Red =
    activeState === 'EXOTHERMIC' || activeState === 'FAILSAFE' || activeState === 'EXPLOSION';

  const votes = packet.treeVotes;
  const voteSummary = votes
    ? `[S:${votes[0]} T:${votes[1]} E:${votes[2]} F:${votes[3]}]`
    : `d=${packet.decision}`;

  const sourceTagAr = serialConnected
    ? 'الأردوينو الحقيقي (USB 9600)'
    : 'محاكي المتصفح (نفس كود الأردوينو بدون USB)';
  const sourceTagEn = serialConnected
    ? 'Live Arduino Uno (USB 9600)'
    : 'Browser Twin (Exact Arduino C++ · No USB)';

  const getNarrative = (): {
    badgeColor: string;
    causeTitle: string;
    causeText: string;
    decisionText: string;
    hardwareText: string;
    outcomeText: string;
  } => {
    if (awaitingArduino) {
      return lang === 'ar'
        ? {
            badgeColor: 'text-amber-300 border-amber-500/50 bg-amber-950/40',
            causeTitle: 'بانتظار رد Arduino Uno الحقيقي (بدون محاكاة بديلة)',
            causeText: `تم تجهيز قراءات الحساسات (H₂=${inputs.h2.toFixed(2)}% · T_s=${inputs.sTemp.toFixed(1)}°C) وإرسالها عبر المنفذ التسلسلي.`,
            decisionText: 'لم يصل رد JSON من الأردوينو بعد — لن يتم تشغيل أي قرار افتراضي.',
            hardwareText: 'تأكد من رفع كود الـ TinyML على البوردة والضغط على Ping RESET إذا استمر الانتظار.',
            outcomeText: 'بمجرد استلام رد الأردوينو سيستجيب المفاعل وملف الحث فوراً لقراراتك الحقيقية.',
          }
        : {
            badgeColor: 'text-amber-300 border-amber-500/50 bg-amber-950/40',
            causeTitle: 'Awaiting Physical Arduino JSON Reply',
            causeText: `Sensor telemetry (H₂=${inputs.h2.toFixed(2)}%, T_s=${inputs.sTemp.toFixed(1)}°C) queued for USB serial.`,
            decisionText: 'No JSON decision received yet — zero simulated fallback active.',
            hardwareText: 'Ensure TinyML sketch is flashed and press Ping RESET if board just rebooted.',
            outcomeText: 'Reactor heating and catalysis will follow real Arduino commands immediately upon receipt.',
          };
    }

    if (activeState === 'EXPLOSION') {
      return lang === 'ar'
        ? {
            badgeColor: 'text-red-400 border-red-500/50 bg-red-950/50',
            causeTitle: 'انفجار هيدروجيني (Deflagration)',
            causeText: `تجاوز تركيز الهيدروجين ${inputs.h2.toFixed(2)}% (فوق حد الاشتعال 4.0% LFL) مع وجود حرارة ${inputs.sTemp.toFixed(0)}°C أو شرارة الحث.`,
            decisionText:
              authorityMode === 'faulty_model'
                ? 'تم تشغيل نموذج معطل تجريبياً (Faulty ML) تجاهل تفعيل إغلاق الطوارئ FAILSAFE.'
                : 'تم تعطيل حماية الطوارئ يدوياً (Fail-Safe Cutoff OFF) فلم يتم فصل ملف الحث أو فتح التنفيس.',
            hardwareText: 'ملف RF أو الصفائح الساخنة تسببا في إشعال الخليط القابل للانفجار داخل المدخنة.',
            outcomeText: `ضغط انفجاري ~${diagnostics.potentialOverpressureKpa.toFixed(0)} kPa. فعّل Fail-Safe أو استخدم Browser Twin لمنع ذلك.`,
          }
        : {
            badgeColor: 'text-red-400 border-red-500/50 bg-red-950/50',
            causeTitle: 'Hydrogen Deflagration Event',
            causeText: `H₂ reached ${inputs.h2.toFixed(2)}% (above 4.0% LFL) in contact with ${inputs.sTemp.toFixed(0)}°C catalyst or active RF coil.`,
            decisionText:
              authorityMode === 'faulty_model'
                ? 'Faulty ML test mode bypassed the FAILSAFE cutoff rule.'
                : 'Manual Fail-Safe Cutoff interlock was bypassed, leaving ignition energy present.',
            hardwareText: 'Thermal hot-spot ignited the confined H₂-air mixture inside the chimney.',
            outcomeText: `Estimated overpressure ~${diagnostics.potentialOverpressureKpa.toFixed(0)} kPa. Keep Pin 7 Fail-Safe armed to prevent ignition.`,
          };
    }

    if (activeState === 'FAILSAFE') {
      return lang === 'ar'
        ? {
            badgeColor: 'text-amber-300 border-amber-500/50 bg-amber-950/40',
            causeTitle: 'وضع الطوارئ ومنع الانفجار (FAILSAFE)',
            causeText: `الهيدروجين اقترب أو تعدى حد الاشتعال (${inputs.h2.toFixed(2)}% H₂) ومعدل تغير ${inputs.rate.toFixed(2)} %/s.`,
            decisionText: `${sourceTagAr} أصدر القرار 3 (FAILSAFE) خلال ${packet.us} µs · تصويت الأشجار ${voteSummary}.`,
            hardwareText: 'Pin 8 الأبيض ON + Pin 7 الأحمر ON (إنذار طوارئ) + فتح بوابة التنفيس العلوية وفصل طاقة ملف RF.',
            outcomeText: failsafeArmed
              ? 'تم منع الانفجار تماماً بتصريف الغاز وعزل مصدر الحث.'
              : 'تحذير: بوابة الحماية معطلة يدوياً، استمرار الصعود سيؤدي لانفجار عند 5.2%!',
          }
        : {
            badgeColor: 'text-amber-300 border-amber-500/50 bg-amber-950/40',
            causeTitle: 'Emergency LFL Fail-Safe Cutoff',
            causeText: `Hydrogen reached ${inputs.h2.toFixed(2)}% (rate ${inputs.rate.toFixed(2)} %/s), entering the Shapiro flammability boundary.`,
            decisionText: `${sourceTagEn} emitted decision 3 (FAILSAFE) in ${packet.us} µs · Votes ${voteSummary}.`,
            hardwareText: 'Pin 8 White ON + Pin 7 Red ON (dual alarm), top damper opens, and RF induction heating locks out.',
            outcomeText: failsafeArmed
              ? 'Explosion prevented via passive pressure relief and ignition lockout.'
              : 'Warning: Hardware cutoff is bypassed; further H₂ rise risks deflagration at 5.2%!',
          };
    }

    if (activeState === 'EXOTHERMIC') {
      return lang === 'ar'
        ? {
            badgeColor: 'text-rose-300 border-rose-500/50 bg-rose-950/40',
            causeTitle: 'اتحاد ذاتي طارد للحرارة (EXOTHERMIC)',
            causeText: `تجاوزت حرارة صفائح النيكل ${inputs.sTemp.toFixed(1)}°C (فوق عتبة 150°C) مع وجود ${inputs.h2.toFixed(2)}% H₂.`,
            decisionText: `${sourceTagAr} أصدر القرار 2 (EXOTHERMIC) خلال ${packet.us} µs · ${voteSummary}.`,
            hardwareText: 'Pin 8 الأبيض OFF (فصل ملف RF لتوفير 92%+ طاقة) + Pin 7 الأحمر ON (توهج حراري ذاتي).',
            outcomeText: `الجزيئات تصطدم وتتحول لبخار ماء (${diagnostics.h2oProducedMgPerSec.toFixed(0)} mg/s H₂O) وتولد ${diagnostics.exothermicPowerW.toFixed(0)} W حرارة ذاتية.`,
          }
        : {
            badgeColor: 'text-rose-300 border-rose-500/50 bg-rose-950/40',
            causeTitle: 'Self-Sustaining Catalysis (EXOTHERMIC)',
            causeText: `Ni-Fe catalyst is at ${inputs.sTemp.toFixed(1)}°C (≥150°C light-off) with ${inputs.h2.toFixed(2)}% H₂ flowing.`,
            decisionText: `${sourceTagEn} selected decision 2 (EXOTHERMIC) in ${packet.us} µs · ${voteSummary}.`,
            hardwareText: 'Pin 8 White OFF (RF coil shut off to save >92% energy) · Pin 7 Red ON (active glowing fins).',
            outcomeText: `Active plate collisions convert H₂ → H₂O steam (${diagnostics.h2oProducedMgPerSec.toFixed(0)} mg/s) releasing ${diagnostics.exothermicPowerW.toFixed(0)} W.`,
          };
    }

    if (activeState === 'TRIGGER') {
      return lang === 'ar'
        ? {
            badgeColor: 'text-sky-300 border-sky-500/50 bg-sky-950/40',
            causeTitle: 'تسريب مبكر ونبضة حث (TRIGGER)',
            causeText: `رصد تسريب هيدروجين (${inputs.h2.toFixed(2)}%) بينما الصفائح باردة (${inputs.sTemp.toFixed(1)}°C < 150°C).`,
            decisionText: `${sourceTagAr} أصدر القرار 1 (TRIGGER) خلال ${packet.us} µs · ${voteSummary}.`,
            hardwareText: `Pin 8 الأبيض ON (تشغيل ملف الحث بقدرة ${diagnostics.rfInductionPowerW.toFixed(0)} W) · Pin 7 الأحمر OFF.`,
            outcomeText: 'التيارات الدوامية تسخن صفائح النيكل بسرعة لتجاوز حاجز الرطوبة والوصول إلى 150°C.',
          }
        : {
            badgeColor: 'text-sky-300 border-sky-500/50 bg-sky-950/40',
            causeTitle: 'RF Induction Pre-Heat Pulse (TRIGGER)',
            causeText: `Hydrogen leak detected (${inputs.h2.toFixed(2)}%) while Ni-Fe plates are still cold (${inputs.sTemp.toFixed(1)}°C < 150°C).`,
            decisionText: `${sourceTagEn} emitted decision 1 (TRIGGER) in ${packet.us} µs · ${voteSummary}.`,
            hardwareText: `Pin 8 White ON (RF coil energized at ${diagnostics.rfInductionPowerW.toFixed(0)} W) · Pin 7 Red OFF.`,
            outcomeText: 'Eddy currents rapidly heat the 8 Ni-Fe fins past 150°C to unlock catalytic recombination.',
          };
    }

    return lang === 'ar'
      ? {
          badgeColor: 'text-emerald-300 border-emerald-500/50 bg-emerald-950/40',
          causeTitle: 'وضع الاستعداد السلمي (SAFE)',
          causeText: `تركيز الهيدروجين منخفض (${inputs.h2.toFixed(2)}%) وصفائح النيكل عند ${inputs.sTemp.toFixed(1)}°C.`,
          decisionText: `${sourceTagAr} أصدر القرار 0 (SAFE) خلال ${packet.us} µs · ${voteSummary}.`,
          hardwareText: 'Pin 8 الأبيض OFF · Pin 7 الأحمر OFF (استهلاك صفر وات لملف الحث).',
          outcomeText: 'الجزيئات القليلة ترتد مرناً عن الصفائح الباردة (تأثير مثبطات الرطوبة) مع توفير 97.6% من الطاقة.',
        }
      : {
          badgeColor: 'text-emerald-300 border-emerald-500/50 bg-emerald-950/40',
          causeTitle: 'Zero-Watt Passive Standby (SAFE)',
          causeText: `Hydrogen is nominal (${inputs.h2.toFixed(2)}%) and catalyst plates sit at ${inputs.sTemp.toFixed(1)}°C.`,
          decisionText: `${sourceTagEn} emitted decision 0 (SAFE) in ${packet.us} µs · ${voteSummary}.`,
          hardwareText: 'Pin 8 White OFF · Pin 7 Red OFF (RF coil de-energized at zero standby draw).',
          outcomeText: 'Stray H₂ molecules bounce elastically off cold plates without wasting trace-heating power.',
        };
  };

  const info = getNarrative();

  return (
    <section
      aria-label="Live Process Cause and Response Guide"
      className="fixed top-[54px] left-3 z-20 hidden lg:flex w-[312px] flex-col rounded-lg border border-[#22304A] bg-[#0A0F1A]/94 shadow-2xl overflow-hidden"
      data-testid="cause-effect-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#22304A] bg-[#111928] px-3 py-2">
        <div className="flex items-center gap-1.5">
          {activeState === 'EXPLOSION' ? (
            <Flame className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
          ) : activeState === 'FAILSAFE' ? (
            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
          ) : activeState === 'TRIGGER' ? (
            <Zap className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
          )}
          <span className="text-[11px] font-semibold text-slate-100" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            {lang === 'ar' ? 'شرح الاستجابة وقرار الـ AI' : 'Live Cause & AI Decision'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <div className="inline-flex rounded border border-[#22304A] bg-[#0A0F1A] p-0.5 text-[10px]">
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
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand explanation card' : 'Collapse explanation card'}
            className="rounded p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div
          className="p-3 space-y-2 text-[11px] leading-relaxed"
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        >
          <div className={`rounded border px-2.5 py-1.5 font-semibold ${info.badgeColor}`}>
            {info.causeTitle}
          </div>

          <div className="space-y-1.5">
            <div className="rounded border border-[#1E2A42] bg-[#0E1525] p-2">
              <div className="text-[10px] font-semibold text-emerald-400">
                {lang === 'ar' ? '1. السبب الفيزيائي' : '1. Physical Condition'}
              </div>
              <p className="mt-0.5 text-slate-200">{info.causeText}</p>
            </div>

            <div className="rounded border border-[#1E2A42] bg-[#0E1525] p-2 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-semibold text-sky-300">
                <span className="inline-flex items-center gap-1">
                  <Cpu className="h-3 w-3" aria-hidden="true" />
                  {lang === 'ar' ? '2. قرار الذكاء الاصطناعي' : '2. AI Model Decision'}
                </span>
              </div>
              <p className="text-slate-200">{info.decisionText}</p>
              <div
                className="rounded border border-[#192338] bg-[#070B13] px-1.5 py-1 font-mono-tabular text-[10px] text-slate-300 space-y-0.5"
                dir="ltr"
              >
                <div className="truncate">
                  <span className="text-sky-400">TX </span>
                  {lastTxPayload}
                </div>
                <div className="truncate">
                  <span className="text-emerald-400">AI </span>
                  {lastRxPayload}
                </div>
              </div>
            </div>

            <div className="rounded border border-[#1E2A42] bg-[#0E1525] p-2">
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-300">
                <span>{lang === 'ar' ? '3. استجابة الأردوينو والمعدات' : '3. Hardware Response'}</span>
                <span className="font-mono-tabular text-[10px]" dir="ltr">
                  <span className={pin8White ? 'text-sky-200' : 'text-slate-500'}>
                    P8:{pin8White ? '1' : '0'}
                  </span>{' '}
                  <span className={pin7Red ? 'text-rose-400' : 'text-slate-500'}>
                    P7:{pin7Red ? '1' : '0'}
                  </span>
                </span>
              </div>
              <p className="mt-0.5 text-slate-200">{info.hardwareText}</p>
            </div>

            <div className="rounded border border-[#1E2A42] bg-[#0E1525] p-2">
              <div className="text-[10px] font-semibold text-amber-300">
                {lang === 'ar' ? '4. النتيجة الفيزيائية' : '4. Physical Outcome'}
              </div>
              <p className="mt-0.5 text-slate-300">{info.outcomeText}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenMatrixExplorer}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded border border-sky-500/50 bg-sky-950/50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-200 hover:bg-sky-900/60 cursor-pointer"
          >
            <Grid className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {lang === 'ar'
                ? 'فتح الماتريكس الكامل للشرح (Confusion & Rules)'
                : 'Open Full Matrix Presentation View'}
            </span>
          </button>
        </div>
      )}
    </section>
  );
};

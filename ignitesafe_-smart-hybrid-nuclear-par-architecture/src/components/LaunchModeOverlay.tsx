import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  ExternalLink,
  Plug,
  RefreshCw,
  Sliders,
  Video,
} from 'lucide-react';
import type { ArduinoVerificationStatus, OperationMode } from '../sim/types';
import { ArduinoSerialClient } from '../serial/webSerial';

interface LaunchModeOverlayProps {
  open: boolean;
  serialConnected: boolean;
  arduinoStatus: ArduinoVerificationStatus;
  serialErrorHint: string | null;
  lastRxPayload: string;
  onConnectArduino: () => void;
  onRetryHandshake: () => void;
  onStartArduinoMode: () => void;
  onStartStandaloneMode: (initialOpMode: OperationMode) => void;
}

export const LaunchModeOverlay: React.FC<LaunchModeOverlayProps> = ({
  open,
  serialConnected,
  arduinoStatus,
  serialErrorHint,
  lastRxPayload,
  onConnectArduino,
  onRetryHandshake,
  onStartArduinoMode,
  onStartStandaloneMode,
}) => {
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  if (!open) return null;

  const isIframe = ArduinoSerialClient.isIframeBlocked();
  const isVerified = serialConnected && arduinoStatus === 'verified';
  const isAwaiting = serialConnected && arduinoStatus !== 'verified';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#060A13]/82 p-4 overflow-y-auto"
      data-testid="launch-mode-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="launch-gate-title"
    >
      <div className="w-full max-w-4xl rounded-xl border border-[#24324D] bg-[#0B111E] shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#24324D] bg-[#111928] px-5 py-3.5">
          <div>
            <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-sky-400">
              IgniteSafe · Smart-Hybrid Nuclear PAR Architecture
            </div>
            <h1
              id="launch-gate-title"
              className="mt-0.5 text-lg font-semibold text-slate-100"
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
            >
              {lang === 'ar'
                ? 'اختر وضع التشغيل والاختبار قبل بدء المحاكاة'
                : 'Select Operation & Verification Mode'}
            </h1>
          </div>

          <div className="inline-flex whitespace-nowrap shrink-0 rounded border border-[#24324D] bg-[#070B13] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setLang('ar')}
              className={`rounded px-2.5 py-1 cursor-pointer ${
                lang === 'ar' ? 'bg-sky-900/70 text-sky-200 font-semibold' : 'text-slate-400'
              }`}
            >
              عربي
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`rounded px-2.5 py-1 cursor-pointer ${
                lang === 'en' ? 'bg-sky-900/70 text-sky-200 font-semibold' : 'text-slate-400'
              }`}
            >
              EN
            </button>
          </div>
        </div>

        {/* Body: 2 Strict Options */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5"
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        >
          {/* Option 1: Physical Arduino Hardware Only */}
          <div
            className={`flex flex-col justify-between rounded-lg border p-4 space-y-4 ${
              isVerified
                ? 'border-emerald-500/70 bg-emerald-950/20'
                : 'border-[#24324D] bg-[#0F172A]'
            }`}
            data-testid="launch-card-arduino"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-sky-300">
                  <Plug className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {lang === 'ar'
                      ? '١. التشغيل مع Arduino Uno الحقيقي (USB)'
                      : '1. Physical Arduino Uno Hardware (USB)'}
                  </span>
                </div>
                <span className="rounded border border-sky-500/40 bg-sky-950/60 px-2 py-0.5 font-mono-tabular text-[10px] text-sky-200">
                  9600 Baud
                </span>
              </div>

              <p className="text-xs leading-relaxed text-slate-300">
                {lang === 'ar'
                  ? 'اختبار حقيقي لنموذج الـ TinyML المرفوع على الأردوينو فقط — الموقع يرسل DATA وينتظر رد JSON الفعلي من البوردة ولا يشغل أي نموذج افتراضي بديل.'
                  : 'Strict hardware verification: the web console sends DATA packets and obeys ONLY real JSON responses from your Arduino Uno — zero simulated AI fallback.'}
              </p>

              {/* Handshake Status Box */}
              <div className="rounded border border-[#1E2A42] bg-[#070B13] p-2.5 text-[11px] space-y-1.5">
                {isVerified ? (
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {lang === 'ar'
                        ? 'تم التحقق من الاتصال واستلام رد JSON بنجاح!'
                        : 'Arduino Handshake Verified & Receiving JSON!'}
                    </span>
                  </div>
                ) : isAwaiting ? (
                  <div className="flex items-center gap-1.5 text-amber-300 font-medium">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden="true" />
                    <span>
                      {lang === 'ar'
                        ? 'المنفذ مفتوح — جاري انتظار رد JSON بعد إقلاع الأردوينو...'
                        : 'USB port open — waiting for Arduino JSON reply...'}
                    </span>
                  </div>
                ) : (
                  <div className="text-slate-400">
                    {lang === 'ar'
                      ? 'الحالة: غير متصل. تأكد من إغلاق Serial Monitor في Arduino IDE ثم اضغط اتصال.'
                      : 'Status: Not connected. Close Arduino IDE Serial Monitor before connecting.'}
                  </div>
                )}

                {isVerified && (
                  <div className="font-mono-tabular text-[10px] text-emerald-300 truncate" dir="ltr">
                    RX: {lastRxPayload}
                  </div>
                )}

                {serialErrorHint && (
                  <div className="flex items-start gap-1.5 text-rose-300 text-[11px] pt-1">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{serialErrorHint}</span>
                  </div>
                )}
              </div>

              {isIframe && (
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-300 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {lang === 'ar'
                      ? 'ملاحظة: إذا منع الإطار المدمج منفذ USB، افتح الصفحة في تبويب مستقل'
                      : 'If iframe blocks Web Serial, open in a full Chrome/Edge tab'}
                  </span>
                </a>
              )}
            </div>

            <div className="space-y-2 pt-2">
              {!serialConnected ? (
                <button
                  type="button"
                  onClick={onConnectArduino}
                  data-testid="launch-connect-arduino-btn"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-sky-400/70 bg-sky-950/70 px-3.5 py-2.5 text-xs font-semibold text-sky-100 hover:bg-sky-900/80 transition-colors cursor-pointer"
                >
                  <Plug className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {lang === 'ar'
                      ? 'توصيل Arduino Uno والتحقق من الرد'
                      : 'Connect Arduino Uno & Verify Link'}
                  </span>
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={onStartArduinoMode}
                    data-testid="launch-enter-arduino-btn"
                    className={`w-full inline-flex items-center justify-center gap-2 rounded-md border px-3.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                      isVerified
                        ? 'border-emerald-400 bg-emerald-900/60 text-emerald-100 hover:bg-emerald-800/70'
                        : 'border-amber-400/70 bg-amber-950/60 text-amber-100 hover:bg-amber-900/70'
                    }`}
                  >
                    <Sliders className="h-4 w-4" aria-hidden="true" />
                    <span>
                      {isVerified
                        ? lang === 'ar'
                          ? 'دخول الاختبار اليدوي مع الأردوينو ✅'
                          : 'Start Hardware Testing ✅'
                        : lang === 'ar'
                        ? 'دخول وضع الأردوينو (بانتظار أول رد JSON)'
                        : 'Enter Arduino Mode (Awaiting JSON)'}
                    </span>
                  </button>

                  {!isVerified && (
                    <button
                      type="button"
                      onClick={onRetryHandshake}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded border border-[#24324D] bg-[#0B111E] px-3 py-1.5 text-[11px] font-medium text-slate-300 hover:text-white cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {lang === 'ar'
                          ? 'إعادة إرسال أمر RESET لفحص الاستجابة'
                          : 'Retry Handshake (Send RESET)'}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Option 2: Standalone Software Twin (No Arduino) */}
          <div
            className="flex flex-col justify-between rounded-lg border border-[#24324D] bg-[#0F172A] p-4 space-y-4"
            data-testid="launch-card-standalone"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  <Cpu className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {lang === 'ar'
                      ? '٢. التشغيل بدون أردوينو (محاكاة مستقلة)'
                      : '2. Run Without Arduino (Software Twin)'}
                  </span>
                </div>
                <span className="whitespace-nowrap shrink-0 rounded border border-emerald-500/40 bg-emerald-950/60 px-2 py-0.5 font-mono-tabular text-[10px] text-emerald-200">
                  5-Tree RF
                </span>
              </div>

              <p className="text-xs leading-relaxed text-slate-300">
                {lang === 'ar'
                  ? 'يشغّل نسخة متطابقة ١٠٠٪ من نموذج Eloquent RandomForest المبرمج بلغة C++ داخل المتصفح، مع محاكاة فيزيائية كاملة للتسخين الحثي وتفاعل النيكل وبخار الماء.'
                  : 'Runs an exact 1:1 port of the 5-tree Arduino RandomForest classifier directly in-browser with full ODE thermodynamics, RF heating, and catalytic H₂→H₂O conversion.'}
              </p>

              <div className="rounded border border-[#1E2A42] bg-[#070B13] p-2.5 text-[11px] text-slate-300 space-y-1">
                <div>
                  {lang === 'ar'
                    ? '• العرض السينمائي (24s): يشرح دورة التسريب والتسخين والتفاعل والطرد أوتوماتيكياً.'
                    : '• Auto Cinematic (24s): Narrated full-cycle demonstration.'}
                </div>
                <div>
                  {lang === 'ar'
                    ? '• التحكم اليدوي: رفع تركيز H₂ يدوياً لرؤية استجابة النموذج أو اختبار الانفجار عند تعطيل الحماية.'
                    : '• Manual Sandbox: Inject H₂ manually or bypass Fail-Safe to test deflagration.'}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => onStartStandaloneMode('cinematic')}
                data-testid="launch-standalone-cinematic-btn"
                className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-emerald-500/60 bg-emerald-950/60 px-3.5 py-2.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/70 transition-colors cursor-pointer"
              >
                <Video className="h-4 w-4" aria-hidden="true" />
                <span>
                  {lang === 'ar'
                    ? 'بدء العرض السينمائي التوضيحي (Auto 24s)'
                    : 'Start Auto Cinematic Demo (24s)'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onStartStandaloneMode('manual')}
                data-testid="launch-standalone-manual-btn"
                className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-[#2C3C5B] bg-[#131C2E] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/60 hover:text-white transition-colors cursor-pointer"
              >
                <Sliders className="h-4 w-4" aria-hidden="true" />
                <span>
                  {lang === 'ar'
                    ? 'دخول الاختبار اليدوي التفاعلي (Manual Sandbox)'
                    : 'Start Manual Physics Sandbox'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

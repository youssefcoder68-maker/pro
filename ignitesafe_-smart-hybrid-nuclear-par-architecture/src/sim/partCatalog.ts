import type {
  CameraPresetId,
  ParState,
  PartInspectorId,
  PhysicsDiagnostics,
  TelemetryInputs,
  TinyMlPacket,
} from './types';

export interface PartDescriptor {
  id: PartInspectorId;
  order: number;
  cameraPreset: Exclude<CameraPresetId, 'auto'>;
  nameEn: string;
  nameAr: string;
  material: string;
  roleEn: string;
  roleAr: string;
  getLiveMetric: (
    inputs: TelemetryInputs,
    packet: TinyMlPacket,
    state: ParState,
    diag: PhysicsDiagnostics
  ) => string;
}

export const PART_CATALOG: Record<PartInspectorId, PartDescriptor> = {
  gas_manifold: {
    id: 'gas_manifold',
    order: 1,
    cameraPreset: 'intake',
    nameEn: 'H₂ Supply Manifold & Valve',
    nameAr: 'صمام وخط إمداد غاز الهيدروجين',
    material: '316L Stainless Steel · Mass Flow Inlet',
    roleEn: 'Meters containment hydrogen gas mixture into the lower perforated PAR sparger ring.',
    roleAr: 'ينظم تدفق غاز الهيدروجين المتسرب ويدفعه إلى حلقة التوزيع السفلية داخل المفاعل.',
    getLiveMetric: (inputs) =>
      `H₂: ${inputs.h2.toFixed(2)}% · Rate: ${inputs.rate >= 0 ? '+' : ''}${inputs.rate.toFixed(2)} %/s`,
  },
  h2_intake: {
    id: 'h2_intake',
    order: 2,
    cameraPreset: 'intake',
    nameEn: 'Perforated H₂ Sparger & Intake Plenum',
    nameAr: 'حلقة حقن الهيدروجين السفلية (جزيئات H₂ الخضراء)',
    material: '12-Nozzle Machined Steel Sparger · Natural Draft',
    roleEn: 'Releases buoyant emerald H₂ spheres upward directly into the channels between the 8 Ni-Fe catalyst plates.',
    roleAr: 'تطلق فقاعات الهيدروجين الخضراء صعوداً بالحمل الحراري الطبيعي بين ألواح الحفاز الثمانية.',
    getLiveMetric: (inputs, _p, _s, diag) =>
      `Inlet H₂: ${inputs.h2.toFixed(2)}% · Draft: ${diag.chimneyDraftVelocityMs.toFixed(2)} m/s`,
  },
  nickel_plates: {
    id: 'nickel_plates',
    order: 3,
    cameraPreset: 'fins',
    nameEn: '8× Nickel-Iron Catalyst Matrix',
    nameAr: 'ماتريكس ألواح النيكل-حديد الحفازة (٨ شرائح)',
    material: 'Perforated Ni-Fe-Pt Alloy · Alumina Ceramic Comb Racks',
    roleEn:
      'Cold (<150°C): moisture inhibits sites so H₂ bounces off elastically. Hot (≥150°C): glowing matrix catalyzes 2H₂ + O₂ → 2H₂O + heat.',
    roleAr:
      'تحت ١٥٠°م تعيق الرطوبة التفاعل فترتد الجزيئات. عند ≥١٥٠°م تتوهج الماتريكس وتتفاعل الجزيئات لتنتج بخار ماء وحرارة ذاتية.',
    getLiveMetric: (inputs, _p, _s, diag) =>
      `${inputs.sTemp.toFixed(1)} °C · Activity η=${diag.surfaceActivationFactor.toFixed(2)} · ${diag.recombinationRatePctPerSec.toFixed(2)} %/s`,
  },
  copper_coil: {
    id: 'copper_coil',
    order: 4,
    cameraPreset: 'coil',
    nameEn: 'Helical Copper RF Induction Coil',
    nameAr: 'ملف الحث المغناطيسي النحاسي (135 kHz)',
    material: '7.5-Turn Oxygen-Free Copper Helix · Ceramic Standoffs',
    roleEn:
      'Energizes on Pin 8 (TRIGGER) to eddy-heat the Ni-Fe matrix past 150°C rapidly, then shuts OFF to save >92% energy.',
    roleAr:
      'يعمل عند تفعيل Pin 8 لتوليد تيارات دوامية تسخن النيكل بسرعة فوق ١٥٠°م، ثم ينفصل أوتوماتيكياً لتوفير أكثر من ٩٢٪ من الطاقة.',
    getLiveMetric: (_i, _p, state, diag) =>
      state === 'TRIGGER'
        ? `ACTIVE · ${diag.rfInductionPowerW.toFixed(1)} W (RF Field ON)`
        : state === 'FAILSAFE'
        ? 'LOCKED OUT · 0.0 W (Fail-Safe Cutoff)'
        : 'STANDBY · 0.0 W (Zero Draw)',
  },
  quartz_window: {
    id: 'quartz_window',
    order: 5,
    cameraPreset: 'wide',
    nameEn: 'Cutaway Borosilicate Quartz Cylinder',
    nameAr: 'أسطوانة الكوارتز الحراري الشفافة',
    material: 'Fused Silica Optical Vessel · Titanium Tie-Rods',
    roleEn:
      '360° optical cutaway housing isolating the catalytic reaction while displaying live H₂→H₂O conversion inside.',
    roleAr:
      'غلاف كوارتز شفاف يتيح رؤية الماتريكس وتصادم الجزيئات وتحول الهيدروجين إلى بخار ماء بوضوح كامل.',
    getLiveMetric: (inputs) => `Box Ambient: ${inputs.bTemp.toFixed(1)} °C`,
  },
  tinyml_box: {
    id: 'tinyml_box',
    order: 6,
    cameraPreset: 'arduino',
    nameEn: 'Arduino Uno & TinyML Controller',
    nameAr: 'وحدة Arduino Uno والذكاء الاصطناعي (TinyML)',
    material: 'Open-Front Industrial Enclosure · USB 9600 · Pin 8 & Pin 7 LEDs',
    roleEn:
      'Runs 5-tree Eloquent RandomForest (~44 µs): Pin 8 White LED drives RF Pulse; Pin 7 Red LED signals Exothermic (≥150°C) or Fail-Safe.',
    roleAr:
      'ينفذ نموذج RandomForest (٥ أشجار قرار) خلال ٤٤ ميكروثانية: Pin 8 الأبيض لملف الحث، وPin 7 الأحمر للحرارة الذاتية والطوارئ.',
    getLiveMetric: (_i, packet, state) =>
      `${state} · Dec=${packet.decision} · P8=${state === 'TRIGGER' || state === 'FAILSAFE' ? 1 : 0} · P7=${state === 'EXOTHERMIC' || state === 'FAILSAFE' ? 1 : 0} · ${packet.us} µs`,
  },
  h2o_exhaust: {
    id: 'h2o_exhaust',
    order: 7,
    cameraPreset: 'exhaust',
    nameEn: 'Conical Diffuser & Glass Steam Chimney',
    nameAr: 'قمع الطرد والمدخنة الزجاجية لبخار الماء',
    material: '316L Diffuser Cone · Borosilicate Stack · Thermocouple',
    roleEn:
      'Channels hot recombined H₂O vapor upward by natural buoyancy, sustaining air draw without pumps or fans.',
    roleAr:
      'توجه بخار الماء الآمن الناتج عن التفاعل للأعلى بالسحب الحراري الطبيعي دون مراوح أو مضخات.',
    getLiveMetric: (_i, _p, _s, diag) =>
      `H₂O Out: ${diag.h2oProducedMgPerSec.toFixed(1)} mg/s · Draft ${diag.chimneyDraftVelocityMs.toFixed(2)} m/s`,
  },
  failsafe_damper: {
    id: 'failsafe_damper',
    order: 8,
    cameraPreset: 'exhaust',
    nameEn: 'Fail-Safe Pressure Relief Damper',
    nameAr: 'بوابة تنفيس الأمان للطوارئ (≥ 4.5% LFL)',
    material: 'Actuated Stainless Relief Flap · Pin 7 Interlock',
    roleEn:
      'Swings open automatically when H₂ breaches 4.5% LFL while locking out RF power to prevent deflagration.',
    roleAr:
      'تفتح فوراً عند وصول تركيز الهيدروجين إلى ٤.٥٪ مع فصل ملف الحث لمنع حدوث انفجار.',
    getLiveMetric: (_i, _p, state) =>
      state === 'FAILSAFE' || state === 'EXPLOSION' ? 'OPEN · VENTING ACTIVE' : 'SEALED · NOMINAL',
  },
};

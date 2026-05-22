export interface OrderSetMedication {
  nameAr: string;
  nameEn: string;
  genericName: string;
  form: string;
  strength: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string;
}

export interface OrderSetLab {
  nameAr: string;
  nameEn: string;
  loincCode: string;
  cptCode: string;
  normalRange: string;
  unit: string;
  priority: "routine" | "urgent" | "stat";
  instructions: string;
}

export interface OrderSetRadiology {
  procedureNameAr: string;
  procedureNameEn: string;
  cptCode: string;
  priority: "routine" | "urgent" | "stat";
  clinicalNotes: string;
}

export interface OrderSet {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  medications: OrderSetMedication[];
  labs: OrderSetLab[];
  radiology: OrderSetRadiology[];
}

export const ORDER_SETS: OrderSet[] = [
  {
    id: "pneumonia-protocol",
    nameAr: "بروتوكول علاج الالتهاب الرئوي",
    nameEn: "Pneumonia Treatment Protocol",
    descriptionAr: "بروتوكول شامل لعلاج حالات الالتهاب الرئوي المكتسب من المجتمع، ويشمل الفحوصات الأساسية، المضادات الحيوية، وخافض الحرارة.",
    descriptionEn: "Comprehensive protocol for community-acquired pneumonia (CAP), including essential labs, empiric dual antibiotic therapy, and antipyretics.",
    medications: [
      {
        nameAr: "أموكسيسيلين + حمض الكلافولانيك ١ جرام قرص",
        nameEn: "Amoxicillin / Clavulanate 1g Tablet",
        genericName: "Amoxicillin + Clavulanate",
        form: "tablet",
        strength: "1g",
        dosage: "1 tablet",
        frequency: "twice daily",
        durationDays: 7,
        instructions: "Take after meals. Complete the full 7-day course."
      },
      {
        nameAr: "أزيثرومايسين ٥٠٠ مجم قرص",
        nameEn: "Azithromycin 500mg Tablet",
        genericName: "Azithromycin",
        form: "tablet",
        strength: "500mg",
        dosage: "1 tablet",
        frequency: "once daily",
        durationDays: 3,
        instructions: "Take 1 hour before or 2 hours after meals."
      },
      {
        nameAr: "باراسيتامول ٥٠٠ مجم قرص",
        nameEn: "Paracetamol 500mg Tablet",
        genericName: "Paracetamol",
        form: "tablet",
        strength: "500mg",
        dosage: "1-2 tablets",
        frequency: "every 6 hours as needed for fever",
        durationDays: 5,
        instructions: "Do not exceed 4g (8 tablets) in 24 hours. For fever and pain."
      }
    ],
    labs: [
      {
        nameAr: "صورة دم كاملة (CBC)",
        nameEn: "Complete Blood Count (CBC)",
        loincCode: "6690-2",
        cptCode: "85025",
        normalRange: "WBC: 4.0-11.0 x10^9/L, Hb: 12.0-16.0 g/dL",
        unit: "Various",
        priority: "routine",
        instructions: "Evaluate for leukocytosis, left shift, and anemia."
      },
      {
        nameAr: "نيتروجين يوريا الدم (BUN)",
        nameEn: "Blood Urea Nitrogen (BUN)",
        loincCode: "3094-0",
        cptCode: "84520",
        normalRange: "7-20 mg/dL",
        unit: "mg/dL",
        priority: "routine",
        instructions: "Assess renal function as part of CURB-65 pneumonia severity scoring."
      },
      {
        nameAr: "البروتين التفاعلي C النشط (CRP)",
        nameEn: "C-Reactive Protein (CRP)",
        loincCode: "1988-5",
        cptCode: "86140",
        normalRange: "< 5.0 mg/L",
        unit: "mg/L",
        priority: "routine",
        instructions: "Baseline inflammatory marker to monitor therapy response."
      },
      {
        nameAr: "مزرعة وحساسية دم",
        nameEn: "Blood Culture & Sensitivity",
        loincCode: "2532-0",
        cptCode: "87040",
        normalRange: "No growth",
        unit: "N/A",
        priority: "urgent",
        instructions: "Draw from two separate sites prior to first dose of systemic antibiotics."
      }
    ],
    radiology: [
      {
        procedureNameAr: "أشعة عادية على الصدر (امامي خلفي وجانبي)",
        procedureNameEn: "Chest X-Ray PA and Lateral View",
        cptCode: "71046",
        priority: "urgent",
        clinicalNotes: "Diagnose and evaluate lobar consolidation, pleural effusion, or multi-lobar infiltrates."
      }
    ]
  },
  {
    id: "acute-chest-pain-protocol",
    nameAr: "بروتوكول آلام الصدر الحادة",
    nameEn: "Acute Chest Pain Protocol",
    descriptionAr: "مسار رعاية طارئ وسريع لمرضى آلام الصدر لتقييم واختبار متلازمة الشريان التاجي الحادة (ACS) واستبعاد النوبة القلبية.",
    descriptionEn: "Emergency care pathway for patients presenting with chest pain to rapidly assess and rule out Acute Coronary Syndrome (ACS).",
    medications: [
      {
        nameAr: "أسبرين أطفال ٨١ مجم قرص مضغ",
        nameEn: "Aspirin 81mg Chewable Tablet",
        genericName: "Aspirin",
        form: "tablet",
        strength: "81mg",
        dosage: "4 tablets",
        frequency: "chew immediately once",
        durationDays: 1,
        instructions: "Chew completely before swallowing for rapid platelet inhibition."
      },
      {
        nameAr: "نيتروجليسرين ٠.٤ مجم تحت اللسان",
        nameEn: "Nitroglycerin 0.4mg Sublingual Tablet",
        genericName: "Nitroglycerin",
        form: "tablet",
        strength: "0.4mg",
        dosage: "1 tablet",
        frequency: "every 5 minutes as needed for chest pain (max 3 doses)",
        durationDays: 1,
        instructions: "Place under tongue. Keep patient seated. Call emergency staff if pain persists after 3 doses."
      },
      {
        nameAr: "كلوبيدوجريل ٧٥ مجم قرص",
        nameEn: "Clopidogrel 75mg Tablet",
        genericName: "Clopidogrel",
        form: "tablet",
        strength: "75mg",
        dosage: "4 tablets",
        frequency: "take immediately once (300mg loading dose)",
        durationDays: 1,
        instructions: "Loading dose for antiplatelet synergy. Take immediately."
      }
    ],
    labs: [
      {
        nameAr: "تحليل تروبونين قلبي نوع I عالي الحساسية",
        nameEn: "High-Sensitivity Cardiac Troponin I (hs-cTnI)",
        loincCode: "10839-9",
        cptCode: "84484",
        normalRange: "< 14 ng/L",
        unit: "ng/L",
        priority: "stat",
        instructions: "STAT cardiac biomarker. Repeat in 1-3 hours if clinically indicated."
      },
      {
        nameAr: "تحليل إنزيم عضلة القلب (CK-MB)",
        nameEn: "Creatine Kinase-MB (CK-MB)",
        loincCode: "13969-1",
        cptCode: "82550",
        normalRange: "< 5.0 ng/mL",
        unit: "ng/mL",
        priority: "stat",
        instructions: "Evaluate myocardial injury and necrosis."
      },
      {
        nameAr: "صورة دم كاملة (CBC)",
        nameEn: "Complete Blood Count (CBC)",
        loincCode: "6690-2",
        cptCode: "85025",
        normalRange: "WBC: 4.0-11.0 x10^9/L, Hb: 12.0-16.0 g/dL",
        unit: "Various",
        priority: "urgent",
        instructions: "Rule out severe anemia or leukocytosis triggering ischemic symptoms."
      },
      {
        nameAr: "تحليل كيميائي شامل (CMP)",
        nameEn: "Comprehensive Metabolic Panel (CMP)",
        loincCode: "2986-0",
        cptCode: "80053",
        normalRange: "Normal electrolytes and organ function parameters",
        unit: "Various",
        priority: "urgent",
        instructions: "Determine baseline electrolytes, renal, and hepatic metrics before interventions."
      }
    ],
    radiology: [
      {
        procedureNameAr: "رسم قلب كهربائي ١٢ قناة (ECG)",
        procedureNameEn: "Electrocardiogram 12-lead (ECG)",
        cptCode: "93000",
        priority: "stat",
        clinicalNotes: "Rule out ST-elevation myocardial infarction (STEMI) or new-onset LBBB."
      },
      {
        procedureNameAr: "أشعة عادية على الصدر (امامي خلفي وجانبي)",
        procedureNameEn: "Chest X-Ray PA and Lateral View",
        cptCode: "71046",
        priority: "urgent",
        clinicalNotes: "Evaluate for non-cardiac chest pain etiologies (pneumothorax, pneumonia) and cardiomegaly."
      }
    ]
  },
  {
    id: "post-op-routine-care-protocol",
    nameAr: "رعاية ما بعد الجراحة الروتينية",
    nameEn: "Post-Op Routine Care Protocol",
    descriptionAr: "بروتوكول عام لرعاية ومتابعة المريض مباشرة في الجناح بعد العمليات الجراحية العامة لتوفير السوائل، تسكين الألم، وفحص النزيف.",
    descriptionEn: "Standardized post-operative ward routine to manage intravenous hydration, direct analgesia, and monitor for acute post-surgical complications.",
    medications: [
      {
        nameAr: "محلول ملح متوازن ٠.٩٪ وريدي ٥٠٠ مل",
        nameEn: "Normal Saline 0.9% IV Infusion 500mL",
        genericName: "Normal Saline 0.9%",
        form: "injection",
        strength: "500mL",
        dosage: "500mL",
        frequency: "Run at 100mL/hour intravenously",
        durationDays: 1,
        instructions: "Maintain active IV line and support basic hydration. Monitor urine output."
      },
      {
        nameAr: "باراسيتامول حقن وريدي ١ جرام / ١٠٠ مل",
        nameEn: "Paracetamol IV Infusion 1g/100mL",
        genericName: "Paracetamol IV",
        form: "injection",
        strength: "1g/100mL",
        dosage: "1g IV",
        frequency: "every 8 hours",
        durationDays: 3,
        instructions: "Infuse slowly over 15 minutes. High-impact baseline non-opioid pain control."
      },
      {
        nameAr: "إيبوبروفين ٤٠٠ مجم قرص",
        nameEn: "Ibuprofen 400mg Tablet",
        genericName: "Ibuprofen",
        form: "tablet",
        strength: "400mg",
        dosage: "1 tablet",
        frequency: "three times daily after food as needed",
        durationDays: 5,
        instructions: "Take with or after food. Discontinue if gastrointestinal distress occurs."
      }
    ],
    labs: [
      {
        nameAr: "قياس نسبة الهيموجلوبين في الدم (Hb)",
        nameEn: "Hemoglobin Measurement (Hb)",
        loincCode: "718-7",
        cptCode: "85018",
        normalRange: "Male: 13.5-17.5 g/dL, Female: 12.0-15.5 g/dL",
        unit: "g/dL",
        priority: "urgent",
        instructions: "Assess for acute post-operative hemorrhage or hidden bleeding."
      },
      {
        nameAr: "صورة دم كاملة (CBC)",
        nameEn: "Complete Blood Count (CBC)",
        loincCode: "6690-2",
        cptCode: "85025",
        normalRange: "WBC: 4.0-11.0 x10^9/L, Hb: 12.0-16.0 g/dL",
        unit: "Various",
        priority: "routine",
        instructions: "Verify leukocyte counts to monitor for early signs of surgical site infection."
      }
    ],
    radiology: []
  }
];

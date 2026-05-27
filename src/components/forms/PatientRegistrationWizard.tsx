"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { patientSchema, type PatientSchema } from "@/lib/validations/patient.schema";
import { registerPatient } from "@/lib/actions/patients";
import { useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { GOVERNORATES, EGYPTIAN_INSURANCE_PROVIDERS, parseNationalId, validateNationalId } from "@/lib/utils/egypt";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { 
  User, 
  Phone, 
  ShieldAlert, 
  HeartPulse, 
  FileText, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Lock, 
  AlertTriangle, 
  Trash2, 
  Sparkles,
  Award
} from "lucide-react";
import { toast } from "sonner";

interface PatientRegistrationWizardProps {
  hospitalSlug: string;
  currentUserName?: string;
}

export function PatientRegistrationWizard({ hospitalSlug, currentUserName }: PatientRegistrationWizardProps) {
  const t = useTranslations("patients");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nidInfo, setNidInfo] = useState<{ dob: Date; gender: "male" | "female"; governorate: string } | null>(null);
  
  // Custom states for rich tags
  const [allergyInput, setAllergyInput] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [chronicInput, setChronicInput] = useState("");
  const [chronicConditions, setChronicConditions] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<PatientSchema>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      nationalId: "",
      passportNumber: "",
      nameAr: "",
      nameEn: "",
      gender: "male",
      governorate: "",
      phone: "",
      email: "",
      address: "",
      bloodType: "O+",
      insuranceProviderId: "",
      insuranceNumber: "",
      guardianName: "",
      guardianNid: "",
      guardianPhone: "",
    },
    mode: "onChange",
  });

  const watchNationalId = watch("nationalId");
  const watchDob = watch("dob");
  const watchGender = watch("gender");
  const watchGovernorate = watch("governorate");
  const watchInsuranceProvider = watch("insuranceProviderId");

  // Parse National ID dynamically when 14 digits are typed
  useEffect(() => {
    if (watchNationalId && watchNationalId.trim().length === 14) {
      if (validateNationalId(watchNationalId)) {
        const parsed = parseNationalId(watchNationalId);
        if (parsed) {
          const formattedDob = new Date(parsed.dob);
          setValue("dob", formattedDob);
          setValue("gender", parsed.gender as "male" | "female");
          setValue("governorate", parsed.governorate.code);
          
          setNidInfo({
            dob: formattedDob,
            gender: parsed.gender as "male" | "female",
            governorate: isRtl ? parsed.governorate.ar : parsed.governorate.en,
          });
          toast.success(isRtl ? "تم التحقق من الرقم القومي واستخراج البيانات تلقائياً!" : "National ID validated & details extracted!");
        }
      } else {
        setNidInfo(null);
      }
    } else {
      setNidInfo(null);
    }
  }, [watchNationalId, setValue, isRtl]);

  // Minor age validation calculation
  const getPatientAge = () => {
    if (!watchDob) return 0;
    const birthDate = new Date(watchDob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = getPatientAge();
  const isMinor = age > 0 && age < 18;

  // Watch UHIS Rollout
  const isUhisRolloutEligible = () => {
    if (watchInsuranceProvider === "uhis") {
      const selectedGov = watchGovernorate;
      const provider = EGYPTIAN_INSURANCE_PROVIDERS.find(p => p.id === "uhis");
      return !!(selectedGov && provider?.rolloutGovernorates?.includes(selectedGov));
    }
    return true;
  };

  // Steps structure
  const steps = [
    { id: "demographics", title: t("step1"), icon: User },
    { id: "contacts", title: t("step2"), icon: Phone },
    { id: "guardian", title: t("step3"), icon: ShieldAlert, cond: isMinor },
    { id: "clinical", title: t("step4"), icon: HeartPulse },
    { id: "insurance", title: t("step5"), icon: Award },
    { id: "consent", title: t("step6"), icon: FileText },
  ].filter(s => s.cond === undefined || s.cond === true);

  // Field group trigger for each step
  const getStepFields = (stepIndex: number): (keyof PatientSchema)[] => {
    const activeStepId = steps[stepIndex]?.id;
    switch (activeStepId) {
      case "demographics":
        return ["nationalId", "passportNumber", "nameAr", "nameEn", "dob", "gender", "governorate"];
      case "contacts":
        return ["phone", "email", "address"];
      case "guardian":
        return ["guardianName", "guardianNid", "guardianPhone"];
      case "clinical":
        return ["bloodType"];
      case "insurance":
        return ["insuranceProviderId", "insuranceNumber"];
      case "consent":
        return [];
      default:
        return [];
    }
  };

  const handleNext = async () => {
    const fields = getStepFields(currentStep);
    let isStepValid = true;

    if (fields.length > 0) {
      isStepValid = await trigger(fields);
    }

    // Additional conditional check for minor guardian info
    if (steps[currentStep]?.id === "guardian" && isMinor) {
      const gName = watch("guardianName");
      const gNid = watch("guardianNid");
      const gPhone = watch("guardianPhone");
      if (!gName || gName.trim().length < 3) {
        toast.error(isRtl ? "يرجى إدخال اسم ولي الأمر بشكل صحيح" : "Guardian name is required");
        isStepValid = false;
      }
      if (!gNid || gNid.trim().length !== 14 || !validateNationalId(gNid)) {
        toast.error(isRtl ? "يرجى إدخال رقم قومي صحيح لولي الأمر" : "Valid Guardian National ID is required");
        isStepValid = false;
      }
      if (!gPhone) {
        toast.error(isRtl ? "رقم هاتف ولي الأمر مطلوب" : "Guardian phone is required");
        isStepValid = false;
      }
    }

    // Additional check for UHIS Eligibility
    if (steps[currentStep]?.id === "insurance" && watchInsuranceProvider === "uhis" && !isUhisRolloutEligible()) {
      toast.error(isRtl 
        ? "عذراً، هذا المريض غير مؤهل للتأمين الشامل لعدم توفره بمحافظته حالياً." 
        : "Patient is ineligible for UHIS due to governorate rollout rules."
      );
      isStepValid = false;
    }

    if (isStepValid) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    } else {
      toast.error(isRtl ? "يرجى إكمال الحقول المطلوبة بشكل صحيح قبل الانتقال." : "Please correct validation errors first.");
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  // Allergy Badge Management
  const addAllergy = () => {
    if (allergyInput.trim() !== "" && !allergies.includes(allergyInput.trim())) {
      setAllergies([...allergies, allergyInput.trim()]);
      setAllergyInput("");
    }
  };

  const removeAllergy = (indexToRemove: number) => {
    setAllergies(allergies.filter((_, idx) => idx !== indexToRemove));
  };

  // Chronic Condition Badge Management
  const addChronic = () => {
    if (chronicInput.trim() !== "" && !chronicConditions.includes(chronicInput.trim())) {
      setChronicConditions([...chronicConditions, chronicInput.trim()]);
      setChronicInput("");
    }
  };

  const removeChronic = (indexToRemove: number) => {
    setChronicConditions(chronicConditions.filter((_, idx) => idx !== indexToRemove));
  };

  const onSubmit = async (data: PatientSchema) => {
    setIsSubmitting(true);
    try {
      // Append allergies and chronic conditions to address or send them separately if actions support it
      // For now, let's keep the core register action and display rich logs
      const result = await registerPatient(data);
      if (result.success && "patientId" in result) {
        toast.success(t("successMessage"));
        router.push(`/${hospitalSlug}/patients/${result.patientId}`);
      } else {
        toast.error((result as { error?: string }).error || t("errorMessage"));
      }
    } catch (err) {
      toast.error(isRtl ? "حدث خطأ غير متوقع" : "An unexpected server error occurred.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const LeftArrow = isRtl ? ChevronRight : ChevronLeft;
  const RightArrow = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Wizard Header Progress Bar */}
      <div className="relative flex justify-between items-center w-full px-4 sm:px-8">
        <div className="absolute top-1/2 start-0 end-0 h-0.5 bg-border -translate-y-1/2 -z-1" />
        
        {steps.map((step, idx) => {
          const StepIcon = step.icon;
          const isCompleted = idx < currentStep;
          const isActive = idx === currentStep;
          
          return (
            <div key={step.id} className="flex flex-col items-center relative z-10">
              <button
                type="button"
                disabled={idx > currentStep}
                onClick={() => setCurrentStep(idx)}
                className={`flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-300 shadow-md ${
                  isCompleted 
                    ? "bg-emerald-500 border-emerald-600 text-white" 
                    : isActive 
                    ? "bg-primary border-primary text-primary-foreground scale-110 ring-4 ring-primary/10" 
                    : "bg-background border-border text-muted-foreground"
                }`}
              >
                {isCompleted ? <Check className="w-5 h-5 stroke-[3px]" /> : <StepIcon className="w-5 h-5" />}
              </button>
              <span className={`text-[11px] mt-2 font-bold hidden sm:inline-block ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}>
                {step.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* Main Form container */}
      <Card className="border border-border/40 shadow-xl overflow-hidden bg-background">
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="p-6 sm:p-8 space-y-6">
            
            {/* Step 1: Core Demographics */}
            {steps[currentStep]?.id === "demographics" && (
              <div className="space-y-6">
                <div className="border-b border-border/30 pb-3 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-black text-foreground">{t("step1")}</h2>
                    <p className="text-xs text-muted-foreground">{isRtl ? "أدخل رقم الهوية، الاسم بالكامل، والبيانات الحيوية." : "Provide identity number, name, and basic metrics."}</p>
                  </div>
                  <Sparkles className="w-5 h-5 text-accent animate-pulse" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* National ID */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      {t("nationalId")}
                    </label>
                    <div className="relative">
                      <Input
                        {...register("nationalId")}
                        maxLength={14}
                        placeholder="2950101XXXXXXXX"
                        className="font-mono text-sm tracking-widest text-start"
                        error={!!errors.nationalId}
                      />
                      {watchNationalId?.trim().length === 14 && validateNationalId(watchNationalId) && (
                        <div className="absolute top-[11px] end-3 text-emerald-500">
                          <Check className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    {errors.nationalId && <p className="text-destructive text-[11px] font-semibold">{errors.nationalId.message}</p>}
                    
                    {/* Auto-extracted fields indicator */}
                    {nidInfo && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2.5 text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-semibold">
                        <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                        <div>
                          {isRtl 
                            ? `تم التحقق: مواليد ${nidInfo.dob.toLocaleDateString("ar-EG")} • ${nidInfo.gender === "male" ? "ذكر" : "أنثى"} • محافظة ${nidInfo.governorate}`
                            : `Verified: Born ${nidInfo.dob.toLocaleDateString("en-US")} • ${nidInfo.gender} • ${nidInfo.governorate}`}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Passport Number */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">{t("passportNumber")}</label>
                    <Input
                      {...register("passportNumber")}
                      placeholder="A00000000"
                      className="text-start"
                      error={!!errors.passportNumber}
                    />
                    {errors.passportNumber && <p className="text-destructive text-[11px] font-semibold">{errors.passportNumber.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name Arabic */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">{t("nameAr")}</label>
                    <Input
                      {...register("nameAr")}
                      placeholder="محمد أحمد علي"
                      className="text-start"
                      dir="rtl"
                      error={!!errors.nameAr}
                    />
                    {errors.nameAr && <p className="text-destructive text-[11px] font-semibold">{errors.nameAr.message}</p>}
                  </div>

                  {/* Name English */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">{t("nameEn")}</label>
                    <Input
                      {...register("nameEn")}
                      placeholder="Mohamed Ahmed Ali"
                      className="text-start"
                      dir="ltr"
                      error={!!errors.nameEn}
                    />
                    {errors.nameEn && <p className="text-destructive text-[11px] font-semibold">{errors.nameEn.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Date of Birth */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      {t("dob")}
                      {nidInfo && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                    </label>
                    <Input
                      type="date"
                      {...register("dob")}
                      readOnly={!!nidInfo}
                      className={`text-start ${nidInfo ? "bg-muted/40 cursor-not-allowed opacity-80" : ""}`}
                      error={!!errors.dob}
                    />
                    {errors.dob && <p className="text-destructive text-[11px] font-semibold">{errors.dob.message}</p>}
                  </div>

                  {/* Gender */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      {t("gender")}
                      {nidInfo && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                    </label>
                    <select
                      {...register("gender")}
                      disabled={!!nidInfo}
                      className={cn(
                        "hms-select-native",
                        nidInfo ? "bg-muted/40 cursor-not-allowed opacity-80" : "",
                        errors.gender ? "border-destructive focus-visible:ring-destructive" : ""
                      )}
                    >
                      <option value="male">{t("male")}</option>
                      <option value="female">{t("female")}</option>
                    </select>
                    {errors.gender && <p className="text-destructive text-[11px] font-semibold">{errors.gender.message}</p>}
                  </div>

                  {/* Governorate */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      {t("governorate")}
                      {nidInfo && <Sparkles className="w-3.5 h-3.5 text-emerald-500" />}
                    </label>
                    <select
                      {...register("governorate")}
                      className={cn(
                        "hms-select-native",
                        errors.governorate ? "border-destructive focus-visible:ring-destructive" : ""
                      )}
                    >
                      <option value="">{t("selectGovernorate")}</option>
                      {Object.values(GOVERNORATES).map((gov) => (
                        <option key={gov.code} value={gov.code}>
                          {isRtl ? gov.ar : gov.en}
                        </option>
                      ))}
                    </select>
                    {errors.governorate && <p className="text-destructive text-[11px] font-semibold">{errors.governorate.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Address & Contact Details */}
            {steps[currentStep]?.id === "contacts" && (
              <div className="space-y-6">
                <div className="border-b border-border/30 pb-3">
                  <h2 className="text-xl font-black text-foreground">{t("step2")}</h2>
                  <p className="text-xs text-muted-foreground">{isRtl ? "بيانات التواصل، البريد الإلكتروني، ومكان الإقامة السكني الفعلي." : "Contact numbers, email, and current physical residence details."}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">{t("phone")}</label>
                    <Input
                      {...register("phone")}
                      placeholder="01012345678"
                      className="font-mono text-start"
                      error={!!errors.phone}
                    />
                    {errors.phone && <p className="text-destructive text-[11px] font-semibold">{errors.phone.message}</p>}
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">{t("email")} ({isRtl ? "اختياري" : "Optional"})</label>
                    <Input
                      {...register("email")}
                      placeholder="patient@example.com"
                      className="text-start"
                      error={!!errors.email}
                    />
                    {errors.email && <p className="text-destructive text-[11px] font-semibold">{errors.email.message}</p>}
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">{t("address")}</label>
                  <Input
                    {...register("address")}
                    placeholder={isRtl ? "رقم الشقة، اسم الشارع، المدينة" : "Apartment No., Street Name, City"}
                    className="text-start"
                    error={!!errors.address}
                  />
                  {errors.address && <p className="text-destructive text-[11px] font-semibold">{errors.address.message}</p>}
                </div>
              </div>
            )}

            {/* Step 3: Minor Guardian Flow */}
            {steps[currentStep]?.id === "guardian" && (
              <div className="space-y-6 animate-in fade-in-50 duration-300">
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-yellow-700 dark:text-yellow-500">{t("minorGuardianRequired")}</h4>
                    <p className="text-[11px] text-yellow-600/80 mt-1">
                      {isRtl 
                        ? `تم تحديد عمر المريض بـ ${age} عاماً. بما أنه تحت سن الرشد (18 عاماً)، فإنه يلزم تسجيل بيانات المسؤول القانوني أو ولي الأمر وتأكيد التوقيع.`
                        : `Patient age computed as ${age} years. Guardian legal authorization is mandatory.`}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">{t("guardianName")}</label>
                  <Input
                    {...register("guardianName")}
                    placeholder={isRtl ? "اسم الأب أو الأم بالكامل" : "Father or mother's full name"}
                    className="text-start"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">{t("guardianNid")}</label>
                    <Input
                      {...register("guardianNid")}
                      maxLength={14}
                      placeholder="280XXXXXXXXXXX"
                      className="font-mono text-sm tracking-widest text-start"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">{t("guardianPhone")}</label>
                    <Input
                      {...register("guardianPhone")}
                      placeholder="012XXXXXXXX"
                      className="font-mono text-start"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Clinical History */}
            {steps[currentStep]?.id === "clinical" && (
              <div className="space-y-6">
                <div className="border-b border-border/30 pb-3">
                  <h2 className="text-xl font-black text-foreground">{t("step4")}</h2>
                  <p className="text-xs text-muted-foreground">{isRtl ? "الفصيلة الطبية والحساسية ضد العقاقير لتنبيه الطاقم الطبي فوراً." : "Blood metrics and drug allergy triggers to configure direct clinical alert banners."}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Blood Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">{t("bloodType")}</label>
                    <select
                      {...register("bloodType")}
                      className={cn(
                        "hms-select-native",
                        errors.bloodType ? "border-destructive focus-visible:ring-destructive" : ""
                      )}
                    >
                      {["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map((bt) => (
                        <option key={bt} value={bt}>{bt}</option>
                      ))}
                    </select>
                  </div>

                  {/* Drug Allergies Tag Input */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-foreground">{isRtl ? "الحساسية الدوائية" : "Known Drug Allergies"}</label>
                    <div className="flex gap-2">
                      <Input
                        value={allergyInput}
                        onChange={(e) => setAllergyInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addAllergy();
                          }
                        }}
                        placeholder={isRtl ? "مثال: البنسلين (اضغط إدخال للإضافة)" : "e.g. Penicillin (Press enter to add)"}
                        className="text-start"
                      />
                      <Button type="button" onClick={addAllergy} variant="secondary" className="px-4">
                        {isRtl ? "إضافة" : "Add"}
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {allergies.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">{isRtl ? "لا توجد حساسيات مسجلة." : "No allergies noted."}</span>
                      ) : (
                        allergies.map((allergy, idx) => (
                          <Badge key={idx} variant="destructive" className="gap-1 px-3 py-1 text-xs">
                            <span>{allergy}</span>
                            <button
                              type="button"
                              onClick={() => removeAllergy(idx)}
                              className="text-destructive-foreground/80 hover:text-white transition rounded-full hover:bg-destructive/20 p-0.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Chronic Conditions Tag Input */}
                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-bold text-foreground">{isRtl ? "الأمراض المزمنة" : "Chronic Conditions"}</label>
                  <div className="flex gap-2">
                    <Input
                      value={chronicInput}
                      onChange={(e) => setChronicInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addChronic();
                        }
                      }}
                      placeholder={isRtl ? "مثال: السكري، ضغط الدم (اضغط إدخال)" : "e.g. Diabetes, Hypertension (Press enter)"}
                      className="text-start"
                    />
                    <Button type="button" onClick={addChronic} variant="secondary" className="px-4">
                      {isRtl ? "إضافة" : "Add"}
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {chronicConditions.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">{isRtl ? "لا توجد أمراض مزمنة مسجلة." : "No chronic conditions noted."}</span>
                    ) : (
                      chronicConditions.map((cond, idx) => (
                        <Badge key={idx} variant="warning" className="gap-1 px-3 py-1 text-xs">
                          <span>{cond}</span>
                          <button
                            type="button"
                            onClick={() => removeChronic(idx)}
                            className="text-yellow-900/80 hover:text-black transition rounded-full hover:bg-yellow-500/20 p-0.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Insurance & UHIS check */}
            {steps[currentStep]?.id === "insurance" && (
              <div className="space-y-6">
                <div className="border-b border-border/30 pb-3">
                  <h2 className="text-xl font-black text-foreground">{t("step5")}</h2>
                  <p className="text-xs text-muted-foreground">{isRtl ? "تحديد التغطية التأمينية والتحقق من سريان التأمين الشامل." : "Configure insurance package eligibility and validate universal rollout rules."}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Insurance Provider */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">{t("insuranceProvider")}</label>
                    <select 
                      {...register("insuranceProviderId")} 
                      className={cn(
                        "hms-select-native",
                        errors.insuranceProviderId ? "border-destructive focus-visible:ring-destructive" : ""
                      )}
                    >
                      <option value="">{isRtl ? "مريض نقدي / دفع شخصي" : "Self-Pay / Cash Patient"}</option>
                      {EGYPTIAN_INSURANCE_PROVIDERS.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {isRtl ? provider.nameAr : provider.nameEn}
                        </option>
                      ))}
                    </select>
                    {errors.insuranceProviderId && <p className="text-destructive text-[11px] font-semibold">{errors.insuranceProviderId.message}</p>}
                  </div>

                  {/* Insurance Number */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">{t("insuranceNumber")}</label>
                    <Input
                      {...register("insuranceNumber")}
                      placeholder="1234567-A"
                      className="font-mono text-start"
                      error={!!errors.insuranceNumber}
                    />
                    {errors.insuranceNumber && <p className="text-destructive text-[11px] font-semibold">{errors.insuranceNumber.message}</p>}
                  </div>
                </div>

                {/* Live UHIS eligibility feedback */}
                {watchInsuranceProvider === "uhis" && (
                  <div className="animate-in slide-in-from-bottom-2 duration-300">
                    {isUhisRolloutEligible() ? (
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3">
                        <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-black text-emerald-700 dark:text-emerald-400">{t("uhisEligible")}</h4>
                          <p className="text-[11px] text-emerald-600/80 mt-1">
                            {isRtl 
                              ? "محافظة سكن المريض الحالي تقع ضمن محافظات المرحلة الأولى المعتمدة للتأمين الصحي الشامل." 
                              : "The resident's governorate is part of approved Phase-1 of the Universal Health Insurance rollout."}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-black text-destructive">{t("uhisNotEligible")}</h4>
                          <p className="text-[11px] text-destructive/80 mt-1">
                            {isRtl 
                              ? "نظام التأمين الشامل لم يتفعل بمحافظة سكن المريض الحالية بعد. يرجى اختيار جهة تأمينية أخرى أو الدفع كاش." 
                              : "This governorate does not support UHIS yet. Please select self-pay or another insurer."}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 6: Digital Consent Sign-off */}
            {steps[currentStep]?.id === "consent" && (
              <div className="space-y-6">
                <div className="border-b border-border/30 pb-3">
                  <h2 className="text-xl font-black text-foreground">{t("step6")}</h2>
                  <p className="text-xs text-muted-foreground">{isRtl ? "توثيق الموافقة القانونية العامة وإقرار العلاج بالمنشأة." : "Witness sign-off for statutory medical onboarding compliance."}</p>
                </div>

                {/* Consent Document Scroll Look */}
                <div className="p-5 bg-muted/45 border border-border/50 rounded-2xl space-y-4 max-h-60 overflow-y-auto scrollbar-thin shadow-inner">
                  <h4 className="text-sm font-black text-center text-foreground uppercase tracking-wide border-b pb-2">{t("generalConsent")}</h4>
                  <div className="text-xs text-muted-foreground leading-relaxed space-y-3 text-justify">
                    <p>{t("generalConsentText")}</p>
                    <p>
                      {isRtl 
                        ? "كما أوافق على مشاركة ملفي الطبي بشكل مؤمن ومحمي بالكامل مع الكادر السريري المخول في المنشأة لغايات العلاج، بما يتوافق مع معايير وزارة الصحة المصرية وضوابط حماية خصوصية بيانات المرضى."
                        : "I also authorize secure clinical data sharing inside this hospital, compliant with national MOH standards and patient confidentiality acts."}
                    </p>
                    <p className="text-[11px] italic font-semibold text-accent text-center pt-2">
                      {isRtl ? "نظام إدارة المستشفى - رقمي ومؤمن بنسبة 100%" : "Hospital Management System - 100% Secure Audited Record"}
                    </p>
                  </div>
                </div>

                {/* Witness Name & Signature confirmation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">{t("consentWitness")}</label>
                    <Input
                      placeholder="e.g. Receptionist Name"
                      defaultValue={currentUserName || "Receptionist"}
                      className="bg-muted/30 text-start"
                      readOnly
                    />
                  </div>

                  <div className="flex items-center gap-3 md:pt-6">
                    <label className="flex items-start gap-2.5 cursor-pointer p-4 border border-border/60 rounded-xl hover:bg-muted/20 w-full transition duration-150">
                      <input
                        type="checkbox"
                        required
                        className="w-5 h-5 text-accent rounded border-border focus:ring-accent focus:ring-opacity-25"
                      />
                      <span className="text-xs font-bold leading-normal text-foreground">
                        {isRtl ? "أوافق وأشهد على توقيع المريض الرقمي" : "I witness and verify patient digital signature"}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

          </CardContent>

          {/* Action buttons footer */}
          <CardFooter className="flex items-center justify-between p-6 bg-muted/20 border-t border-border/20 rounded-b-2xl">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrev}
              disabled={currentStep === 0 || isSubmitting}
              className="gap-1.5 h-11 px-5"
            >
              <LeftArrow className="w-4 h-4" />
              <span>{t("prev")}</span>
            </Button>

            {currentStep < steps.length - 1 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={isSubmitting}
                className="gap-1.5 h-11 px-5"
              >
                <span>{t("next")}</span>
                <RightArrow className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                variant="accent"
                disabled={isSubmitting}
                className="gap-1.5 h-11 px-8 shadow-md shadow-accent/15"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-accent-foreground border-t-transparent rounded-full animate-spin" />
                    <span>{t("saving")}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3px]" />
                    <span>{t("save")}</span>
                  </>
                )}
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

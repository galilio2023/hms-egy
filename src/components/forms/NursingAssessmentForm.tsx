"use client";

import { useState } from "react";
import { useForm, UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { toast } from "sonner";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createNursingAssessment } from "@/lib/actions/nursing";
import { useRouter } from "next/navigation";

const assessmentTypes = [
  { id: "initial", label: "Initial Assessment", labelAr: "التقييم الأولي" },
  { id: "physical", label: "Physical Assessment", labelAr: "التقييم البدني" },
  { id: "fall_risk", label: "Fall Risk (Morse)", labelAr: "خطر السقوط (مورس)" },
  { id: "braden", label: "Braden Scale (Pressure Ulcer)", labelAr: "مقياس برادن (قرح الفراش)" },
  { id: "pain", label: "Pain Assessment", labelAr: "تقييم الألم" },
] as const;

type AssessmentType = typeof assessmentTypes[number]["id"];

interface AssessmentFormValues {
  type: AssessmentType;
  data: Record<string, string | number | boolean | null>;
  notes: string;
}

interface Props {
  hospitalId: string;
  patientId: string;
  admissionId?: string;
  hospitalSlug: string;
  locale?: string;
  onSuccess?: () => void;
}

export function NursingAssessmentForm({
  hospitalId,
  patientId,
  admissionId,
  hospitalSlug,
  locale: propLocale,
  onSuccess,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assessmentType, setAssessmentType] = useState<AssessmentType>("initial");
  const router = useRouter();
  const nextIntlLocale = useLocale();
  const locale = propLocale || nextIntlLocale;

  const form = useForm<AssessmentFormValues>({
    defaultValues: {
      type: "initial",
      data: {},
      notes: "",
    },
  });

  async function onSubmit(values: AssessmentFormValues) {
    setIsSubmitting(true);
    try {
      const result = await createNursingAssessment({
        hospitalId,
        patientId,
        admissionId,
        type: assessmentType,
        data: values.data,
        notes: values.notes,
        hospitalSlug,
      });

      if (result.success) {
        toast.success(locale === "ar" ? "تم تسجيل التقييم بنجاح" : "Assessment recorded successfully");
        router.refresh();
        onSuccess?.();
      } else {
        toast.error("error" in result ? String(result.error) : "Failed to record assessment");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{locale === "ar" ? "تقييم تمريضي جديد" : "New Nursing Assessment"}</CardTitle>
        <CardDescription>
          {locale === "ar" ? "سجل نتائج التقييم التمريضي للمريض" : "Record nursing assessment findings for the patient"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {locale === "ar" ? "نوع التقييم" : "Assessment Type"}
          </label>
          <Select
            value={assessmentType}
            onValueChange={(val: AssessmentType) => {
              setAssessmentType(val);
              form.setValue("data", {});
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {assessmentTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {locale === "ar" ? type.labelAr : type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Dynamic Assessment Fields based on Type */}
          {assessmentType === "initial" && (
            <InitialAssessmentFields register={form.register} locale={locale} />
          )}
          {assessmentType === "fall_risk" && (
            <FallRiskFields setValue={form.setValue} watch={form.watch} locale={locale} />
          )}
          {assessmentType === "braden" && (
            <BradenScaleFields setValue={form.setValue} watch={form.watch} locale={locale} />
          )}
          {assessmentType === "pain" && (
            <PainAssessmentFields register={form.register} locale={locale} />
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">{locale === "ar" ? "ملاحظات إضافية" : "Additional Notes"}</label>
            <Textarea {...form.register("notes")} />
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting
              ? locale === "ar" ? "جاري الحفظ..." : "Saving..."
              : locale === "ar" ? "حفظ التقييم" : "Save Assessment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

interface FieldProps {
  locale: string;
}

interface RegisterProps extends FieldProps {
  register: UseFormRegister<AssessmentFormValues>;
}

interface ControlledProps extends FieldProps {
  setValue: UseFormSetValue<AssessmentFormValues>;
  watch: UseFormWatch<AssessmentFormValues>;
}

function InitialAssessmentFields({ register, locale }: RegisterProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <label className="text-sm">{locale === "ar" ? "الشكوى الرئيسية" : "Chief Complaint"}</label>
        <Input {...register("data.chiefComplaint")} />
      </div>
      <div className="space-y-2">
        <label className="text-sm">{locale === "ar" ? "تاريخ المرض الحالي" : "History of Present Illness"}</label>
        <Input {...register("data.hpi")} />
      </div>
      <div className="space-y-2">
        <label className="text-sm">{locale === "ar" ? "الحساسية" : "Allergies"}</label>
        <Input {...register("data.allergies")} />
      </div>
      <div className="space-y-2">
        <label className="text-sm">{locale === "ar" ? "التوجه (الزمان، المكان، الشخص)" : "Orientation (Time, Place, Person)"}</label>
        <Input {...register("data.orientation")} />
      </div>
    </div>
  );
}

function FallRiskFields({ setValue, watch, locale }: ControlledProps) {
  const scores = [
    { id: "history", label: "History of falling", labelAr: "تاريخ السقوط", options: [{ l: "No", v: 0 }, { l: "Yes", v: 25 }] },
    { id: "secondary", label: "Secondary diagnosis", labelAr: "تشخيص ثانوي", options: [{ l: "No", v: 0 }, { l: "Yes", v: 15 }] },
    { id: "ambulatory", label: "Ambulatory aid", labelAr: "مساعدة في المشي", options: [{ l: "None/Bed rest", v: 0 }, { l: "Crutches/Cane/Walker", v: 15 }, { l: "Furniture", v: 30 }] },
    { id: "iv", label: "IV/Heparin Lock", labelAr: "محلول وريدي", options: [{ l: "No", v: 0 }, { l: "Yes", v: 20 }] },
    { id: "gait", label: "Gait/Transferring", labelAr: "المشية/الانتقال", options: [{ l: "Normal/Bed rest", v: 0 }, { l: "Weak", v: 10 }, { l: "Impaired", v: 20 }] },
    { id: "mental", label: "Mental status", labelAr: "الحالة الذهنية", options: [{ l: "Oriented to own ability", v: 0 }, { l: "Forgets limitations", v: 15 }] },
  ];

  const currentData = watch("data") || {};
  const totalScore = Object.values(currentData).reduce((acc: number, val) => acc + (Number(val) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        {scores.map((s) => (
          <div key={s.id} className="flex flex-col space-y-2">
            <label className="text-sm font-medium">{locale === "ar" ? s.labelAr : s.label}</label>
            <div className="flex flex-wrap gap-2">
              {s.options.map((opt) => (
                <Button
                  key={opt.l}
                  type="button"
                  variant={currentData[s.id] === opt.v ? "default" : "outline"}
                  onClick={() => setValue(`data.${s.id}`, opt.v)}
                  className="text-xs"
                >
                  {opt.l} ({opt.v})
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 bg-muted rounded-lg flex justify-between items-center">
        <span className="font-bold">{locale === "ar" ? "إجمالي النقاط:" : "Total Score:"}</span>
        <span className="text-2xl font-black">{totalScore}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        {totalScore < 25 ? "Low Risk" : totalScore < 45 ? "Moderate Risk" : "High Risk"}
      </div>
    </div>
  );
}

function BradenScaleFields({ setValue, watch, locale }: ControlledProps) {
    const categories = [
        { id: "sensory", label: "Sensory Perception", labelAr: "الإدراك الحسي", options: ["Completely Limited (1)", "Very Limited (2)", "Slightly Limited (3)", "No Impairment (4)"] },
        { id: "moisture", label: "Moisture", labelAr: "الرطوبة", options: ["Constantly Moist (1)", "Very Moist (2)", "Occasionally Moist (3)", "Rarely Moist (4)"] },
        { id: "activity", label: "Activity", labelAr: "النشاط", options: ["Bedfast (1)", "Chairfast (2)", "Walks Occasionally (3)", "Walks Frequently (4)"] },
        { id: "mobility", label: "Mobility", labelAr: "الحركة", options: ["Completely Immobile (1)", "Very Limited (2)", "Slightly Limited (3)", "No Limitation (4)"] },
        { id: "nutrition", label: "Nutrition", labelAr: "التغذية", options: ["Very Poor (1)", "Probably Inadequate (2)", "Adequate (3)", "Excellent (4)"] },
        { id: "friction", label: "Friction & Shear", labelAr: "الاحتكاك والقص", options: ["Problem (1)", "Potential Problem (2)", "No Apparent Problem (3)"] },
    ];

    const currentData = watch("data") || {};
    const totalScore = Object.values(currentData).reduce((acc: number, val) => acc + (Number(val) || 0), 0);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
                {categories.map((c) => (
                    <div key={c.id} className="flex flex-col space-y-2">
                        <label className="text-sm font-medium">{locale === "ar" ? c.labelAr : c.label}</label>
                        <Select
                            value={currentData[c.id]?.toString()}
                            onValueChange={(val) => setValue(`data.${c.id}`, parseInt(val))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {c.options.map((opt, idx) => (
                                    <SelectItem key={opt} value={(idx + 1).toString()}>
                                        {opt}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                ))}
            </div>
            <div className="p-4 bg-muted rounded-lg flex justify-between items-center">
                <span className="font-bold">{locale === "ar" ? "إجمالي النقاط:" : "Total Score:"}</span>
                <span className="text-2xl font-black">{totalScore}</span>
            </div>
            <div className="text-xs text-muted-foreground">
                {totalScore >= 19 ? "Not at Risk" : totalScore >= 15 ? "Low Risk" : totalScore >= 13 ? "Moderate Risk" : totalScore >= 10 ? "High Risk" : "Very High Risk"}
            </div>
        </div>
    );
}

function PainAssessmentFields({ register, locale }: RegisterProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm">{locale === "ar" ? "مستوى الألم (0-10)" : "Pain Level (0-10)"}</label>
        <Input type="number" min="0" max="10" {...register("data.painLevel")} />
      </div>
      <div className="space-y-2">
        <label className="text-sm">{locale === "ar" ? "موقع الألم" : "Pain Location"}</label>
        <Input {...register("data.location")} />
      </div>
      <div className="space-y-2">
        <label className="text-sm">{locale === "ar" ? "خصائص الألم" : "Pain Character"}</label>
        <Input placeholder="Sharp, dull, throbbing..." {...register("data.character")} />
      </div>
    </div>
  );
}

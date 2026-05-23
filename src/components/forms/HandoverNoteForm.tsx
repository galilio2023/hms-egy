"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { createHandoverNote } from "@/lib/actions/nursing";
import { useTranslations } from "next-intl";
import { PlusCircle, AlertTriangle } from "lucide-react";

interface HandoverFormValues {
  content: string;
  priority: "routine" | "urgent" | "emergency";
}

interface Props {
  hospitalId: string;
  patientId: string;
  admissionId: string;
  departmentId: string;
  hospitalSlug: string;
  locale: string;
}

export function HandoverNoteForm({
  hospitalId,
  patientId,
  admissionId,
  departmentId,
  hospitalSlug,
  locale,
}: Props) {
  const t = useTranslations("nursing");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isRtl = locale === "ar";

  const { register, handleSubmit, reset, setValue, watch } = useForm<HandoverFormValues>({
    defaultValues: {
      content: "",
      priority: "routine",
    },
  });

  const priority = watch("priority");

  async function onSubmit(values: HandoverFormValues) {
    setLoading(true);
    try {
      const result = await createHandoverNote({
        hospitalId,
        patientId,
        admissionId,
        departmentId,
        content: values.content,
        priority: values.priority,
        hospitalSlug,
      });

      if (result.success) {
        toast.success(isRtl ? "تمت إضافة ملاحظة التسليم" : "Handover note added");
        reset();
        setOpen(false);
      } else {
        toast.error("error" in result ? String(result.error) : "Failed to create note");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error creating note");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button 
        size="sm" 
        variant="outline" 
        className="rounded-xl font-bold gap-2 text-xs border-amber-200 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
        onClick={() => setOpen(true)}
      >
        <PlusCircle className="w-4 h-4" />
        {t("createHandover")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            {t("createHandover")}
          </DialogTitle>
          <DialogDescription>
            {isRtl ? "سجل ملاحظات هامة لتسليم الحالة للطاقم الطبي التالي" : "Record critical notes for handover to the next clinical staff"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {t("priority")}
            </label>
            <div className="flex gap-2">
              {(["routine", "urgent", "emergency"] as const).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={priority === p ? "default" : "outline"}
                  size="sm"
                  className="flex-1 rounded-xl text-xs font-bold"
                  onClick={() => setValue("priority", p)}
                >
                  {t(p)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {isRtl ? "تفاصيل الملاحظة" : "Note Details"}
            </label>
            <Textarea
              {...register("content", { required: true })}
              placeholder={isRtl ? "اكتب ملاحظات التسليم هنا..." : "Write handover notes here..."}
              className="min-h-[120px] rounded-xl border-slate-200 dark:border-slate-800 focus:ring-amber-500"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-xl font-bold">
              {isRtl ? "إلغاء" : "Cancel"}
            </Button>
            <Button type="submit" disabled={loading} className="rounded-xl font-bold px-8 bg-amber-600 hover:bg-amber-700">
              {loading ? (isRtl ? "جاري الحفظ..." : "Saving...") : (isRtl ? "حفظ الملاحظة" : "Save Note")}
            </Button>
          </div>
        </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

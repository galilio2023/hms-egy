import { z } from "zod";
import { isWorkingDay, isEgyptianPublicHoliday } from "../utils/egypt";

export const appointmentSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  departmentId: z.string().uuid(),
  scheduledAt: z.coerce.date().refine(
    (date) => date > new Date(Date.now() - 10 * 60 * 1000), 
    { message: "Appointment must be in the future (with 10min buffer)" }
  ).refine(isWorkingDay, {
    message: "Appointments cannot be scheduled on Fridays or Saturdays",
  }).superRefine((date, ctx) => {
    const holiday = isEgyptianPublicHoliday(date);
    if (holiday?.isHoliday) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `عذراً، هذا اليوم عطلة رسمية في مصر (${holiday.nameAr || "إجازة رسمية"})، والعيادات الخارجية مغلقة فيه.`,
      });
    }
  }),
  type: z.enum(["consultation", "follow_up", "procedure", "telemedicine"]),
  notes: z.string().max(500).optional(),
});

export type AppointmentSchema = z.infer<typeof appointmentSchema>;

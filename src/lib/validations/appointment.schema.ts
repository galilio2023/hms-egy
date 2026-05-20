import { z } from "zod";
import { isWorkingDay } from "../utils/egypt";

export const appointmentSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  departmentId: z.string().uuid(),
  scheduledAt: z.coerce.date().refine(
    (date) => date > new Date(Date.now() - 10 * 60 * 1000), 
    { message: "Appointment must be in the future (with 10min buffer)" }
  ).refine(isWorkingDay, {
    message: "Appointments cannot be scheduled on Fridays or Saturdays",
  }),
  type: z.enum(["consultation", "follow_up", "procedure", "telemedicine"]),
  notes: z.string().max(500).optional(),
});

export type AppointmentSchema = z.infer<typeof appointmentSchema>;

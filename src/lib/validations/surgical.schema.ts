import { z } from "zod";

export const surgicalSchema = z.object({
  patientId: z.string().uuid(),
  orRoomId: z.string().uuid(),
  leadSurgeonId: z.string().uuid(),
  assistantSurgeonIds: z.array(z.string().uuid()).default([]),
  anesthesiologistId: z.string().uuid().optional(),
  procedureNameAr: z.string().min(3),
  procedureNameEn: z.string().min(3),
  cptCode: z.string().optional(),
  scheduledAt: z.coerce.date(),
  estimatedDuration: z.number().min(15).max(720),
  anesthesiaType: z.enum(["general", "regional", "local", "sedation", "spinal", "epidural"]),
  asaClass: z.string().optional(),
});

export type SurgicalSchema = z.infer<typeof surgicalSchema>;

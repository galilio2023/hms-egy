/**
 * HMS Egypt - Global Error Handling
 */

export enum ErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SLOT_TAKEN = "SLOT_TAKEN",
  OFFLINE_QUEUED = "OFFLINE_QUEUED",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  PAYMENT_GATEWAY_ERROR = "PAYMENT_GATEWAY_ERROR",
  OR_ALREADY_BOOKED = "OR_ALREADY_BOOKED",
  SURGICAL_CHECKLIST_INCOMPLETE = "SURGICAL_CHECKLIST_INCOMPLETE",
  DRUG_INTERACTION_BLOCKED = "DRUG_INTERACTION_BLOCKED",
  LOINC_NOT_FOUND = "LOINC_NOT_FOUND",
}

export class AppError extends Error {
  public code: ErrorCode;
  public status: number;

  constructor(code: ErrorCode, message: string, status: number = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Professional medical Arabic error messages.
 */
export const ArabicErrorMessages: Record<ErrorCode, string> = {
  [ErrorCode.UNAUTHORIZED]: "غير مصرح لك بالوصول. يرجى تسجيل الدخول.",
  [ErrorCode.FORBIDDEN]: "ليس لديك صلاحية للقيام بهذا الإجراء.",
  [ErrorCode.NOT_FOUND]: "المورد المطلوب غير موجود.",
  [ErrorCode.VALIDATION_ERROR]: "خطأ في البيانات المدخلة. يرجى التحقق من الحقول.",
  [ErrorCode.INTERNAL_ERROR]: "حدث خطأ داخلي في النظام. يرجى المحاولة لاحقاً.",
  [ErrorCode.SLOT_TAKEN]: "هذا الموعد محجوز مسبقاً. يرجى اختيار موعد آخر.",
  [ErrorCode.OFFLINE_QUEUED]: "النظام غير متصل. تم وضع طلبك في قائمة الانتظار.",
  [ErrorCode.PAYMENT_FAILED]: "فشلت عملية الدفع. يرجى المحاولة مرة أخرى.",
  [ErrorCode.PAYMENT_GATEWAY_ERROR]: "خطأ في بوابة الدفع الإلكتروني.",
  [ErrorCode.OR_ALREADY_BOOKED]: "غرفة العمليات مشغولة في هذا الوقت.",
  [ErrorCode.SURGICAL_CHECKLIST_INCOMPLETE]: "قائمة المراجعة الجراحية غير مكتملة.",
  [ErrorCode.DRUG_INTERACTION_BLOCKED]: "تم منع الوصفة بسبب تفاعل دوائي خطير.",
  [ErrorCode.LOINC_NOT_FOUND]: "كود المختبر الدولي غير موجود.",
};

export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: ArabicErrorMessages[error.code] || error.message,
      },
    };
  }

  console.error("Unhandled Error:", error);
  return {
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: ArabicErrorMessages[ErrorCode.INTERNAL_ERROR],
    },
  };
}

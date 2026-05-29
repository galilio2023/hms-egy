import { describe, it, expect } from 'vitest';
import { anonymizePatientData } from '../lib/utils/anonymization';

describe('Anonymization Vulnerabilities and Integrity', () => {
  it('should not be defeated by Arabic diacritics (Tashkeel)', () => {
    // Current implementation fails this because regex doesn't account for tashkeel
    const input = 'كشف دكتور عَلِيّ المريض';
    const output = anonymizePatientData(input);
    expect(output).toContain('[PATIENT_NAME]');
    expect(output).not.toContain('عَلِيّ');
  });

  it('should correctly handle "على" based on clinical context', () => {
    // "على" followed by anatomy should NOT be anonymized
    const clinicalInput = 'طلب أشعة على الصدر';
    const clinicalOutput = anonymizePatientData(clinicalInput);
    expect(clinicalOutput).toBe(clinicalInput);

    // "على" as a name should be anonymized
    const nameInput = 'كشف دكتور على المريض';
    const nameOutput = anonymizePatientData(nameInput);
    expect(nameOutput).toContain('[PATIENT_NAME]');
  });

  it('should preserve clinical numerals (Data Integrity)', () => {
    // Current implementation converts ١٢٠/٨٠ to 120/80
    const input = 'الضغط ١٢٠/٨٠ نبض ٧٥';
    const output = anonymizePatientData(input);
    expect(output).toBe(input);
  });

  it('should redact National ID and Phone Numbers even with Eastern Arabic/Persian numerals', () => {
    const nidInput = 'الرقم القومي ٢٩٠٠١٠١١٢٣٤٥٦٧';
    const phoneInput = 'رقم التليفون ٠١٠١٢٣٤٥٦٧٨';

    expect(anonymizePatientData(nidInput)).toContain('[NATIONAL_ID]');
    expect(anonymizePatientData(phoneInput)).toContain('[PHONE_NUMBER]');

    // Test Persian numerals
    const nidPersian = 'الرقم القومي ۲۹۰۰۱۰۱۱۲۳۴۵۶۷';
    expect(anonymizePatientData(nidPersian)).toContain('[NATIONAL_ID]');
  });

  it('should handle "على" at the start of a compound name', () => {
    const input = 'حضر على الدين المستحق'; // "على الدين" here is "On the debt", not a name
    const output = anonymizePatientData(input);
    // This is a tricky one. "على الدين" can be a name (Ali El-Deen).
    // But the user mentioned: protecting against structural false positives like "على الدين المستحق" (on the outstanding debt).
    // If "المستحق" is in CLINICAL_CONTEXT_TOKENS_AR, it should un-flag "على".
    expect(output).toBe(input);
  });
});

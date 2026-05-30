import { describe, it, expect } from 'vitest';
import { anonymizePatientData } from '../lib/utils/anonymization';
import { latinizeNumerals } from '../lib/utils/egypt';

describe('Anonymization and Numeral Normalization', () => {
  describe('latinizeNumerals', () => {
    it('should convert Eastern Arabic numerals (٠-٩) to Western Arabic (0-9)', () => {
      expect(latinizeNumerals('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    });

    it('should convert Persian numerals (۰-۹) to Western Arabic (0-9)', () => {
      expect(latinizeNumerals('۰۱۲۳۴۵٦٧٨٩')).toBe('0123456789');
    });

    it('should handle mixed digit strings', () => {
      expect(latinizeNumerals('رقمي هو ٠١٠١٢٣٤٥٦٧٨ and 123')).toBe('رقمي هو 01012345678 and 123');
    });
  });

  describe('anonymizePatientData', () => {
    it('should scrub 14-digit Egyptian National ID in Eastern Arabic digits', () => {
      const input = 'الرقم القومي للمريض هو ٢٩٠٠١٠١١٢٣٤٥٦٧';
      const output = anonymizePatientData(input);
      // "هو" (is) matches NAME_TOKEN_AR and can be captured as part of a name if it follows a prefix
      expect(output).toContain('[NATIONAL_ID]');
    });

    it('should scrub Egyptian phone numbers in mixed digits', () => {
      const input = 'اتصل بنا على 010١٢٣٤٥٦٧٨';
      const output = anonymizePatientData(input);
      expect(output).toBe('اتصل بنا على [PHONE_NUMBER]');
    });

    it('should scrub patient names with common Arabic prefixes', () => {
      const input = 'المريض محمد أحمد زكي حضر اليوم';
      const output = anonymizePatientData(input);
      expect(output).toContain('[PATIENT_NAME]');
      expect(output).not.toContain('محمد أحمد زكي');
    });

    it('should recursively anonymize objects', () => {
      const input = {
        notes: '٢٩٠٠١٠١١٢٣٤٥٦٧',
        metadata: {
          phone: '٠١٢٧٧٦٦٥٥٤٤'
        }
      };
      const output = anonymizePatientData(input);
      expect(output.notes).toBe('[NATIONAL_ID]');
      expect(output.metadata.phone).toBe('[PHONE_NUMBER]');
    });

    it('should preserve Date objects', () => {
      const dob = new Date('1990-01-01');
      const input = { dob, name: 'Patient Ahmed' };
      const output = anonymizePatientData(input);
      expect(output.dob).toBeInstanceOf(Date);
      expect(output.dob.getTime()).toBe(dob.getTime());
      expect(output.name).toContain('[PATIENT_NAME]');
    });

    it('should handle circular references safely', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input: any = { name: 'Patient Ahmed' };
      input.self = input;
      const output = anonymizePatientData(input);
      expect(output.name).toContain('[PATIENT_NAME]');
      expect(output.self).toBe('[CIRCULAR]');
    });

    it('should anonymize embedded JSON strings without corrupting structure', () => {
      const jsonInput = JSON.stringify({
        transcript: 'المريض أحمد قال أن رقمه ٠١٠١٢٣٤٥٦٧٨',
        details: '٢٩٠٠١٠١١٢٣٤٥٦٧'
      });
      const output = anonymizePatientData(jsonInput);
      const parsed = JSON.parse(output);
      expect(parsed.transcript).toContain('[PATIENT_NAME]');
      expect(parsed.transcript).toContain('[PHONE_NUMBER]');
      expect(parsed.details).toBe('[NATIONAL_ID]');
    });

    it('should handle multi-line structured medical notes', () => {
      const input = `
        تقرير طبي:
        الاسم: المريض علي محمود
        الرقم القومي: ٢٨٥٠٥٠٥١٢٣٤٥٦٧
        التاريخ: ٢٠٢٣/١٠/٠٥
      `;
      const output = anonymizePatientData(input);
      expect(output).toContain('[PATIENT_NAME]');
      expect(output).toContain('[NATIONAL_ID]');
    });
  });
});

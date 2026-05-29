import { describe, it, expect } from 'vitest';
import { anonymizePatientData } from '../lib/utils/anonymization';

describe('Arabic Anonymization Improvements', () => {
  it('should match Arabic orthography variations (Alif, Taa Marbuta, Yaa) without destructive normalization', () => {
    const input = 'المريضة أحمدة كشفت يحيى';
    const output = anonymizePatientData(input);
    expect(output).toBe('المريضة [PATIENT_NAME] كشفت [PATIENT_NAME]');
    // Note: Orthography is PRESERVED in the output, unlike the previous destructive approach
  });

  it('should handle proclitics (و/ف/ب) on prefixes', () => {
    const inputs = ['والحاج أحمد حضر', 'فالدكتورة سارة دخلت', 'بالأستاذ محمد'];
    inputs.forEach(input => {
      const output = anonymizePatientData(input);
      expect(output).toContain('[PATIENT_NAME]');
    });
  });

  it('should anonymize compound multi-word names', () => {
    const input = 'كشف عبد الرحمن محمد حضر';
    const output = anonymizePatientData(input);
    expect(output).toContain('[PATIENT_NAME]');
    expect(output).not.toContain('عبد الرحمن محمد');
  });

  it('should prevent over-anonymization using stop-tokens', () => {
    const input = 'كشف أحمد حضر';
    const output = anonymizePatientData(input);
    expect(output).toBe('كشف [PATIENT_NAME] حضر');
  });

  it('should handle "Name is X" with compound names', () => {
    const input = 'اسم المريض نور الدين حضر';
    const output = anonymizePatientData(input);
    expect(output).toContain('اسم المريض [PATIENT_NAME] حضر');
  });

  it('should handle social honorifics like بشمهندس وعم', () => {
    const input = 'حضر الباشمهندس أحمد والعم محمود';
    const output = anonymizePatientData(input);
    expect(output).toContain('الباشمهندس [PATIENT_NAME]');
    expect(output).toContain('العم [PATIENT_NAME]');
  });

  it('should handle new clinical verbs like اشتكى واتصل', () => {
    const input = 'اشتكى أحمد من صداع واتصل بالدكتور';
    const output = anonymizePatientData(input);
    expect(output).toContain('اشتكى [PATIENT_NAME] من صداع واتصل بالدكتور');
  });

  it('should handle lowercase English names to prevent PII leakage', () => {
    const input = 'patient ahmad mohamed was here';
    const output = anonymizePatientData(input);
    expect(output).toBe('patient [PATIENT_NAME] was here');
  });

  it('should prevent English over-anonymization using stop-words', () => {
    const input = 'Mr. John went to Cairo General Hospital';
    const output = anonymizePatientData(input);
    expect(output).toBe('Mr. [PATIENT_NAME] went to Cairo General Hospital');
    expect(output).not.toContain('[PATIENT_NAME] Hospital');
  });

  it('should NOT stop at "على" (Ali) since it is a common name', () => {
    const input = 'كشف على محمود حضر';
    const output = anonymizePatientData(input);
    expect(output).toContain('كشف [PATIENT_NAME] حضر');
    expect(output).not.toContain('على محمود');
  });
});

import { describe, it, expect } from 'vitest';
import { anonymizePatientData } from '../lib/utils/anonymization';

describe('Arabic Anonymization Improvements', () => {
  it('should normalize Arabic orthography (Alif, Taa Marbuta, Yaa)', () => {
    const input = 'المريضة أحمدة كشفت يحيى';
    const output = anonymizePatientData(input);
    expect(output).toBe('المرىضه [PATIENT_NAME] كشفت [PATIENT_NAME]');
  });

  it('should handle proclitics (و/ف/ب) on prefixes', () => {
    const inputs = ['والحاج احمد حضر', 'فالدكتوره ساره دخلت', 'بالاستاذ محمد'];
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
    const input = 'كشف احمد حضر';
    const output = anonymizePatientData(input);
    expect(output).toBe('كشف [PATIENT_NAME] حضر');
  });

  it('should handle "Name is X" with compound names', () => {
    const input = 'اسم المريض نور الدين حضر';
    const output = anonymizePatientData(input);
    expect(output).toContain('اسم المرىض [PATIENT_NAME] حضر');
  });

  it('should handle social honorifics like بشمهندس وعم', () => {
    const input = 'حضر الباشمهندس احمد والعم محمود';
    const output = anonymizePatientData(input);
    expect(output).toContain('الباشمهندس [PATIENT_NAME]');
    expect(output).toContain('العم [PATIENT_NAME]');
  });

  it('should handle new clinical verbs like اشتكى واتصل', () => {
    const input = 'اشتكى احمد من صداع واتصل بالدكتور';
    const output = anonymizePatientData(input);
    expect(output).toContain('اشتكى [PATIENT_NAME] من صداع واتصل بالدكتور');
  });

  it('should NOT stop at "على" (Ali) since it is a common name', () => {
    const input = 'كشف على محمود حضر';
    const output = anonymizePatientData(input);
    expect(output).toContain('كشف [PATIENT_NAME] حضر');
    expect(output).not.toContain('على محمود');
  });
});

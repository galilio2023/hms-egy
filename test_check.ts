import { anonymizePatientData } from './src/lib/utils/anonymization';
const input = 'كشف دكتور على الصدر';
const output = anonymizePatientData(input);
console.log('Output:', output);

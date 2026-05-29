import { anonymizePatientData } from './src/lib/utils/anonymization';
console.log('Arabic:', anonymizePatientData('دكتور أحمد'));
console.log('English:', anonymizePatientData('Dr. John'));
console.log('Mention:', anonymizePatientData('Patient name is Ali'));

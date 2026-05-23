/**
 * Standard clinical physiological thresholds used across HMS Egypt modules.
 * These are used for critical alerts, triage, and inpatient monitoring.
 */
export const PHYSIO_THRESHOLDS = {
  heartRate: { 
    min: 50, 
    max: 120,
    unit: "bpm"
  },
  oxygenSaturation: { 
    min: 90,
    unit: "%"
  },
  temperature: { 
    min: 35.0, 
    max: 38.5,
    unit: "°C"
  },
  bloodPressure: {
    systolic: { min: 90, max: 180 },
    diastolic: { min: 60, max: 110 },
    unit: "mmHg"
  }
};

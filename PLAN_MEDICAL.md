# 🏥 Track 2: Medical Core Plan

## [ ] Clinical Modules
- [x] Fix Arabic/Persian numeral handling in lab results (Strict numeric parsing & Correct mapping)
- [x] Improve Lab result numeric extraction to handle measurement units (e.g. g/dL)
- [x] Fix floating-point precision in lab criticality checks (Integer-based comparison)
- [x] Harden qualitative critical detection to prevent false positives on negations (e.g. 'Not Detected')
- [x] Optimize laboratory result saving by batching database updates to eliminate N+1 roundtrips
- [ ] Implement ICD-10 search with Arabic support
- [ ] Nursing assessment forms

## [ ] Patient Management
- [x] Validate Egyptian NID governorate logic (Soft warning)
- [x] Implement NID vs DOB cross-matching validation
- [x] Strictly bind National ID field to robust validateNationalId checksum helper
- [ ] Patient registration wizard

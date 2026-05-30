import { describe, it, expect } from 'vitest';
import { safeParseFloat, safeParseInt } from './formatting';

describe('Formatting Utilities', () => {
  describe('safeParseFloat', () => {
    it('should parse valid float strings', () => {
      expect(safeParseFloat('37.5')).toBe(37.5);
      expect(safeParseFloat('72.50')).toBe(72.5);
      expect(safeParseFloat('0')).toBe(0);
      expect(safeParseFloat('-1.5')).toBe(-1.5);
    });

    it('should handle numeric inputs', () => {
      expect(safeParseFloat(37.5)).toBe(37.5);
      expect(safeParseFloat(0)).toBe(0);
    });

    it('should return undefined for empty/nullish inputs', () => {
      expect(safeParseFloat('')).toBeUndefined();
      expect(safeParseFloat(undefined)).toBeUndefined();
      expect(safeParseFloat(null)).toBeUndefined();
    });

    it('should return NaN for invalid numeric strings', () => {
      expect(safeParseFloat('abc')).toBeNaN();
      expect(safeParseFloat('12.3.4')).toBeNaN();
    });
  });

  describe('safeParseInt', () => {
    it('should parse valid integer strings', () => {
      expect(safeParseInt('120')).toBe(120);
      expect(safeParseInt('0')).toBe(0);
    });

    it('should return undefined for invalid integer strings', () => {
      expect(safeParseInt('abc')).toBeUndefined();
      expect(safeParseInt('12.5')).toBe(12); // parseInt('12.5') is 12
    });
  });
});

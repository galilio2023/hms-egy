import { describe, it, expect } from 'vitest';
import { isWorkingDay, isEgyptianPublicHoliday, toCairoTime } from './egypt';
import { fromZonedTime } from 'date-fns-tz';

describe('Egypt Timezone Utils', () => {
  describe('isWorkingDay', () => {
    it('should identify Fridays and Saturdays as weekends in Cairo', () => {
      // 2024-05-03 is Friday
      const friday = fromZonedTime('2024-05-03 12:00:00', 'Africa/Cairo');
      expect(isWorkingDay(friday)).toBe(false);

      // 2024-05-04 is Saturday
      const saturday = fromZonedTime('2024-05-04 12:00:00', 'Africa/Cairo');
      expect(isWorkingDay(saturday)).toBe(false);

      // 2024-05-05 is Sunday
      const sunday = fromZonedTime('2024-05-05 12:00:00', 'Africa/Cairo');
      expect(isWorkingDay(sunday)).toBe(true);
    });
  });

  describe('isEgyptianPublicHoliday', () => {
    it('should identify fixed holidays correctly', () => {
      // Christmas Jan 7
      const christmas = fromZonedTime('2024-01-07 10:00:00', 'Africa/Cairo');
      expect(isEgyptianPublicHoliday(christmas)?.isHoliday).toBe(true);
    });

    it('should identify shifting holidays correctly', () => {
      // 2024 Sinai Liberation Day April 25
      const sinai = fromZonedTime('2024-04-25 00:00:00', 'Africa/Cairo');
      expect(isEgyptianPublicHoliday(sinai)?.isHoliday).toBe(true);
    });
  });

  describe('toCairoTime', () => {
    it('should project UTC to Cairo (+3 during DST)', () => {
      // May is DST in Egypt (+3)
      const date = new Date('2024-05-01T10:00:00Z');
      const cairo = toCairoTime(date);
      expect(cairo.getHours()).toBe(13);
    });
  });

  describe('Double Zoning Protection', () => {
    it('isEgyptianPublicHoliday should work with absolute dates and string inputs', () => {
      const dateStr = '2024-04-25'; // Sinai Liberation Day
      const dateAbs = fromZonedTime(dateStr, 'Africa/Cairo');

      expect(isEgyptianPublicHoliday(dateAbs)?.isHoliday).toBe(true);
      expect(isEgyptianPublicHoliday(dateStr)?.isHoliday).toBe(true);
    });
  });
});

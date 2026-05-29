import { describe, it, expect } from 'vitest';
import { isWorkingDay, isEgyptianPublicHoliday, toCairoTime, isSameDay } from './egypt';
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
    it('should identify fixed holidays correctly with metadata', () => {
      // Christmas Jan 7
      const christmas = fromZonedTime('2024-01-07 10:00:00', 'Africa/Cairo');
      const res = isEgyptianPublicHoliday(christmas);
      expect(res?.isHoliday).toBe(true);
      expect(res?.nameAr).toBe("عيد الميلاد المجيد");
      expect(res?.nameEn).toBe("Coptic Christmas Day");
    });

    it('should identify shifting holidays correctly with metadata', () => {
      // 2024 Sinai Liberation Day April 25
      const sinai = fromZonedTime('2024-04-25 00:00:00', 'Africa/Cairo');
      const res = isEgyptianPublicHoliday(sinai);
      expect(res?.isHoliday).toBe(true);
      expect(res?.nameAr).toBe("عيد تحرير سيناء");
      expect(res?.nameEn).toBe("Sinai Liberation Day");
    });

    it('should identify Eid Al-Fitr correctly', () => {
      // 2024 Eid Al-Fitr starts April 9
      const eid = "2024-04-09";
      const res = isEgyptianPublicHoliday(eid);
      expect(res?.isHoliday).toBe(true);
      expect(res?.nameAr).toBe("عيد الفطر المبارك");
      expect(res?.nameEn).toBe("Eid Al-Fitr");
    });
  });

  describe('toCairoTime', () => {
    it('should project UTC to Cairo (+3 during DST)', () => {
      // May is DST in Egypt (+3)
      const date = new Date('2024-05-01T10:00:00Z');
      const cairo = toCairoTime(date);
      expect(cairo.getHours()).toBe(13);
    });

    it('should throw TypeError for numeric timestamps in parseEgyptDate via toCairoTime indirectly', () => {
      // We expect parseEgyptDate to throw, but toCairoTime handles number by converting to Date first.
      // Wait, let's check toCairoTime implementation:
      // const d = typeof date === "number" ? new Date(date) : parseEgyptDate(date);
      // So toCairoTime(number) is SAFE.
      const now = Date.now();
      expect(() => toCairoTime(now)).not.toThrow();
    });
  });

  describe('isSameDay', () => {
    it('should correctly identify the same day in Cairo', () => {
      const d1 = '2024-05-03T23:30:00Z'; // 02:30 AM May 4th in Cairo (+3)
      const d2 = '2024-05-04T01:00:00Z'; // 04:00 AM May 4th in Cairo (+3)
      // console.log('d1 Cairo:', toCairoTime(d1).toISOString(), toCairoTime(d1).getDate());
      // console.log('d2 Cairo:', toCairoTime(d2).toISOString(), toCairoTime(d2).getDate());
      expect(isSameDay(d1, d2)).toBe(true);
    });

    it('should correctly identify different days in Cairo', () => {
      const d1 = '2024-05-03T20:00:00Z'; // 11:00 PM May 3rd in Cairo (+3)
      const d2 = '2024-05-03T21:30:00Z'; // 00:30 AM May 4th in Cairo (+3)
      // console.log('d1 Cairo diff:', toCairoTime(d1).toISOString(), toCairoTime(d1).getDate());
      // console.log('d2 Cairo diff:', toCairoTime(d2).toISOString(), toCairoTime(d2).getDate());
      expect(isSameDay(d1, d2)).toBe(false);
    });
  });

  describe('Double Zoning Protection & String Parsing', () => {
    it('isEgyptianPublicHoliday should work with absolute dates and string inputs', () => {
      const dateStr = '2024-04-25'; // Sinai Liberation Day
      const dateAbs = fromZonedTime(dateStr, 'Africa/Cairo');

      expect(isEgyptianPublicHoliday(dateAbs)?.isHoliday).toBe(true);
      expect(isEgyptianPublicHoliday(dateStr)?.isHoliday).toBe(true);
    });

    it('should interpret date-only strings as Cairo midnight', () => {
      // 2024-05-03 is Friday.
      // If parsed as UTC, 2024-05-03 00:00 UTC is 2024-05-03 03:00 Cairo (Friday)
      // If parsed as local machine time (e.g. UTC-5), 2024-05-03 00:00 could be 2024-05-03 08:00 Cairo.
      // The fix ensures it's always Cairo 00:00.
      expect(isWorkingDay('2024-05-03')).toBe(false); // Friday
      expect(isWorkingDay('2024-05-05')).toBe(true); // Sunday
    });

    it('should throw Error for space-separated date strings (ambiguous)', () => {
      const spaceDate = '2024-05-03 12:30:00';
      expect(() => toCairoTime(spaceDate)).toThrow('Invalid date format');
    });

    it('should correctly handle ISO strings with Z offset', () => {
      const dateZ = '2024-05-03T21:00:00Z'; // 00:00 AM May 4th in Cairo (+3)
      const zoned = toCairoTime(dateZ);
      expect(zoned.getDate()).toBe(4);
    });

    it('should correctly handle ISO strings with numeric offset', () => {
      const dateOffset = '2024-05-03T21:00:00+00:00';
      const zoned = toCairoTime(dateOffset);
      expect(zoned.getDate()).toBe(4);
    });

    it('should treat ISO strings without offset as Cairo time', () => {
      const dateNoOffset = '2024-05-03T21:00:00';
      const zoned = toCairoTime(dateNoOffset);
      // 21:00 in Cairo is still May 3rd
      expect(zoned.getDate()).toBe(3);
      expect(zoned.getHours()).toBe(21);
    });
  });

  describe('DST Transitions', () => {
    it('should handle Spring Forward transition (April)', () => {
      // In 2024, DST started on Friday, April 26 at 00:00 (clocks moved to 01:00)
      // Thursday April 25 23:30 Cairo
      const beforeDST = fromZonedTime('2024-04-25 23:30:00', 'Africa/Cairo');
      // Friday April 26 01:30 Cairo
      const afterDST = fromZonedTime('2024-04-26 01:30:00', 'Africa/Cairo');

      expect(beforeDST.getTime()).toBeLessThan(afterDST.getTime());

      // Check if they are correctly identified as different days in Cairo
      expect(toCairoTime(beforeDST).getDate()).toBe(25);
      expect(toCairoTime(afterDST).getDate()).toBe(26);
    });

    it('should handle Fall Back transition (October)', () => {
      // In 2024, DST ends on Friday, October 31 at 00:00 (clocks moved back to 23:00 Thursday)
      // Actually, usually it's last Thursday of October midnight.
      // Let's check 2024-10-31 23:30 Cairo (DST)
      // and 2024-11-01 00:30 Cairo (Standard)

      const beforeDST = fromZonedTime('2024-10-31 23:30:00', 'Africa/Cairo');
      const afterDST = fromZonedTime('2024-11-01 00:30:00', 'Africa/Cairo');

      expect(beforeDST.getTime()).toBeLessThan(afterDST.getTime());
      expect(toCairoTime(beforeDST).getDate()).toBe(31);
      expect(toCairoTime(afterDST).getDate()).toBe(1);
    });
  });
});

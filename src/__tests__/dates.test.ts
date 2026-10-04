import {
  addDays,
  formatDate,
  formatDateTime,
  isoToLocalDate,
  localDateToIso,
  todayIst,
} from '@/lib/dates';

describe('dates', () => {
  it('uses India time for today', () => {
    // 20:00 UTC on 4 Oct is 01:30 on 5 Oct in India.
    expect(todayIst(new Date('2026-10-04T20:00:00Z'))).toBe('2026-10-05');
    expect(todayIst(new Date('2026-10-04T10:00:00Z'))).toBe('2026-10-04');
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-10-04', 90)).toBe('2027-01-02');
  });

  it('round-trips through picker dates', () => {
    expect(localDateToIso(isoToLocalDate('2026-02-28'))).toBe('2026-02-28');
  });

  it('formats for reading', () => {
    expect(formatDate('2026-10-10')).toBe('10 Oct 2026');
  });

  it('formats a time in 12-hour style', () => {
    const local = new Date(2026, 9, 10, 16, 5);
    expect(formatDateTime(local.toISOString())).toBe('10 Oct, 4:05 pm');
    expect(formatDateTime(new Date(2026, 9, 10, 0, 30).toISOString())).toBe('10 Oct, 12:30 am');
  });
});

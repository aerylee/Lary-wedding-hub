import { addDays, csvObjects, daysBetween, dayOfWeek, isMidweek, parseCSV, parseDate, toCSV } from './util';

describe('dates', () => {
  it('parses date-only values at local noon', () => {
    const d = parseDate('2027-06-12')!;
    expect(d.getHours()).toBe(12);
    expect(d.getDate()).toBe(12);
  });
  it('adds days across month ends and DST', () => {
    expect(addDays('2027-03-27', 2)).toBe('2027-03-29');
    expect(addDays('2027-01-31', 1)).toBe('2027-02-01');
    expect(addDays('2027-06-12', -540)).toBe('2025-12-19');
  });
  it('counts whole days', () => {
    expect(daysBetween('2027-06-01', '2027-06-12')).toBe(11);
    expect(daysBetween('2027-06-12', '2027-06-01')).toBe(-11);
  });
  it('names the weekday and flags midweek dates', () => {
    expect(dayOfWeek('2027-06-12')).toBe('Saturday');
    expect(isMidweek('2027-06-09')).toBe(true);
    expect(isMidweek('2027-06-11')).toBe(false);
  });
});

describe('CSV', () => {
  it('round-trips quotes, commas and newlines', () => {
    const rows = [{ a: 'plain', b: 'has, comma' }, { a: 'has "quotes"', b: 'two\nlines' }];
    const back = parseCSV(toCSV(rows));
    expect(back).toEqual([['a', 'b'], ['plain', 'has, comma'], ['has "quotes"', 'two\nlines']]);
  });
  it('neutralises formula injection but leaves negative numbers alone', () => {
    const csv = toCSV([{ x: '=HYPERLINK("evil")', y: -12 }]);
    expect(csv).toContain(`"'=HYPERLINK(""evil"")"`);
    expect(csv).toContain('-12');
  });
  it('maps rows to lower-cased headers and skips blank lines', () => {
    expect(csvObjects('First Name,Email\r\nAnne,a@x.test\r\n\r\n')).toEqual([{ 'first name': 'Anne', email: 'a@x.test' }]);
  });
});

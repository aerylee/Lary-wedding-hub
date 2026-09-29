import { isIsoDate, verifyEvidence } from './evidence';

describe('verifyEvidence', () => {
  const source = 'Hello!\n\nOur quote is   €4,600 for two days.\nPlease confirm by 1 October 2027.';
  it('accepts a verbatim quote regardless of case and whitespace', () => {
    expect(verifyEvidence(source, 'our QUOTE is €4,600 for two days').ok).toBe(true);
    expect(verifyEvidence(source, 'Please confirm\nby 1 October 2027.').ok).toBe(true);
  });
  it('rejects paraphrase and short quotes', () => {
    expect(verifyEvidence(source, 'the quote was 4600 euros for two days').ok).toBe(false);
    expect(verifyEvidence(source, 'two days').ok).toBe(false);
    expect(verifyEvidence(source, null).ok).toBe(false);
  });
  it('treats curly and straight quotes alike', () => {
    expect(verifyEvidence("We can’t do the 12th, sorry about that", "We can't do the 12th, sorry").ok).toBe(true);
  });
});

describe('isIsoDate', () => {
  it('accepts only real dates', () => {
    expect(isIsoDate('2027-10-01')).toBe(true);
    expect(isIsoDate('2027-02-30')).toBe(false);
    expect(isIsoDate('1 October')).toBe(false);
  });
});

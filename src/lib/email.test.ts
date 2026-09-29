import { canAutofill, decodeEncodedWords, matchVendor, parseEmail } from './email';

const EML = [
  'Received: from mail.example',
  'From: =?UTF-8?Q?Giulia_Bianchi?= <Giulia@StudioLuce.example>',
  'To: "Rylee, R" <rylee@example.test>,',
  '  laurel@example.test',
  'Subject: =?UTF-8?B?UHJldmVudGl2byDigJQgbWF0cmltb25pbw==?=',
  'Date: Tue, 14 Sep 2027 10:12:00 +0200',
  'MIME-Version: 1.0',
  'Content-Type: multipart/alternative; boundary="b1"',
  '',
  '--b1',
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  'Our quote is =E2=82=AC4,600 for two days. Please confirm by 1 Octo=',
  'ber 2027.',
  '--b1',
  'Content-Type: text/html; charset=utf-8',
  '',
  '<p>ignored</p>',
  '--b1--',
].join('\r\n');

describe('parseEmail', () => {
  const e = parseEmail(EML);
  it('decodes encoded-word headers and unfolds continuation lines', () => {
    expect(e.subject).toBe('Preventivo — matrimonio');
    expect(e.from).toContain('Giulia Bianchi');
    expect(e.toAddrs).toEqual(['rylee@example.test', 'laurel@example.test']);
  });
  it('reads the date and the plain-text part, decoding quoted-printable', () => {
    expect(e.date).toBe('2027-09-14');
    expect(e.body).toBe('Our quote is €4,600 for two days. Please confirm by 1 October 2027.');
  });
  it('treats non-email text as a body only', () => {
    expect(parseEmail('just some notes')).toMatchObject({ subject: '', body: 'just some notes' });
  });
  it('joins adjacent encoded words', () => {
    expect(decodeEncodedWords('=?utf-8?q?a?= =?utf-8?q?b?=')).toBe('ab');
  });
});

describe('matchVendor', () => {
  const vendors = [{ id: 'v1', name: 'Studio Luce', email: 'giulia@studioluce.example' }];
  it('sender match means received, recipient match means sent', () => {
    expect(matchVendor(parseEmail(EML), vendors)).toMatchObject({ vendorId: 'v1', direction: 'received' });
    const sent = parseEmail('From: rylee@example.test\nTo: giulia@studioluce.example\nSubject: hi\n\nbody');
    expect(matchVendor(sent, vendors)).toMatchObject({ direction: 'sent' });
  });
  it('never matches on names', () => {
    expect(matchVendor(parseEmail('From: Studio Luce <other@x.example>\nSubject: x\n\nb'), vendors)).toBeNull();
  });
});

describe('canAutofill', () => {
  it('refuses PDFs honestly and caps size', () => {
    expect(canAutofill({ name: 'quote.pdf', size: 10 }).ok).toBe(false);
    expect(canAutofill({ name: 'a.eml', size: 10 }).ok).toBe(true);
    expect(canAutofill({ name: 'a.eml', size: 10_000_000 }).ok).toBe(false);
  });
});

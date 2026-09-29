import { checkAddress, formatForMail, guessCountry, parseAddressBlock } from './address';

describe('address parsing', () => {
  it('parses US locality lines', () => {
    expect(parseAddressBlock('1200 Larimer St\nApt 4\nDenver, CO 80202')).toEqual({
      street: '1200 Larimer St', line2: 'Apt 4', city: 'Denver', region: 'CO', postcode: '80202', country: 'United States',
    });
  });
  it('parses one-line comma addresses with a trailing country', () => {
    expect(parseAddressBlock('1200 Larimer St, Denver, CO 80202, USA')).toMatchObject({ city: 'Denver', region: 'CO', country: 'United States' });
  });
  it('parses UK addresses with the postcode on the town line or its own line', () => {
    expect(parseAddressBlock('14 Harbour Road\nLondon SW1A 1AA')).toMatchObject({ city: 'London', postcode: 'SW1A 1AA', country: 'United Kingdom' });
    expect(parseAddressBlock('14 Harbour Road\nLondon\nSW1A 1AA\nUnited Kingdom')).toMatchObject({ city: 'London', postcode: 'SW1A 1AA' });
  });
  it('parses European postcode-first localities', () => {
    expect(parseAddressBlock('Via Roma 12\n20121 Milano MI\nItaly')).toMatchObject({ postcode: '20121', city: 'Milano', region: 'MI', country: 'Italy' });
    expect(parseAddressBlock('3 rue de Rivoli\n75001 Paris\nFrance')).toMatchObject({ postcode: '75001', city: 'Paris' });
  });
  it('parses Canadian postcodes', () => {
    expect(parseAddressBlock('200 Bay St\nToronto, ON M5J 2J2')).toMatchObject({ region: 'ON', postcode: 'M5J 2J2', country: 'Canada' });
  });
  it('guesses the country from shapes', () => {
    expect(guessCountry('Denver CO 80202')).toBe('United States');
    expect(guessCountry('Toronto M5J 2J2')).toBe('Canada');
    expect(guessCountry('London SW1A 1AA')).toBe('United Kingdom');
    expect(guessCountry('Somewhere, Deutschland')).toBe('Germany');
  });
});

describe('formatting and checks', () => {
  it('orders lines per destination convention, country last in capitals', () => {
    expect(formatForMail({ street: 'Via Roma 12', line2: '', city: 'Milano', region: 'MI', postcode: '20121', country: 'Italy' }))
      .toBe('Via Roma 12\n20121 Milano MI\nITALY');
    expect(formatForMail({ street: '14 Harbour Road', line2: '', city: 'London', region: '', postcode: 'sw1a 1aa', country: 'United Kingdom' }))
      .toBe('14 Harbour Road\nLONDON\nSW1A 1AA\nUNITED KINGDOM');
    expect(formatForMail({ street: '1 Main St', line2: '', city: 'Denver', region: 'CO', postcode: '80202', country: 'United States' }))
      .toBe('1 Main St\nDenver, CO  80202\nUNITED STATES');
  });
  it('warns on missing parts and bad shapes, without blocking', () => {
    expect(checkAddress({ street: '1 Main St', line2: '', city: 'Denver', region: 'ZZ', postcode: '802', country: 'United States' })).toEqual([
      'Postcode "802" doesn\'t look right for United States — expected 5 digits (or ZIP+4).',
      '"ZZ" isn\'t a US state code.',
    ]);
    expect(checkAddress({ street: '', line2: '', city: '', region: '', postcode: '', country: '' })).toHaveLength(3);
  });
});

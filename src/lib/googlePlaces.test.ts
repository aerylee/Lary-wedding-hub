import { componentsToParts } from './googlePlaces';
import { formatForMail } from './address';

const c = (types: string[], longText: string, shortText = longText) => ({ types, longText, shortText });

describe('componentsToParts', () => {
  it('maps a US address with the state code', () => {
    const parts = componentsToParts([
      c(['street_number'], '1200'), c(['route'], 'Larimer Street', 'Larimer St'), c(['subpremise'], 'Apt 4'),
      c(['locality', 'political'], 'Denver'), c(['administrative_area_level_1', 'political'], 'Colorado', 'CO'),
      c(['postal_code'], '80202'), c(['country', 'political'], 'United States', 'US'),
    ]);
    expect(parts).toEqual({ street: '1200 Larimer Street', line2: 'Apt 4', city: 'Denver', region: 'CO', postcode: '80202', country: 'United States' });
    expect(formatForMail(parts)).toBe('1200 Larimer Street\nApt 4\nDenver, CO  80202\nUNITED STATES');
  });
  it('puts the house number after the street in Italy, with the province code', () => {
    const parts = componentsToParts([
      c(['street_number'], '12'), c(['route'], 'Via Roma'), c(['locality'], 'Milano'),
      c(['administrative_area_level_2'], 'Città Metropolitana di Milano', 'MI'), c(['administrative_area_level_1'], 'Lombardia', 'Lombardia'),
      c(['postal_code'], '20121'), c(['country'], 'Italy', 'IT'),
    ]);
    expect(formatForMail(parts)).toBe('Via Roma 12\n20121 Milano MI\nITALY');
  });
  it('uses the postal town in the UK and leaves out the constituent country', () => {
    const parts = componentsToParts([
      c(['street_number'], '14'), c(['route'], 'Harbour Road'), c(['postal_town'], 'London'),
      c(['administrative_area_level_1'], 'England', 'England'), c(['postal_code'], 'SW1A 1AA'), c(['country'], 'United Kingdom', 'GB'),
    ]);
    expect(parts).toMatchObject({ city: 'London', region: '', postcode: 'SW1A 1AA', country: 'United Kingdom' });
  });
});

// Offline, deterministic address handling (main spec §10). No geocoder, nothing checked
// against a real address database — the UI says so. It splits, reorders and warns; it
// never blocks saving.

export type AddressParts = {
  street: string;
  line2: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
};

export const EMPTY_ADDRESS: AddressParts = { street: '', line2: '', city: '', region: '', postcode: '', country: '' };

// ~70 countries guests are likely to live in, with the aliases people actually type.
const COUNTRY_TABLE: [string, string[]][] = [
  ['United States', ['usa', 'us', 'u.s.', 'u.s.a.', 'united states of america', 'america']],
  ['Canada', ['ca', 'can']],
  ['United Kingdom', ['uk', 'u.k.', 'gb', 'great britain', 'england', 'scotland', 'wales', 'northern ireland']],
  ['Ireland', ['eire', 'republic of ireland', 'ie']],
  ['Australia', ['au', 'aus']],
  ['New Zealand', ['nz']],
  ['Italy', ['italia', 'it']],
  ['France', ['fr']],
  ['Germany', ['deutschland', 'de']],
  ['Spain', ['españa', 'espana', 'es']],
  ['Portugal', ['pt']],
  ['Netherlands', ['the netherlands', 'holland', 'nederland', 'nl']],
  ['Belgium', ['belgique', 'belgië', 'be']],
  ['Switzerland', ['schweiz', 'suisse', 'svizzera', 'ch']],
  ['Austria', ['österreich', 'osterreich', 'at']],
  ['Denmark', ['danmark', 'dk']],
  ['Sweden', ['sverige', 'se']],
  ['Norway', ['norge', 'no']],
  ['Finland', ['suomi', 'fi']],
  ['Iceland', ['ísland', 'is']],
  ['Greece', ['hellas', 'gr']],
  ['Poland', ['polska', 'pl']],
  ['Czech Republic', ['czechia', 'cz']],
  ['Slovakia', ['sk']],
  ['Hungary', ['magyarország', 'hu']],
  ['Romania', ['ro']],
  ['Bulgaria', ['bg']],
  ['Croatia', ['hrvatska', 'hr']],
  ['Slovenia', ['si']],
  ['Serbia', ['rs']],
  ['Luxembourg', ['lu']],
  ['Malta', ['mt']],
  ['Cyprus', ['cy']],
  ['Estonia', ['ee']],
  ['Latvia', ['lv']],
  ['Lithuania', ['lt']],
  ['Monaco', ['mc']],
  ['Turkey', ['türkiye', 'turkiye', 'tr']],
  ['Israel', ['il']],
  ['United Arab Emirates', ['uae', 'ae']],
  ['Saudi Arabia', ['sa']],
  ['Qatar', ['qa']],
  ['Egypt', ['eg']],
  ['Morocco', ['ma']],
  ['South Africa', ['za', 'rsa']],
  ['Kenya', ['ke']],
  ['Nigeria', ['ng']],
  ['India', ['in']],
  ['Pakistan', ['pk']],
  ['Sri Lanka', ['lk']],
  ['China', ['prc', 'cn']],
  ['Hong Kong', ['hk']],
  ['Taiwan', ['tw']],
  ['Japan', ['jp']],
  ['South Korea', ['korea', 'republic of korea', 'kr']],
  ['Singapore', ['sg']],
  ['Malaysia', ['my']],
  ['Thailand', ['th']],
  ['Vietnam', ['viet nam', 'vn']],
  ['Philippines', ['ph']],
  ['Indonesia', ['id']],
  ['Mexico', ['méxico', 'mx']],
  ['Brazil', ['brasil', 'br']],
  ['Argentina', ['ar']],
  ['Chile', ['cl']],
  ['Colombia', ['co']],
  ['Peru', ['pe']],
  ['Costa Rica', ['cr']],
  ['Puerto Rico', ['pr']],
  ['Jamaica', ['jm']],
];

export const COUNTRIES: string[] = COUNTRY_TABLE.map(([n]) => n).sort();

const ALIAS = new Map<string, string>();
for (const [name, aliases] of COUNTRY_TABLE) {
  ALIAS.set(name.toLowerCase(), name);
  for (const a of aliases) if (a.length > 2) ALIAS.set(a, name);
}
// two-letter codes only when they stand alone on the country line
const CODE = new Map<string, string>();
for (const [name, aliases] of COUNTRY_TABLE) for (const a of aliases) if (a.length === 2) CODE.set(a, name);

export function normaliseCountry(s: string): string {
  const k = s.trim().toLowerCase().replace(/\.$/, '');
  if (!k) return '';
  return ALIAS.get(k) ?? CODE.get(k) ?? '';
}

export const US_STATES = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR VI GU AS MP AA AE AP'.split(' '));
export const CA_PROVINCES = new Set('AB BC MB NB NL NS NT NU ON PE QC SK YT'.split(' '));
const AU_STATES = new Set('NSW VIC QLD WA SA TAS ACT NT'.split(' '));

const RE = {
  usLocality: /^(.+?),?\s+([A-Za-z]{2})\.?\s+(\d{5}(?:-\d{4})?)$/,
  caLocality: /^(.+?),?\s+([A-Za-z]{2})\.?\s+([A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d)$/,
  auLocality: /^(.+?)\s+(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s+(\d{4})$/i,
  ukPostcode: /^([A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2})$/,
  ukLocality: /^(.+?)[,\s]+([A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2})$/,
  euLocality: /^((?:[A-Za-z]{1,2}-)?\d{4,5}(?:-\d{3})?(?:\s?[A-Za-z]{2})?)\s+(.+)$/,
  caPostcode: /\b[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d\b/,
  usStateZip: /\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/,
  ukPostcodeAnywhere: /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/,
};

/** Best guess at the country from a named country, a US state + ZIP, a Canadian or UK postcode. */
export function guessCountry(text: string): string {
  const lines = text.split(/\n|,/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const c = normaliseCountry(lines[i]);
    if (c) return c;
  }
  const us = RE.usStateZip.exec(text);
  if (us && US_STATES.has(us[1])) return 'United States';
  if (RE.caPostcode.test(text)) return 'Canada';
  if (RE.ukPostcodeAnywhere.test(text.toUpperCase())) return 'United Kingdom';
  return '';
}

function splitLines(raw: string): string[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) return lines.map((l) => l.replace(/,$/, ''));
  // one line: "1200 Larimer St, Denver, CO 80202, USA"
  return raw.split(',').map((l) => l.trim()).filter(Boolean);
}

/** Split a pasted block into street / second line / city / region / postcode / country. */
export function parseAddressBlock(raw: string): AddressParts {
  const out: AddressParts = { ...EMPTY_ADDRESS };
  let lines = splitLines(raw);
  if (!lines.length) return out;

  // a trailing country line
  const last = normaliseCountry(lines[lines.length - 1]);
  if (last) {
    out.country = last;
    lines = lines.slice(0, -1);
  }

  // one-line inputs arrive as "Denver" + "CO 80202" — rejoin a lone "ST 12345" tail
  if (lines.length >= 2 && /^[A-Za-z]{2,3}\s+[\dA-Za-z]{3,}(\s?[\dA-Za-z]{3})?$/.test(lines[lines.length - 1]) && !RE.ukPostcode.test(lines[lines.length - 1])) {
    const tail = lines.pop()!;
    lines[lines.length - 1] = `${lines[lines.length - 1]} ${tail}`;
  }

  // UK style: postcode alone on the last line, town above it
  if (lines.length >= 2 && RE.ukPostcode.test(lines[lines.length - 1])) {
    out.postcode = lines.pop()!.toUpperCase();
    out.city = lines.pop()!;
    out.country ||= 'United Kingdom';
  } else if (lines.length >= 1) {
    const loc = lines[lines.length - 1];
    let m: RegExpExecArray | null;
    if ((m = RE.caLocality.exec(loc)) && CA_PROVINCES.has(m[2].toUpperCase())) {
      [out.city, out.region, out.postcode] = [m[1], m[2].toUpperCase(), m[3].toUpperCase()];
      out.country ||= 'Canada';
      lines.pop();
    } else if ((m = RE.usLocality.exec(loc)) && US_STATES.has(m[2].toUpperCase())) {
      [out.city, out.region, out.postcode] = [m[1], m[2].toUpperCase(), m[3]];
      out.country ||= 'United States';
      lines.pop();
    } else if ((m = RE.auLocality.exec(loc)) && AU_STATES.has(m[2].toUpperCase())) {
      [out.city, out.region, out.postcode] = [m[1], m[2].toUpperCase(), m[3]];
      out.country ||= 'Australia';
      lines.pop();
    } else if ((m = RE.euLocality.exec(loc)) && lines.length > 1) {
      out.postcode = m[1];
      let city = m[2];
      const prov = /^(.+?)\s*\(?\b([A-Z]{2})\)?$/.exec(city);
      if (prov && out.country === 'Italy') {
        city = prov[1];
        out.region = prov[2];
      }
      out.city = city;
      lines.pop();
    } else if ((m = RE.ukLocality.exec(loc)) && lines.length > 1 && !/^\d/.test(loc)) {
      [out.city, out.postcode] = [m[1], m[2].toUpperCase()];
      out.country ||= 'United Kingdom';
      lines.pop();
    } else if (lines.length > 1) {
      out.city = loc;
      lines.pop();
    }
  }

  out.street = lines[0] ?? '';
  out.line2 = lines.slice(1).join(', ');
  if (!out.country) out.country = guessCountry(raw);
  return out;
}

const ONE_LINE_LOCALITY = new Set(['United States', 'Canada', 'Australia', 'New Zealand', 'Puerto Rico']);
const SEPARATE_POSTCODE = new Set(['United Kingdom', 'Ireland']);
const POSTCODE_FIRST = new Set([
  'Italy', 'France', 'Germany', 'Spain', 'Portugal', 'Netherlands', 'Belgium', 'Switzerland', 'Austria',
  'Denmark', 'Sweden', 'Norway', 'Finland', 'Iceland', 'Greece', 'Poland', 'Czech Republic', 'Slovakia',
  'Hungary', 'Croatia', 'Slovenia', 'Luxembourg', 'Monaco', 'Estonia', 'Latvia', 'Lithuania', 'Romania',
  'Bulgaria', 'Serbia', 'Turkey', 'Israel', 'Mexico', 'Argentina', 'Chile', 'Brazil',
]);

/** Order the lines the way the destination post office expects; country last, upper-cased. */
export function formatForMail(p: AddressParts): string {
  const lines: string[] = [];
  if (p.street) lines.push(p.street);
  if (p.line2) lines.push(p.line2);
  const c = p.country;
  if (ONE_LINE_LOCALITY.has(c)) {
    const sep = c === 'Australia' || c === 'New Zealand' ? ' ' : ', ';
    const loc = [p.city, [p.region, p.postcode].filter(Boolean).join(c === 'United States' || c === 'Puerto Rico' || c === 'Canada' ? '  ' : ' ')]
      .filter(Boolean)
      .join(sep);
    if (loc) lines.push(c === 'Australia' ? loc.toUpperCase() : loc);
  } else if (SEPARATE_POSTCODE.has(c)) {
    if (p.city) lines.push(p.city.toUpperCase());
    if (p.region) lines.push(p.region);
    if (p.postcode) lines.push(p.postcode.toUpperCase());
  } else if (POSTCODE_FIRST.has(c)) {
    const loc = [p.postcode, p.city, c === 'Italy' && p.region ? p.region.toUpperCase() : ''].filter(Boolean).join(' ');
    if (loc) lines.push(loc);
    if (p.region && c !== 'Italy') lines.push(p.region);
  } else {
    const loc = [p.city, p.region, p.postcode].filter(Boolean).join(' ');
    if (loc) lines.push(loc);
  }
  if (c) lines.push(c.toUpperCase());
  return lines.join('\n');
}

const POSTCODE_SHAPES: Record<string, [RegExp, string]> = {
  'United States': [/^\d{5}(-\d{4})?$/, '5 digits (or ZIP+4)'],
  Canada: [/^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i, 'A1A 1A1'],
  'United Kingdom': [/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i, 'like SW1A 1AA'],
  Ireland: [/^[A-Z]\d{2} ?[A-Z\d]{4}$/i, 'an Eircode like D02 X285'],
  Australia: [/^\d{4}$/, '4 digits'],
  'New Zealand': [/^\d{4}$/, '4 digits'],
  Italy: [/^\d{5}$/, '5 digits (CAP)'],
  France: [/^\d{5}$/, '5 digits'],
  Germany: [/^\d{5}$/, '5 digits'],
  Spain: [/^\d{5}$/, '5 digits'],
  Portugal: [/^\d{4}-\d{3}$/, '1234-567'],
  Netherlands: [/^\d{4} ?[A-Z]{2}$/i, '1234 AB'],
  Belgium: [/^\d{4}$/, '4 digits'],
  Switzerland: [/^\d{4}$/, '4 digits'],
  Austria: [/^\d{4}$/, '4 digits'],
  Denmark: [/^\d{4}$/, '4 digits'],
  Sweden: [/^\d{3} ?\d{2}$/, '123 45'],
  Norway: [/^\d{4}$/, '4 digits'],
  Finland: [/^\d{5}$/, '5 digits'],
  Greece: [/^\d{3} ?\d{2}$/, '123 45'],
  Poland: [/^\d{2}-\d{3}$/, '12-345'],
  Japan: [/^\d{3}-?\d{4}$/, '123-4567'],
  India: [/^\d{6}$/, '6 digits'],
  Mexico: [/^\d{5}$/, '5 digits'],
  Brazil: [/^\d{5}-?\d{3}$/, '12345-678'],
};
const NO_POSTCODE = new Set(['Hong Kong', 'United Arab Emirates', 'Qatar', 'Jamaica']);

/** What is missing or malformed. Warnings only — it never blocks saving. */
export function checkAddress(p: AddressParts): string[] {
  const w: string[] = [];
  if (!p.street.trim()) w.push('No street line.');
  if (!p.city.trim()) w.push('No town or city.');
  if (!p.country.trim()) w.push('No country — international mail needs one.');
  const shape = POSTCODE_SHAPES[p.country];
  if (!p.postcode.trim()) {
    if (p.country && !NO_POSTCODE.has(p.country)) w.push('No postcode.');
  } else if (shape && !shape[0].test(p.postcode.trim())) {
    w.push(`Postcode "${p.postcode}" doesn't look right for ${p.country} — expected ${shape[1]}.`);
  }
  if (p.country === 'United States') {
    if (!p.region) w.push('No state.');
    else if (!US_STATES.has(p.region.toUpperCase())) w.push(`"${p.region}" isn't a US state code.`);
  }
  if (p.country === 'Canada') {
    if (!p.region) w.push('No province.');
    else if (!CA_PROVINCES.has(p.region.toUpperCase())) w.push(`"${p.region}" isn't a Canadian province code.`);
  }
  return w;
}

// Google Maps address autocomplete (Places API, "New"). Optional: without
// VITE_GOOGLE_MAPS_API_KEY the app falls back to the offline address tools in address.ts.
//
// The key is a browser key: restrict it in Google Cloud to this site's URLs and to the
// Maps JavaScript API + Places API (New), or anyone could spend it.
import { formatForMail, normaliseCountry, type AddressParts } from './address';

const KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? '';
export const placesEnabled = KEY.length > 0;

// The slice of the Places library this file uses. Declared here rather than pulling in
// @types/google.maps for a handful of calls.
type AddressComponent = { longText: string | null; shortText: string | null; types: string[] };
type Place = { fetchFields: (o: { fields: string[] }) => Promise<unknown>; addressComponents?: AddressComponent[]; formattedAddress?: string };
type PlacePrediction = { placeId: string; text: { text: string }; toPlace: () => Place };
type Suggestion = { placePrediction: PlacePrediction | null };
type PlacesLib = {
  AutocompleteSuggestion: { fetchAutocompleteSuggestions: (req: { input: string; sessionToken?: unknown }) => Promise<{ suggestions: Suggestion[] }> };
  AutocompleteSessionToken: new () => unknown;
};

let loading: Promise<PlacesLib> | null = null;

/** Load the Maps JavaScript API once, then the places library. */
export function loadPlaces(): Promise<PlacesLib> {
  if (!placesEnabled) return Promise.reject(new Error('Google Maps is not configured'));
  if (loading) return loading;
  loading = new Promise<PlacesLib>((resolve, reject) => {
    const w = window as unknown as { google?: { maps?: { importLibrary: (n: string) => Promise<unknown> } }; __hubMapsReady?: () => void };
    const done = () => w.google!.maps!.importLibrary('places').then((lib) => resolve(lib as PlacesLib), reject);
    if (w.google?.maps?.importLibrary) return void done();
    w.__hubMapsReady = done;
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&v=weekly&loading=async&libraries=places&callback=__hubMapsReady`;
    s.async = true;
    s.onerror = () => {
      loading = null;
      reject(new Error('Could not load Google Maps'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export type AddressSuggestion = { id: string; label: string; prediction: PlacePrediction };

export async function suggestAddresses(input: string, sessionToken: unknown): Promise<AddressSuggestion[]> {
  const lib = await loadPlaces();
  const { suggestions } = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input, sessionToken });
  return suggestions
    .map((s) => s.placePrediction)
    .filter((p): p is PlacePrediction => !!p)
    .map((p) => ({ id: p.placeId, label: p.text.text, prediction: p }));
}

export async function newSessionToken(): Promise<unknown> {
  const lib = await loadPlaces();
  return new lib.AutocompleteSessionToken();
}

/** Fetch the chosen place's components and turn them into mailing-address parts. */
export async function addressFromSuggestion(s: AddressSuggestion): Promise<{ parts: AddressParts; block: string }> {
  const place = s.prediction.toPlace();
  await place.fetchFields({ fields: ['addressComponents', 'formattedAddress'] });
  const parts = componentsToParts(place.addressComponents ?? []);
  return { parts, block: formatForMail(parts) };
}

// Countries where the house number follows the street name ("Via Roma 12").
const NUMBER_AFTER_STREET = new Set([
  'DE', 'AT', 'CH', 'IT', 'ES', 'PT', 'NL', 'BE', 'DK', 'SE', 'NO', 'FI', 'IS', 'PL', 'CZ', 'SK', 'HU', 'HR', 'SI',
  'RS', 'GR', 'TR', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE',
]);
// Where the state/province code is part of the mailing address.
const REGION_CODE = new Set(['US', 'CA', 'AU', 'BR', 'MX', 'PR']);

/** Pure mapping from Google address components to our AddressParts. */
export function componentsToParts(components: AddressComponent[]): AddressParts {
  const get = (type: string, short = false) => {
    const c = components.find((x) => x.types.includes(type));
    return (short ? c?.shortText : c?.longText) ?? '';
  };
  const cc = get('country', true).toUpperCase();
  const number = get('street_number');
  const route = get('route');
  const street = [number, route].filter(Boolean);
  const countryName = get('country');

  let region = '';
  if (REGION_CODE.has(cc)) region = get('administrative_area_level_1', true);
  else if (cc === 'IT') region = get('administrative_area_level_2', true); // province code, e.g. MI

  return {
    street: (NUMBER_AFTER_STREET.has(cc) ? street.reverse() : street).join(' ') || get('premise') || get('point_of_interest'),
    line2: [get('subpremise'), number || route ? get('premise') : ''].filter(Boolean).join(', '),
    city: get('locality') || get('postal_town') || get('sublocality_level_1') || get('administrative_area_level_2'),
    region,
    postcode: get('postal_code'),
    country: normaliseCountry(countryName) || countryName,
  };
}

const GEOAPIFY_KEY = '4566ba494f5a4c6d8ad8cb137d73aae2';
const BASE = 'https://api.geoapify.com/v1/geocode';

export interface GeoapifySuggestion {
  formatted: string;
  lat: number;
  lng: number;
  city?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  country?: string;
  countryCode?: string;
}

export interface GeoapifyResult {
  formatted: string;
  lat: number;
  lng: number;
}

type GeoapifyRawResult = {
  formatted?: string;
  lat?: number | string;
  lon?: number | string;
  lng?: number | string;
  city?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
};

const toSuggestion = (raw: GeoapifyRawResult): GeoapifySuggestion | null => {
  const lat = Number(raw.lat);
  const lng = Number(raw.lon ?? raw.lng);
  const formatted = raw.formatted?.trim() || '';

  if (!formatted || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    formatted,
    lat,
    lng,
    city: raw.city,
    street: raw.street,
    housenumber: raw.housenumber,
    postcode: raw.postcode,
    country: raw.country,
    countryCode: raw.country_code,
  };
};

const readResults = (data: any): GeoapifyRawResult[] => {
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.features)) {
    return data.features
      .map((feature: any) => feature?.properties)
      .filter(Boolean);
  }
  return [];
};

/** Search for address suggestions as the user types */
export async function autocomplete(query: string): Promise<GeoapifySuggestion[]> {
  if (!query || query.trim().length < 3) return [];

  const url = `${BASE}/autocomplete?text=${encodeURIComponent(query)}&format=json&apiKey=${GEOAPIFY_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return readResults(data)
      .map(toSuggestion)
      .filter((item): item is GeoapifySuggestion => item !== null);
  } catch {
    return [];
  }
}

/** Reverse geocode: lat/lng → address string */
export async function reverseGeocodeDetails(lat: number, lng: number): Promise<GeoapifySuggestion | null> {
  const url = `${BASE}/reverse?lat=${lat}&lon=${lng}&format=json&apiKey=${GEOAPIFY_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return toSuggestion(readResults(data)[0] || {});
  } catch {
    return null;
  }
}

/** Reverse geocode: lat/lng → address string */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const result = await reverseGeocodeDetails(lat, lng);
  return result?.formatted || null;
}

/** Forward geocode: address string → { lat, lng, formatted } */
export async function forwardGeocode(
  address: string,
): Promise<GeoapifyResult | null> {
  if (!address.trim()) return null;

  const url = `${BASE}/search?text=${encodeURIComponent(address)}&format=json&limit=1&apiKey=${GEOAPIFY_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const suggestion = toSuggestion(readResults(data)[0] || {});
    if (!suggestion) return null;
    return {
      formatted: suggestion.formatted,
      lat: suggestion.lat,
      lng: suggestion.lng,
    };
  } catch {
    return null;
  }
}

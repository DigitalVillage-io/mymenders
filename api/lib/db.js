import crypto from 'node:crypto';
import { normalizeTaxonomyValues } from '../../shared/vendorTaxonomy.js';

export const APPROXIMATE_RADIUS_KM = 0.2;
const APPROXIMATE_POINT_OFFSET_MIN_KM = 0.075;
const APPROXIMATE_POINT_OFFSET_MAX_KM = 0.15;

export const normalizeStringArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') {
    if (!value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch {
      // Fall through to delimiter-based parsing.
    }
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

export const normalizeRating = (value) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.min(5, Math.max(0, parsed));
};

export const normalizeRatingCount = (value) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
};

export const safeParseMetadata = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const TAXONOMY_LABELS = {
  types: 'type',
  categories: 'category',
  regional_techniques: 'regional technique',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeOptionalContact = (value) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
};

const normalizeVendorEmail = (value) => {
  const normalized = normalizeOptionalContact(value);
  if (normalized && !EMAIL_PATTERN.test(normalized)) {
    throw new ValidationError('A valid email address is required');
  }
  return normalized;
};

const stripLegacyContactMetadata = (metadata) => {
  const {
    online_presence: _onlinePresence,
    website: _website,
    social: _social,
    email: _email,
    ...rest
  } = metadata;
  return rest;
};

const canonicalizeTaxonomyArray = (group, value) => {
  const values = normalizeStringArray(value);

  try {
    return normalizeTaxonomyValues(group, values, { allowUnknown: false });
  } catch (error) {
    const unknownValue = error?.unknownValues?.[0] || 'unknown';
    throw new ValidationError(`Unknown ${TAXONOMY_LABELS[group]} value: ${unknownValue}`);
  }
};

const normalizeLocationVisibility = (value, entryLevel, types, fallback = 'exact') => {
  if (entryLevel === 'Member of the public') return 'approx';
  if (value === 'exact' || value === 'approx') return value;
  if (fallback === 'exact' || fallback === 'approx') return fallback;
  return entryLevel === 'Menders' && types.includes('home') ? 'approx' : 'exact';
};

const generalizeAddress = (value) => {
  const parts = String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return 'Approximate area';

  const isPostalCode = (part) => /(?:\b\d{4,6}\b|\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b)/i.test(part);
  const broadParts = parts.filter((part, index) => index > 0 || parts.length === 2)
    .filter((part) => !isPostalCode(part));
  const selected = broadParts.slice(-2);
  return selected.length ? selected.join(', ') : 'Approximate area';
};

const createApproximateLocation = (latitude, longitude, address) => {
  const bearing = (crypto.randomInt(0, 360000) / 1000) * (Math.PI / 180);
  const distanceKm = APPROXIMATE_POINT_OFFSET_MIN_KM
    + (crypto.randomInt(0, 1000000) / 1000000)
      * (APPROXIMATE_POINT_OFFSET_MAX_KM - APPROXIMATE_POINT_OFFSET_MIN_KM);
  const latitudeOffset = (distanceKm * Math.cos(bearing)) / 6371 * (180 / Math.PI);
  const longitudeOffset = (distanceKm * Math.sin(bearing))
    / (6371 * Math.max(0.15, Math.cos(latitude * (Math.PI / 180)))) * (180 / Math.PI);

  return {
    address: generalizeAddress(address),
    latitude: Math.max(-89.9, Math.min(89.9, latitude + latitudeOffset)),
    longitude: Math.max(-180, Math.min(180, longitude + longitudeOffset)),
    radiusKm: APPROXIMATE_RADIUS_KM,
  };
};

const validCoordinate = (value) => Number.isFinite(Number(value));

const publicLocationForRow = (row) => {
  const isApproximate = row.location_visibility === 'approx';
  if (!isApproximate) {
    return {
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      location_visibility: 'exact',
    };
  }

  return {
    latitude: row.public_latitude,
    longitude: row.public_longitude,
    location_visibility: 'approx',
    location_radius_km: APPROXIMATE_RADIUS_KM,
  };
};

// This is the only shape allowed to leave the public vendors endpoint. In
// particular, it never spreads the database row, because the canonical
// address and coordinates are private even when the public point is exact.
export const publicVendor = (row) => {
  const metadata = safeParseMetadata(row.photos);
  const location = publicLocationForRow(row);
  return {
    id: row.id,
    status: row.status,
    name: row.name,
    ...location,
    category: row.category,
    entry_level: metadata.entry_level || row.entry_level || row.category,
    types: normalizeTaxonomyValues('types', metadata.types || []),
    categories: normalizeTaxonomyValues('categories', metadata.categories || []),
    regional_techniques: normalizeTaxonomyValues('regional_techniques', metadata.regional_techniques || []),
    rating: row.rating ?? metadata.rating ?? 0,
    rating_count: row.rating_count ?? metadata.rating_count ?? 0,
    phone: row.phone || null,
    website: row.website || metadata.website || metadata.online_presence || null,
    social: row.social || metadata.social || null,
    email: row.email || metadata.email || null,
    hours: row.hours || null,
    photo_url: row.photo_url || null,
    review_text: metadata.review_text || null,
  };
};

export async function insertVendor(pool, data) {
  const {
    name,
    address,
    latitude,
    longitude,
    category,
    phone,
    website,
    social,
    email,
    hours,
    photo_url,
    photos,
    entry_level,
    types,
    categories,
    regional_techniques,
    review_text,
    rating,
    rating_count,
    location_visibility,
  } = data;

  if (!name || latitude === undefined || longitude === undefined) {
    throw new ValidationError('Name, latitude, and longitude are required');
  }

  const incomingPhotos = stripLegacyContactMetadata(safeParseMetadata(photos));
  const normalizedWebsite = normalizeOptionalContact(website);
  const normalizedSocial = normalizeOptionalContact(social);
  const normalizedEmail = normalizeVendorEmail(email);
  const resolvedEntryLevel = entry_level === 'Member of the public' || category === 'Member of the public'
    ? 'Member of the public'
    : entry_level || category || 'Menders';
  const resolvedTypes = canonicalizeTaxonomyArray('types', types ?? incomingPhotos.types);
  const resolvedVisibility = normalizeLocationVisibility(
    location_visibility,
    resolvedEntryLevel,
    resolvedTypes,
    resolvedEntryLevel === 'Menders' && resolvedTypes.includes('home') ? 'approx' : 'exact',
  );
  const approximateLocation = resolvedVisibility === 'approx'
    ? createApproximateLocation(Number(latitude), Number(longitude), address)
    : null;

  const parsedPhotos = {
    ...incomingPhotos,
    entry_level: resolvedEntryLevel,
    types: resolvedTypes,
    categories: canonicalizeTaxonomyArray('categories', categories ?? incomingPhotos.categories),
    regional_techniques: canonicalizeTaxonomyArray(
      'regional_techniques',
      regional_techniques ?? incomingPhotos.regional_techniques,
    ),
    review_text: review_text || undefined,
    rating: normalizeRating(rating),
    rating_count: normalizeRatingCount(rating_count),
  };

  const result = await pool.query(
    `INSERT INTO vendors (name, address, latitude, longitude, category, phone, website, social, email, hours, photo_url, photos, status,
      location_visibility, public_address, public_latitude, public_longitude, public_radius_km)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft', $13, $14, $15, $16, $17)
     RETURNING *`,
    [
      name,
      address || null,
      latitude,
      longitude,
      entry_level || category || 'Menders',
      phone || null,
      normalizedWebsite,
      normalizedSocial,
      normalizedEmail,
      normalizeOptionalContact(hours),
      photo_url || null,
      JSON.stringify(parsedPhotos),
      resolvedVisibility,
      approximateLocation?.address || null,
      approximateLocation?.latitude ?? null,
      approximateLocation?.longitude ?? null,
      approximateLocation?.radiusKm || APPROXIMATE_RADIUS_KM,
    ],
  );

  return result.rows[0];
}

export async function updateVendor(pool, id, data) {
  const vendorId = Number(id);
  if (!Number.isInteger(vendorId) || vendorId <= 0) throw new ValidationError('Valid vendor id is required');
  const currentResult = await pool.query('SELECT * FROM vendors WHERE id=$1 AND is_deleted = false', [vendorId]);
  const current = currentResult.rows[0];
  if (!current) throw new ValidationError('Mender not found');

  const name = String(data.name || '').trim();
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new ValidationError('Name, latitude, and longitude are required');
  }
  const photos = stripLegacyContactMetadata(safeParseMetadata(data.photos));
  const normalizedWebsite = normalizeOptionalContact(data.website);
  const normalizedSocial = normalizeOptionalContact(data.social);
  const normalizedEmail = normalizeVendorEmail(data.email);
  const nextTypes = canonicalizeTaxonomyArray('types', data.types);
  const entryLevel = data.entry_level === 'Member of the public' || data.category === 'Member of the public'
    ? 'Member of the public'
    : data.entry_level || data.category || 'Menders';
  const nextPhotos = {
    ...photos,
    entry_level: entryLevel,
    types: nextTypes,
    categories: canonicalizeTaxonomyArray('categories', data.categories),
    regional_techniques: canonicalizeTaxonomyArray('regional_techniques', data.regional_techniques),
    review_text: data.review_text || undefined,
    rating: normalizeRating(data.rating),
    rating_count: normalizeRatingCount(data.rating_count),
  };
  const status = data.status === 'draft' || data.status === 'active' ? data.status : null;
  const locationVisibility = normalizeLocationVisibility(
    data.location_visibility,
    entryLevel,
    nextTypes,
    current.location_visibility || 'exact',
  );
  const canonicalLocationChanged = String(current.address || '').trim() !== String(data.address || '').trim()
    || Number(current.latitude) !== latitude
    || Number(current.longitude) !== longitude;
  const currentPublicLocation = current.location_visibility === 'approx'
    && !canonicalLocationChanged
    && current.public_address
    && validCoordinate(current.public_latitude)
    && validCoordinate(current.public_longitude)
    ? {
        address: current.public_address,
        latitude: Number(current.public_latitude),
        longitude: Number(current.public_longitude),
        radiusKm: APPROXIMATE_RADIUS_KM,
      }
    : null;
  const approximateLocation = locationVisibility === 'approx'
    ? currentPublicLocation || createApproximateLocation(latitude, longitude, data.address)
    : null;
  const result = await pool.query(
    `UPDATE vendors SET name=$2, address=$3, latitude=$4, longitude=$5, category=$6,
      phone=$7, website=$8, social=$9, email=$10, hours=$11, photo_url=$12, photos=$13,
      status=COALESCE($14, status), location_visibility=$15, public_address=$16,
      public_latitude=$17, public_longitude=$18, public_radius_km=$19
     WHERE id=$1 AND is_deleted = false RETURNING *`,
    [vendorId, name, data.address || null, latitude, longitude, entryLevel,
      normalizeOptionalContact(data.phone), normalizedWebsite, normalizedSocial, normalizedEmail,
      normalizeOptionalContact(data.hours), data.photo_url || null, JSON.stringify(nextPhotos), status,
      locationVisibility, approximateLocation?.address || null, approximateLocation?.latitude ?? null,
      approximateLocation?.longitude ?? null, approximateLocation?.radiusKm || APPROXIMATE_RADIUS_KM],
  );
  if (!result.rows[0]) throw new ValidationError('Mender not found');
  return result.rows[0];
}

export async function activateVendor(pool, id) {
  const result = await pool.query(`UPDATE vendors SET status='active' WHERE id=$1 AND is_deleted = false RETURNING *`, [Number(id)]);
  if (!result.rows[0]) throw new ValidationError('Mender not found');
  return result.rows[0];
}

export async function insertEmailSub(pool, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw new ValidationError('A valid email address is required');
  }

  const result = await pool.query(
    `INSERT INTO email_subs (email) VALUES ($1)
     ON CONFLICT (email) DO NOTHING
     RETURNING *`,
    [normalizedEmail],
  );

  if (result.rows[0]) return result.rows[0];

  const existing = await pool.query(`SELECT * FROM email_subs WHERE email = $1`, [normalizedEmail]);
  return existing.rows[0];
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

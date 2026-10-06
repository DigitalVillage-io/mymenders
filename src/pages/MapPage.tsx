import React, { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Cog,
  Globe,
  Globe2,
  Info,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  MessageSquareQuote,
  Minus,
  Navigation,
  Phone,
  Loader2,
  Plus,
  Route,
  Search,
  SlidersHorizontal,
  SquareArrowOutUpRight,
  Star,
  Store,
  Twitter,
  X,
  X as XBrand,
} from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Vendor } from '../types';
import {
  getTaxonomyLabel,
  getTaxonomyOptions,
  getStudioTypeColor,
  STUDIO_TYPE_COLORS,
  STUDIO_TYPE_FALLBACK_COLOR,
  normalizeTaxonomyValues,
} from '../../shared/vendorTaxonomy.js';

const DEFAULT_CENTER: [number, number] = [20, 0]; // [lat, lng]
const GLOBAL_ZOOM = 2.5;
const LOCAL_ZOOM = 15;
const CITY_ZOOM = 12.5;
const AUTO_CENTER_TO_FIRST_VENDOR = true;
const VENDOR_SOURCE_ID = 'vendors';
const CLUSTER_CIRCLE_LAYER_ID = 'vendor-clusters';
const CLUSTER_COUNT_LAYER_ID = 'vendor-cluster-count';
const UNCLUSTERED_LAYER_ID = 'vendor-points';
const VENDOR_ZONE_SOURCE_ID = 'vendor-zones';
const VENDOR_ZONE_FILL_LAYER_ID = 'vendor-zone-fill';
const VENDOR_ZONE_LINE_LAYER_ID = 'vendor-zone-line';
const MAP_CARD_WIDTH_PX = 360;
const BASEMAP_STYLES = [
  { id: 'positron', label: 'Positron', styleUrl: 'https://tiles.openfreemap.org/styles/positron' },
  { id: 'bright', label: 'Bright', styleUrl: 'https://tiles.openfreemap.org/styles/bright' },
  { id: 'liberty', label: 'Liberty', styleUrl: 'https://tiles.openfreemap.org/styles/liberty' },
  { id: 'dark', label: 'Dark', styleUrl: 'https://tiles.openfreemap.org/styles/dark' },
  { id: 'fiord', label: 'Fiord', styleUrl: 'https://tiles.openfreemap.org/styles/fiord' },
] as const;
const DEFAULT_BASEMAP_STYLE_ID = 'bright';
const pinImageId = (color: string) => `vendor-pin-${color.replace('#', '').toLowerCase()}`;
const PIN_COLORS = [...Object.values(STUDIO_TYPE_COLORS), STUDIO_TYPE_FALLBACK_COLOR];
const PIN_IMAGE_EXPRESSION: any = [
  'match',
  ['get', 'pinColor'],
  ...PIN_COLORS.slice(0, -1).flatMap((color) => [color, pinImageId(color)]),
  pinImageId(STUDIO_TYPE_FALLBACK_COLOR),
];
const VENDOR_PIN_CANVAS_HEIGHT = 64;
const VENDOR_PIN_TIP_Y = 28 + 14 * Math.SQRT2;
const VENDOR_PIN_TIP_OFFSET = VENDOR_PIN_CANVAS_HEIGHT - VENDOR_PIN_TIP_Y;

// This is the Revolution marker's 28px square with its asymmetric corner
// radii rotated -45 degrees. It is rendered at 2x for crisp MapLibre symbols;
// the white border, center, and shadow require one baked image per pin color.
const buildVendorPinSvg = (color: string) => `
<svg xmlns="http://www.w3.org/2000/svg" width="112" height="128" viewBox="0 0 56 64">
  <defs>
    <filter id="shadow" filterUnits="userSpaceOnUse" x="-12" y="-12" width="52" height="56" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#202824" flood-opacity=".32"/>
    </filter>
  </defs>
  <g transform="translate(28 28) rotate(-45) translate(-14 -14)">
    <path fill="#ffffff" filter="url(#shadow)" d="M14 0 C21.732 0 28 6.268 28 14 C28 21.732 21.732 28 14 28 H4 C1.791 28 0 26.209 0 24 V14 C0 6.268 6.268 0 14 0 Z"/>
    <path fill="${color}" d="M14 2 C20.627 2 26 7.373 26 14 C26 20.627 20.627 26 14 26 H4 C2.895 26 2 25.105 2 24 V14 C2 7.373 7.373 2 14 2 Z"/>
    <circle cx="14" cy="14" r="3.5" fill="#ffffff"/>
  </g>
</svg>`;

const parseCoordinate = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseListFromSource = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') {
    if (!value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch {
      // fallback below
    }
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeEntryLevel = (entryLevel?: string) => {
  if (!entryLevel) return undefined;
  if (entryLevel === 'Menders') return 'Verified Mender';
  if (entryLevel === 'Member of the public') return 'Community Contribution';
  return entryLevel;
};

const renderIconMarkup = (icon: React.ReactElement) => renderToStaticMarkup(icon);

const DETAILS_BUTTON_ICON = renderIconMarkup(<Info className="w-4 h-4" aria-hidden="true" />);
const DIRECTIONS_BUTTON_ICON = renderIconMarkup(<Route className="w-4 h-4" aria-hidden="true" />);
const ADDRESS_ICON = renderIconMarkup(<MapPin className="w-4 h-4" aria-hidden="true" />);
const PHONE_ICON = renderIconMarkup(<Phone className="w-4 h-4" aria-hidden="true" />);
const ONLINE_ICON = renderIconMarkup(<Globe2 className="w-4 h-4" aria-hidden="true" />);
const EMAIL_ICON = renderIconMarkup(<Mail className="w-4 h-4" aria-hidden="true" />);
const SOCIAL_ICON = renderIconMarkup(<SquareArrowOutUpRight className="w-4 h-4" aria-hidden="true" />);
const REVIEW_ICON = renderIconMarkup(<MessageSquareQuote className="w-4 h-4" aria-hidden="true" />);
const RATING_ICON = renderIconMarkup(<Star className="w-4 h-4 fill-current" aria-hidden="true" />);
const STORE_ICON = renderIconMarkup(<Store className="w-4 h-4" aria-hidden="true" />);

const toDisplayName = (name?: string) => (name || '').trim();
const EARTH_RADIUS_KM = 6371;
const MAX_LIST_DISTANCE_KM = 100;
const toRadians = (value: number) => (value * Math.PI) / 180;

const getDistanceFromUser = (
  userLocation: { lat: number; lng: number } | null,
  vendor: Vendor,
): number | undefined => {
  if (!userLocation) return undefined;

  const vendorLat = parseCoordinate(vendor.latitude);
  const vendorLng = parseCoordinate(vendor.longitude);
  if (vendorLat === undefined || vendorLng === undefined) return undefined;

  const deltaLat = toRadians(vendorLat - userLocation.lat);
  const deltaLng = toRadians(vendorLng - userLocation.lng);
  const lat1 = toRadians(userLocation.lat);
  const lat2 = toRadians(vendorLat);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));

  return EARTH_RADIUS_KM * c;
};

const formatDistance = (distanceKm?: number) => {
  if (distanceKm === undefined) return null;
  if (distanceKm >= MAX_LIST_DISTANCE_KM) return null;
  if (distanceKm < 1) return `${Math.max(1, Math.round(distanceKm * 1000))} m`;
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm)} km`;
};

const buildGoogleMapsDirectionsUrl = (vendor: Vendor) => {
  const latitude = parseCoordinate(vendor.latitude);
  const longitude = parseCoordinate(vendor.longitude);
  const destination =
    latitude !== undefined && longitude !== undefined
      ? `${latitude},${longitude}`
      : [toDisplayName(vendor.name), vendor.address].filter(Boolean).join(' ');

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
};

const toExternalWebsiteUrl = (value?: string) => {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const getSocialIconMarkup = (value?: string) => {
  const normalized = (value || '').trim().toLowerCase();
  let host = normalized;

  try {
    host = new URL(/^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`).hostname
      .replace(/^www\./, '');
  } catch {
    // Keep the raw value for a conservative substring fallback.
  }

  if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
    return renderIconMarkup(<Instagram className="w-4 h-4" aria-hidden="true" />);
  }
  if (host === 'twitter.com' || host.endsWith('.twitter.com')) {
    return renderIconMarkup(<Twitter className="w-4 h-4" aria-hidden="true" />);
  }
  if (host === 'x.com' || host.endsWith('.x.com')) {
    return renderIconMarkup(<XBrand className="w-4 h-4" aria-hidden="true" />);
  }
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
    return renderIconMarkup(<Linkedin className="w-4 h-4" aria-hidden="true" />);
  }
  return SOCIAL_ICON;
};

const emptyVendorFeatureCollection: GeoJSON.FeatureCollection<GeoJSON.Point> = {
  type: 'FeatureCollection',
  features: [],
};

const buildVendorFeatureCollection = (vendors: Vendor[]): GeoJSON.FeatureCollection<GeoJSON.Point> => ({
  type: 'FeatureCollection',
  features: vendors.flatMap((vendor) => {
    const latitude = parseCoordinate(vendor.latitude);
    const longitude = parseCoordinate(vendor.longitude);
    if (latitude === undefined || longitude === undefined) return [];

    return [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: toLngLat(latitude, longitude),
        },
        properties: {
          vendorId: vendor.id,
          pinColor: getStudioTypeColor(vendor.types),
        },
      },
    ];
  }),
});

const buildVendorZoneFeatureCollection = (vendors: Vendor[]): GeoJSON.FeatureCollection<GeoJSON.Polygon> => ({
  type: 'FeatureCollection',
  features: vendors.flatMap((vendor) => {
    if (vendor.location_visibility !== 'approx') return [];
    const latitude = parseCoordinate(vendor.latitude);
    const longitude = parseCoordinate(vendor.longitude);
    const radiusKm = parseCoordinate(vendor.location_radius_km) ?? 0.2;
    if (latitude === undefined || longitude === undefined) return [];

    const coordinates = Array.from({ length: 65 }, (_, index) => {
      const bearing = (index / 64) * 2 * Math.PI;
      const latitudeOffset = (radiusKm * Math.cos(bearing)) / EARTH_RADIUS_KM * (180 / Math.PI);
      const longitudeOffset = (radiusKm * Math.sin(bearing))
        / (EARTH_RADIUS_KM * Math.max(0.15, Math.cos(latitude * (Math.PI / 180)))) * (180 / Math.PI);
      return [longitude + longitudeOffset, latitude + latitudeOffset] as [number, number];
    });

    return [{
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coordinates] },
      properties: { vendorId: vendor.id },
    }];
  }),
});

type FilterGroupKey = 'types' | 'categories' | 'regional_techniques';
type TaxonomyOption = { id: string; label: string };
type VendorFilterState = Record<FilterGroupKey, string[]>;

const normalizeVendorTaxonomyValues = (group: FilterGroupKey, value: unknown) =>
  normalizeTaxonomyValues(group, parseListFromSource(value), { allowUnknown: true });

const normalizeVendor = (raw: any): Vendor => {
  let metadata: Record<string, any> = {};
  try {
    if (typeof raw?.photos === 'string') {
      const parsed = JSON.parse(raw.photos);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        metadata = parsed;
      }
    } else if (raw?.photos && typeof raw.photos === 'object') {
      metadata = raw.photos;
    }
  } catch {
    metadata = {};
  }

  return {
    ...raw,
    latitude: parseCoordinate(raw.latitude) ?? Number.NaN,
    longitude: parseCoordinate(raw.longitude) ?? Number.NaN,
    location_visibility: raw.location_visibility === 'approx' ? 'approx' : 'exact',
    location_radius_km: parseCoordinate(raw.location_radius_km) ?? undefined,
    rating: typeof raw.rating === 'number' ? raw.rating : Number(raw.rating) || 0,
    rating_count: Number(raw.rating_count) || Number((metadata as any)?.rating_count) || 0,
    types: normalizeVendorTaxonomyValues('types', raw.types || (metadata as any)?.types || (raw as any).type || (metadata as any)?.type),
    categories: normalizeVendorTaxonomyValues('categories', raw.categories || (metadata as any)?.categories),
    regional_techniques: normalizeVendorTaxonomyValues('regional_techniques', raw.regional_techniques || (metadata as any)?.regional_techniques),
    website: raw.website || raw.online_presence || (metadata as any)?.online_presence || (metadata as any)?.website,
    social: raw.social || (metadata as any)?.social,
    email: raw.email || (metadata as any)?.email,
    review_text: raw.review_text || (metadata as any)?.review_text,
    entry_level: normalizeEntryLevel(raw.entry_level || (metadata as any)?.entry_level),
  };
};

const buildTagRow = (
  container: HTMLDivElement,
  label: string,
  group: FilterGroupKey,
  items: string[],
) => {
  if (!items.length) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'mb-2 last:mb-0';

  const title = document.createElement('div');
  title.className = 'mb-1 text-[10px] text-[#68665f] mymenders-map-card-label';
  title.textContent = label;
  wrapper.append(title);

  const tags = document.createElement('div');
  tags.className = 'flex flex-wrap gap-1.5';
  const chipVariant =
    group === 'categories'
      ? 'mymenders-cloth-chip--categories'
      : group === 'regional_techniques'
        ? 'mymenders-cloth-chip--techniques'
        : '';
  items.forEach((tag) => {
    const chip = document.createElement('span');
    chip.className = `mymenders-cloth-chip ${chipVariant} inline-flex items-center gap-1 px-2 py-0.5 text-[11px]`;
    chip.textContent = getTaxonomyLabel(group, tag);
    tags.append(chip);
  });
  wrapper.append(tags);
  container.append(wrapper);
};

const appendTextRow = (container: HTMLDivElement, iconMarkup: string, value: string, label?: string) => {
  const row = document.createElement('div');
  row.className = 'mb-1.5 flex items-start gap-1.5 text-xs text-[var(--mm-text-soft)]';

  const icon = document.createElement('div');
  icon.className = 'mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[var(--mm-muted)]';
  icon.innerHTML = iconMarkup;

  const text = document.createElement('span');
  text.className = 'min-w-0 flex-1 break-words leading-[1.35]';
  if (label) {
    const labelText = document.createElement('span');
    labelText.className = 'mr-1 text-[10px] uppercase text-[var(--mm-muted)]';
    labelText.textContent = `${label}:`;
    text.append(labelText);
  }
  text.append(document.createTextNode(value));

  row.append(icon, text);
  container.append(row);
};

const buildPopoverContent = (vendor: Vendor, onDetails: (vendor: Vendor) => void) => {
  const container = document.createElement('div');
  container.className = 'box-border p-3 pr-4';
  // Standard card width; only shrinks on narrow screens so it never overflows the viewport.
  container.style.width = `min(${MAP_CARD_WIDTH_PX}px, calc(100vw - 40px))`;

  const title = document.createElement('h3');
  title.className =
    'mymenders-card-title-semi mb-3 pr-8 text-base leading-[1.08] text-[var(--mm-text)] capitalize';
  title.textContent = toDisplayName(vendor.name);
  container.append(title);

  const contactSection = document.createElement('div');
  contactSection.className = 'space-y-0.5';
  const primaryType = vendor.types?.[0]?.trim();
  if (primaryType) appendTextRow(contactSection, STORE_ICON, getTaxonomyLabel('types', primaryType));
  if (vendor.phone) appendTextRow(contactSection, PHONE_ICON, vendor.phone);
  if (vendor.location_visibility !== 'approx' && vendor.address) {
    appendTextRow(contactSection, ADDRESS_ICON, vendor.address);
  }
  if (contactSection.children.length) {
    container.append(contactSection);
  }

  const expertiseSection = document.createElement('div');
  expertiseSection.className = 'mt-3';
  buildTagRow(expertiseSection, 'Categories', 'categories', vendor.categories || []);
  buildTagRow(expertiseSection, 'Regional techniques', 'regional_techniques', vendor.regional_techniques || []);
  if (expertiseSection.children.length) {
    container.append(expertiseSection);
  }

  if (vendor.review_text) {
    const review = document.createElement('div');
    review.className = 'mt-3 text-xs leading-[1.4] text-[var(--mm-text-soft)]';
    review.innerHTML = `
      <div class="mb-1 flex items-center gap-1.5 text-[10px] uppercase text-[#68665f]">
        <span class="inline-flex h-4 w-4 items-center justify-center">${REVIEW_ICON}</span>
        Review
      </div>
    `;
    const reviewText = document.createElement('div');
    reviewText.textContent = vendor.review_text;
    review.append(reviewText);
    container.append(review);
  }

  if ((vendor.rating || 0) > 0) {
    const rating = document.createElement('div');
    rating.className = 'mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#f1dcc1] bg-[#fff8ed] px-2.5 py-0.5 text-[11px] text-[#785531]';
    rating.innerHTML = `
      <span class="inline-flex h-5 w-5 items-center justify-center text-[#c9782f]">
        ${RATING_ICON}
      </span>
      <span>${(vendor.rating || 0).toFixed(1)} (${vendor.rating_count || 0} review${vendor.rating_count === 1 ? '' : 's'})</span>
    `;
    container.append(rating);
  }

  const actionRow = document.createElement('div');
  actionRow.className = 'mt-3 flex flex-wrap items-center gap-1.5';

  const circleActiveClass =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[0.5px] border-black bg-brand text-brand-dark-on transition-colors hover:bg-brand-hover';
  const circleDisabledClass =
    'inline-flex h-8 w-8 shrink-0 cursor-not-allowed items-center justify-center rounded-full border border-[var(--mm-border-strong)] bg-[var(--mm-panel-muted)] text-[var(--mm-muted)]';

  if (vendor.location_visibility === 'approx') {
    const directionsButton = document.createElement('button');
    directionsButton.type = 'button';
    directionsButton.disabled = true;
    directionsButton.className =
      'inline-flex h-8 min-w-[108px] flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-full bg-[var(--mm-panel-muted)] px-2.5 text-[11px] text-[var(--mm-muted)]';
    directionsButton.title = 'Directions unavailable for approximate locations';
    directionsButton.innerHTML = `
      <span class="inline-flex items-center justify-center w-4 h-4">
        ${DIRECTIONS_BUTTON_ICON}
      </span>
      Directions
    `;
    actionRow.append(directionsButton);
  } else {
    const directionsLink = document.createElement('a');
    directionsLink.href = buildGoogleMapsDirectionsUrl(vendor);
    directionsLink.target = '_blank';
    directionsLink.rel = 'noopener noreferrer';
    directionsLink.className =
      'inline-flex h-8 min-w-[108px] flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-dark px-2.5 text-[11px] text-brand-dark-on transition-colors hover:bg-brand-dark-hover';
    directionsLink.innerHTML = `
      <span class="inline-flex items-center justify-center w-4 h-4">
        ${DIRECTIONS_BUTTON_ICON}
      </span>
      Directions
    `;
    actionRow.append(directionsLink);
  }

  const detailsButton = document.createElement('button');
  detailsButton.type = 'button';
  detailsButton.className = circleActiveClass;
  detailsButton.title = 'Details';
  detailsButton.setAttribute('aria-label', 'Details');
  detailsButton.innerHTML = `
    <span class="inline-flex items-center justify-center w-4 h-4">
      ${DETAILS_BUTTON_ICON}
    </span>
  `;
  detailsButton.addEventListener('click', () => {
    onDetails(vendor);
  });
  actionRow.append(detailsButton);

  const trimmedPhone = (vendor.phone || '').trim();
  if (trimmedPhone) {
    const phoneLink = document.createElement('a');
    phoneLink.className = circleActiveClass;
    phoneLink.href = `tel:${trimmedPhone}`;
    phoneLink.title = `Call ${trimmedPhone}`;
    phoneLink.setAttribute('aria-label', `Call ${trimmedPhone}`);
    phoneLink.innerHTML = `
      <span class="inline-flex items-center justify-center w-4 h-4">
        ${PHONE_ICON}
      </span>
    `;
    actionRow.append(phoneLink);
  } else {
    const phoneButton = document.createElement('button');
    phoneButton.type = 'button';
    phoneButton.disabled = true;
    phoneButton.className = circleDisabledClass;
    phoneButton.title = 'No phone available';
    phoneButton.setAttribute('aria-label', 'No phone available');
    phoneButton.innerHTML = `
      <span class="inline-flex items-center justify-center w-4 h-4">
        ${PHONE_ICON}
      </span>
    `;
    actionRow.append(phoneButton);
  }

  const appendContactAction = ({
    value,
    label,
    iconMarkup,
    href,
    external = false,
  }: {
    value?: string;
    label: string;
    iconMarkup: string;
    href: (value: string) => string | null;
    external?: boolean;
  }) => {
    const trimmedValue = (value || '').trim();
    const targetUrl = trimmedValue ? href(trimmedValue) : null;
    if (targetUrl) {
      const link = document.createElement('a');
      link.className = circleActiveClass;
      link.href = targetUrl;
      if (external) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      link.title = label;
      link.setAttribute('aria-label', label);
      link.innerHTML = `<span class="inline-flex items-center justify-center w-4 h-4">${iconMarkup}</span>`;
      actionRow.append(link);
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.disabled = true;
    button.className = circleDisabledClass;
    button.title = `No ${label.toLowerCase()} available`;
    button.setAttribute('aria-label', `No ${label.toLowerCase()} available`);
    button.innerHTML = `<span class="inline-flex items-center justify-center w-4 h-4">${iconMarkup}</span>`;
    actionRow.append(button);
  };

  appendContactAction({ value: vendor.email, label: 'Email', iconMarkup: EMAIL_ICON, href: (value) => `mailto:${value}` });
  appendContactAction({ value: vendor.website, label: 'Visit website', iconMarkup: ONLINE_ICON, href: toExternalWebsiteUrl, external: true });
  appendContactAction({ value: vendor.social, label: 'Visit social profile', iconMarkup: getSocialIconMarkup(vendor.social), href: toExternalWebsiteUrl, external: true });

  container.append(actionRow);

  return container;
};

const englishLabelField = [
  'coalesce',
  ['get', 'name_en'],
  ['get', 'name:en'],
  ['get', 'name_int'],
  ['get', 'name:latin'],
  ['get', 'name'],
] as const;

const getEnglishLabelOverride = (textField: unknown) => {
  if (typeof textField === 'string') {
    return textField.toLowerCase().includes('name') ? englishLabelField : null;
  }

  if (Array.isArray(textField)) {
    return JSON.stringify(textField).toLowerCase().includes('name') ? englishLabelField : null;
  }

  return null;
};

const applyEnglishLabelOverrides = (map: maplibregl.Map) => {
  const layers = map.getStyle()?.layers || [];

  layers.forEach((layer) => {
    if (layer.type !== 'symbol') return;

    const textField = map.getLayoutProperty(layer.id, 'text-field');
    const override = getEnglishLabelOverride(textField);
    if (!override) return;

    map.setLayoutProperty(layer.id, 'text-field', override);
  });
};

const rasterizeVendorPinSvg = async (svgMarkup: string) => {
  // MapLibre's built-in loadImage intentionally does not support SVG files.
  // Rasterize our source SVG in-browser, then register the resulting pixels.
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('Failed to rasterize the vendor map pin SVG'));
    element.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  });

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || 64;
  canvas.height = image.naturalHeight || 64;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create a canvas for the vendor map pin');

  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
};

const ensureVendorPinImages = async (map: maplibregl.Map) => {
  for (const color of PIN_COLORS) {
    const id = pinImageId(color);
    if (map.hasImage(id)) continue;
    const imageData = await rasterizeVendorPinSvg(buildVendorPinSvg(color));
    if (!map.hasImage(id)) {
      map.addImage(id, imageData, { pixelRatio: 2 });
    }
  }
};

const ensureVendorLayers = async (map: maplibregl.Map) => {
  await ensureVendorPinImages(map);

  if (!map.getSource(VENDOR_SOURCE_ID)) {
    map.addSource(VENDOR_SOURCE_ID, {
      type: 'geojson',
      data: emptyVendorFeatureCollection,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 56,
    });
  }

  if (!map.getSource(VENDOR_ZONE_SOURCE_ID)) {
    map.addSource(VENDOR_ZONE_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  if (!map.getLayer(VENDOR_ZONE_FILL_LAYER_ID)) {
    map.addLayer({
      id: VENDOR_ZONE_FILL_LAYER_ID,
      type: 'fill',
      source: VENDOR_ZONE_SOURCE_ID,
      paint: {
        'fill-color': '#d9dfdb',
        'fill-opacity': 0.22,
      },
    });
  }

  if (!map.getLayer(VENDOR_ZONE_LINE_LAYER_ID)) {
    map.addLayer({
      id: VENDOR_ZONE_LINE_LAYER_ID,
      type: 'line',
      source: VENDOR_ZONE_SOURCE_ID,
      paint: {
        'line-color': '#6f877d',
        'line-width': 1.25,
        'line-opacity': 0.6,
        'line-dasharray': [2, 2],
      },
    });
  }

  if (!map.getLayer(CLUSTER_CIRCLE_LAYER_ID)) {
    map.addLayer({
      id: CLUSTER_CIRCLE_LAYER_ID,
      type: 'circle',
      source: VENDOR_SOURCE_ID,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#A8D4F5',
          10,
          '#6FB7E8',
          25,
          '#3E92CC',
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          18,
          10,
          22,
          25,
          28,
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-opacity': 0.95,
      },
    });
  }

  if (!map.getLayer(CLUSTER_COUNT_LAYER_ID)) {
    map.addLayer({
      id: CLUSTER_COUNT_LAYER_ID,
      type: 'symbol',
      source: VENDOR_SOURCE_ID,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Open Sans Semibold'],
        'text-size': 12,
      },
      paint: {
        'text-color': '#ffffff',
      },
    });
  }

  if (!map.getLayer(UNCLUSTERED_LAYER_ID)) {
    map.addLayer({
      id: UNCLUSTERED_LAYER_ID,
      type: 'symbol',
      source: VENDOR_SOURCE_ID,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': PIN_IMAGE_EXPRESSION,
        'icon-size': 1,
        'icon-anchor': 'bottom',
        // The bitmap keeps room for the CSS-equivalent shadow below the tip.
        // Offset that padding so the pointed corner, not the image edge, is
        // anchored to the vendor's exact coordinate.
        'icon-offset': [0, VENDOR_PIN_TIP_OFFSET],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
  }
};

const applyGlobeProjectionIfSupported = (map: maplibregl.Map) => {
  if (!map || typeof (map as any).setProjection !== 'function') {
    return;
  }

  try {
    (map as any).setProjection({ type: 'globe' });
  } catch {
    // Some runtimes can ship without globe support; gracefully continue.
  }
};

const toLngLat = (latitude: number, longitude: number) => [longitude, latitude] as [number, number];
const getVendorCoordinates = (vendor: Vendor): [number, number] | null => {
  const latitude = parseCoordinate(vendor.latitude);
  const longitude = parseCoordinate(vendor.longitude);
  if (latitude === undefined || longitude === undefined) return null;
  return toLngLat(latitude, longitude);
};
const DIRECTION_ZOOM = 14.5;
const DIRECTION_FLY_DURATION_MS = Math.round(800 * 1.3);

const FILTER_GROUPS: Array<{ key: FilterGroupKey; label: string; options: TaxonomyOption[] }> = [
  { key: 'types', label: 'Workplace Type', options: getTaxonomyOptions('types') as TaxonomyOption[] },
  { key: 'categories', label: 'Categories', options: getTaxonomyOptions('categories') as TaxonomyOption[] },
  {
    key: 'regional_techniques',
    label: 'Techniques',
    options: getTaxonomyOptions('regional_techniques') as TaxonomyOption[],
  },
];

const createEmptyFilterState = (): VendorFilterState => ({
  types: [],
  categories: [],
  regional_techniques: [],
});

const getVendorFilterValues = (vendor: Vendor, key: FilterGroupKey) =>
  normalizeTaxonomyValues(key, vendor[key] || [], { allowUnknown: true });

const VENDOR_LIST_SKELETON_COUNT = 7;

// Mirrors the shape of a vendor list card (title, address, chips) so the
// loading state doesn't shift the layout when the real list arrives.
const VendorListSkeleton = () => (
  <div aria-hidden="true">
    {Array.from({ length: VENDOR_LIST_SKELETON_COUNT }, (_, index) => (
      <div key={index} className="border-b border-[var(--mm-border)] py-3 pl-3 pr-3 last:border-b-0">
        <div className="pl-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="mymenders-shimmer-block h-3.5 w-2/5 rounded-md" />
            <div className="mymenders-shimmer-block h-3 w-9 rounded-md" />
          </div>
          <div className="mymenders-shimmer-block mt-2.5 h-3 w-3/4 rounded-md" />
          <div className="mt-2 flex gap-1.5">
            <div className="mymenders-shimmer-block h-4 w-16 rounded-full" />
            <div className="mymenders-shimmer-block h-4 w-24 rounded-full" />
            <div className="mymenders-shimmer-block h-4 w-14 rounded-full" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export function MapPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [centerMapTo, setCenterMapTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [findingLocation, setFindingLocation] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);
  const [selectedBasemapStyleId, setSelectedBasemapStyleId] =
    useState<(typeof BASEMAP_STYLES)[number]['id']>(DEFAULT_BASEMAP_STYLE_ID);
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<VendorFilterState>(createEmptyFilterState);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapBounds, setMapBounds] = useState<maplibregl.LngLatBounds | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const styleMenuRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterDrawerRef = useRef<HTMLDivElement>(null);
  const vendorsRef = useRef<Vendor[]>([]);
  const hasAutoCentered = useRef(false);
  const activeBasemapStyleIdRef = useRef<(typeof BASEMAP_STYLES)[number]['id']>(DEFAULT_BASEMAP_STYLE_ID);

  useEffect(() => {
    let cancelled = false;

    const loadVendors = async () => {
      setLoadError(null);
      try {
        const res = await fetch(`${window.location.origin}/api/vendors`);
        if (!res.ok) throw new Error(`Vendor request failed with status ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Vendor response was not a list');
        if (cancelled) return;

        setVendors(data.map(normalizeVendor));
      } catch (err) {
        console.error('Failed to fetch vendors:', err);
        if (!cancelled) setLoadError('We couldn’t load menders right now.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadVendors();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    vendorsRef.current = vendors;
  }, [vendors]);

  const openVendorPopup = (vendor: Vendor, options: { focus?: boolean; zoom?: number } = {}) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const coordinates = getVendorCoordinates(vendor);
    if (!coordinates) return;

    if (options.focus !== false) {
      map.flyTo({
        center: coordinates,
        zoom: options.zoom ?? DIRECTION_ZOOM,
        duration: DIRECTION_FLY_DURATION_MS,
      });
    }

    setSelectedVendorId(vendor.id);

    popupRef.current?.remove();
    popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: `${MAP_CARD_WIDTH_PX}px` })
      .setLngLat(coordinates)
      .setDOMContent(
        buildPopoverContent(vendor, (selectedVendor) => {
          const targetCoordinates = getVendorCoordinates(selectedVendor);
          if (!targetCoordinates) return;
          map.flyTo({
            center: targetCoordinates,
            zoom: DIRECTION_ZOOM,
            duration: DIRECTION_FLY_DURATION_MS,
          });
        }),
      )
      .addTo(map);
  };

  const vendorsWithDistance = useMemo(
    () => {
      const enriched = vendors.map((vendor, sortIndex) => ({
        vendor,
        sortIndex,
        distanceKm: getDistanceFromUser(userLocation, vendor),
      }));

      if (!userLocation) return enriched;

      return enriched.sort((first, second) => {
        if (first.distanceKm === undefined && second.distanceKm === undefined) {
          return first.sortIndex - second.sortIndex;
        }
        if (first.distanceKm === undefined) return 1;
        if (second.distanceKm === undefined) return -1;
        return first.distanceKm - second.distanceKm;
      });
    },
    [vendors, userLocation],
  );

  const displayedVendorsWithDistance = useMemo(() => {
    const filtered = vendorsWithDistance.filter(({ vendor }) => {
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const name = (vendor.name || '').toLowerCase();
        const address = (vendor.address || '').toLowerCase();
        if (!name.includes(query) && !address.includes(query)) return false;
      }

      if (mapBounds) {
        const coords = getVendorCoordinates(vendor);
        if (!coords || !mapBounds.contains(coords)) return false;
      }

      return FILTER_GROUPS.every(({ key }) => {
        const selectedValues = selectedFilters[key];
        if (!selectedValues.length) return true;

        const vendorValueSet = new Set(getVendorFilterValues(vendor, key));
        return selectedValues.some((selectedValue) => vendorValueSet.has(selectedValue));
      });
    });

    return [...filtered].sort((left, right) => {
      if (userLocation) {
        if (left.distanceKm === undefined && right.distanceKm === undefined) {
          return left.sortIndex - right.sortIndex;
        }
        if (left.distanceKm === undefined) return 1;
        if (right.distanceKm === undefined) return -1;
        return left.distanceKm - right.distanceKm;
      }

      return left.sortIndex - right.sortIndex;
    });
  }, [selectedFilters, userLocation, vendorsWithDistance, searchQuery, mapBounds]);

  const visibleMapVendors = useMemo(
    () =>
      displayedVendorsWithDistance
        .map(({ vendor }) => vendor)
        .filter((vendor) => Boolean(getVendorCoordinates(vendor))),
    [displayedVendorsWithDistance],
  );

  const activeFilterCount = FILTER_GROUPS.reduce(
    (count, { key }) => count + selectedFilters[key].length,
    0,
  );
  const hasActiveFilters = activeFilterCount > 0;
  const hasSearchOrFilters = Boolean(searchQuery.trim()) || hasActiveFilters;

  const clearAllFilters = () => {
    setSelectedFilters(createEmptyFilterState());
    setSearchQuery('');
  };

  const activeFilterChips = FILTER_GROUPS.flatMap(({ key, label }) =>
    selectedFilters[key].map((value) => ({
      groupKey: key,
      groupLabel: label,
      value,
      displayLabel: getTaxonomyLabel(key, value),
    })),
  );

  const toggleFilterOption = (groupKey: FilterGroupKey, value: string) => {
    setSelectedFilters((currentFilters) => {
      const currentGroupValues = currentFilters[groupKey];
      const isSelected = currentGroupValues.includes(value);
      return {
        ...currentFilters,
        [groupKey]: isSelected
          ? currentGroupValues.filter((selectedValue) => selectedValue !== value)
          : [...currentGroupValues, value],
      };
    });
  };

  useEffect(() => {
    if (!isStyleMenuOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!styleMenuRef.current?.contains(event.target as Node)) {
        setIsStyleMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isStyleMenuOpen]);

  useEffect(() => {
    if (!isFilterDrawerOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (filterDrawerRef.current?.contains(target) || filterButtonRef.current?.contains(target)) {
        return;
      }
      setIsFilterDrawerOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterDrawerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isFilterDrawerOpen]);

  const selectedBasemapStyle =
    BASEMAP_STYLES.find((style) => style.id === selectedBasemapStyleId) ?? BASEMAP_STYLES[0];

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: selectedBasemapStyle.styleUrl,
      center: [DEFAULT_CENTER[1], DEFAULT_CENTER[0]],
      zoom: GLOBAL_ZOOM,
      minZoom: GLOBAL_ZOOM,
      attributionControl: {},
      logoPosition: 'bottom-left',
    });

    const handleStyleLoad = async () => {
      applyGlobeProjectionIfSupported(map);
      applyEnglishLabelOverrides(map);
      try {
        await ensureVendorLayers(map);
        setMapBounds(map.getBounds());
        setIsMapReady(true);
      } catch (error) {
        console.error('Unable to load the vendor map pin:', error);
      }
    };

    map.on('style.load', handleStyleLoad);

    const handleMapClick = async (event: maplibregl.MapMouseEvent) => {
      if (!map.getLayer(CLUSTER_CIRCLE_LAYER_ID) || !map.getLayer(UNCLUSTERED_LAYER_ID)) return;

      const clusterFeatures = map.queryRenderedFeatures(event.point, {
        layers: [CLUSTER_CIRCLE_LAYER_ID, CLUSTER_COUNT_LAYER_ID],
      });
      const clusterFeature = clusterFeatures[0];

      if (clusterFeature) {
        const clusterId = Number(clusterFeature.properties?.cluster_id);
        const source = map.getSource(VENDOR_SOURCE_ID) as GeoJSONSource | undefined;
        if (!source || !Number.isFinite(clusterId)) return;

        const expansionZoom = await source.getClusterExpansionZoom(clusterId);
        const [longitude, latitude] = (clusterFeature.geometry as GeoJSON.Point).coordinates;

        map.flyTo({
          center: [longitude, latitude],
          zoom: expansionZoom,
          duration: 700,
        });
        return;
      }

      const vendorFeatures = map.queryRenderedFeatures(event.point, {
        layers: [UNCLUSTERED_LAYER_ID, VENDOR_ZONE_FILL_LAYER_ID],
      });
      const vendorFeature = vendorFeatures[0];

      if (!vendorFeature) return;

      const vendorId = Number(vendorFeature.properties?.vendorId);
      const vendor = vendorsRef.current.find((item) => item.id === vendorId);
      if (!vendor) return;
      await openVendorPopup(vendor, { focus: false });
    };

    const handlePointerMove = (event: maplibregl.MapMouseEvent) => {
      if (!map.getLayer(CLUSTER_CIRCLE_LAYER_ID) || !map.getLayer(UNCLUSTERED_LAYER_ID)) return;

      const interactiveFeatures = map.queryRenderedFeatures(event.point, {
        layers: [CLUSTER_CIRCLE_LAYER_ID, CLUSTER_COUNT_LAYER_ID, UNCLUSTERED_LAYER_ID, VENDOR_ZONE_FILL_LAYER_ID],
      });
      map.getCanvas().style.cursor = interactiveFeatures.length ? 'pointer' : '';
    };

    const clearPointerCursor = () => {
      map.getCanvas().style.cursor = '';
    };

    const handleMoveEnd = () => {
      setMapBounds(map.getBounds());
    };

    map.on('click', handleMapClick);
    map.on('mousemove', handlePointerMove);
    map.on('mouseout', clearPointerCursor);
    map.on('moveend', handleMoveEnd);

    mapInstanceRef.current = map;

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.off('style.load', handleStyleLoad);
      map.off('click', handleMapClick);
      map.off('mousemove', handlePointerMove);
      map.off('mouseout', clearPointerCursor);
      map.off('moveend', handleMoveEnd);
      map.remove();
      mapInstanceRef.current = null;
      setIsMapReady(false);
      hasAutoCentered.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isMapReady) return;

    const map = mapInstanceRef.current;
    if (!map) return;

    const source = map.getSource(VENDOR_SOURCE_ID) as GeoJSONSource | undefined;
    const zoneSource = map.getSource(VENDOR_ZONE_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source || !zoneSource) return;
    source.setData(buildVendorFeatureCollection(visibleMapVendors));
    zoneSource.setData(buildVendorZoneFeatureCollection(visibleMapVendors));
  }, [isMapReady, visibleMapVendors]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (activeBasemapStyleIdRef.current === selectedBasemapStyle.id) {
      return;
    }

    activeBasemapStyleIdRef.current = selectedBasemapStyle.id;
    popupRef.current?.remove();
    popupRef.current = null;
    setIsMapReady(false);
    map.setStyle(selectedBasemapStyle.styleUrl);
  }, [selectedBasemapStyle]);

  useEffect(() => {
  const map = mapInstanceRef.current;
    if (!isMapReady || !map || centerMapTo) return;

    if (!vendors.length || hasAutoCentered.current || !AUTO_CENTER_TO_FIRST_VENDOR) return;

    const validVendor = vendors.find((vendor) => {
      const latitude = parseCoordinate(vendor.latitude);
      const longitude = parseCoordinate(vendor.longitude);
      return latitude !== undefined && longitude !== undefined;
    });

    if (!validVendor) return;

    map.flyTo({
      center: toLngLat(validVendor.latitude, validVendor.longitude),
      zoom: CITY_ZOOM,
      duration: 1200,
    });
    hasAutoCentered.current = true;
  }, [vendors, isMapReady, centerMapTo]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!isMapReady || !centerMapTo || !map) return;
    map.flyTo({
      center: [centerMapTo.lng, centerMapTo.lat],
      zoom: centerMapTo.zoom ?? LOCAL_ZOOM,
      duration: 900,
    });
  }, [centerMapTo, isMapReady]);

  // Default to the user's city instead of the globe; the globe button in the
  // bottom-right controls is still there for anyone who wants it.
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(nextLocation);
        setCenterMapTo({ lat: nextLocation.lat, lng: nextLocation.lng, zoom: CITY_ZOOM });
      },
      (error) => {
        // Fall back to the first vendor's city (AUTO_CENTER_TO_FIRST_VENDOR).
        console.error('Error auto-locating on load:', error);
      },
    );
  }, []);

  const locateUser = () => {
    setFindingLocation(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
          setUserLocation(nextLocation);
          setCenterMapTo({
            lat: nextLocation.lat,
            lng: nextLocation.lng,
            zoom: LOCAL_ZOOM,
          });
          setFindingLocation(false);
        },
        (error) => {
          console.error("Error finding location: ", error);
          alert("Couldn't find your location. Please check your browser permissions.");
          setFindingLocation(false);
        },
      );
    } else {
      alert("Geolocation is not supported by your browser.");
      setFindingLocation(false);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-80px)] mt-20 z-0">
      <div className="grid h-full min-h-0 overflow-visible grid-cols-1 md:grid-cols-[25%_75%]">
        <aside
          className="relative z-20 hidden md:flex md:flex-col min-h-0 overflow-visible bg-[#fafafa] border-r border-[#e5e7eb]"
          onWheel={(event) => {
            event.stopPropagation();
          }}
        >
          <div className="shrink-0 border-b border-[#e5e7eb] px-3 py-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <label htmlFor="menders-search-desktop" className="sr-only">Search menders</label>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a877d]"
                  aria-hidden="true"
                />
                <input
                  id="menders-search-desktop"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search menders…"
                  aria-label="Search menders"
                  className="w-full rounded-full border border-[#e5e7eb] bg-white py-2 pl-9 pr-8 text-sm text-[#171b17] placeholder:text-[#8a877d] focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--mm-faint)] transition-[background-color,color] hover:bg-[var(--mm-panel-muted)] hover:text-[var(--mm-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              <button
                ref={filterButtonRef}
                type="button"
                onClick={() => setIsFilterDrawerOpen((value) => !value)}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                  isFilterDrawerOpen || hasActiveFilters
                    ? 'border-brand-dark bg-brand-dark text-brand-dark-on'
                    : 'border-dashed border-[var(--mm-border-strong)] bg-[var(--mm-panel)] text-[var(--mm-text-soft)] hover:border-[var(--mm-muted)] hover:bg-[var(--mm-panel-muted)]'
                }`}
                aria-label="Filter menders"
                aria-expanded={isFilterDrawerOpen}
                aria-controls="vendor-filter-drawer"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                Filters
                {hasActiveFilters ? (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f4a261] px-1 text-[10px] leading-none text-[#171b17]">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </div>

            {activeFilterChips.length ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {activeFilterChips.map((chip) => (
                  <button
                    key={`${chip.groupKey}-${chip.value}`}
                    type="button"
                    onClick={() => toggleFilterOption(chip.groupKey, chip.value)}
                    className="inline-flex max-w-[160px] items-center gap-1 rounded-full bg-brand-dark py-1 pl-2.5 pr-1.5 text-xs text-brand-dark-on transition-colors hover:bg-brand-dark-hover"
                    title={`Remove ${chip.displayLabel}`}
                  >
                    <span className="truncate">{chip.displayLabel}</span>
                    <X className="h-3 w-3 shrink-0" aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : null}

            {(isLoading || hasSearchOrFilters) && (
              <div className="mt-3 flex items-center justify-end gap-3">
                {isLoading && (
                  <p className="mr-auto text-xs text-[var(--mm-muted)]" role="status" aria-live="polite">
                    Loading menders…
                  </p>
                )}
                {hasSearchOrFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="shrink-0 text-xs text-[var(--mm-muted)] underline decoration-[var(--mm-border-strong)] underline-offset-2 transition-[color] hover:text-[var(--mm-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    Clear search and filters
                  </button>
                )}
              </div>
            )}
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto"
            onWheel={(event) => {
              event.stopPropagation();
            }}
          >
            {isLoading ? (
              <VendorListSkeleton />
            ) : loadError ? (
              <div className="mymenders-map-empty-state m-3">
                <p className="font-medium text-[var(--mm-text)]">Menders are temporarily unavailable</p>
                <p className="mt-1 text-xs leading-5 text-[var(--mm-muted)]">Check your connection and try again.</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsLoading(true);
                    setReloadKey((key) => key + 1);
                  }}
                  className="mymenders-map-empty-state__action mt-3"
                >
                  Try again
                </button>
              </div>
            ) : displayedVendorsWithDistance.length ? (
              displayedVendorsWithDistance.map(({ vendor, distanceKm }) => {
                const coordinates = getVendorCoordinates(vendor);
                const isActive = selectedVendorId === vendor.id;
                const isClickable = Boolean(coordinates);
                const categories = getVendorFilterValues(vendor, 'categories');
                const techniques = getVendorFilterValues(vendor, 'regional_techniques');
                const vendorName = toDisplayName(vendor.name) || 'Unnamed mender';

                return (
                  <button
                    type="button"
                    key={vendor.id}
                    onClick={() => {
                      if (!isClickable) return;
                      openVendorPopup(vendor, { focus: true, zoom: DIRECTION_ZOOM });
                    }}
                    disabled={!isClickable}
                    className={`group relative w-full border-b border-[var(--mm-border)] last:border-b-0 py-3 pl-3 pr-3 text-left transition-[background-color,opacity] ${
                      isActive
                        ? 'bg-[var(--mm-border)]'
                        : isClickable
                          ? 'hover:bg-[var(--mm-panel-muted)]'
                          : 'bg-[var(--mm-panel)]/30 opacity-65'
                    }`}
                    title={isClickable ? `Fly to ${vendorName}` : 'Location unavailable'}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-y-0 left-0 w-0.5 transition-opacity ${isActive ? 'opacity-100 bg-brand-dark-text' : 'bg-[var(--mm-border-strong)] opacity-0 group-hover:opacity-30'}`}
                    />
                    <div className="min-w-0 pl-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="mymenders-card-title-semi truncate text-sm text-[var(--mm-text)]">{vendorName}</p>
                        {distanceKm !== undefined && distanceKm < MAX_LIST_DISTANCE_KM ? (
                          <span className="shrink-0 text-[10px] tabular-nums text-[var(--mm-muted)]">
                            {formatDistance(distanceKm)}
                          </span>
                        ) : null}
                      </div>
                      {vendor.location_visibility === 'approx' ? (
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--mm-muted)]">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">Contact the mender for the exact location</span>
                        </p>
                      ) : vendor.address ? (
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--mm-muted)]">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{vendor.address}</span>
                        </p>
                      ) : null}
                      {!!categories.length ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {categories.map((category) => (
                            <span
                              key={`${vendor.id}-category-${category}`}
                              className="mymenders-cloth-chip--categories rounded-full px-2 py-0.5 text-[10px] "
                            >
                              {getTaxonomyLabel('categories', category)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {!!techniques.length ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {techniques.map((technique) => (
                            <span
                              key={`${vendor.id}-technique-${technique}`}
                              className="mymenders-cloth-chip--techniques rounded-full px-2 py-0.5 text-[10px] "
                            >
                              {getTaxonomyLabel('regional_techniques', technique)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="mymenders-map-empty-state m-3">
                <p className="font-medium text-[var(--mm-text)]">
                  {hasSearchOrFilters ? 'No menders match this search' : 'No menders have been added yet'}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--mm-muted)]">
                  {hasSearchOrFilters
                    ? 'Try a different search or clear the current filters.'
                    : 'Menders added to the directory will appear here.'}
                </p>
                {hasSearchOrFilters ? (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="mymenders-map-empty-state__action mt-3"
                  >
                    Clear search and filters
                  </button>
                ) : (
                  <a href="/add" className="mymenders-map-empty-state__action mt-3">
                    Add a mender
                  </a>
                )}
              </div>
            )}
          </div>
        </aside>

        <div className="relative z-0">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Mobile search + filters (below md) */}
          <div className="absolute left-4 right-4 top-4 z-10 flex items-center gap-2 md:hidden">
            <div className="relative min-w-0 flex-1">
              <label htmlFor="menders-search-mobile" className="sr-only">Search menders</label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a877d]"
                aria-hidden="true"
              />
              <input
                id="menders-search-mobile"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search menders…"
                aria-label="Search menders"
                className="w-full rounded-full border border-[#e5e7eb] bg-white/95 py-2.5 pl-9 pr-4 text-sm text-[#171b17] shadow-[0_2px_12px_rgba(15,23,42,0.08)] backdrop-blur-sm placeholder:text-[#8a877d] focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              />
            </div>
            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen((value) => !value)}
              className="mymenders-map-control relative h-11 w-11 shrink-0"
              aria-label="Filter menders"
              aria-expanded={isFilterDrawerOpen}
              aria-controls="vendor-filter-drawer"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              {hasActiveFilters ? (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f4a261] px-1 text-[10px] leading-none text-[#171b17]">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={locateUser}
              disabled={findingLocation}
              className="mymenders-map-control h-11 shrink-0 px-3 text-xs sm:px-4"
              title="Near me"
              aria-label="Find nearby menders"
            >
              {findingLocation ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#8a877d]" /> : <Navigation className="h-4 w-4 shrink-0" />}
              <span>Near me</span>
            </button>
          </div>

          {isLoading && (
            <div className="mymenders-map-status absolute bottom-6 left-4 z-10 md:hidden" role="status" aria-live="polite">
              Loading menders…
            </div>
          )}

          {isFilterDrawerOpen && (
            <div
              id="vendor-filter-drawer"
              ref={filterDrawerRef}
              className="fixed inset-x-0 bottom-0 z-20 flex max-h-[70vh] flex-col rounded-t-2xl border-t border-[#e5e7eb] bg-[#fafafa] shadow-[0_-8px_32px_rgba(15,23,42,0.12)] backdrop-blur-sm md:absolute md:bottom-0 md:left-0 md:top-0 md:max-h-none md:w-[min(340px,calc(100vw-25vw))] md:rounded-none md:border-r md:border-t-0 md:shadow-[18px_0_34px_rgba(15,23,42,0.12)]"
              aria-labelledby="vendor-filter-drawer-title"
              onWheel={(event) => {
                event.stopPropagation();
              }}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
                <h2 id="vendor-filter-drawer-title" className="text-sm font-medium text-[var(--mm-text)]">Filter menders</h2>
                <button
                  type="button"
                  onClick={() => setIsFilterDrawerOpen(false)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#68665f] transition-colors hover:bg-[#f3f4f6] hover:text-[#171b17]"
                  aria-label="Close filters"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                {FILTER_GROUPS.map(({ key, label, options }) => {
                  return (
                    <section key={key} className="border-b border-[#e5e7eb] py-3 first:pt-0 last:border-b-0">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="mymenders-field-label-font text-[11px] uppercase text-[var(--mm-muted)]">
                          {label}
                        </h3>
                        {selectedFilters[key].length ? (
                          <span className="rounded-full bg-[var(--mm-panel-muted)] px-2 py-0.5 text-[11px] text-[var(--mm-muted)]">
                            {selectedFilters[key].length}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {options.map((option) => {
                          const checked = selectedFilters[key].includes(option.id);
                          return (
                            <button
                              key={`${key}-${option.id}`}
                              type="button"
                              onClick={() => toggleFilterOption(key, option.id)}
                              aria-pressed={checked}
                              className={`inline-flex max-w-full items-center rounded-full border px-3 py-1.5 text-xs leading-tight transition-colors ${
                                checked
                                  ? 'border-brand-dark bg-brand-dark text-brand-dark-on'
                                  : 'border-dashed border-[var(--mm-border-strong)] bg-[var(--mm-panel)] text-[var(--mm-text-soft)] hover:border-[var(--mm-muted)] hover:bg-[var(--mm-panel-muted)]'
                              }`}
                            >
                              <span className="min-w-0 truncate">{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>

              <div className="shrink-0 border-t border-[#e5e7eb] p-3">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  disabled={!hasSearchOrFilters}
                  className="mymenders-field flex h-10 w-full items-center justify-center border px-3 text-sm text-[#3d403b] transition-colors hover:bg-[#f3f4f6] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Clear search and filters
                </button>
              </div>
            </div>
          )}

          <div className="absolute right-6 top-6 z-10 hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={locateUser}
              disabled={findingLocation}
              className="mymenders-map-control w-[116px] px-4"
              title="Near me"
              aria-label="Find nearby menders"
            >
              {findingLocation ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#8a877d]" /> : <Navigation className="h-4 w-4 shrink-0" />}
              <span className="ml-2 text-xs">Near me</span>
            </button>
          </div>

          <div className="absolute right-4 top-[4.5rem] z-10 flex flex-col items-end gap-2 md:bottom-6 md:right-6 md:top-auto">
            <div className="mymenders-map-control-group">
              <button
                type="button"
                onClick={() => {
                  const map = mapInstanceRef.current;
                  if (!map) return;
                  map.zoomIn();
                }}
                className="mymenders-map-control h-11 w-11 rounded-none shadow-none"
                aria-label="Zoom in"
              >
                <Plus className="w-5 h-5" />
              </button>

              <div className="h-px bg-brand-dark-text/15" />

              <button
                type="button"
                onClick={() => {
                  const map = mapInstanceRef.current;
                  if (!map) return;
                  map.zoomOut();
                }}
                className="mymenders-map-control h-11 w-11 rounded-none shadow-none"
                aria-label="Zoom out"
              >
                <Minus className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const map = mapInstanceRef.current;
                if (!map) return;
                map.flyTo({
                  center: [DEFAULT_CENTER[1], DEFAULT_CENTER[0]],
                  zoom: GLOBAL_ZOOM,
                  pitch: 0,
                  bearing: 0,
                  duration: 700,
                });
              }}
              className="mymenders-map-control h-11 w-11"
              aria-label="Reset to globe view"
            >
              <Globe className="w-5 h-5" />
            </button>

            <div className="relative" ref={styleMenuRef}>
              <button
                type="button"
                onClick={() => setIsStyleMenuOpen((value) => !value)}
                className="mymenders-map-control h-11 w-11"
                aria-label="Map style"
                aria-expanded={isStyleMenuOpen}
              >
                <Cog className="w-5 h-5" />
              </button>

              {isStyleMenuOpen && (
                <div className="mymenders-map-menu mymenders-cloth-panel absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-2xl border bg-cloth/95 p-1.5 backdrop-blur-sm md:bottom-full md:top-auto md:mb-2 md:mt-0">
                  {BASEMAP_STYLES.map((style) => (
                    <button
                      type="button"
                      key={style.id}
                      onClick={() => {
                        setSelectedBasemapStyleId(style.id);
                        setIsStyleMenuOpen(false);
                      }}
                      className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                        selectedBasemapStyleId === style.id
                          ? 'bg-brand/20 text-[#2f3e39] '
                          : 'text-[#3d403b] hover:bg-[#f3f4f6]'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

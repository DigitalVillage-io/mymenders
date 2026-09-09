import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import Select, { type GroupBase, type MultiValue, type SingleValue } from 'react-select';
import { PhoneInput } from 'react-international-phone';
import { Rating as ReactRating, ThinRoundedStar } from '@smastrom/react-rating';
import '@smastrom/react-rating/style.css';
import { Vendor } from '../types';
import { createLocationPinIcon, loadGoogleMapsScript } from '../utils/googleMaps';
import { reverseGeocode as geoReverse } from '../utils/geoapify';
import { GeoAutocomplete } from '../components/GeoAutocomplete';
import { getGroupedTaxonomyOptions, getTaxonomyOptions } from '../../shared/vendorTaxonomy.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTRY_LEVEL_OPTIONS = ['Menders', 'Member of the public'] as const;
type EntryLevelOption = (typeof ENTRY_LEVEL_OPTIONS)[number];

const MENDER_ICON_URL =
  'https://img.icons8.com/external-kmg-design-outline-color-kmg-design/64/external-sewing-sewing-kmg-design-outline-color-kmg-design-3.png';
const CONTRIBUTOR_ICON_URL = 'https://img.icons8.com/office/80/map-marker.png';

// CSS custom properties for the pin colours — change them in index.css to
// retheme the pins. Values mirror the /map page pins (see MapPage.tsx).
const PIN_COLOR_VARS: Record<string, string> = {
  Menders: '--mm-pin-mender',
  'Member of the public': '--mm-pin-contributor',
};

const FALLBACK_PIN_COLOR = '#99C4CB';

type EntryLevelMeta = {
  title: string;
  iconSrc: string;
  activePanelClasses: string;
};

const ENTRY_LEVEL_META: Record<EntryLevelOption, EntryLevelMeta> = {
  Menders: {
    title: 'Mender',
    iconSrc: MENDER_ICON_URL,
    activePanelClasses: 'border-brand-hover bg-brand',
  },
  'Member of the public': {
    title: 'Contributor',
    iconSrc: CONTRIBUTOR_ICON_URL,
    activePanelClasses: 'border-brand-hover bg-brand',
  },
};

// Google Maps marker icons are SVG data URLs and can't reference var()
// directly, so resolve the CSS custom property at runtime. Fallback mirrors
// the current theme value (same pattern as StitchedLogo.tsx).
const getPinColor = (level: string) => {
  const varName = PIN_COLOR_VARS[level];
  if (!varName) return FALLBACK_PIN_COLOR;
  if (typeof document === 'undefined') return FALLBACK_PIN_COLOR;
  const resolved = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return resolved || FALLBACK_PIN_COLOR;
};

const DEFAULT_CENTER: [number, number] = [51.505, -0.09]; // London

const coordinatesMatch = (
  first: [number, number] | null,
  second: [number, number] | null,
) => Boolean(first && second && first[0] === second[0] && first[1] === second[1]);

// ---------------------------------------------------------------------------
// react-select helpers
// ---------------------------------------------------------------------------

type Option = { value: string; label: string };
type CategoryGroup = GroupBase<Option>;

const toSelectOption = (option: { id: string; label: string }): Option => ({
  value: option.id,
  label: option.label,
});

const typeOptions: Option[] = getTaxonomyOptions('types').map(toSelectOption);
const categoryOptions: CategoryGroup[] = getGroupedTaxonomyOptions('categories').map((group: {
  label: string;
  options: Array<{ id: string; label: string }>;
}) => ({
  label: group.label,
  options: group.options.map(toSelectOption),
}));
const techniqueOptions: Option[] = getTaxonomyOptions('regional_techniques').map(toSelectOption);
const reviewItemLabels = ['Rate 1 star', 'Rate 2 stars', 'Rate 3 stars', 'Rate 4 stars', 'Rate 5 stars'];

const toValues = (opts: MultiValue<Option>): string[] => opts.map((o) => o.value);
const toSingleValue = (opt: SingleValue<Option>): string[] => (opt ? [opt.value] : []);

const selectStyles = {
  control: (base: any) => ({
    ...base,
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderRadius: '0.625rem',
    minHeight: '2.5rem',
    fontSize: '0.8125rem',
    boxShadow: 'none',
    color: '#171b17',
    '&:hover': { borderColor: '#d1d5db' },
  }),
  menu: (base: any) => ({
    ...base,
    backgroundColor: '#ffffff',
    borderRadius: '0.75rem',
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.12)',
    fontSize: '0.875rem',
    overflow: 'hidden',
    zIndex: 50,
  }),
  menuPortal: (base: any) => ({ ...base, zIndex: 3300 }),
  multiValue: (base: any) => ({
    ...base,
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '999px',
  }),
  multiValueLabel: (base: any) => ({
    ...base,
    color: '#3d403b',
    fontSize: '0.75rem',
    padding: '0.125rem 0.5rem',
  }),
  multiValueRemove: (base: any) => ({
    ...base,
    borderRadius: '0 999px 999px 0',
    '&:hover': { backgroundColor: '#1a2e45', color: '#ffffff' },
  }),
  placeholder: (base: any) => ({ ...base, color: '#8a877d' }),
  singleValue: (base: any) => ({ ...base, color: '#171b17' }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isFocused || state.isSelected ? '#f3f4f6' : '#ffffff',
    color: '#171b17',
    '&:active': { backgroundColor: '#e5e7eb' },
  }),
};

const reviewRatingStyles = {
  itemShapes: ThinRoundedStar,
  itemStrokeWidth: 1.8,
  activeFillColor: '#F4A261',
  activeStrokeColor: '#F4A261',
  inactiveFillColor: '#fff7ed',
  inactiveStrokeColor: '#fdba74',
};

const FIELD_LABEL_CLASS =
  'add-mender-modal-label mb-1.5 block text-[11px] uppercase';

// Mirrors the shape of the form fields (labels + inputs) so the reveal
// skeleton doesn't shift the layout when the real fields appear.
const FormSkeleton = () => (
  <div aria-hidden="true" className="space-y-4">
    <div>
      <div className="mymenders-shimmer-block mb-1.5 h-2.5 w-24 rounded" />
      <div className="mymenders-shimmer-block h-10 w-full rounded-[0.625rem]" />
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <div className="mymenders-shimmer-block mb-1.5 h-2.5 w-20 rounded" />
        <div className="mymenders-shimmer-block h-10 w-full rounded-[0.625rem]" />
      </div>
      <div>
        <div className="mymenders-shimmer-block mb-1.5 h-2.5 w-20 rounded" />
        <div className="mymenders-shimmer-block h-10 w-full rounded-[0.625rem]" />
      </div>
    </div>
    <div>
      <div className="mymenders-shimmer-block mb-1.5 h-2.5 w-16 rounded" />
      <div className="mymenders-shimmer-block h-10 w-full rounded-[0.625rem]" />
    </div>
    <div>
      <div className="mymenders-shimmer-block mb-1.5 h-2.5 w-24 rounded" />
      <div className="mymenders-shimmer-block h-10 w-full rounded-[0.625rem]" />
    </div>
    <div>
      <div className="mymenders-shimmer-block mb-1.5 h-2.5 w-28 rounded" />
      <div className="mymenders-shimmer-block h-10 w-full rounded-[0.625rem]" />
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddMenderPage() {
  const navigate = useNavigate();

  // ---- form fields ----
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [onlinePresence, setOnlinePresence] = useState('');
  const [entryLevel, setEntryLevel] = useState<string | null>(null);
  const [isRevealingForm, setIsRevealingForm] = useState(false);
  const [types, setTypes] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [regionalTechniques, setRegionalTechniques] = useState<string[]>([]);
  const [reviewStars, setReviewStars] = useState(0);
  const [reviewText, setReviewText] = useState('');

  // ---- map / location state ----
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [geoResolved, setGeoResolved] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submissionComplete, setSubmissionComplete] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [placesReady, setPlacesReady] = useState(false);
  const [addressSuggestionsEnabled, setAddressSuggestionsEnabled] = useState(false);
  const selectMenuPortalTarget = typeof document !== 'undefined' ? document.body : undefined;

  // ---- refs to survive effect closures ----
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const googleAutocompleteRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSelectedCoordinatesRef = useRef<[number, number] | null>(null);
  const pendingReverseGeocodeRef = useRef<Promise<string | null> | null>(null);
  const reverseGeocodeRequestIdRef = useRef(0);
  const addressManuallyEditedRef = useRef(false);

  // Keep a ref copy of position so GMaps callbacks always read the latest value
  const positionRef = useRef(position);
  positionRef.current = position;

  // ------------------------------------------------------------------
  // Helpers that touch the map directly (not via state)
  // ------------------------------------------------------------------

  const panMapTo = useCallback((lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.setCenter({ lat, lng });
    map.setZoom(16);
  }, []);

  const enableAddressSuggestions = useCallback(() => {
    setAddressSuggestionsEnabled(true);
  }, []);

  const disableAddressSuggestions = useCallback(() => {
    setAddressSuggestionsEnabled(false);
    addressInputRef.current?.blur();
  }, []);

  const reverseGeocode = useCallback(
    (lat: number, lng: number): Promise<string | null> => {
      disableAddressSuggestions();

      const requestId = ++reverseGeocodeRequestIdRef.current;
      const coordinates: [number, number] = [lat, lng];

      const lookup = new Promise<string | null>((resolve) => {
        const useGeoapify = () => {
          geoReverse(lat, lng)
            .then(resolve)
            .catch(() => resolve(null));
        };

        // Try Google first.
        if ((window as any).google?.maps) {
          try {
            const geocoder = new (window as any).google.maps.Geocoder();
            geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
              if (status === 'OK' && results?.[0]?.formatted_address) {
                resolve(results[0].formatted_address);
              } else {
                // Fall back to Geoapify.
                useGeoapify();
              }
            });
          } catch {
            useGeoapify();
          }
        } else {
          // Google not loaded — use Geoapify directly.
          useGeoapify();
        }
      }).then((resolvedAddress) => {
        const isCurrentRequest =
          requestId === reverseGeocodeRequestIdRef.current &&
          coordinatesMatch(latestSelectedCoordinatesRef.current, coordinates);

        // A late response must not replace the address for a newer pin, or a
        // manual edit made while this lookup was pending.
        if (isCurrentRequest && resolvedAddress && !addressManuallyEditedRef.current) {
          setAddress(resolvedAddress);
        }

        return resolvedAddress;
      });

      return lookup;
    },
    [disableAddressSuggestions],
  );

  // Central "go here" action used by autocomplete, click, and drag
  const goToLocation = useCallback(
    (lat: number, lng: number, addr?: string) => {
      disableAddressSuggestions();
      latestSelectedCoordinatesRef.current = [lat, lng];
      setPosition([lat, lng]);
      if (addr) {
        ++reverseGeocodeRequestIdRef.current;
        pendingReverseGeocodeRef.current = null;
        addressManuallyEditedRef.current = false;
        setAddress(addr);
      } else {
        addressManuallyEditedRef.current = false;
        setAddress('');
        pendingReverseGeocodeRef.current = reverseGeocode(lat, lng);
      }
      panMapTo(lat, lng);
    },
    [disableAddressSuggestions, panMapTo, reverseGeocode],
  );

  // ------------------------------------------------------------------
  // Effect 1 — Geolocation
  // ------------------------------------------------------------------
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition([pos.coords.latitude, pos.coords.longitude]);
          setGeoResolved(true);
        },
        () => {
          setPosition(DEFAULT_CENTER);
          setGeoResolved(true);
        },
      );
    } else {
      setPosition(DEFAULT_CENTER);
      setGeoResolved(true);
    }
  }, []);

  // ------------------------------------------------------------------
  // Effect 1b — centre the map on the user's location once geolocation
  // resolves. The map is usually created (Effect 2) before the
  // geolocation callback lands, so it starts on the default centre —
  // this effect pulls it to the geolocated position afterwards.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!geoResolved || !position) return;
    panMapTo(position[0], position[1]);
  }, [geoResolved, position, panMapTo]);

  // ------------------------------------------------------------------
  // Effect 2 — Google Maps initialisation
  // ------------------------------------------------------------------
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    setMapError(null);

    // Set up the global auth-failure callback
    const onGmAuthFailure = () =>
      setMapError(
        'Google Maps authentication failed. Check your API key, billing, and domain restrictions.',
      );
    (window as any).gm_authFailure = onGmAuthFailure;

    let cancelled = false;

    loadGoogleMapsScript(apiKey || '')
      .then(async () => {
        if (cancelled || !mapContainerRef.current) return;
        const g = (window as any).google;
        if (!g?.maps) return;

        // Ensure Places is available
        try { await g.maps.importLibrary('places'); } catch { /* ok */ }

        // ---- Create the map ----
        const initial = positionRef.current || DEFAULT_CENTER;
        const map = new g.maps.Map(mapContainerRef.current, {
          center: { lat: initial[0], lng: initial[1] },
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
        });
        mapRef.current = map;

        // ---- Place Autocomplete ----
        const hasPlaces = !!g.maps.places?.Autocomplete;
        if (hasPlaces && addressInputRef.current) {
          const autocomplete = new g.maps.places.Autocomplete(addressInputRef.current, {
            fields: ['formatted_address', 'geometry', 'name'],
          });
          googleAutocompleteRef.current = autocomplete;
          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            const location = place?.geometry?.location;
            if (!location) {
              setMapError('Unable to resolve the selected address. Try another suggestion.');
              return;
            }

            const lat = location.lat();
            const lng = location.lng();
            const addr = place.formatted_address || place.name || addressInputRef.current?.value || '';
            goToLocation(lat, lng, addr);
            setMapError(null);
          });
          setPlacesReady(true);
        }

        // ---- Marker (draggable) ----
        const marker = new g.maps.Marker({
          map,
          position: { lat: initial[0], lng: initial[1] },
          icon: createLocationPinIcon(g.maps, getPinColor('Menders'), '#ffffff'),
          draggable: true,
        });
        markerRef.current = marker;

        // ---- Map click ----
        map.addListener('click', (evt: any) => {
          if (!evt.latLng) return;
          const lat = evt.latLng.lat();
          const lng = evt.latLng.lng();
          goToLocation(lat, lng);
        });

        // ---- Marker drag ----
        marker.addListener('dragend', () => {
          const pos = marker.getPosition();
          if (!pos) return;
          const lat = pos.lat();
          const lng = pos.lng();
          goToLocation(lat, lng);
        });
      })
      .catch((err: any) => {
        if (cancelled) return;
        setMapError(err instanceof Error ? err.message : 'Failed to load Google Maps.');
      });

    return () => {
      cancelled = true;
      if ((window as any).gm_authFailure === onGmAuthFailure) {
        (window as any).gm_authFailure = undefined;
      }
      googleAutocompleteRef.current = null;
      markerRef.current = null;
      mapRef.current = null;
      setPlacesReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // Effect 3 — sync marker position + colour when position/entryLevel changes
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!position || !markerRef.current) return;
    const g = (window as any).google;
    if (!g?.maps) return;

    const latLng = { lat: position[0], lng: position[1] };
    markerRef.current.setPosition(latLng);
    markerRef.current.setIcon(
      createLocationPinIcon(g.maps, getPinColor(entryLevel ?? ''), '#ffffff'),
    );
  }, [position, entryLevel]);

  // ------------------------------------------------------------------
  // Form helpers
  // ------------------------------------------------------------------

  const resetReviewFields = () => {
    setReviewStars(0);
    setReviewText('');
  };

  const onEntryLevelChange = (level: string) => {
    if (level === entryLevel) return;
    setEntryLevel(level);
    if (level === 'Menders') resetReviewFields();

    // Every role change gets the reveal choreography — a brief shimmer so
    // the form swap doesn't feel instant.
    setIsRevealingForm(true);
    revealTimerRef.current = setTimeout(() => setIsRevealingForm(false), 1000);
  };

  // Clear the reveal timer if the user leaves the page mid-reveal.
  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, []);

  // Back to the role picker — the only place to choose who's adding this.
  const goBackToPicker = () => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    setIsRevealingForm(false);
    setEntryLevel(null);
  };

  // ------------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryLevel) return;
    setSubmitError('');
    setSubmitting(true);

    if (!name.trim()) {
      setSubmitError('Shop name is required.');
      setSubmitting(false);
      return;
    }

    if (!position || !Number.isFinite(position[0]) || !Number.isFinite(position[1])) {
      setSubmitError('Please select a location on the map — click or drag the pin.');
      setSubmitting(false);
      return;
    }

    const selectedPosition = position;
    const selectedCoordinates = latestSelectedCoordinatesRef.current;
    const pendingLookup = pendingReverseGeocodeRef.current;
    let lookedUpAddress: string | null = null;

    if (pendingLookup && coordinatesMatch(selectedCoordinates, selectedPosition)) {
      lookedUpAddress = await pendingLookup;
    }

    const resolvedAddress =
      (addressManuallyEditedRef.current ? address.trim() : lookedUpAddress || address.trim()) ||
      'Location selected on map';
    const normalizedReview = Number.isFinite(reviewStars) ? Math.min(5, Math.max(0, reviewStars)) : 0;

    const payload = {
      name,
      category: entryLevel,
      entry_level: entryLevel,
      types,
      address: resolvedAddress,
      latitude: selectedPosition[0],
      longitude: selectedPosition[1],
      phone,
      contact: phone,
      website: onlinePresence || undefined,
      online_presence: onlinePresence,
      categories,
      regional_techniques: regionalTechniques,
      review_text: reviewText,
      rating: entryLevel === 'Member of the public' ? normalizedReview : 0,
      rating_count:
        entryLevel === 'Member of the public' && (reviewText || normalizedReview > 0) ? 1 : 0,
      photos: JSON.stringify({
        entry_level: entryLevel,
        types,
        categories,
        regional_techniques: regionalTechniques,
        online_presence: onlinePresence,
        review_text: reviewText,
      }),
    };

    try {
      const res = await fetch(`${window.location.origin}/api/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`Failed to add mender (${res.status}). Please try again.`);
      }
      setSubmitting(false);
      setSubmissionComplete(true);
      window.setTimeout(() => setShowSuccessModal(true), 450);
    } catch (err) {
      console.error('Failed to add vendor:', err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to add mender. Please try again.');
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------------
  // Derived UI flags
  // ------------------------------------------------------------------

  // Show the fallback text input when Places isn't available OR we hit an error
  const showFallbackInput = !placesReady;

  // Shared by the standalone picker view and the form's entry-level section,
  // so the role can be switched at any time.
  const entryLevelCards = (
    <div className="grid grid-cols-2 gap-3">
      {ENTRY_LEVEL_OPTIONS.map((level) => {
        const meta = ENTRY_LEVEL_META[level];
        const isSelected = entryLevel === level;

        return (
          <label key={level} className="group block cursor-pointer">
            <input
              type="radio"
              name="entry-level"
              value={level}
              checked={isSelected}
              onChange={() => onEntryLevelChange(level)}
              className="peer sr-only"
            />
            <span
              className={`relative flex aspect-[3/1] items-center gap-2.5 rounded-2xl border pl-4 pr-3 transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-light peer-focus-visible:ring-offset-2 ${
                isSelected
                  ? meta.activePanelClasses
                  : 'border-[#e5e7eb] bg-white hover:-translate-y-0.5 hover:border-[#d1d5db] hover:bg-[#fafafa] hover:shadow-[var(--mm-shadow-subtle)]'
              }`}
            >
              {/* Icon in a circular grey container */}
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] transition-transform duration-200 group-hover:scale-105">
                <img
                  src={meta.iconSrc}
                  alt=""
                  aria-hidden="true"
                  className={`h-6.5 w-6.5 object-contain transition-all duration-200 ${
                    isSelected ? '' : 'opacity-60 saturate-50'
                  }`}
                />
              </span>

              <span
                className={`min-w-0 flex-1 text-sm leading-tight ${
                  isSelected ? 'text-[#222222]' : 'text-[#171b17]'
                }`}
              >
                {meta.title}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="relative z-0 mt-20 h-[calc(100vh-80px)] w-full">
      <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[35%_65%]">
        {/* ==================== FORM SIDEBAR ==================== */}
        <aside className="order-2 flex h-[calc(60vh-80px)] min-h-0 flex-col border-r border-[#e5e7eb] bg-[#fafafa] md:order-1 md:h-full">
          <div className="shrink-0 border-b border-[#e5e7eb] px-4 py-3">
            <h1 className="mymenders-card-title-semi text-xl uppercase text-brand-dark-on">
              Add a Mender
            </h1>
          </div>

          {entryLevel === null ? (
            <div className="flex min-h-0 flex-1 flex-col justify-start px-4 py-6">
              <h2 className="mymenders-card-title-semi mb-3 text-sm uppercase text-[var(--mm-muted)]">
                Who is adding this?
              </h2>
              <fieldset>{entryLevelCards}</fieldset>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-4 px-4 py-4">
                {/* Change the role by heading back to the picker */}
                <button
                  type="button"
                  onClick={goBackToPicker}
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--mm-muted)] transition-colors hover:text-[var(--mm-text)]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Back
                </button>

                {isRevealingForm ? (
                  <FormSkeleton />
                ) : (
                <div className="mymenders-fade-in space-y-4">
                {/* Studio Name */}
                <div>
                  <label htmlFor="name" className={FIELD_LABEL_CLASS}>
                    Mender / Studio Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Maria's Shoe Repair"
                    className="mymenders-field w-full border px-3 py-2 text-sm outline-none"
                  />
                </div>

                {/* Type + Phone */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={FIELD_LABEL_CLASS}>Studio Type</label>
                    <Select
                      options={typeOptions}
                      value={typeOptions.find((o) => types.includes(o.value)) ?? null}
                      onChange={(opt) => setTypes(toSingleValue(opt))}
                      placeholder="Select studio type..."
                      isClearable
                      menuPortalTarget={selectMenuPortalTarget}
                      menuPosition="fixed"
                      styles={selectStyles}
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className={FIELD_LABEL_CLASS}>
                      Tel Number
                    </label>
                    <PhoneInput
                      defaultCountry="gb"
                      value={phone}
                      onChange={(nextPhone) => setPhone(nextPhone)}
                      placeholder="Phone"
                      allowMaskOverflow
                      inputProps={{ id: 'phone', name: 'phone' }}
                      className="mymenders-phone-input"
                      inputClassName="mymenders-phone-input__field"
                      countrySelectorStyleProps={{
                        buttonClassName: 'mymenders-phone-input__country-button',
                        dropdownStyleProps: {
                          className: 'mymenders-phone-input__dropdown',
                        },
                      }}
                    />
                  </div>
                </div>

                {/* Social */}
                <div>
                  <label htmlFor="online" className={FIELD_LABEL_CLASS}>
                    Social
                  </label>
                  <input
                    id="online"
                    type="text"
                    value={onlinePresence}
                    onChange={(e) => setOnlinePresence(e.target.value)}
                    placeholder="Website or social link"
                    className="mymenders-field w-full border px-3 py-2 text-sm outline-none"
                  />
                </div>

                {/* Categories */}
                <div>
                  <p className={FIELD_LABEL_CLASS}>Categories</p>
                  <Select
                    isMulti
                    options={categoryOptions}
                    value={categoryOptions
                      .flatMap((group) => group.options)
                      .filter((option) => categories.includes(option.value))}
                    onChange={(opts) => setCategories(toValues(opts))}
                    placeholder="Select categories..."
                    menuPortalTarget={selectMenuPortalTarget}
                    menuPosition="fixed"
                    styles={selectStyles}
                  />
                </div>

                {/* Regional Techniques */}
                <div>
                  <label className={FIELD_LABEL_CLASS}>
                    Regional techniques
                  </label>
                  <Select
                    isMulti
                    options={techniqueOptions}
                    value={techniqueOptions.filter((o) => regionalTechniques.includes(o.value))}
                    onChange={(opts) => setRegionalTechniques(toValues(opts))}
                    placeholder="Select techniques..."
                    menuPortalTarget={selectMenuPortalTarget}
                    menuPosition="fixed"
                    styles={selectStyles}
                  />
                </div>

                {/* Review (Member of the public only) */}
                {entryLevel === 'Member of the public' && (
                  <div>
                    <span
                      id="review-stars-label"
                      className={FIELD_LABEL_CLASS}
                    >
                      Review
                    </span>
                    <div>
                      <ReactRating
                        id="review-stars"
                        style={{ maxWidth: 180 }}
                        value={reviewStars}
                        onChange={setReviewStars}
                        transition="colors"
                        spaceBetween="small"
                        itemStyles={reviewRatingStyles}
                        visibleLabelId="review-stars-label"
                        invisibleItemLabels={reviewItemLabels}
                      />
                      <textarea
                        id="review-text"
                        aria-label="Written review"
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder="Leave your feedback"
                        rows={2}
                        className="mymenders-field mt-2 w-full border px-3 py-2 text-sm outline-none"
                      />
                    </div>
                  </div>
                )}
                </div>
                )}
              </div>
            </div>

            <div className="shrink-0 border-t border-[#e5e7eb] bg-[#f5f6f8] px-4 py-3">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  disabled={submitting || submissionComplete}
                  className="h-10 flex-1 rounded-full border border-[#e5e7eb] bg-white px-5 text-sm text-[#3d403b] transition-colors hover:bg-[#f3f4f6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || submissionComplete}
                  className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-full px-5 text-sm transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${
                    submissionComplete
                      ? 'bg-[#5d8b61] text-white'
                      : 'bg-brand-dark text-brand-dark-on hover:bg-brand-dark-hover'
                  }`}
                >
                  {submissionComplete ? (
                    <>
                      <Check className="h-4 w-4 animate-[mm-submit-confirm_350ms_ease-out]" strokeWidth={2.5} aria-hidden="true" />
                      Submitted
                    </>
                  ) : submitting ? 'Submitting…' : 'Submit for review'}
                </button>
              </div>
              {submitError && <p className="mt-3 text-xs text-[#8b4e16]">{submitError}</p>}
            </div>
          </form>
          )}
        </aside>

        {/* ==================== MAP ==================== */}
        <div className="relative order-1 h-[40vh] min-h-0 md:order-2 md:h-full">
          <div ref={mapContainerRef} className="h-full w-full" />

          {/* Floating address search */}
          <div className="absolute left-4 right-4 top-4 z-10 mx-auto max-w-lg">
            <div className="mymenders-cloth-panel rounded-2xl border p-1.5">
              {!showFallbackInput ? (
                <input
                  ref={addressInputRef}
                  type="text"
                  value={address}
                  onFocus={enableAddressSuggestions}
                  onChange={(e) => {
                    enableAddressSuggestions();
                    addressManuallyEditedRef.current = true;
                    setAddress(e.target.value);
                  }}
                  placeholder="Search an address to place the pin"
                  autoComplete="off"
                  className="mymenders-field w-full border px-3 py-2.5 text-sm text-[#171b17] outline-none"
                />
              ) : (
                <GeoAutocomplete
                  value={address}
                  onChange={(val) => {
                    addressManuallyEditedRef.current = true;
                    setAddress(val);
                  }}
                  onSelect={(s) => goToLocation(s.lat, s.lng, s.formatted)}
                  suggestionsEnabled={addressSuggestionsEnabled}
                  onManualInputFocus={enableAddressSuggestions}
                  onManualInputChange={enableAddressSuggestions}
                  onSuggestionsClose={disableAddressSuggestions}
                  placeholder="Search an address to place the pin"
                />
              )}
            </div>
            {mapError && <p className="mt-1.5 px-2 text-xs text-[#9b5f1d]">{mapError}</p>}
          </div>
        </div>
      </div>

      {showSuccessModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-[#171b17]/30 p-5 backdrop-blur-[2px]">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="contribution-success-title"
            className="w-full max-w-sm rounded-2xl border border-[#e5e7eb] bg-[#fafafa] p-7 shadow-[var(--mm-shadow-panel)] sm:p-8"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8f1e7] text-[#527b56]">
              <Check className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
            </div>
            <h2 id="contribution-success-title" className="mymenders-card-title-semi mt-5 text-3xl text-[var(--mm-text)]">
              Thanks for your contribution.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--mm-muted)]">
              Your mender has been submitted for review and will soon be live on the map.
            </p>
            <button
              type="button"
              onClick={() => navigate('/map')}
              className="mt-7 h-10 w-full rounded-full bg-brand-dark px-5 text-sm text-brand-dark-on transition-colors hover:bg-brand-dark-hover"
            >
              Go back to Map
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

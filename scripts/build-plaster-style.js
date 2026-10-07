// Builds public/map-styles/plaster.json: a cream "plaster globe" basemap.
// It starts from OpenFreeMap's Positron style (same vector tiles, glyphs and
// sprites), recolors it, and adds a Mapterhorn DEM hillshade for embossed relief.
//
//   node scripts/build-plaster-style.js
//
// Tweak the PALETTE / HILLSHADE values below and re-run; MapPage loads the
// generated JSON as a static file.
import { mkdir, writeFile } from 'node:fs/promises';

const SOURCE_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const OUTPUT_DIR = new URL('../public/map-styles/', import.meta.url);
const OUTPUT_PATH = new URL('plaster.json', OUTPUT_DIR);

// OpenFreeMap's low-zoom vector tiles are ~1.5 MB each, so the globe would sit
// blank for seconds. Below this zoom we draw tiny bundled Natural Earth 1:110m
// oceans and borders instead (public domain), which appear instantly.
const OVERVIEW_MAX_ZOOM = 3;
const NATURAL_EARTH_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';
const OVERVIEW_DATASETS = {
  'ne-ocean': 'ne_110m_ocean',
  'ne-borders': 'ne_110m_admin_0_boundary_lines_land',
};

const PALETTE = {
  land: '#e4ded2',
  landShade: '#ded7ca',
  water: '#f0ece5',
  waterway: '#e3ddd1',
  building: '#e7e0d3',
  buildingOutline: '#d8d0c1',
  roadCasing: '#d9d1c2',
  roadMinor: '#f6f2ea',
  roadMajor: '#fbf8f2',
  rail: '#d3cbbb',
  border: '#8f8778',
  coastline: '#8c8371',
  labelStrong: '#4a443a',
  label: '#6b6457',
  labelSoft: '#8c8577',
  waterLabel: '#968d7d',
  coastShadow: 'rgba(74, 62, 44, 0.42)',
  coastHighlight: 'rgba(255, 253, 248, 0.9)',
  halo: 'rgba(236, 231, 222, 0.6)',
};

const HILLSHADE_LAYER_ID = 'plaster-hillshade';
const DEM_SOURCE_ID = 'mapterhorn-dem';

const hillshadeLayer = {
  id: HILLSHADE_LAYER_ID,
  type: 'hillshade',
  source: DEM_SOURCE_ID,
  paint: {
    'hillshade-method': 'multidirectional',
    'hillshade-illumination-direction': [270, 315, 0, 45],
    'hillshade-illumination-altitude': [30, 30, 30, 30],
    'hillshade-highlight-color': ['#fffdf8', '#fbf7ef', '#fbf7ef', '#fffdf8'],
    'hillshade-shadow-color': ['#837864', '#958a76', '#a39a88', '#958a76'],
    // Strong relief on the globe, fading out at street level so it never
    // competes with the roads people use to place a pin precisely.
    'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 0.8, 11, 0.35, 15, 0.15],
  },
};

// Raised plaster coastline: a soft shadow down-right and a highlight up-left
// of the edge (light comes from the upper left), then a fine crisp line.
const embossedCoastline = (idPrefix, source, extra) => [
  {
    id: `${idPrefix}-shadow`,
    type: 'line',
    source,
    ...extra,
    paint: {
      'line-color': PALETTE.coastShadow,
      'line-width': 2.6,
      'line-blur': 1.6,
      'line-translate': [1.2, 1.4],
    },
  },
  {
    id: `${idPrefix}-highlight`,
    type: 'line',
    source,
    ...extra,
    paint: {
      'line-color': PALETTE.coastHighlight,
      'line-width': 1.4,
      'line-blur': 0.6,
      'line-translate': [-0.8, -0.9],
    },
  },
  {
    id: idPrefix,
    type: 'line',
    source,
    ...extra,
    paint: {
      'line-color': PALETTE.coastline,
      'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 6, 1, 12, 1.2],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.95, 12, 0.5],
    },
  },
];

const coastlineLayers = embossedCoastline('plaster-coastline', 'openmaptiles', {
  'source-layer': 'water',
  minzoom: OVERVIEW_MAX_ZOOM,
  filter: ['==', ['geometry-type'], 'Polygon'],
});


const overviewLayers = [
  {
    id: 'plaster-overview-ocean',
    type: 'fill',
    source: 'ne-ocean',
    maxzoom: OVERVIEW_MAX_ZOOM,
    paint: { 'fill-color': PALETTE.water },
  },
  ...embossedCoastline('plaster-overview-coastline', 'ne-ocean', { maxzoom: OVERVIEW_MAX_ZOOM }),
  {
    id: 'plaster-overview-borders',
    type: 'line',
    source: 'ne-borders',
    maxzoom: OVERVIEW_MAX_ZOOM,
    paint: { 'line-color': PALETTE.border, 'line-width': 1, 'line-opacity': 0.6 },
  },
];

// Keep the globe uncluttered: smaller countries and states appear as you zoom.
const LABEL_MIN_ZOOMS = { label_country_3: 4, label_state: 5, label_other: 6 };

const setPaint = (layer, paint) => {
  layer.paint = { ...layer.paint, ...paint };
};

const setLayout = (layer, layout) => {
  layer.layout = { ...layer.layout, ...layout };
};

const restyleLayer = (layer) => {
  const { id, type } = layer;

  if (id === 'background') return setPaint(layer, { 'background-color': PALETTE.land });
  if (id === 'water') {
    return setPaint(layer, { 'fill-color': PALETTE.water });
  }
  if (id === 'waterway') return setPaint(layer, { 'line-color': PALETTE.waterway });
  if (id === 'park' || id.startsWith('landcover_wood') || id.startsWith('landuse_')) {
    return setPaint(layer, { 'fill-color': PALETTE.landShade });
  }
  if (id.startsWith('landcover_')) return setPaint(layer, { 'fill-color': '#f5f1e8' });
  if (id === 'building') {
    return setPaint(layer, { 'fill-color': PALETTE.building, 'fill-outline-color': PALETTE.buildingOutline });
  }
  if (id === 'road_area_pier' || id === 'road_pier') {
    return setPaint(layer, type === 'fill' ? { 'fill-color': PALETTE.land } : { 'line-color': PALETTE.land });
  }

  if (id.startsWith('boundary_')) {
    if (id !== 'boundary_3') layer.minzoom = Math.max(layer.minzoom ?? 0, OVERVIEW_MAX_ZOOM);
    return setPaint(layer, {
      'line-color': PALETTE.border,
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.55, 4, 0.8],
    });
  }

  if (type === 'line' && (id.includes('casing') || id === 'aeroway-runway-casing')) {
    return setPaint(layer, { 'line-color': PALETTE.roadCasing });
  }
  if (type === 'line' && id.includes('subtle')) return setPaint(layer, { 'line-color': PALETTE.roadCasing });
  if (type === 'line' && id.startsWith('railway')) {
    return setPaint(layer, { 'line-color': id.includes('dashline') ? PALETTE.roadMinor : PALETTE.rail });
  }
  if (type === 'line' && (id.includes('major_inner') || id.includes('motorway') && id.includes('inner'))) {
    return setPaint(layer, { 'line-color': PALETTE.roadMajor });
  }
  if (type === 'line' && (id.startsWith('highway') || id.startsWith('aeroway') || id.startsWith('tunnel'))) {
    return setPaint(layer, { 'line-color': PALETTE.roadMinor });
  }
  if (id === 'aeroway-area') return setPaint(layer, { 'fill-color': PALETTE.roadMinor });

  if (type !== 'symbol') return;

  if (LABEL_MIN_ZOOMS[id] !== undefined) {
    layer.minzoom = Math.max(layer.minzoom ?? 0, LABEL_MIN_ZOOMS[id]);
  }

  // No halo at globe zoom: labels that spill past the globe's edge then vanish
  // into the night sky instead of floating there on a cream outline.
  const halo = {
    'text-halo-color': PALETTE.halo,
    'text-halo-width': ['interpolate', ['linear'], ['zoom'], 3.5, 0, 5, 1.2],
    'text-halo-blur': 0.5,
  };

  if (id.startsWith('water_name') || id === 'waterway_line_label') {
    setLayout(layer, { 'text-transform': 'uppercase', 'text-letter-spacing': 0.45, 'text-line-height': 1.6 });
    return setPaint(layer, { ...halo, 'text-color': PALETTE.waterLabel });
  }
  if (id.startsWith('label_country')) {
    setLayout(layer, { 'text-transform': 'uppercase', 'text-letter-spacing': 0.15 });
    return setPaint(layer, { ...halo, 'text-color': PALETTE.labelStrong });
  }
  if (id === 'label_state' || id === 'label_other') {
    setLayout(layer, { 'text-transform': 'uppercase', 'text-letter-spacing': 0.1 });
    return setPaint(layer, { ...halo, 'text-color': PALETTE.labelSoft });
  }
  if (id.startsWith('label_')) return setPaint(layer, { ...halo, 'text-color': PALETTE.labelStrong });

  if (layer.paint?.['text-color']) setPaint(layer, { ...halo, 'text-color': PALETTE.label });
};

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.json();
};

const roundCoordinates = (coordinates) =>
  typeof coordinates[0] === 'number'
    ? coordinates.map((value) => Math.round(value * 100) / 100)
    : coordinates.map(roundCoordinates);

// Strip properties and round to ~1 km; plenty for a 1:110m overview.
const writeOverviewDataset = async (fileName) => {
  const collection = await fetchJson(`${NATURAL_EARTH_URL}/${fileName}.geojson`);
  const slim = {
    type: 'FeatureCollection',
    features: collection.features.map(({ geometry }) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: geometry.type, coordinates: roundCoordinates(geometry.coordinates) },
    })),
  };
  await writeFile(new URL(`${fileName}.geojson`, OUTPUT_DIR), JSON.stringify(slim));
};

// Night sky behind the globe (see .mymenders-starfield in index.css). Seeded so
// re-running the script produces the same sky.
const writeStarfield = async (fileName, size, starCount, seed) => {
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  const stars = Array.from({ length: starCount }, () => {
    const bright = random() < 0.08;
    const radius = bright ? 1 + random() * 0.6 : 0.35 + random() * 0.55;
    const opacity = bright ? 0.85 + random() * 0.15 : 0.35 + random() * 0.45;
    return `<circle cx="${(random() * size).toFixed(1)}" cy="${(random() * size).toFixed(1)}" r="${radius.toFixed(2)}" fill="#fff" fill-opacity="${opacity.toFixed(2)}"/>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${stars.join('')}</svg>`;
  await writeFile(new URL(fileName, OUTPUT_DIR), svg);
};

const response = await fetch(SOURCE_STYLE_URL);
if (!response.ok) throw new Error(`Failed to fetch ${SOURCE_STYLE_URL}: ${response.status}`);
const style = await response.json();

style.name = 'My Mender Plaster';
delete style.sources.ne2_shaded;
style.sources[DEM_SOURCE_ID] = {
  type: 'raster-dem',
  url: 'https://tiles.mapterhorn.com/tilejson.json',
  encoding: 'terrarium',
  tileSize: 512,
};

// Atmosphere glow around the globe, kept warm and faint against the starfield.
style.sky = {
  'sky-color': '#0b0b0d',
  'horizon-color': '#d9cfbd',
  'fog-color': '#efe9dd',
  'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.35, 5, 0.2, 8, 0],
};

for (const [sourceId, fileName] of Object.entries(OVERVIEW_DATASETS)) {
  style.sources[sourceId] = { type: 'geojson', data: `/map-styles/${fileName}.geojson` };
}

style.layers.forEach(restyleLayer);

// Hillshade sits above land fills but below water, so oceans stay flat and
// smooth (the DEM includes bathymetry) while continents look raised.
const waterLayer = style.layers.find((layer) => layer.id === 'water');
const landFills = style.layers.filter(
  (layer) => layer.type === 'fill' && ['park', 'landcover', 'landuse'].includes(layer['source-layer']),
);
const rest = style.layers.filter((layer) => layer !== waterLayer && !landFills.includes(layer));
const [background, ...others] = rest;
style.layers = [background, ...landFills, hillshadeLayer, waterLayer, ...overviewLayers, ...coastlineLayers, ...others];

await mkdir(OUTPUT_DIR, { recursive: true });
await Promise.all([
  ...Object.values(OVERVIEW_DATASETS).map(writeOverviewDataset),
  writeStarfield('stars-near.svg', 560, 90, 7),
  writeStarfield('stars-far.svg', 380, 70, 13),
]);
await writeFile(OUTPUT_PATH, `${JSON.stringify(style, null, 2)}\n`);
console.log(`Wrote ${OUTPUT_PATH.pathname} (${style.layers.length} layers)`);

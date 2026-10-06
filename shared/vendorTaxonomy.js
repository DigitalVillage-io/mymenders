export const VENDOR_TAXONOMY = {
  types: [
    { id: 'shop_workshop', label: 'Shop / Workshop' },
    { id: 'home', label: 'Home' },
    { id: 'brand_in_store_services', label: 'Brand In Store Services' },
    { id: 'mobile_itinerant', label: 'Mobile / Itinerant' },
    { id: 'chains_networks', label: 'Chains and Networks' },
    { id: 'dry_cleaners', label: 'Dry-cleaners' },
    { id: 'shoe_leather_accessories', label: 'Shoe and Leather Accessories' },
  ],
  categories: [
    {
      label: 'CLOTHING',
      options: [
        { id: 'alterations_customising', label: 'Alterations and Customising' },
        { id: 'bridal_occasion_wear_alterations', label: 'Bridal & Occasion Wear Alterations' },
        { id: 'darning', label: 'Darning' },
        { id: 'denim_repairs', label: 'Denim Repairs' },
        { id: 'embroidery_decorative_repairs', label: 'Embroidery & Decorative Repairs' },
        { id: 'machine_hand_mending_basics', label: 'Machine & Hand Mending Basics' },
        { id: 'patching', label: 'Patching' },
        { id: 're_dyeing_surface_treatments', label: 'Re-dyeing & Surface Treatments' },
        { id: 'reinforcing', label: 'Reinforcing' },
        { id: 'seam_repairs_stitching', label: 'Seam Repairs / Stitching' },
        { id: 'tailoring_repairs', label: 'Tailoring Repairs' },
        { id: 'upcycling_reconstruction', label: 'Upcycling & Reconstruction' },
      ],
    },
    {
      label: 'ACCESSORIES',
      options: [
        { id: 'bags_luggage', label: 'Bags and Luggage' },
        { id: 'shoes', label: 'Shoes' },
      ],
    },
  ],
  regional_techniques: [
    { id: 'applique_repair', label: 'Appliqu\u00e9 Repair' },
    { id: 'boro', label: 'Boro' },
    { id: 'darning', label: 'Darning' },
    { id: 'kantha_repair', label: 'Kantha Repair' },
    { id: 'kintsugi_inspired_textile_repair', label: 'Kintsugi-inspired Textile Repair' },
    { id: 'kogin_stitch', label: 'Kogin Stitch' },
    { id: 'needle_weaving', label: 'Needle Weaving' },
    { id: 'patchwork_mending', label: 'Patchwork Mending' },
    { id: 'rafu', label: 'Rafu' },
    { id: 'reweaving', label: 'Reweaving' },
    { id: 'sashiko', label: 'Sashiko' },
    { id: 'swiss_darning', label: 'Swiss Darning' },
  ],
};

export const TAXONOMY_GROUP_KEYS = ['types', 'categories', 'regional_techniques'];

const flattenCategoryOptions = () => VENDOR_TAXONOMY.categories.flatMap((group) => group.options);

const TAXONOMY_OPTIONS = {
  types: VENDOR_TAXONOMY.types,
  categories: flattenCategoryOptions(),
  regional_techniques: VENDOR_TAXONOMY.regional_techniques,
};

const LEGACY_ALIASES = {
  types: {
    shop: 'shop_workshop',
    workshop: 'shop_workshop',
    itinerant: 'mobile_itinerant',
    chain: 'chains_networks',
    dry_clean: 'dry_cleaners',
    'Dry Clean': 'dry_cleaners',
    'Dry-clean': 'dry_cleaners',
    'Dry clean': 'dry_cleaners',
  },
  categories: {
    'Alterations and Customising': 'alterations_customising',
    'Alterations & Customising': 'alterations_customising',
    'Bridal & Occasion Wear Alterations': 'bridal_occasion_wear_alterations',
    'Machine & Hand Mending basics': 'machine_hand_mending_basics',
    'Machine & Hand Mending Basics': 'machine_hand_mending_basics',
    'Re-dyeing & Surface Treatments': 're_dyeing_surface_treatments',
    'Redyeing & Surface Treatments': 're_dyeing_surface_treatments',
    'Seam Repairs / Stitching': 'seam_repairs_stitching',
    'Bags and Luggage': 'bags_luggage',
    'Bags & Luggage': 'bags_luggage',
    Shoes: 'shoes',
  },
  regional_techniques: {
    'Applique Repair': 'applique_repair',
    'Appliqu\u00e9 Repair': 'applique_repair',
    'Kintsugi-inspired Textile Repair': 'kintsugi_inspired_textile_repair',
    'Patchwork Mending': 'patchwork_mending',
    'Swiss Darning': 'swiss_darning',
  },
};

const normalizeAliasKey = (value) =>
  String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const buildAliasMap = (group) => {
  const map = new Map();
  const options = TAXONOMY_OPTIONS[group] || [];

  options.forEach((option) => {
    map.set(normalizeAliasKey(option.id), option.id);
    map.set(normalizeAliasKey(option.label), option.id);
  });

  Object.entries(LEGACY_ALIASES[group] || {}).forEach(([alias, id]) => {
    map.set(normalizeAliasKey(alias), id);
  });

  return map;
};

const TAXONOMY_ALIAS_MAPS = {
  types: buildAliasMap('types'),
  categories: buildAliasMap('categories'),
  regional_techniques: buildAliasMap('regional_techniques'),
};

const uniquePush = (items, value) => {
  if (!value || items.includes(value)) return;
  items.push(value);
};

export const getTaxonomyOptions = (group) => TAXONOMY_OPTIONS[group] || [];

export const getGroupedTaxonomyOptions = (group) => {
  if (group === 'categories') return VENDOR_TAXONOMY.categories;
  return [{ label: group, options: getTaxonomyOptions(group) }];
};

export const normalizeTaxonomyValue = (group, value) => {
  const normalizedKey = normalizeAliasKey(value);
  if (!normalizedKey) return null;
  return TAXONOMY_ALIAS_MAPS[group]?.get(normalizedKey) || null;
};

export const normalizeTaxonomyValues = (group, values, options = {}) => {
  const { allowUnknown = true } = options;
  const normalizedValues = [];
  const unknownValues = [];

  (Array.isArray(values) ? values : []).forEach((value) => {
    const trimmedValue = String(value || '').trim();
    if (!trimmedValue) return;

    const normalizedValue = normalizeTaxonomyValue(group, trimmedValue);
    if (normalizedValue) {
      uniquePush(normalizedValues, normalizedValue);
      return;
    }

    unknownValues.push(trimmedValue);
    if (allowUnknown) uniquePush(normalizedValues, trimmedValue);
  });

  if (!allowUnknown && unknownValues.length) {
    const error = new Error(`Unknown taxonomy value: ${unknownValues[0]}`);
    error.unknownValues = unknownValues;
    throw error;
  }

  return normalizedValues;
};

export const getTaxonomyLabel = (group, value) => {
  const trimmedValue = String(value || '').trim();
  if (!trimmedValue) return '';

  const normalizedValue = normalizeTaxonomyValue(group, trimmedValue) || trimmedValue;
  return getTaxonomyOptions(group).find((option) => option.id === normalizedValue)?.label || trimmedValue;
};

// Studio Type colors are application configuration rather than vendor data.
// The first type on a vendor determines its marker color.
export const STUDIO_TYPE_COLORS = Object.freeze({
  shop_workshop: '#7F00FF',
  home: '#4B0082',
  brand_in_store_services: '#2563EB',
  mobile_itinerant: '#16A34A',
  chains_networks: '#EAB308',
  dry_cleaners: '#F97316',
  shoe_leather_accessories: '#DC2626',
});

export const STUDIO_TYPE_FALLBACK_COLOR = '#64748B';

export const getStudioTypeColor = (value) => {
  const firstValue = Array.isArray(value) ? value[0] : value;
  const normalizedValue = normalizeTaxonomyValue('types', firstValue);
  return STUDIO_TYPE_COLORS[normalizedValue] || STUDIO_TYPE_FALLBACK_COLOR;
};

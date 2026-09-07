// Maps each product category to the specification fields worth showing on
// the product card and detail page, in display order. Falls back to a raw
// dump of `specifications` for any field not listed here, so nothing is
// ever silently hidden.
export const CATEGORY_LABELS = {
  cpu: 'CPU',
  gpu: 'GPU',
  motherboard: 'Motherboard',
  ram: 'RAM',
  storage: 'Storage',
  psu: 'PSU',
  case: 'Case',
  'cpu-cooler': 'CPU Cooler',
};

export const CATEGORY_SPEC_FIELDS = {
  cpu: [
    ['socket', 'Socket'],
    ['cores', 'Cores'],
    ['threads', 'Threads'],
    ['baseClock', 'Base clock'],
    ['boostClock', 'Boost clock'],
    ['tdp', 'TDP', 'W'],
    ['integratedGraphics', 'Integrated graphics'],
  ],
  gpu: [
    ['vram', 'VRAM'],
    ['memoryType', 'Memory type'],
    ['length', 'Length', 'mm'],
    ['tdp', 'TDP', 'W'],
    ['recommendedPSU', 'Recommended PSU', 'W'],
  ],
  motherboard: [
    ['socket', 'Socket'],
    ['chipset', 'Chipset'],
    ['formFactor', 'Form factor'],
    ['ramType', 'RAM type'],
    ['ramSlots', 'RAM slots'],
    ['maxRam', 'Max RAM', 'GB'],
    ['m2Slots', 'M.2 slots'],
    ['sataPorts', 'SATA ports'],
  ],
  ram: [
    ['capacity', 'Capacity'],
    ['type', 'Type'],
    ['speed', 'Speed'],
    ['modules', 'Modules'],
  ],
  storage: [
    ['type', 'Type'],
    ['capacity', 'Capacity'],
    ['interface', 'Interface'],
    ['readSpeed', 'Read speed'],
    ['writeSpeed', 'Write speed'],
  ],
  psu: [
    ['wattage', 'Wattage', 'W'],
    ['efficiency', 'Efficiency'],
    ['formFactor', 'Form factor'],
    ['modular', 'Modular'],
  ],
  case: [
    ['formFactor', 'Form factor'],
    ['supportedMotherboardSizes', 'Supports'],
    ['gpuMaxLength', 'Max GPU length', 'mm'],
    ['cpuCoolerMaxHeight', 'Max cooler height', 'mm'],
    ['psuFormFactor', 'PSU form factor'],
  ],
  'cpu-cooler': [
    ['coolerType', 'Type'],
    ['supportedSockets', 'Supported sockets'],
    ['height', 'Height', 'mm'],
    ['tdpRating', 'TDP rating', 'W'],
  ],
};

// Turns the backend's raw union of spec keys (GET /products/compare) into
// ordered { key, label, unit } rows for a comparison table — known fields
// first, in the same order/labels as CATEGORY_SPEC_FIELDS, then any leftover
// keys (fields not in that table yet) appended using the raw key as its own
// label, so nothing is ever silently hidden — same fallback philosophy as
// getSpecEntries above, just reused rather than reimplemented.
export function getComparisonRows(category, specKeys) {
  const known = CATEGORY_SPEC_FIELDS[category] || [];
  const knownKeys = new Set(known.map(([key]) => key));

  const rows = known
    .filter(([key]) => specKeys.includes(key))
    .map(([key, label, unit]) => ({ key, label, unit }));

  const extras = specKeys
    .filter((key) => !knownKeys.has(key))
    .map((key) => ({ key, label: key, unit: undefined }));

  return [...rows, ...extras];
}

// Formats a single product's value for one comparison row. Mirrors the
// array-join/unit-suffix rules in getSpecEntries; returns an em dash when
// this particular product doesn't have that field.
export function formatSpecValue(product, key, unit) {
  const value = product?.specifications?.[key];
  if (value === undefined || value === null || value === '') return '—';
  let display = Array.isArray(value) ? value.join(' / ') : value;
  if (unit && !String(display).includes(unit)) display = `${display}${unit}`;
  return display;
}

export function getSpecEntries(product, { limit } = {}) {
  if (!product) return [];
  const fields = CATEGORY_SPEC_FIELDS[product.category] || [];
  const specs = product.specifications || {};
  const entries = fields
    .filter(([key]) => specs[key] !== undefined && specs[key] !== null && specs[key] !== '')
    .map(([key, label, unit]) => {
      let value = specs[key];
      if (Array.isArray(value)) value = value.join(' / ');
      if (unit && typeof value !== 'string') value = `${value}${unit}`;
      else if (unit && !String(value).includes(unit)) value = `${value}${unit}`;
      return [label, value];
    });
  return limit ? entries.slice(0, limit) : entries;
}

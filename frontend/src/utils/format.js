import { imageUrl } from '../lib/siteFeatures.mjs';

const nprFormatter = new Intl.NumberFormat('en-NP', {
  maximumFractionDigits: 2,
});

export function formatNPR(amount) {
  return `NPR ${nprFormatter.format(amount || 0)}`;
}

export function resolveImageUrl(image) {
  return imageUrl(image, import.meta.env.VITE_API_URL || '/api', window.location.origin);
}

export function stockStatusLabel(status) {
  switch (status) {
    case 'out-of-stock':
      return 'Out of stock';
    case 'low-stock':
      return 'Low stock';
    default:
      return 'In stock';
  }
}

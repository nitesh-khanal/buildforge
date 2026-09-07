const nprFormatter = new Intl.NumberFormat('en-NP', {
  maximumFractionDigits: 0,
});

export function formatNPR(amount) {
  return `NPR ${nprFormatter.format(Math.round(amount || 0))}`;
}

export function resolveImageUrl(image) {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  const origin = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
  return `${origin}${image}`;
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

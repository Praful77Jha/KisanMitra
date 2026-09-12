export function formatCurrency(value) {
  const rounded = Math.round(value);
  return `₹${rounded.toLocaleString('en-IN')}`;
}

export function formatQuantity(quantity, unit) {
  return `${quantity} ${unit}`;
}

export function formatDistance(km) {
  if (km == null) return '';
  return `${km} km`;
}

export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateShort(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

export function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

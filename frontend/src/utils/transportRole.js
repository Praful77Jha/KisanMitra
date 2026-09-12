// Role-aware transport navigation/UI helpers. The backend remains authoritative
// for authorization; these helpers only decide what a role sees in the client.

import { ROLES, REQUESTER_ROLES } from '../constants/transport';

// Coerce a possibly-missing role to a known value. Unknown/missing roles behave
// as FARMER (the default role assigned at registration).
export function normalizeRole(role) {
  const normalized = String(role || '').toUpperCase();
  if (normalized === ROLES.FARMER || normalized === ROLES.BUYER || normalized === ROLES.TRANSPORTER) {
    return normalized;
  }
  return ROLES.FARMER;
}

export function isTransporter(role) {
  return normalizeRole(role) === ROLES.TRANSPORTER;
}

export function isRequesterRole(role) {
  return REQUESTER_ROLES.includes(normalizeRole(role));
}

// Home quick action config for the current role.
export function homeTransportAction(role) {
  if (isTransporter(role)) {
    return {
      action: 'available_transport_jobs',
      labelKey: 'quickActions.availableTransportJobs',
      icon: 'car',
      color: 'primary',
    };
  }
  return {
    action: 'arrange_transport',
    labelKey: 'quickActions.arrangeTransport',
    icon: 'car',
    color: 'primary',
  };
}

// Profile "Transport" section rows for the current role. Each row maps to a
// registered stack screen.
export function transportProfileActions(role) {
  if (isTransporter(role)) {
    return [
      { key: 'profile', labelKey: 'profile.transporterProfile', icon: 'car', screen: 'TransporterProfile' },
      { key: 'available', labelKey: 'profile.availableRequests', icon: 'list', screen: 'AvailableTransportRequests' },
      { key: 'active', labelKey: 'profile.activeJobs', icon: 'car-outline', screen: 'MyTransportJobs' },
      { key: 'completed', labelKey: 'profile.completedJobs', icon: 'checkmark-circle', screen: 'CompletedJobs' },
      { key: 'ratings', labelKey: 'profile.transportRatings', icon: 'star', screen: 'TransporterReviews' },
    ];
  }
  return [
    { key: 'requests', labelKey: 'profile.transportRequests', icon: 'car-outline', screen: 'MyTransportRequests' },
    { key: 'jobs', labelKey: 'profile.transportJobs', icon: 'clipboard', screen: 'MyTransportJobs' },
  ];
}
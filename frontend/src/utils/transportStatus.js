// Transport status helpers. The state machines mirror the backend so the client
// renders the same allowed transitions without duplicating business rules. The
// backend remains authoritative — this only drives the UI.

import { REQUEST_STATUS, JOB_STATUS } from '../constants/transport';

// Ordered transitions allowed from each job state (mirror of backend
// transportStates.js). DELIVERED and CANCELLED are terminal.
export const JOB_TRANSITIONS = {
  [JOB_STATUS.BOOKED]: [JOB_STATUS.DRIVER_ASSIGNED, JOB_STATUS.CANCELLED],
  [JOB_STATUS.DRIVER_ASSIGNED]: [JOB_STATUS.PICKUP_STARTED, JOB_STATUS.CANCELLED],
  [JOB_STATUS.PICKUP_STARTED]: [JOB_STATUS.PICKED_UP, JOB_STATUS.CANCELLED],
  [JOB_STATUS.PICKED_UP]: [JOB_STATUS.IN_TRANSIT, JOB_STATUS.CANCELLED],
  [JOB_STATUS.IN_TRANSIT]: [JOB_STATUS.DELIVERED, JOB_STATUS.CANCELLED],
  [JOB_STATUS.DELIVERED]: [],
  [JOB_STATUS.CANCELLED]: [],
};

// i18n keys for the fixed status values controlled by the backend. Free-text
// values (crop names, locations) are shown as stored — never translated.
export const REQUEST_STATUS_KEY = {
  [REQUEST_STATUS.OPEN]: 'transport.requestStatus.OPEN',
  [REQUEST_STATUS.IN_PROGRESS]: 'transport.requestStatus.IN_PROGRESS',
  [REQUEST_STATUS.COMPLETED]: 'transport.requestStatus.COMPLETED',
  [REQUEST_STATUS.CANCELLED]: 'transport.requestStatus.CANCELLED',
};

export const JOB_STATUS_KEY = {
  [JOB_STATUS.BOOKED]: 'transport.jobStatus.BOOKED',
  [JOB_STATUS.DRIVER_ASSIGNED]: 'transport.jobStatus.DRIVER_ASSIGNED',
  [JOB_STATUS.PICKUP_STARTED]: 'transport.jobStatus.PICKUP_STARTED',
  [JOB_STATUS.PICKED_UP]: 'transport.jobStatus.PICKED_UP',
  [JOB_STATUS.IN_TRANSIT]: 'transport.jobStatus.IN_TRANSIT',
  [JOB_STATUS.DELIVERED]: 'transport.jobStatus.DELIVERED',
  [JOB_STATUS.CANCELLED]: 'transport.jobStatus.CANCELLED',
};

export const QUOTE_STATUS_KEY = {
  SUBMITTED: 'transport.quoteStatus.SUBMITTED',
  SUPERSEDED: 'transport.quoteStatus.SUPERSEDED',
  ACCEPTED: 'transport.quoteStatus.ACCEPTED',
  REJECTED: 'transport.quoteStatus.REJECTED',
};

export const QUOTE_OFFER_TYPE_KEY = {
  INITIAL: 'transport.offerType.INITIAL',
  COUNTER: 'transport.offerType.COUNTER',
};

export function isValidJobTransition(fromStatus, toStatus) {
  const allowed = JOB_TRANSITIONS[fromStatus];
  return Array.isArray(allowed) && allowed.includes(toStatus);
}

// The statuses a transporter may advance (or cancel) to from the current one.
export function nextJobStatuses(status) {
  return JOB_TRANSITIONS[status] || [];
}

export function canUpdateJobStatus(status) {
  return nextJobStatuses(status).length > 0;
}

export function requestStatusLabel(status, t) {
  return t(REQUEST_STATUS_KEY[status] || String(status));
}

export function jobStatusLabel(status, t) {
  return t(JOB_STATUS_KEY[status] || String(status));
}

export function quoteStatusLabel(status, t) {
  return t(QUOTE_STATUS_KEY[status] || String(status));
}

export function offerTypeLabel(offerType, t) {
  return t(QUOTE_OFFER_TYPE_KEY[offerType] || 'transport.offerType.INITIAL');
}

// Badge tone per status (matches the Badge component's type prop).
export function requestStatusTone(status) {
  switch (status) {
    case REQUEST_STATUS.OPEN:
      return 'info';
    case REQUEST_STATUS.IN_PROGRESS:
      return 'warning';
    case REQUEST_STATUS.COMPLETED:
      return 'success';
    case REQUEST_STATUS.CANCELLED:
      return 'error';
    default:
      return 'info';
  }
}

export function jobStatusTone(status) {
  switch (status) {
    case JOB_STATUS.DELIVERED:
      return 'success';
    case JOB_STATUS.CANCELLED:
      return 'error';
    default:
      return 'info';
  }
}

export function quoteStatusTone(status) {
  switch (status) {
    case 'SUBMITTED':
      return 'warning';
    case 'ACCEPTED':
      return 'success';
    case 'REJECTED':
      return 'error';
    default:
      return 'info';
  }
}

const JOB_TIMELINE_STATUSES = [
  JOB_STATUS.BOOKED,
  JOB_STATUS.DRIVER_ASSIGNED,
  JOB_STATUS.PICKUP_STARTED,
  JOB_STATUS.PICKED_UP,
  JOB_STATUS.IN_TRANSIT,
  JOB_STATUS.DELIVERED,
];

// Ordered waypoints for the job progress bar, each marked done/current/pending.
// CANCELLED jobs have no progression.
export function jobTimeline(status) {
  if (status === JOB_STATUS.CANCELLED) return [];
  const currentIndex = JOB_TIMELINE_STATUSES.indexOf(status);
  return JOB_TIMELINE_STATUSES.map((jobStatus, index) => ({
    status: jobStatus,
    labelKey: JOB_STATUS_KEY[jobStatus],
    done: index < currentIndex,
    current: index === currentIndex,
  }));
}
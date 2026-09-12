// Transport module constants. Values mirror the backend transport module so the
// client renders the same vocabulary without duplicating business rules. The
// backend remains authoritative for authorization and state transitions.

export const ROLES = {
  FARMER: 'FARMER',
  BUYER: 'BUYER',
  TRANSPORTER: 'TRANSPORTER',
};

// FARMER and BUYER create transport requests; TRANSPORTER quotes and delivers.
export const REQUESTER_ROLES = [ROLES.FARMER, ROLES.BUYER];

export const ROLE_OPTIONS = [
  { key: ROLES.FARMER, label: 'Farmer' },
  { key: ROLES.BUYER, label: 'Buyer' },
  { key: ROLES.TRANSPORTER, label: 'Transporter' },
];

// Vehicle choices for requests, quotes, and transporter profiles. The selected
// label is stored verbatim on the backend, so keep the display labels aligned
// with what we send.
export const VEHICLE_TYPES = [
  'Tractor-Trolley',
  'Mini Truck',
  'Truck',
  'Tempo',
  'Container',
];

export const REQUEST_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export const JOB_STATUS = {
  BOOKED: 'BOOKED',
  DRIVER_ASSIGNED: 'DRIVER_ASSIGNED',
  PICKUP_STARTED: 'PICKUP_STARTED',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
};

export const QUOTE_STATUS = {
  SUBMITTED: 'SUBMITTED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  SUPERSEDED: 'SUPERSEDED',
};
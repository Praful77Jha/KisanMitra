// Transport module state machines. Shared by the DB service and the in-memory
// controllers so transition validation is defined exactly once.

// Job lifecycle:
//   BOOKED -> DRIVER_ASSIGNED -> PICKUP_STARTED -> PICKED_UP -> IN_TRANSIT -> DELIVERED
// CANCELLED is allowed from any non-terminal state (mirrors the order Logistics
// convention). DELIVERED and CANCELLED are terminal.
const JOB_TRANSITIONS = {
  BOOKED: ['DRIVER_ASSIGNED', 'CANCELLED'],
  DRIVER_ASSIGNED: ['PICKUP_STARTED', 'CANCELLED'],
  PICKUP_STARTED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

function isValidJobTransition(fromStatus, toStatus) {
  const allowed = JOB_TRANSITIONS[fromStatus];
  return Array.isArray(allowed) && allowed.includes(toStatus);
}

// Transport request lifecycle: OPEN -> IN_PROGRESS -> COMPLETED. A request is
// moved to IN_PROGRESS when a quote is accepted and COMPLETED when its job is
// delivered. CANCELLED exists in the schema for future explicit cancellation.
const REQUEST_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

// Quantity units accepted for a transport request payload, and the canonical
// vehicle types offered for transport. These mirror the frontend selectors.
const QUANTITY_UNITS = ['kg', 'quintal', 'tonne', 'sack'];
const VEHICLE_TYPES = ['Tractor-Trolley', 'Mini Truck', 'Truck', 'Tempo', 'Container'];

// Case-insensitive normalization so 'KG', 'Tonne', 'QUINTAL' all resolve to the
// canonical lowercase unit a request is stored with.
function normalizeUnit(unit) {
  if (typeof unit !== 'string') return null;
  const lower = unit.trim().toLowerCase();
  return QUANTITY_UNITS.includes(lower) ? lower : null;
}

module.exports = {
  JOB_TRANSITIONS,
  isValidJobTransition,
  REQUEST_STATUS,
  QUANTITY_UNITS,
  VEHICLE_TYPES,
  normalizeUnit,
};
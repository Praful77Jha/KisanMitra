const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// transportStatus.js references REQUEST_STATUS/JOB_STATUS from constants. The
// import is stripped and the constants provided as globals before the module is
// evaluated in a plain function scope.
global.JOB_STATUS = {
  BOOKED: 'BOOKED',
  DRIVER_ASSIGNED: 'DRIVER_ASSIGNED',
  PICKUP_STARTED: 'PICKUP_STARTED',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
};
global.REQUEST_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

function loadModule() {
  const filePath = path.join(__dirname, '..', 'src', 'utils', 'transportStatus.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const stripped = source
    .replace(/^import\s+[^\n]+\n?/m, '')
    .replace(/^export\s+/gm, '')
    .trim();
  const wrapped = `${stripped}\n\nreturn { JOB_TRANSITIONS, REQUEST_STATUS_KEY, JOB_STATUS_KEY, QUOTE_STATUS_KEY, QUOTE_OFFER_TYPE_KEY, isValidJobTransition, nextJobStatuses, canUpdateJobStatus, requestStatusLabel, jobStatusLabel, quoteStatusLabel, offerTypeLabel, requestStatusTone, jobStatusTone, quoteStatusTone, jobTimeline };`;
  // eslint-disable-next-line no-new-func
  return new Function(wrapped)();
}

const {
  JOB_TRANSITIONS,
  REQUEST_STATUS_KEY,
  JOB_STATUS_KEY,
  QUOTE_STATUS_KEY,
  QUOTE_OFFER_TYPE_KEY,
  isValidJobTransition,
  nextJobStatuses,
  canUpdateJobStatus,
  requestStatusLabel,
  jobStatusLabel,
  quoteStatusLabel,
  offerTypeLabel,
  requestStatusTone,
  jobStatusTone,
  quoteStatusTone,
  jobTimeline,
} = loadModule();

test('job transitions mirror the backend state machine', () => {
  assert.deepEqual(JOB_TRANSITIONS.BOOKED, ['DRIVER_ASSIGNED', 'CANCELLED']);
  assert.deepEqual(JOB_TRANSITIONS.DRIVER_ASSIGNED, ['PICKUP_STARTED', 'CANCELLED']);
  assert.deepEqual(JOB_TRANSITIONS.PICKUP_STARTED, ['PICKED_UP', 'CANCELLED']);
  assert.deepEqual(JOB_TRANSITIONS.PICKED_UP, ['IN_TRANSIT', 'CANCELLED']);
  assert.deepEqual(JOB_TRANSITIONS.IN_TRANSIT, ['DELIVERED', 'CANCELLED']);
  assert.deepEqual(JOB_TRANSITIONS.DELIVERED, []);
  assert.deepEqual(JOB_TRANSITIONS.CANCELLED, []);
});

test('isValidJobTransition accepts only allowed moves', () => {
  assert.equal(isValidJobTransition('BOOKED', 'DRIVER_ASSIGNED'), true);
  assert.equal(isValidJobTransition('IN_TRANSIT', 'DELIVERED'), true);
  assert.equal(isValidJobTransition('BOOKED', 'DELIVERED'), false); // no skipping
  assert.equal(isValidJobTransition('DELIVERED', 'BOOKED'), false); // terminal
  assert.equal(isValidJobTransition('SOMETHING', 'BOOKED'), false); // unknown
});

test('nextJobStatuses and canUpdateJobStatus reflect terminal states', () => {
  assert.deepEqual(nextJobStatuses('IN_TRANSIT'), ['DELIVERED', 'CANCELLED']);
  assert.equal(canUpdateJobStatus('IN_TRANSIT'), true);
  assert.equal(canUpdateJobStatus('DELIVERED'), false);
  assert.equal(canUpdateJobStatus('CANCELLED'), false);
});

test('status label helpers map to i18n keys and fall back to raw value', () => {
  const identity = (key) => key;
  assert.equal(jobStatusLabel('BOOKED', identity), 'transport.jobStatus.BOOKED');
  assert.equal(jobStatusLabel('MYSTERY', identity), 'MYSTERY');
  assert.equal(requestStatusLabel('OPEN', identity), 'transport.requestStatus.OPEN');
  assert.equal(requestStatusLabel('MYSTERY', identity), 'MYSTERY');
  assert.equal(quoteStatusLabel('ACCEPTED', identity), 'transport.quoteStatus.ACCEPTED');
  assert.equal(quoteStatusLabel('SUPERSEDED', identity), 'transport.quoteStatus.SUPERSEDED');
  assert.equal(offerTypeLabel('COUNTER', identity), 'transport.offerType.COUNTER');
  assert.equal(offerTypeLabel('MONKEY', identity), 'transport.offerType.INITIAL');
});

test('status key maps are aligned to constants', () => {
  assert.equal(JOB_STATUS_KEY.BOOKED, 'transport.jobStatus.BOOKED');
  assert.equal(JOB_STATUS_KEY.IN_TRANSIT, 'transport.jobStatus.IN_TRANSIT');
  assert.equal(JOB_STATUS_KEY.CANCELLED, 'transport.jobStatus.CANCELLED');
  assert.equal(REQUEST_STATUS_KEY.OPEN, 'transport.requestStatus.OPEN');
  assert.equal(QUOTE_STATUS_KEY.SUBMITTED, 'transport.quoteStatus.SUBMITTED');
  assert.equal(QUOTE_STATUS_KEY.SUPERSEDED, 'transport.quoteStatus.SUPERSEDED');
  assert.equal(QUOTE_STATUS_KEY.REJECTED, 'transport.quoteStatus.REJECTED');
  assert.equal(QUOTE_OFFER_TYPE_KEY.INITIAL, 'transport.offerType.INITIAL');
  assert.equal(QUOTE_OFFER_TYPE_KEY.COUNTER, 'transport.offerType.COUNTER');
});

test('jobTimeline builds ordered waypoints with done/current/pending', () => {
  const booked = jobTimeline('BOOKED');
  assert.equal(booked.length, 6);
  assert.deepEqual(booked.map((w) => w.status), [
    'BOOKED',
    'DRIVER_ASSIGNED',
    'PICKUP_STARTED',
    'PICKED_UP',
    'IN_TRANSIT',
    'DELIVERED',
  ]);
  assert.equal(booked[0].current, true);
  assert.equal(booked[1].done, false);
  assert.equal(booked[1].current, false);

  const delivered = jobTimeline('DELIVERED');
  assert.equal(delivered.filter((w) => w.done).length, 5);
  assert.equal(delivered[5].done, false);
  assert.equal(delivered[5].current, true);

  assert.deepEqual(jobTimeline('CANCELLED'), []);
});

test('badge tones', () => {
  assert.equal(requestStatusTone('OPEN'), 'info');
  assert.equal(requestStatusTone('IN_PROGRESS'), 'warning');
  assert.equal(requestStatusTone('COMPLETED'), 'success');
  assert.equal(requestStatusTone('CANCELLED'), 'error');
  assert.equal(jobStatusTone('DELIVERED'), 'success');
  assert.equal(jobStatusTone('CANCELLED'), 'error');
  assert.equal(jobStatusTone('BOOKED'), 'info');
  assert.equal(quoteStatusTone('SUBMITTED'), 'warning');
  assert.equal(quoteStatusTone('ACCEPTED'), 'success');
  assert.equal(quoteStatusTone('REJECTED'), 'error');
  assert.equal(quoteStatusTone('SUPERSEDED'), 'info');
  assert.equal(quoteStatusTone('MYSTERY'), 'info');
});
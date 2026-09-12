const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// transportRole.js references ROLES/REQUESTER_ROLES from constants. The import is
// stripped and the constants provided as globals before the module is evaluated.
global.ROLES = { FARMER: 'FARMER', BUYER: 'BUYER', TRANSPORTER: 'TRANSPORTER' };
global.REQUESTER_ROLES = ['FARMER', 'BUYER'];

function loadModule() {
  const filePath = path.join(__dirname, '..', 'src', 'utils', 'transportRole.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const stripped = source
    .replace(/^import\s+[^\n]+\n?/m, '')
    .replace(/^export\s+/gm, '')
    .trim();
  const wrapped = `${stripped}\n\nreturn { normalizeRole, isTransporter, isRequesterRole, homeTransportAction, transportProfileActions };`;
  // eslint-disable-next-line no-new-func
  return new Function(wrapped)();
}

const {
  normalizeRole,
  isTransporter,
  isRequesterRole,
  homeTransportAction,
  transportProfileActions,
} = loadModule();

test('normalizeRole coerces unknown/missing roles to FARMER', () => {
  assert.equal(normalizeRole(undefined), 'FARMER');
  assert.equal(normalizeRole(null), 'FARMER');
  assert.equal(normalizeRole(''), 'FARMER');
  assert.equal(normalizeRole('fraud'), 'FARMER');
  assert.equal(normalizeRole('farmer'), 'FARMER'); // case-insensitive
  assert.equal(normalizeRole('BUYER'), 'BUYER');
  assert.equal(normalizeRole('transporter'), 'TRANSPORTER');
});

test('isTransporter matches only the transporter role', () => {
  assert.equal(isTransporter('TRANSPORTER'), true);
  assert.equal(isTransporter('transporter'), true);
  assert.equal(isTransporter('FARMER'), false);
  assert.equal(isTransporter('BUYER'), false);
  assert.equal(isTransporter(undefined), false);
});

test('isRequesterRole covers farmer and buyer', () => {
  assert.equal(isRequesterRole('FARMER'), true);
  assert.equal(isRequesterRole('BUYER'), true);
  assert.equal(isRequesterRole('TRANSPORTER'), false);
  assert.equal(isRequesterRole(undefined), true); // defaults to FARMER
});

test('homeTransportAction is role-aware', () => {
  assert.equal(homeTransportAction('TRANSPORTER').action, 'available_transport_jobs');
  assert.equal(homeTransportAction('TRANSPORTER').labelKey, 'quickActions.availableTransportJobs');
  assert.equal(homeTransportAction('FARMER').action, 'arrange_transport');
  assert.equal(homeTransportAction('BUYER').labelKey, 'quickActions.arrangeTransport');
});

test('transportProfileActions returns transporter rows for transporter', () => {
  const actions = transportProfileActions('TRANSPORTER');
  assert.equal(actions.length, 5);
  const screens = actions.map((a) => a.screen);
  assert.ok(screens.includes('TransporterProfile'));
  assert.ok(screens.includes('AvailableTransportRequests'));
  assert.ok(screens.includes('MyTransportJobs'));
  assert.ok(screens.includes('CompletedJobs'));
  assert.ok(screens.includes('TransporterReviews'));
});

test('transportProfileActions returns requester rows for farmer/buyer', () => {
  for (const role of ['FARMER', 'BUYER']) {
    const actions = transportProfileActions(role);
    assert.equal(actions.length, 2);
    assert.deepEqual(
      actions.map((a) => a.screen),
      ['MyTransportRequests', 'MyTransportJobs']
    );
  }
});
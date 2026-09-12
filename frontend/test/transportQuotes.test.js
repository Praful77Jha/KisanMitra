const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Pure ES module loaded through node:vm (CommonJS project).
function loadModule() {
  const filePath = path.join(__dirname, '..', 'src', 'utils', 'transportQuotes.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const stripped = source
    .replace(/^export\s+default\s+/gm, '')
    .replace(/^export\s+/gm, '')
    .trim();
  const wrapped = `${stripped}\n\nreturn { rankTransportQuotes };`;
  // eslint-disable-next-line no-new-func
  return new Function(wrapped)();
}

const { rankTransportQuotes } = loadModule();

test('sorts submitted offers by amount ascending', () => {
  const result = rankTransportQuotes([
    { id: 'q2', status: 'SUBMITTED', quotedAmount: '6000' },
    { id: 'q1', status: 'SUBMITTED', quotedAmount: '5200' },
    { id: 'q0', status: 'SUBMITTED', quotedAmount: '7000' },
  ]);
  assert.deepEqual(result.map((q) => q.id), ['q1', 'q2', 'q0']);
});

test('marks only the lowest submitted offer as best', () => {
  const result = rankTransportQuotes([
    { id: 'low', status: 'SUBMITTED', quotedAmount: '5000' },
    { id: 'high', status: 'SUBMITTED', quotedAmount: '5500' },
    { id: 'acc', status: 'ACCEPTED', quotedAmount: '4800' },
  ]);
  assert.equal(result.find((q) => q.id === 'low').isBest, true);
  assert.equal(result.find((q) => q.id === 'high').isBest, false);
  assert.equal(result.find((q) => q.id === 'acc').isBest, false);
});

test('sorts non-submitted offers (accepted/rejected) after submitted ones', () => {
  const result = rankTransportQuotes([
    { id: 'acc', status: 'ACCEPTED', quotedAmount: '1000' },
    { id: 'open2', status: 'SUBMITTED', quotedAmount: '9000' },
    { id: 'rej', status: 'REJECTED', quotedAmount: '2000' },
  ]);
  assert.deepEqual(result.map((q) => q.id), ['open2', 'acc', 'rej']);
});

test('tie on lowest amount marks both as best', () => {
  const result = rankTransportQuotes([
    { id: 'a', status: 'SUBMITTED', quotedAmount: '5000' },
    { id: 'b', status: 'SUBMITTED', quotedAmount: '5000' },
    { id: 'c', status: 'SUBMITTED', quotedAmount: '6000' },
  ]);
  assert.equal(result.find((q) => q.id === 'a').isBest, true);
  assert.equal(result.find((q) => q.id === 'b').isBest, true);
  assert.equal(result.find((q) => q.id === 'c').isBest, false);
});

test('handles empty and malformed input without throwing', () => {
  assert.deepEqual(rankTransportQuotes([]), []);
  assert.deepEqual(rankTransportQuotes(undefined), []);
  assert.deepEqual(rankTransportQuotes(null), []);
});
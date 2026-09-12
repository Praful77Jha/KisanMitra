const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// The four language files must define the exact same key structure so the
// client never falls back to a missing translation in one language.
const LANG_FILES = ['en.js', 'hi.js', 'mr.js', 'lmn.js'];

function loadLanguage(fileName) {
  const filePath = path.join(__dirname, '..', 'src', 'i18n', fileName);
  const src = fs.readFileSync(filePath, 'utf8');
  // eslint-disable-next-line no-new-func
  return new Function('return ' + src.replace(/^export default /, ''))();
}

function collectKeys(obj, prefix = '') {
  const out = [];
  for (const key of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...collectKeys(value, full));
    } else {
      out.push(full);
    }
  }
  return out;
}

test('all four languages define the exact same keys', () => {
  const keySets = LANG_FILES.map((file) => new Set(collectKeys(loadLanguage(file))));
  const [en, hi, mr, lmn] = keySets;
  assert.equal(en.size, hi.size);
  assert.equal(en.size, mr.size);
  assert.equal(en.size, lmn.size);
  for (const key of en) {
    assert.ok(hi.has(key), `hi.js missing ${key}`);
    assert.ok(mr.has(key), `mr.js missing ${key}`);
    assert.ok(lmn.has(key), `lmn.js missing ${key}`);
  }
  for (const key of [...hi, ...mr, ...lmn]) {
    assert.ok(en.has(key), `en.js missing ${key}`);
  }
});

test('transport module keys exist in every language', () => {
  for (const file of LANG_FILES) {
    const translations = loadLanguage(file);
    assert.equal(typeof translations.transport?.jobStatus?.BOOKED, 'string', `${file} jobStatus.BOOKED`);
    assert.equal(typeof translations.transport?.jobStatus?.IN_TRANSIT, 'string', `${file} jobStatus.IN_TRANSIT`);
    assert.equal(typeof translations.transport?.requestStatus?.OPEN, 'string', `${file} requestStatus.OPEN`);
    assert.equal(typeof translations.transport?.quoteStatus?.ACCEPTED, 'string', `${file} quoteStatus.ACCEPTED`);
    assert.equal(typeof translations.transport?.quoteStatus?.SUPERSEDED, 'string', `${file} quoteStatus.SUPERSEDED`);
    assert.equal(typeof translations.transport?.offerType?.INITIAL, 'string', `${file} offerType.INITIAL`);
    assert.equal(typeof translations.transport?.offerType?.COUNTER, 'string', `${file} offerType.COUNTER`);
    assert.equal(typeof translations.transport?.counterOffer, 'string', `${file} counterOffer`);
    assert.equal(typeof translations.transport?.negotiationHistory, 'string', `${file} negotiationHistory`);
    assert.equal(typeof translations.transport?.latestStatus, 'string', `${file} latestStatus`);
    assert.equal(typeof translations.roles?.transporter, 'string', `${file} roles.transporter`);
    assert.equal(typeof translations.quickActions?.arrangeTransport, 'string', `${file} quickActions.arrangeTransport`);
    assert.equal(typeof translations.validation?.cropRequired, 'string', `${file} validation.cropRequired`);
    assert.equal(typeof translations.validation?.profileVehiclesRequired, 'string', `${file} validation.profileVehiclesRequired`);
    assert.equal(typeof translations.validation?.vehicleIncompatible, 'string', `${file} validation.vehicleIncompatible`);
  }
});

test('all transport job status values are translated in en.js', () => {
  const en = loadLanguage('en.js');
  const statusKeys = collectKeys(en).filter((key) => key.startsWith('transport.jobStatus.'));
  assert.equal(statusKeys.length, 7);
});
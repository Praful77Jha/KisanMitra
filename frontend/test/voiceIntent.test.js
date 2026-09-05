const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// voiceIntent.js is a pure ES module (export syntax) while this project is
// CommonJS. Load it through node:vm so tests run with plain `node --test`
// and no Babel / new testing framework.
function loadVoiceIntent() {
  const filePath = path.join(__dirname, '..', 'src', 'utils', 'voiceIntent.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const stripped = source
    .replace(/^export\s+default\s+/gm, '')
    .replace(/^export\s+/gm, '')
    .trim();
  const wrapped = `${stripped}\n\nreturn { normalizeText, extractCrop, extractQuantity, detectIntent, parseCommand, INTENTS, CROP_ALIASES, NUMBER_WORDS };`;
  // eslint-disable-next-line no-new-func
  const mod = new Function(wrapped)();
  return mod;
}

const {
  normalizeText,
  extractCrop,
  extractQuantity,
  detectIntent,
  parseCommand,
  INTENTS,
  CROP_ALIASES,
} = loadVoiceIntent();

test('INTENTS exposes all canonical intents', () => {
  assert.equal(INTENTS.MARKET_PRICE, 'MARKET_PRICE');
  assert.equal(INTENTS.SMART_SELLING, 'SMART_SELLING');
  assert.equal(INTENTS.SELL_CROP, 'SELL_CROP');
  assert.equal(INTENTS.MARKETPLACE, 'MARKETPLACE');
  assert.equal(INTENTS.ORDERS, 'ORDERS');
  assert.equal(INTENTS.PROFILE, 'PROFILE');
  assert.equal(INTENTS.UNKNOWN, 'UNKNOWN');
});

test('CROP_ALIASES covers all 5 canonical crops', () => {
  assert.deepEqual(Object.keys(CROP_ALIASES).sort(), ['Maize', 'Onion', 'Soybean', 'Tur', 'Wheat']);
});

test('normalizeText lowercases, strips punctuation, collapses spaces', () => {
  assert.equal(normalizeText('  Market Price Of Onion!! '), 'market price of onion');
  assert.equal(normalizeText('प्याज़ का भाव बताओ।'), 'प्याज़ का भाव बताओ');
  assert.equal(normalizeText(''), '');
});

// ---------------------------------------------------------------------------
// English
// ---------------------------------------------------------------------------

test('EN: market price of onion -> MARKET_PRICE, crop Onion', () => {
  const r = parseCommand('market price of onion');
  assert.equal(r.intent, INTENTS.MARKET_PRICE);
  assert.equal(r.crop, 'Onion');
  assert.equal(r.quantity, null);
});

test('EN: sell 50 quintal onion -> SMART_SELLING, qty 50', () => {
  const r = parseCommand('I want to sell 50 quintal onion');
  assert.equal(r.intent, INTENTS.SMART_SELLING);
  assert.equal(r.crop, 'Onion');
  assert.equal(r.quantity, 50);
});

test('EN: open marketplace -> MARKETPLACE', () => {
  const r = parseCommand('open marketplace');
  assert.equal(r.intent, INTENTS.MARKETPLACE);
  assert.equal(r.crop, null);
  assert.equal(r.quantity, null);
});

test('EN: show my orders -> ORDERS', () => {
  const r = parseCommand('show my orders');
  assert.equal(r.intent, INTENTS.ORDERS);
});

test('EN: open my profile -> PROFILE', () => {
  const r = parseCommand('open my profile');
  assert.equal(r.intent, INTENTS.PROFILE);
});

test('EN: explicit post/list my crop -> SELL_CROP', () => {
  assert.equal(parseCommand('post my onion crop').intent, INTENTS.SELL_CROP);
  assert.equal(parseCommand('list my wheat crop').intent, INTENTS.SELL_CROP);
});

// ---------------------------------------------------------------------------
// Hindi
// ---------------------------------------------------------------------------

test('HI: प्याज़ का भाव बताओ -> MARKET_PRICE, crop Onion', () => {
  const r = parseCommand('प्याज़ का भाव बताओ');
  assert.equal(r.intent, INTENTS.MARKET_PRICE);
  assert.equal(r.crop, 'Onion');
  assert.equal(r.quantity, null);
});

test('HI: मुझे 50 क्विंटल प्याज़ बेचना है -> SMART_SELLING, qty 50 (bare sell)', () => {
  const r = parseCommand('मुझे 50 क्विंटल प्याज़ बेचना है');
  assert.equal(r.intent, INTENTS.SMART_SELLING);
  assert.equal(r.crop, 'Onion');
  assert.equal(r.quantity, 50);
});

test('HI: बाज़ार खोलो -> MARKETPLACE', () => {
  assert.equal(parseCommand('बाज़ार खोलो').intent, INTENTS.MARKETPLACE);
});

test('HI: मेरे ऑर्डर दिखाओ -> ORDERS', () => {
  assert.equal(parseCommand('मेरे ऑर्डर दिखाओ').intent, INTENTS.ORDERS);
});

test('HI: मेरी प्रोफाइल खोलो -> PROFILE', () => {
  assert.equal(parseCommand('मेरी प्रोफाइल खोलो').intent, INTENTS.PROFILE);
});

test('HI: explicit पोस्ट/डालो -> SELL_CROP', () => {
  assert.equal(parseCommand('मेरी प्याज़ की फ़सल पोस्ट करो').intent, INTENTS.SELL_CROP);
});

// ---------------------------------------------------------------------------
// Marathi
// ---------------------------------------------------------------------------

test('MR: कांद्याचा भाव सांगा -> MARKET_PRICE, crop Onion', () => {
  const r = parseCommand('कांद्याचा भाव सांगा');
  assert.equal(r.intent, INTENTS.MARKET_PRICE);
  assert.equal(r.crop, 'Onion');
});

test('MR: मला 50 क्विंटल कांदा विकायचा आहे -> SMART_SELLING, qty 50, crop Onion', () => {
  const r = parseCommand('मला 50 क्विंटल कांदा विकायचा आहे');
  assert.equal(r.intent, INTENTS.SMART_SELLING);
  assert.equal(r.crop, 'Onion');
  assert.equal(r.quantity, 50);
});

test('MR: बाजार उघडा -> MARKETPLACE', () => {
  assert.equal(parseCommand('बाजार उघडा').intent, INTENTS.MARKETPLACE);
});

test('MR: माझे ऑर्डर दाखवा -> ORDERS', () => {
  assert.equal(parseCommand('माझे ऑर्डर दाखवा').intent, INTENTS.ORDERS);
});

test('MR: माझी प्रोफाइल उघडा -> PROFILE', () => {
  assert.equal(parseCommand('माझी प्रोफाइल उघडा').intent, INTENTS.PROFILE);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test('unknown command -> UNKNOWN', () => {
  assert.equal(parseCommand('नमस्ते').intent, INTENTS.UNKNOWN);
  assert.equal(parseCommand('hello there friend').intent, INTENTS.UNKNOWN);
});

test('missing crop for market price -> MARKET_PRICE with crop null', () => {
  const r = parseCommand('what is the market price');
  assert.equal(r.intent, INTENTS.MARKET_PRICE);
  assert.equal(r.crop, null);
});

test('missing quantity -> null, never invented', () => {
  assert.equal(parseCommand('मुझे प्याज़ बेचना है').quantity, null);
  assert.equal(parseCommand('I want to sell onion').quantity, null);
});

test('number words work in Hindi and Marathi', () => {
  assert.equal(extractQuantity('मुझे पचास क्विंटल गेहूं बेचना है'), 50);
  assert.equal(extractQuantity('मला पन्नास क्विंटल गहू विकायचा आहे'), 50);
  assert.equal(extractQuantity('मुझे सौ क्विंटल मक्का बेचना है'), 100);
  assert.equal(extractQuantity('मला शंभर क्विंटल तूर विकायचा आहे'), 100);
});

test('quantity out of supported range -> null', () => {
  assert.equal(extractQuantity('I want to sell 500 quintal onion'), null);
  assert.equal(extractQuantity('price 250 qtl'), null);
});

test('units are ignored but quantity extracted', () => {
  assert.equal(extractQuantity('sell 75 kg wheat'), 75);
  assert.equal(extractQuantity('बीस किलो प्याज़ बेचना है'), 20);
});

test('crop extraction with Marathi inflected forms', () => {
  assert.equal(extractCrop('गव्हाचा भाव सांगा'), 'Wheat');
  assert.equal(extractCrop('मक्याचा भाव सांगा'), 'Maize');
  assert.equal(extractCrop('सोयाबीनचा भाव सांगा'), 'Soybean');
});

test('canonical aliases resolve to canonical crops', () => {
  assert.equal(extractCrop('tur/arhar/toor'), 'Tur');
  assert.equal(extractCrop('corn price'), 'Maize');
  assert.equal(extractCrop('soyabean'), 'Soybean');
});

// ---------------------------------------------------------------------------
// Full command matrix (English / Hindi / Marathi)
// ---------------------------------------------------------------------------

test('matrix EN: 8 commands -> expected intents', () => {
  assert.equal(parseCommand('market price of onion').intent, INTENTS.MARKET_PRICE);
  assert.equal(parseCommand('what is the price of onion').intent, INTENTS.MARKET_PRICE);
  assert.equal(parseCommand('I want to sell 50 quintal onion').intent, INTENTS.SMART_SELLING);
  assert.equal(parseCommand('find the best market for 50 quintal onion').intent, INTENTS.SMART_SELLING);
  assert.equal(parseCommand('open marketplace').intent, INTENTS.MARKETPLACE);
  assert.equal(parseCommand('show my orders').intent, INTENTS.ORDERS);
  assert.equal(parseCommand('open my profile').intent, INTENTS.PROFILE);
  assert.equal(parseCommand('sell my crop').intent, INTENTS.SMART_SELLING);
});

test('matrix HI: 8 commands -> expected intents', () => {
  assert.equal(parseCommand('प्याज़ का भाव बताओ').intent, INTENTS.MARKET_PRICE);
  assert.equal(parseCommand('प्याज़ का आज का भाव क्या है').intent, INTENTS.MARKET_PRICE);
  assert.equal(parseCommand('मुझे 50 क्विंटल प्याज़ बेचना है').intent, INTENTS.SMART_SELLING);
  assert.equal(parseCommand('प्याज़ के लिए सबसे अच्छा बाजार ढूंढो').intent, INTENTS.SMART_SELLING);
  assert.equal(parseCommand('बाज़ार खोलो').intent, INTENTS.MARKETPLACE);
  assert.equal(parseCommand('मेरे ऑर्डर दिखाओ').intent, INTENTS.ORDERS);
  assert.equal(parseCommand('मेरी प्रोफाइल खोलो').intent, INTENTS.PROFILE);
  assert.equal(parseCommand('फसल बेचनी है').intent, INTENTS.SMART_SELLING);
});

test('matrix MR: 8 commands -> expected intents', () => {
  assert.equal(parseCommand('कांद्याचा भाव सांगा').intent, INTENTS.MARKET_PRICE);
  assert.equal(parseCommand('कांद्याचा आजचा भाव काय आहे').intent, INTENTS.MARKET_PRICE);
  assert.equal(parseCommand('मला 50 क्विंटल कांदा विकायचा आहे').intent, INTENTS.SMART_SELLING);
  assert.equal(parseCommand('कांद्यासाठी सर्वोत्तम बाजार शोधा').intent, INTENTS.SMART_SELLING);
  assert.equal(parseCommand('बाजार उघडा').intent, INTENTS.MARKETPLACE);
  assert.equal(parseCommand('माझे ऑर्डर दाखवा').intent, INTENTS.ORDERS);
  assert.equal(parseCommand('माझी प्रोफाइल उघडा').intent, INTENTS.PROFILE);
  assert.equal(parseCommand('मला पीक विकायचे आहे').intent, INTENTS.SMART_SELLING);
});

test('matrix MR: Marathi sell with neuter/feminine inflections', () => {
  assert.equal(parseCommand('मला पीक विकायचे आहे').intent, INTENTS.SMART_SELLING);
  assert.equal(parseCommand('एक भाजी विकायची आहे').intent, INTENTS.SMART_SELLING);
});

// ---------------------------------------------------------------------------
// Edge hardening
// ---------------------------------------------------------------------------

test('empty and punctuation-only speech -> UNKNOWN, nothing invented', () => {
  for (const raw of ['', '   ', '।', '...']) {
    const r = parseCommand(raw);
    assert.equal(r.intent, INTENTS.UNKNOWN);
    assert.equal(r.crop, null);
    assert.equal(r.quantity, null);
  }
});

test('unrelated sentences -> UNKNOWN', () => {
  assert.equal(parseCommand('नमस्ते').intent, INTENTS.UNKNOWN);
  assert.equal(parseCommand('good morning farmer').intent, INTENTS.UNKNOWN);
  assert.equal(parseCommand('आज मौसम अच्छा है').intent, INTENTS.UNKNOWN);
});

test('composite number phrases are ambiguous -> null, never invented', () => {
  assert.equal(extractQuantity('मुझे दो सौ क्विंटल प्याज़ बेचना है'), null);
  assert.equal(extractQuantity('मला दोनशे क्विंटल कांदा विकायचा आहे'), null);
  assert.equal(extractQuantity('I have ten twenty quintals'), null);
});

test('number-word matching is whole-word (no substring collisions)', () => {
  assert.equal(extractQuantity('सव्वीस क्विंटल कांदा'), 26);
  assert.equal(extractQuantity('बावीस क्विंटल गहू'), 22);
  assert.equal(extractQuantity('मला दहा किलो कांदा हवा आहे'), 10);
});

test('parseCommand returns stable shape', () => {
  const r = parseCommand('market price of onion');
  assert.deepEqual(Object.keys(r).sort(), ['crop', 'intent', 'quantity', 'rawText']);
});
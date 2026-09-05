// Voice assistant intent parser.
// Pure, import-free ES module: it reads ext-agnostic text (EN/HI/MR) produced by
// speech recognition and maps it to a canonical { intent, crop, quantity } result.
// No side effects, no external dependencies - loadable in any JS runtime.

export const CROP_KEYS = Object.freeze(['Onion', 'Soybean', 'Tur', 'Wheat', 'Maize']);

export const CROP_ALIASES = Object.freeze({
  Onion: [
    'onion',
    'प्याज़',
    'प्याज',
    'कांदा',
    'कांदे',
    'कांद्याचा',
    'कांद्याची',
  ],
  Soybean: ['soybean', 'soyabean', 'सोयाबीन', 'सोयाबीनचा'],
  Tur: ['tur', 'toor', 'arhar', 'तूर', 'तुअर', 'अरहर', 'तुराचा'],
  Wheat: ['wheat', 'गेहूँ', 'गेहूं', 'गहू', 'गव्हाचा'],
  Maize: ['maize', 'corn', 'मक्का', 'मका', 'मक्याचा'],
});

export const INTENTS = Object.freeze({
  MARKET_PRICE: 'MARKET_PRICE',
  SELL_CROP: 'SELL_CROP',
  SMART_SELLING: 'SMART_SELLING',
  MARKETPLACE: 'MARKETPLACE',
  ORDERS: 'ORDERS',
  PROFILE: 'PROFILE',
  UNKNOWN: 'UNKNOWN',
});

const PRICE_KEYWORDS = Object.freeze([
  'price',
  'rate',
  'bhav',
  'cost per',
  'भाव',
  'दर',
  'रेट',
  'कीमत',
  'किंमत',
  'दाम',
]);

// Explicit "post / list my crop" language -> the "list to sell" flow (SELL_CROP).
const SELL_LISTING_KEYWORDS = Object.freeze([
  'post',
  'list',
  'listing',
  'पोस्ट',
  'लिस्ट',
  'लिस्टिंग',
  'डालो',
  'टाका',
]);

// Selling / best-option language -> SMART_SELLING recommendation flow.
const SELLING_KEYWORDS = Object.freeze([
  'sell',
  'selling',
  'best market',
  'best price',
  'best option',
  'where to sell',
  'बेचना',
  'बेच',
  'विक्री',
  'विकायचा',
  'विकायचे',
  'विकायची',
  'विकू',
  'कहां बेचूं',
  'सबसे अच्छा',
  'अच्छा दाम',
  'अच्छा भाव',
  'सर्वोत्तम',
  'सर्वोत्कृष्ट',
  'उत्तम किंमत',
  'उत्तम बाजार',
  'सगळ्यात चांगला',
]);

const MARKETPLACE_KEYWORDS = Object.freeze([
  'marketplace',
  'market',
  'बाज़ार',
  'बाजार',
  'मार्केटप्लेस',
]);

const ORDERS_KEYWORDS = Object.freeze(['order', 'orders', 'ऑर्डर', 'ओर्डर', 'आर्डर']);

const PROFILE_KEYWORDS = Object.freeze(['profile', 'प्रोफाइल', 'प्रोफाईल']);

// Hindi + Marathi number words for 1-100 (shared keys carry the same value).
export const NUMBER_WORDS = Object.freeze({
  // 1-10
  एक: 1,
  दो: 2,
  दोन: 2,
  तीन: 3,
  चार: 4,
  पांच: 5,
  पाँच: 5,
  पाच: 5,
  छह: 6,
  छः: 6,
  छ: 6,
  सहा: 6,
  सात: 7,
  आठ: 8,
  नौ: 9,
  नऊ: 9,
  दस: 10,
  दहा: 10,
  // 11-20
  ग्यारह: 11,
  अकरा: 11,
  बारह: 12,
  बारा: 12,
  तेरह: 13,
  तेरा: 13,
  चौदह: 14,
  चौदा: 14,
  पंद्रह: 15,
  पंधरा: 15,
  सोलह: 16,
  सोळा: 16,
  सत्रह: 17,
  सतरा: 17,
  अठारह: 18,
  अठरा: 18,
  उन्नीस: 19,
  एकोणीस: 19,
  बीस: 20,
  वीस: 20,
  // 21-30
  इक्कीस: 21,
  एकवीस: 21,
  बाईस: 22,
  बावीस: 22,
  तेईस: 23,
  तेवीस: 23,
  चौबीस: 24,
  चोवीस: 24,
  पच्चीस: 25,
  पंचवीस: 25,
  छब्बीस: 26,
  सव्वीस: 26,
  सत्ताईस: 27,
  सत्तावीस: 27,
  अट्ठाईस: 28,
  अठ्ठावीस: 28,
  उनतीस: 29,
  एकोणतीस: 29,
  तीस: 30,
  // 31-40
  इकतीस: 31,
  एकतीस: 31,
  बत्तीस: 32,
  तैंतीस: 33,
  तेहतीस: 33,
  चौंतीस: 34,
  चौतीस: 34,
  पैंतीस: 35,
  पस्तीस: 35,
  छत्तीस: 36,
  सैंतीस: 37,
  सदतीस: 37,
  अड़तीस: 38,
  अडतीस: 38,
  उनतालीस: 39,
  एकोणचाळीस: 39,
  चालीस: 40,
  चाळीस: 40,
  // 41-50
  इकतालीस: 41,
  एकेचाळीस: 41,
  बयालीस: 42,
  बेचाळीस: 42,
  तैंतालीस: 43,
  त्रेचाळीस: 43,
  चौवालीस: 44,
  चव्वेचाळीस: 44,
  पैंतालीस: 45,
  पंचेचाळीस: 45,
  छियालीस: 46,
  छेचाळीस: 46,
  सैंतालीस: 47,
  सत्तेचाळीस: 47,
  अड़तालीस: 48,
  अडूचाळीस: 48,
  उनचास: 49,
  एकोणपन्नास: 49,
  पचास: 50,
  पन्नास: 50,
  // 51-60
  इक्यावन: 51,
  एक्कावन्न: 51,
  बावन: 52,
  बावन्न: 52,
  तिरेपन: 53,
  त्रेपन्न: 53,
  चौवन: 54,
  चौपन्न: 54,
  पचपन: 55,
  पंचावन्न: 55,
  छप्पन: 56,
  सत्तावन: 57,
  सत्तावन्न: 57,
  अट्ठावन: 58,
  अठ्ठावन्न: 58,
  उनसठ: 59,
  एकोणसाठ: 59,
  साठ: 60,
  // 61-70
  इकसठ: 61,
  एकसष्ट: 61,
  बासठ: 62,
  बासष्ट: 62,
  तिरसठ: 63,
  त्रेसष्ट: 63,
  चौंसठ: 64,
  चौसष्ट: 64,
  पैंसठ: 65,
  पासष्ट: 65,
  छियासठ: 66,
  सहासष्ट: 66,
  सड़सठ: 67,
  सदुसष्ट: 67,
  अड़सठ: 68,
  अडुसष्ट: 68,
  उनहत्तर: 69,
  एकोणसत्तर: 69,
  सत्तर: 70,
  // 71-80
  इकहत्तर: 71,
  एक्काहत्तर: 71,
  बहत्तर: 72,
  बाहत्तर: 72,
  तिहत्तर: 73,
  त्र्याहत्तर: 73,
  चौहत्तर: 74,
  चौऱ्याहत्तर: 74,
  पचहत्तर: 75,
  पंच्याहत्तर: 75,
  छिहत्तर: 76,
  शहात्तर: 76,
  सतहत्तर: 77,
  सत्याहत्तर: 77,
  अठहत्तर: 78,
  अठ्ठ्याहत्तर: 78,
  उन्यासी: 79,
  एकोणऐंशी: 79,
  अस्सी: 80,
  ऐंशी: 80,
  // 81-90
  इक्यासी: 81,
  एक्क्याऐंशी: 81,
  बयासी: 82,
  ब्याऐंशी: 82,
  तिरासी: 83,
  त्र्याऐंशी: 83,
  चौरासी: 84,
  चौऱ्याऐंशी: 84,
  पचासी: 85,
  पंच्याऐंशी: 85,
  छियासी: 86,
  शहाऐंशी: 86,
  सत्तासी: 87,
  सत्त्याऐंशी: 87,
  अट्ठासी: 88,
  अठ्ठ्याऐंशी: 88,
  नवासी: 89,
  एकोणनव्वद: 89,
  नब्बे: 90,
  नव्वद: 90,
  // 91-100
  इक्यानवे: 91,
  एक्क्याण्णव: 91,
  बानवे: 92,
  ब्याण्णव: 92,
  तिरानवे: 93,
  त्र्याण्णव: 93,
  चौरानवे: 94,
  चौऱ्याण्णव: 94,
  पचानवे: 95,
  पंच्याण्णव: 95,
  छियानवे: 96,
  शहाण्णव: 96,
  सत्तानवे: 97,
  सत्त्याण्णव: 97,
  अट्ठानवे: 98,
  अठ्ठ्याण्णव: 98,
  निन्यानवे: 99,
  नव्व्याण्णव: 99,
  सौ: 100,
  शंभर: 100,
});

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeText(rawText) {
  if (!rawText) return '';
  return String(rawText)
    .toLowerCase()
    .replace(/[.,!?;:।॥"“”'‘’()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Return the canonical crop key present in the text, or null. */
export function extractCrop(rawText) {
  const text = normalizeText(rawText);
  if (!text) return null;
  for (const crop of CROP_KEYS) {
    if (CROP_ALIASES[crop].some((alias) => text.includes(alias))) {
      return crop;
    }
  }
  return null;
}

/** Extract a supported quantity (1-100) from the text, or null if uncertain. */
export function extractQuantity(rawText) {
  const text = normalizeText(rawText);
  if (!text) return null;

  const digitMatch = text.match(/(^|\s)(\d{1,3})(\s|$)/);
  if (digitMatch) {
    const value = Number(digitMatch[2]);
    return value >= 1 && value <= 100 ? value : null;
  }

  const tokens = text.split(' ');
  const numberTokens = tokens.filter((token) =>
    Object.prototype.hasOwnProperty.call(NUMBER_WORDS, token)
  );
  // Exactly one number word means the number was said once; more than one (e.g.
  // "दो सौ" = 200) is ambiguous and never guessed -> null.
  if (numberTokens.length === 1) return NUMBER_WORDS[numberTokens[0]];
  return null;
}

/**
 * Map text to one of the canonical intents.
 * Priority: MARKET_PRICE (crop + price words) -> SELL_CROP (explicit
 * post/list) -> SMART_SELLING (sell / best option) -> MARKET_PRICE (price
 * words, no crop) -> MARKETPLACE -> ORDERS -> PROFILE -> UNKNOWN.
 * Bare "sell / बेचना / विकायचा" is SMART_SELLING unless the user explicitly
 * says "post / list" the crop.
 */
export function detectIntent(rawText, options = {}) {
  const text = normalizeText(rawText);
  if (!text) return INTENTS.UNKNOWN;

  const crop = options && options.crop != null ? options.crop : extractCrop(text);
  const hasPriceKeyword = PRICE_KEYWORDS.some((k) => text.includes(k));
  const hasListingKeyword = SELL_LISTING_KEYWORDS.some((k) => text.includes(k));
  const hasSellingKeyword = SELLING_KEYWORDS.some((k) => text.includes(k));
  const hasMarketplaceKeyword = MARKETPLACE_KEYWORDS.some((k) => text.includes(k));
  const hasOrdersKeyword = ORDERS_KEYWORDS.some((k) => text.includes(k));
  const hasProfileKeyword = PROFILE_KEYWORDS.some((k) => text.includes(k));

  if (hasPriceKeyword && crop) return INTENTS.MARKET_PRICE;
  if (hasListingKeyword) return INTENTS.SELL_CROP;
  if (hasSellingKeyword) return INTENTS.SMART_SELLING;
  if (hasPriceKeyword) return INTENTS.MARKET_PRICE;
  if (hasMarketplaceKeyword) return INTENTS.MARKETPLACE;
  if (hasOrdersKeyword) return INTENTS.ORDERS;
  if (hasProfileKeyword) return INTENTS.PROFILE;
  return INTENTS.UNKNOWN;
}

/** Parse a raw transcript into a predictable { intent, crop, quantity, rawText }. */
export function parseCommand(rawText) {
  const normalized = normalizeText(rawText);
  const crop = extractCrop(normalized);
  const quantity = extractQuantity(normalized);
  const intent = detectIntent(normalized, { crop });
  return { intent, crop, quantity, rawText: normalized };
}
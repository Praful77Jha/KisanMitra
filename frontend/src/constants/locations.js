// Hackathon-safe, deterministic location options for "Sell Crop" (State → District
// → Village/City). No background GPS and no fake coordinates are stored — the
// selected village/district/state is combined into a plain-text location string
// exactly like the free-text locations used across the rest of the app.
export const LOCATIONS = {
  Maharashtra: {
    Nashik: ['Pimpalgaon', 'Niphad', 'Ozhe', 'Girnare'],
    Pune: ['Baramati', 'Shirur', 'Rajgurunagar', 'Daund'],
    Nagpur: ['Katol', 'Kalmeshwar', 'Savner', 'Narkhed'],
  },
  Punjab: {
    Ludhiana: ['Khanna', 'Doraha', 'Jagraon', 'Payal'],
    Amritsar: ['Raja Sansi', 'Majitha', 'Tarn Taran', 'Ajnala'],
  },
  'Madhya Pradesh': {
    Indore: ['Sanwer', 'Depalpur', 'Mhow', 'Kannod'],
    Sehore: ['Ashta', 'Ichhawar', 'Nasrullaganj', 'Budhni'],
  },
  'Uttar Pradesh': {
    Kanpur: ['Bilhaur', 'Ghatampur', 'Sarsaul', 'Shivrajpur'],
    Varanasi: ['Raja Talab', 'Pindra', 'Sewapuri', 'Cholapur'],
  },
};

export const LOCATION_STATES = Object.keys(LOCATIONS);

export function districtsForState(state) {
  return state && LOCATIONS[state] ? Object.keys(LOCATIONS[state]) : [];
}

export function villagesForDistrict(state, district) {
  if (!state || !district || !LOCATIONS[state] || !LOCATIONS[state][district]) return [];
  return LOCATIONS[state][district];
}

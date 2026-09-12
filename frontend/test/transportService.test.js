const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// transportService.js imports apiClient helpers that don't exist under plain
// node. The import is stripped and the api helpers provided as globals, letting
// us assert the exact endpoints and payloads the client sends.
const calls = [];
const api = {
  apiGet: (url) => {
    calls.push(['GET', url]);
    return { success: true, data: url };
  },
  apiPost: (url, body) => {
    calls.push(['POST', url, body]);
    return { success: true, data: url };
  },
  apiPut: (url, body) => {
    calls.push(body === undefined ? ['PUT', url] : ['PUT', url, body]);
    return { success: true, data: url };
  },
  apiPatch: (url, body) => {
    calls.push(['PATCH', url, body]);
    return { success: true, data: url };
  },
  apiDelete: (url) => {
    calls.push(['DELETE', url]);
    return { success: true, data: url };
  },
};
global.apiGet = api.apiGet;
global.apiPost = api.apiPost;
global.apiPut = api.apiPut;
global.apiPatch = api.apiPatch;
global.apiDelete = api.apiDelete;

function loadModule() {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'transportService.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const stripped = source
    .replace(/^import\s+[^\n]+\n?/m, '')
    .replace(/^export\s+/gm, '')
    .trim();
  const wrapped = `${stripped}\n\nreturn { createTransporterProfile, getMyTransporterProfile, updateMyTransporterProfile, createTransportRequest, getMyTransportRequests, getAvailableTransportRequests, getTransportRequest, deleteTransportRequest, createTransportQuote, getTransportQuotes, acceptTransportQuote, rejectTransportQuote, createCounterOffer, getNegotiationHistory, getTransportJobs, getTransportJobHistory, getTransportJob, updateTransportJobStatus, createTransportReview, getTransporterReviews };`;
  // eslint-disable-next-line no-new-func
  return new Function(wrapped)();
}

const service = loadModule();

function resetCalls() {
  calls.length = 0;
  global.apiGet = api.apiGet;
  global.apiPut = api.apiPut;
}

test('getMyTransportRequests falls back to an empty list for missing data', async () => {
  resetCalls();
  global.apiGet = (url) => {
    calls.push(['GET', url]);
    return { success: true };
  };
  const result = await service.getMyTransportRequests();
  assert.deepEqual(result, []);
  assert.deepEqual(calls, [['GET', '/transport-requests']]);
});

test('createTransportRequest posts to /transport-requests with the payload', async () => {
  resetCalls();
  const payload = { cropName: 'Wheat', quantity: 100 };
  await service.createTransportRequest(payload);
  assert.deepEqual(calls, [['POST', '/transport-requests', payload]]);
});

test('deleteTransportRequest deletes the request url', async () => {
  resetCalls();
  await service.deleteTransportRequest('rq-1');
  assert.deepEqual(calls, [['DELETE', '/transport-requests/rq-1']]);
});

test('createTransportQuote posts to the request quotes endpoint', async () => {
  resetCalls();
  const payload = { quotedAmount: 5000, vehicleType: 'Truck' };
  await service.createTransportQuote('rq-9', payload);
  assert.deepEqual(calls, [['POST', '/transport-requests/rq-9/quotes', payload]]);
});

test('createTransportQuote forwards the full send-offer body with notes', async () => {
  resetCalls();
  await service.createTransportQuote('rq-9', {
    quotedAmount: 5200,
    vehicleType: 'Mini Truck',
    notes: 'Same-day pickup',
  });
  assert.deepEqual(calls, [
    [
      'POST',
      '/transport-requests/rq-9/quotes',
      { quotedAmount: 5200, vehicleType: 'Mini Truck', notes: 'Same-day pickup' },
    ],
  ]);
});

test('acceptTransportQuote puts to the accept endpoint', async () => {
  resetCalls();
  await service.acceptTransportQuote('qt-3');
  assert.deepEqual(calls, [['PUT', '/transport-quotes/qt-3/accept']]);
});

test('rejectTransportQuote puts to the reject endpoint', async () => {
  resetCalls();
  await service.rejectTransportQuote('qt-3');
  assert.deepEqual(calls, [['PUT', '/transport-quotes/qt-3/reject']]);
});

test('createCounterOffer posts to the quote counter endpoint with the payload', async () => {
  resetCalls();
  await service.createCounterOffer('qt-3', { quotedAmount: 5200, notes: 'One more trip possible' });
  assert.deepEqual(calls, [
    ['POST', '/transport-quotes/qt-3/counter', { quotedAmount: 5200, notes: 'One more trip possible' }],
  ]);
});

test('createCounterOffer sends null notes when empty', async () => {
  resetCalls();
  await service.createCounterOffer('qt-3', { quotedAmount: 5200, notes: '   ' });
  assert.deepEqual(calls, [['POST', '/transport-quotes/qt-3/counter', { quotedAmount: 5200, notes: null }]]);
});

test('getNegotiationHistory fetches the quote history endpoint', async () => {
  resetCalls();
  await service.getNegotiationHistory('qt-3');
  assert.deepEqual(calls, [['GET', '/transport-quotes/qt-3/history']]);
});

test('updateTransportJobStatus sends the new status as the body', async () => {
  resetCalls();
  await service.updateTransportJobStatus('job-1', 'DELIVERED');
  assert.deepEqual(calls, [['PUT', '/transport-jobs/job-1/status', { status: 'DELIVERED' }]]);
});

test('createTransportReview sends rating with empty comment as null', async () => {
  resetCalls();
  await service.createTransportReview('job-2', { rating: 5, comment: '' });
  assert.deepEqual(calls, [
    ['POST', '/transport-jobs/job-2/review', { rating: 5, comment: null }],
  ]);
});

test('getTransporterReviews hits the public reviews endpoint', async () => {
  resetCalls();
  await service.getTransporterReviews('user-44');
  assert.deepEqual(calls, [['GET', '/transporters/user-44/reviews']]);
});

test('transportService rejects non-success responses with the backend message', async () => {
  resetCalls();
  global.apiGet = () => ({ success: false, message: 'Transporter profile not found' });
  await assert.rejects(() => service.getMyTransporterProfile(), {
    message: 'Transporter profile not found',
  });
});

test('transportService list endpoints surface data when present', async () => {
  resetCalls();
  global.apiGet = (url) => {
    calls.push(['GET', url]);
    return { success: true, data: [{ id: url }] };
  };
  const result = await service.getTransportJobs();
  assert.deepEqual(result, [{ id: '/transport-jobs' }]);
});
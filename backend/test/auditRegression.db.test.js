// Phase 8 production-readiness audit regression test (DATABASE path).
//
// Confirmed defect: in the DB path, the payment controller responded with a
// sanitized copy of the STALE pre-write order (paymentState remained 'pending'
// in the response even after 'paid'/'failed'/'cancelled' was persisted). The fix
// makes the DB path build the response from the updated order returned by the
// payment service.
//
// This file runs in DATABASE mode but mocks the persistence/gateway services so
// no live MySQL connection is required. It runs in its own process under
// `node --test`, so it cannot affect the in-memory test files.

process.env.USE_DATABASE = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  confirmPayment,
  cancelPayment,
} = require('../src/controllers/paymentController');
const orderService = require('../src/services/orderService');
const paymentService = require('../src/services/paymentService');
const paymentGateway = require('../src/services/paymentGateway');

function makeRes() {
  const calls = [];
  return {
    calls,
    status(code) { calls.push(['status', code]); return this; },
    json(body) { calls.push(['json', body]); return this; },
  };
}
function statusOf(res) {
  for (let i = 0; i < res.calls.length; i += 1) if (res.calls[i][0] === 'status') return res.calls[i][1];
  return 200;
}
function bodyOf(res) {
  for (let i = 0; i < res.calls.length; i += 1) if (res.calls[i][0] === 'json') return res.calls[i][1];
  return null;
}

// A representative order row as the DB would return it (paymentState 'pending'
// until a write happens).
function orderRow(state = 'pending') {
  return {
    id: 'ord-reg-1',
    userId: 'reg-buyer-1',
    sellerUserId: 'reg-seller-1',
    productName: 'Tomato',
    totalAmount: 8800,
    paymentMethod: 'Bank Transfer',
    paymentState: state,
    paymentRef: null,
    paidAt: null,
    quantity: 10,
    transportCost: 200,
  };
}

const originalFind = orderService.findOrderById;
const originalRecord = paymentService.recordPayment;
const originalSetState = paymentService.setPaymentState;
const originalCharge = paymentGateway.charge;

test('DB path: confirmPayment response reflects recorded paid state (no stale pending)', async () => {
  try {
    // findOrderById returns a pending order before the write.
    orderService.findOrderById = async () => orderRow('pending');
    // The persisted write returns the updated order with paid state.
    paymentService.recordPayment = async (id, d) => ({
      ...orderRow('pending'),
      paymentState: d.paymentState,
      paymentRef: d.paymentRef,
      paidAt: d.paidAt,
    });
    paymentGateway.charge = () => ({ success: true, ref: 'TXN-REG-1', gateway: 'mock', devOnly: true });

    const res = makeRes();
    await confirmPayment(
      { user: { id: 'reg-buyer-1' }, params: { orderId: 'ord-reg-1' } },
      res,
      () => assert.fail('unexpected error')
    );
    assert.equal(statusOf(res), 200);
    // Regression: response must say 'paid', not the stale 'pending'.
    assert.equal(bodyOf(res).data.state, 'paid');
  } finally {
    orderService.findOrderById = originalFind;
    paymentService.recordPayment = originalRecord;
    paymentGateway.charge = originalCharge;
  }
});

test('DB path: confirmPayment failure response reflects failed state (no stale pending)', async () => {
  try {
    orderService.findOrderById = async () => orderRow('pending');
    paymentService.setPaymentState = async (id, s) => ({ ...orderRow('pending'), paymentState: s });
    paymentGateway.charge = () => ({ success: false, ref: null, gateway: 'mock', devOnly: true, error: 'Card declined' });

    const res = makeRes();
    await confirmPayment(
      { user: { id: 'reg-buyer-1' }, params: { orderId: 'ord-reg-1' } },
      res,
      () => assert.fail('unexpected error')
    );
    assert.equal(statusOf(res), 402);
    // Regression: response must say 'failed', not the stale 'pending'.
    assert.equal(bodyOf(res).data.state, 'failed');
  } finally {
    orderService.findOrderById = originalFind;
    paymentService.setPaymentState = originalSetState;
    paymentGateway.charge = originalCharge;
  }
});

test('DB path: cancelPayment response reflects cancelled state (no stale pending)', async () => {
  try {
    orderService.findOrderById = async () => orderRow('pending');
    paymentService.setPaymentState = async (id, s) => ({ ...orderRow('pending'), paymentState: s });

    const res = makeRes();
    await cancelPayment(
      { user: { id: 'reg-buyer-1' }, params: { orderId: 'ord-reg-1' } },
      res,
      () => assert.fail('unexpected error')
    );
    assert.equal(statusOf(res), 200);
    // Regression: response must say 'cancelled', not the stale 'pending'.
    assert.equal(bodyOf(res).data.state, 'cancelled');
  } finally {
    orderService.findOrderById = originalFind;
    paymentService.setPaymentState = originalSetState;
  }
});

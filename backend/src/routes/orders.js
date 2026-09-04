const express = require('express');
const router = express.Router();
const { getAllOrders, getOrderById, createOrder, cancelOrder } = require('../controllers/ordersController');
const { createReview, getOrderReviews, updateReview, deleteReview } = require('../controllers/reviewsController');
const {
  getPayment,
  initiatePayment,
  confirmPayment,
  cancelPayment,
} = require('../controllers/paymentController');
const { verifyToken } = require('../middlewares/auth');

router.get('/', verifyToken, getAllOrders);
router.get('/:id', verifyToken, getOrderById);
router.post('/', verifyToken, createOrder);
router.post('/:id/cancel', verifyToken, cancelOrder);

// Ratings & Reviews tied to a specific order. Only the order's two parties may
// create or view a review; only the author may update/delete (ownership enforced
// server-side in the controller).
router.post('/:orderId/reviews', verifyToken, createReview);
router.get('/:orderId/reviews', verifyToken, getOrderReviews);
router.put('/:orderId/reviews/:reviewId', verifyToken, updateReview);
router.delete('/:orderId/reviews/:reviewId', verifyToken, deleteReview);

// Payments (Phase 5). Payment state belongs to the order. Payment status is
// viewable by either party; initiation, confirmation and cancellation are
// restricted to the buying user. Amounts are always derived server-side.
router.get('/:orderId/payment', verifyToken, getPayment);
router.post('/:orderId/payment/initiate', verifyToken, initiatePayment);
router.post('/:orderId/payment/confirm', verifyToken, confirmPayment);
router.post('/:orderId/payment/cancel', verifyToken, cancelPayment);

module.exports = router;

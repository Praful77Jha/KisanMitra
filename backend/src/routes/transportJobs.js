const express = require('express');
const router = express.Router();
const {
  getAllJobs,
  getJobHistory,
  getJobById,
  updateJobStatus,
  createReview,
} = require('../controllers/transportJobsController');
const { verifyToken, requireRole } = require('../middlewares/auth');

// Transport jobs. /history must precede /:id (route ordering). Status updates are
// restricted to the assigned TRANSPORTER; reviews to the requesting party.
router.get('/history', verifyToken, requireRole('FARMER', 'BUYER', 'TRANSPORTER'), getJobHistory);
router.get('/', verifyToken, requireRole('FARMER', 'BUYER', 'TRANSPORTER'), getAllJobs);
router.put('/:id/status', verifyToken, requireRole('TRANSPORTER'), updateJobStatus);
router.post('/:id/review', verifyToken, requireRole('FARMER', 'BUYER'), createReview);
router.get('/:id', verifyToken, requireRole('FARMER', 'BUYER', 'TRANSPORTER'), getJobById);

module.exports = router;
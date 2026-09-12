const express = require('express');
const router = express.Router();
const { uploadImage } = require('../controllers/uploadsController');
const { verifyToken } = require('../middlewares/auth');

// Uploads write to local disk: only authenticated users may place files, and the
// handler never trusts the client-side filename or declared type.
router.post('/', verifyToken, uploadImage);

module.exports = router;
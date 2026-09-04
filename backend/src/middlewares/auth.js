const { verifyToken } = require('../utils/jwt');

function verifyTokenMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Missing or malformed Authorization header',
    });
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.id, phone: payload.phone };
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
}

module.exports = { verifyToken: verifyTokenMiddleware };

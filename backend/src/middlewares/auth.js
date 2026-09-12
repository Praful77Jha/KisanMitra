const { verifyToken } = require('../utils/jwt');
const { USE_DATABASE } = require('../config/config');
const userService = require('../services/userService');

const ROLES = ['FARMER', 'BUYER', 'TRANSPORTER'];

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

// Express middleware factory: requires the caller to be authenticated AND to hold
// one of the given roles (e.g. requireRole('TRANSPORTER'),
// requireRole('FARMER', 'BUYER')). The user's CURRENT role is loaded from the
// database (authoritative) rather than from the compact JWT payload or any
// client-supplied value; database-mode requests that already carry req.user.role
// (or the in-memory auth surface) are not re-fetched.
function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Missing or expired authorization',
        });
      }
      let role = req.user.role;
      if (!role && USE_DATABASE) {
        const user = await userService.findUserById(req.user.id);
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'Authenticated user not found',
          });
        }
        role = user.role || 'FARMER';
      }
      if (!role || !roles.includes(role)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      req.user.role = role;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

// Synchronous predicates reused by controllers (including the in-memory paths
// and tests) so role authorization logic is defined once, not per controller.
function isAuthenticated(req) {
  return !!(req.user && req.user.id);
}

function hasRole(req, ...roles) {
  return !!(req.user && req.user.role && roles.includes(req.user.role));
}

function isValidRole(role) {
  return typeof role === 'string' && ROLES.includes(role);
}

module.exports = {
  verifyToken: verifyTokenMiddleware,
  requireRole,
  isAuthenticated,
  hasRole,
  isValidRole,
  ROLES,
};
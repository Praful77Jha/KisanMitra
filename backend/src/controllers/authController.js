const userService = require('../services/userService');
const { signToken } = require('../utils/jwt');

// App roles accepted at registration. Missing role defaults to FARMER; anything
// else is rejected with 400. Kept as plain strings (no PRisma enums), matching
// the project-wide string-status convention.
const VALID_ROLES = ['FARMER', 'BUYER', 'TRANSPORTER'];
const DEFAULT_ROLE = 'FARMER';

function toSafeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

async function register(req, res, next) {
  try {
    const { name, phone, password, role } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'name, phone, and password are required',
      });
    }

    // Role is optional and validated. The JWT payload stays { id, phone }; the
    // authoritative role lives on the user row and is loaded by authorization
    // middleware when needed, never trusted from the token or later bodies.
    const normalizedRole = role === undefined || role === null ? DEFAULT_ROLE : role;
    if (!VALID_ROLES.includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: 'role must be FARMER, BUYER, or TRANSPORTER',
      });
    }

    const existing = await userService.findUserByPhone(phone);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'User with this phone already exists',
      });
    }

    const user = await userService.createUser({ name, phone, password, role: normalizedRole });

    return res.status(201).json({
      success: true,
      data: toSafeUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'phone and password are required',
      });
    }

    const user = await userService.findUserByPhone(phone);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone or password',
      });
    }

    const valid = await userService.comparePassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone or password',
      });
    }

    const token = signToken({ id: user.id, phone: user.phone });

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: toSafeUser(user),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function me(req, res, next) {
  try {
    const user = await userService.findUserByPhone(req.user.phone);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    return res.status(200).json({
      success: true,
      data: toSafeUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login, me };

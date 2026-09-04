const userService = require('../services/userService');
const { signToken } = require('../utils/jwt');

function toSafeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

async function register(req, res, next) {
  try {
    const { name, phone, password } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'name, phone, and password are required',
      });
    }

    const existing = await userService.findUserByPhone(phone);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'User with this phone already exists',
      });
    }

    const user = await userService.createUser({ name, phone, password });

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

const userService = require('../services/userService');

async function updateLocation(req, res, next) {
  try {
    const { location } = req.body;
    if (typeof location !== 'string' || !location.trim()) {
      return res.status(400).json({
        success: false,
        message: 'location is required',
      });
    }
    const trimmed = location.trim().slice(0, 120);
    const user = await userService.updateUserLocation(req.user.id, trimmed);
    const { passwordHash, ...safe } = user;
    return res.status(200).json({ success: true, data: safe });
  } catch (error) {
    return next(error);
  }
}

module.exports = { updateLocation };

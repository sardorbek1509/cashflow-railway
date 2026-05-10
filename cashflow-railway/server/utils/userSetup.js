const User = require('../models/User');
const logger = require('./logger');

const ensureSuperAdmin = async () => {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!email || !password) {
    logger.warn('SUPERADMIN_EMAIL va SUPERADMIN_PASSWORD .env da topilmadi, superadmin yaratilmadi.');
    return;
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });

  if (!existing) {
    const user = new User({
      username: process.env.SUPERADMIN_USERNAME || 'superadmin',
      email: email.toLowerCase().trim(),
      passwordHash: password,
      role: 'superadmin',
      isActive: true
    });
    await user.save();
    logger.info('Superadmin foydalanuvchi avtomatik yaratildi.', { email: user.email });
    return;
  }

  if (existing.role !== 'superadmin') {
    existing.role = 'superadmin';
    await existing.save();
    logger.info('Mavjud foydalanuvchi superadminga yangilandi.', { email: existing.email });
    return;
  }

  logger.info('Superadmin mavjud: %s', existing.email);
};

module.exports = { ensureSuperAdmin };

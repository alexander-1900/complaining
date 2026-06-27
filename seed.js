const { sequelize } = require('./config/db');
const User = require('./models/User');

/**
 * DATABASE SEEDING SCRIPT
 * Initializes the administrative accounts for the Aflou Wilaya.
 * This script should be run once during the initial setup.
 */
const seedAdminUsers = async () => {
  try {
    // Ensure database connection is active
    await sequelize.authenticate();
    console.log('Database connected for seeding.');

    // Sync models (ensures tables exist)
    await sequelize.sync();

    // 1. Initialize Governor Account
    const [governor, govCreated] = await User.findOrCreate({
      where: { username: 'aflou_governor' },
      defaults: {
        password: 'Governor@Aflou2026', // Will be hashed automatically by User model hook
        role: 'governor'
      }
    });

    if (govCreated) {
      console.log('SUCCESS: Governor account created (aflou_governor).');
    } else {
      console.log('NOTICE: Governor account already exists.');
    }

    // 2. Initialize Secretary Account
    const [secretary, secCreated] = await User.findOrCreate({
      where: { username: 'aflou_secretary' },
      defaults: {
        password: 'Secretary@Aflou2026', // Will be hashed automatically by User model hook
        role: 'secretary'
      }
    });

    if (secCreated) {
      console.log('SUCCESS: Secretary account created (aflou_secretary).');
    } else {
      console.log('NOTICE: Secretary account already exists.');
    }

    console.log('Seeding process completed successfully.');
  } catch (error) {
    console.error('CRITICAL SEEDING ERROR:', error);
  } finally {
    // Close the database connection cleanly
    await sequelize.close();
    process.exit(0);
  }
};

// Execute the seeding
seedAdminUsers();

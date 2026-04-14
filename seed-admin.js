const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/fixxer';

const UserSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  email: String,
  passwordHash: { type: String, required: true },
  fullName: String,
  savedAddresses: { type: [{ label: String, zip: String, text: String }], default: [] },
  role: { type: String, default: 'CUSTOMER', enum: ['CUSTOMER', 'ADMIN'] },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function seedAdmin() {
  try {
    console.log(`🔌 Connecting to MongoDB at ${MONGO_URI}...`);
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected.');

    const phone = process.argv[2] || '9999999999';
    const password = process.argv[3] || 'admin123';
    const fullName = process.argv[4] || 'Fixxer Admin';

    const existing = await User.findOne({ phone });
    if (existing) {
      // Update to admin if they exist
      existing.role = 'ADMIN';
      await existing.save();
      console.log(`✅ Existing user ${phone} promoted to ADMIN.`);
    } else {
      const salt = await bcrypt.genSalt();
      const passwordHash = await bcrypt.hash(password, salt);

      await User.create({
        phone,
        passwordHash,
        fullName,
        role: 'ADMIN',
      });
      console.log(`✅ Admin user created.`);
      console.log(`   Phone: ${phone}`);
      console.log(`   Password: ${password}`);
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected.');
    process.exit(0);
  }
}

seedAdmin();

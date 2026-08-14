const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from the root .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('../configs/db');
const User = require('../models/user.model');
const bcrypt = require('bcryptjs');

async function seedSuperAdmin() {
    try {
        // Validate required environment variables
        const requiredEnvVars = ['SUPER_ADMIN_NAME', 'SUPER_ADMIN_EMAIL', 'SUPER_ADMIN_PASSWORD'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

        if (missingVars.length > 0) {
            console.error('========================================');
            console.error('Super Admin Seeder Error');
            console.error('========================================');
            console.error('Missing required environment variable(s):');
            missingVars.forEach(v => console.error(`- ${v}`));
            console.error('========================================');
            process.exitCode = 1;
            return;
        }

        // Normalize email
        const email = process.env.SUPER_ADMIN_EMAIL.trim().toLowerCase();
        const name = process.env.SUPER_ADMIN_NAME.trim();
        const role = process.env.SUPER_ADMIN_ROLE || 'super_admin';

        // Check if user already exists
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            console.log('========================================');
            console.log('Super Admin Seeder');
            console.log('========================================');
            console.log('\nSuper Admin already exists.\n');
            console.log(`Email: ${email}`);
            console.log(`Role: ${existingUser.role}`);
            console.log('\nNo new user was created.');
            console.log('========================================');
            process.exitCode = 0;
            return;
        }

        // Hash the password (using salt rounds = 10 as per controller config)
        const hashedPassword = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD, 10);

        // Create the new Super Admin user
        await User.create({
            name,
            email,
            password: hashedPassword,
            role,
            isActive: true
        });

        console.log('========================================');
        console.log('Super Admin Seeder');
        console.log('========================================');
        console.log('\nSuper Admin created successfully.\n');
        console.log(`Email: ${email}`);
        console.log(`Role: ${role}`);
        console.log('Status: Active');
        console.log('========================================');
        process.exitCode = 0;
    } catch (error) {
        console.error('========================================');
        console.error('Super Admin Seeder Error');
        console.error('========================================');
        console.error('An error occurred during seeding:', error);
        console.error('========================================');
        process.exitCode = 1;
    } finally {
        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            console.error('Error disconnecting from database:', disconnectError);
        }
    }
}

// Run the seeder function
seedSuperAdmin();

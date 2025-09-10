const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model.js");
const path = require('path');
const fs = require('fs');

// REGISTER
exports.register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({
            success: false,
            message: "Email already registered"
        });

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: role || "user", // Default role is user
        });

        await newUser.save();
        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            Id: newUser.id
        });
    } catch (err) {
        console.log('register Error', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({
            success: false,
            message: "Invalid email"
        });

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({
            success: false,
            message: "Invalid password"
        });

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "30d" } // Token valid for 30 day
        );
        return res.status(200).json({
            success: true,
            message: `${user.role} Login successfully`,
            token,
            name: user.name,
            email: user.email,
            role: user.role
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const user = req.user;

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Profile fetched successfully',
            data: {
                Id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                imageUrl: `${req.protocol}://${req.get('host')}/uploads/users/${user.profileImage}`
            }
        });

    } catch (err) {
        console.error('Error fetching profile', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching profile',
            error: err.message
        });
    }
};


exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user?._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (req.body.name) {
            user.name = req.body.name;
        }

        if (req.body.email) {
            user.email = req.body.email;
        }

        if (req.file) {
            // Delete old image if exists
            if (user.profileImage) {
                const oldPath = path.join(__dirname, '../uploads/users/', user.profileImage);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }

            user.profileImage = req.file.filename;
        }

        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                imageUrl: user.profileImage
                    ? `${req.protocol}://${req.get('host')}/uploads/users/${user.profileImage}`
                    : null
            }
        });

    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({
            success: false,
            message: "Error updating user profile",
            error: error.message
        });
    }
};

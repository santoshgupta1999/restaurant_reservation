const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model.js");
const UserOtp = require('../models/userOtp.js');
const sendMail = require('../utils/mailer.js');
const path = require('path');
const fs = require('fs');
const BlacklistToken = require("../models/blacklistToken.model");


exports.register = async (req, res) => {
    try {
        const { name, email, phone, password, role } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({
            success: false,
            message: "Email already registered"
        });

        const allowRoles = ['host', 'marketer', 'manager', 'user']
        if (!allowRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid role."
            })
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            email,
            phone,
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

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({
            success: false,
            message: "Invalid email"
        });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({
            success: false,
            message: "Invalid password"
        });

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );
        return res.status(200).json({
            success: true,
            message: `${user.role} Login successfully`,
            token,
            id: user.id,
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
                phone: user.phone,
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
            const emailExists = await User.findOne({ email: req.body.email, _id: { $ne: userId } });
            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: "Email already in use by another user"
                });
            }
            user.email = req.body.email;
        }

        if (req.file) {
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

exports.logout = async (req, res) => {
    try {
        const authHeader = req.headers?.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authorization token missing"
            });
        }

        const token = authHeader.split(" ")[1];

        await BlacklistToken.create({ token });

        return res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });

    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({
            success: false,
            message: "Error during logout",
            error: error.message
        });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword, confirmPassword } = req.body;

        if (!oldPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: true,
                message: 'New password at least 6 characters long'
            });
        }

        if (oldPassword === newPassword) {
            return res.status(400).json({
                success: false,
                message: "New Password must be different from Old Password"
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "New password and confirm password do not match"
            });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Old password is incorrect"
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        user.password = hashedPassword;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Password updated successfully"
        });

    } catch (error) {
        console.error("Error while changing Password", error);
        res.status(500).json({
            success: false,
            message: "Error while changing password"
        });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await UserOtp.deleteMany({ userId: user._id });

        await UserOtp.create({ userId: user._id, otp, expiresAt });

        const message = `
        Your OTP for password reset is:

        ${otp}

        This OTP is valid for 5 minutes.
        `;

        await sendMail(user.email, "Password Reset OTP", message);

        const token = jwt.sign(
            { userId: user._id, userEmail: user.email, purpose: 'forgot_password' },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully to your email",
            token,
        });
    } catch (error) {
        console.error("Forgot Password Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while sending OTP",
            Error: error.message
        });
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(400).json({ success: false, message: "Authorization token is required" });
        }

        const token = authHeader.split(" ")[1];
        if (!token) {
            return res.status(400).json({ success: false, message: "Invalid token format" });
        }

        if (!otp) {
            return res.status(400).json({ success: false, message: "OTP is required" });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            console.error("JWT verify error:", err.message);
            return res.status(401).json({ success: false, message: "Invalid or expired token" });
        }

        const userId = decoded?.userId;
        if (!userId) {
            return res.status(400).json({ success: false, message: "Invalid token payload" });
        }

        const user = await User.findById(userId);
        if (!user) {
            console.error("User not found for userId:", userId);
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const otpRecord = await UserOtp.findOne({ userId, otp });
        if (!otpRecord) {
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }

        if (otpRecord.expiresAt < new Date()) {
            await UserOtp.deleteMany({ userId });
            return res.status(400).json({ success: false, message: "OTP expired" });
        }

        await UserOtp.deleteMany({ userId });

        const genrateToken = jwt.sign(
            { userId: user._id, userEmail: user.email, purpose: 'forgot_password' },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully",
            Token: genrateToken,
        });

    } catch (error) {
        console.error("Verify OTP Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error during OTP verification",
            error: error.message,
        });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { newPassword, confirmPassword } = req.body;

        if (!newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password and confirm password are required',
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long',
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password and confirm password do not match',
            });
        }

        const user = req.user;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        user.password = hashedPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password reset successfully',
        });

    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during reset password',
            error: error.message,
        });
    }
};

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model.js");
const Restaurant = require('../models/restaurant.model.js');
const UserOtp = require('../models/userOtp.js');
const sendMail = require('../utils/mailer.js');
const path = require('path');
const fs = require('fs');
const BlacklistToken = require("../models/blacklistToken.model");


exports.register = async (req, res) => {
    try {
        const { name, email, phone, password, role, restaurantId } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Email already registered",
            });
        }

        const allowedRoles = ["admin", "host", "marketer", "manager"];
        if (role && !allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role. Allowed roles: admin, host, marketer, manager",
            });
        }

        if (restaurantId) {
            const restaurantExists = await Restaurant.findById(restaurantId);
            if (!restaurantExists) {
                return res.status(404).json({
                    success: false,
                    message: "Invalid restaurant ID. Restaurant not found.",
                });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            email,
            phone,
            password: hashedPassword,
            role: role || "manager",
            restaurantId: restaurantId || null,
        });

        await newUser.save();

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            userId: newUser._id,
            role: newUser.role,
            restaurantId: newUser.restaurantId
        });

    } catch (error) {
        console.error("Register Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found. Please register first.",
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: "Account is inactive. Contact admin.",
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid password.",
            });
        }

        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign(
            {
                id: user._id,
                role: user.role,
                restaurantId: user.restaurantId || null,
            },
            process.env.JWT_SECRET || "MY_SUPER_SECRET_KEY",
            { expiresIn: "30d" }
        );

        return res.status(200).json({
            success: true,
            message: "Login successfully",
            token,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                restaurantId: user.restaurantId,
            },
        });

    } catch (error) {
        console.error("Login Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Invalid token or user not found.",
            });
        }

        const user = await User.findById(userId).select("-password");
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        const imageUrl = user.profileImage
            ? `${req.protocol}://${req.get("host")}/uploads/users/${user.profileImage}`
            : null;

        return res.status(200).json({
            success: true,
            message: "Profile fetched successfully",
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                isActive: user.isActive,
                lastLogin: user.lastLogin ? user.lastLogin.toISOString() : null,
                imageUrl,
            },
        });

    } catch (err) {
        console.error("Error fetching profile:", err);
        return res.status(500).json({
            success: false,
            message: "Error fetching profile",
            error: err.message,
        });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Invalid token or user not found.",
            });
        }

        const { name, phone, email } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        let newImage = user.profileImage;
        if (req.file) {
            newImage = req.file.filename;

            if (user.profileImage) {
                const oldPath = path.join(__dirname, "../uploads/users", user.profileImage);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
        }

        user.name = name || user.name;
        user.phone = phone || user.phone;
        user.email = email || user.email;
        user.profileImage = newImage;

        await user.save();

        const imageUrl = user.profileImage
            ? `${req.protocol}://${req.get("host")}/uploads/users/${user.profileImage}`
            : null;

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                imageUrl,
            },
        });

    } catch (error) {
        console.error("Error updating profile:", error);
        return res.status(500).json({
            success: false,
            message: "Error updating profile",
            error: error.message,
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

exports.getAllActiveUser = async (req, res) => {
    try {
        const { role, restaurantId, page = 1, limit = 10, sortBy = "createdAt", order = "desc" } = req.query;

        const query = { isActive: true };

        if (role) query.role = role;
        if (restaurantId) query.restaurantId = restaurantId;

        const skip = (page - 1) * limit;
        const sortOrder = order === "asc" ? 1 : -1;

        const users = await User.find(query)
            .select("-password")
            .populate("restaurantId", "name email phone address")
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        if (!users.length) {
            return res.status(404).json({
                success: false,
                message: "No active users found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Active users fetched successfully.",
            count: users.length,
            total,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            data: users,
        });
    } catch (error) {
        console.error("Error fetching active users:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching active users.",
            error: error.message,
        });
    }
};

exports.updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        if (typeof isActive !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "Invalid input. 'isActive' must be a boolean (true or false).",
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            id,
            { isActive },
            { new: true, runValidators: true }
        ).select("-password");

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: `User has been ${isActive ? "activated" : "deactivated"} successfully.`,
            data: {
                id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                isActive: updatedUser.isActive,
            },
        });

    } catch (error) {
        console.error("Error updating user status:", error);
        return res.status(500).json({
            success: false,
            message: "Error updating user status.",
            error: error.message,
        });
    }
};

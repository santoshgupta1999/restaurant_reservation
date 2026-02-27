const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model.js");
const Restaurant = require('../models/Restaurant.model.js');
const UserOtp = require('../models/userOtp.js');
const sendMail = require('../utils/mailer.js');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
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

exports.superAdminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid Email",
            });
        }

        if (user.role !== "super_admin") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Not a Super Admin.",
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid password.",
            });
        }

        const token = jwt.sign(
            {
                id: user._id,
                role: user.role,
            },
            process.env.JWT_SECRET,
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
            },
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Invalid token or user not found."
            });
        }

        const user = await User.findById(userId).select("-password");
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const host = `${req.protocol}://${req.get("host")}`;
        const imageUrl = user.profileImage
            ? `${host}/restaurant_reservation/uploads/users/${user.profileImage}`
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
                imageUrl
            }
        });

    } catch (err) {
        console.error("Error fetching profile:", err);
        return res.status(500).json({
            success: false,
            message: "Error fetching profile",
            error: err.message
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

        const { name, phone, email, restaurantId } = req.body;

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
        user.restaurantId = restaurantId || user.restaurantId;
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

// exports.changePassword = async (req, res) => {
//     try {
//         const { oldPassword, newPassword, confirmPassword } = req.body;

//         if (!oldPassword || !newPassword || !confirmPassword) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'All fields are required'
//             });
//         }

//         if (newPassword.length < 6) {
//             return res.status(400).json({
//                 success: true,
//                 message: 'New password at least 6 characters long'
//             });
//         }

//         if (oldPassword === newPassword) {
//             return res.status(400).json({
//                 success: false,
//                 message: "New Password must be different from Old Password"
//             });
//         }

//         if (newPassword !== confirmPassword) {
//             return res.status(400).json({
//                 success: false,
//                 message: "New password and confirm password do not match"
//             });
//         }

//         const user = await User.findById(req.user._id);
//         if (!user) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'User not found'
//             });
//         }

//         const isMatch = await bcrypt.compare(oldPassword, user.password);
//         if (!isMatch) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Old password is incorrect"
//             });
//         }

//         const salt = await bcrypt.genSalt(10);
//         const hashedPassword = await bcrypt.hash(newPassword, salt);

//         user.password = hashedPassword;
//         await user.save();

//         return res.status(200).json({
//             success: true,
//             message: "Password updated successfully"
//         });

//     } catch (error) {
//         console.error("Error while changing Password", error);
//         res.status(500).json({
//             success: false,
//             message: "Error while changing password"
//         });
//     }
// };

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

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).
                json({
                    success: false,
                    message: "User not found"
                });
        }

        const token = crypto.randomBytes(32).toString("hex");

        user.resetPasswordToken = token;
        user.resetPasswordExpire = Date.now() + 1000 * 60 * 15; // 15 min

        await user.save();

        const resetLink = `${process.env.FRONTEND_URL}${token}`;
        const fullName = `${user.name || ""}`.trim();
        const subject = "Password Reset Request";

        const message = `
Dear ${fullName || "User"},

We received a request to reset your account password.

To create a new password, please click the link below:

${resetLink}

This link will expire in 15 minutes for security reasons.

If you did not request a password reset, please ignore this email. 
Your account will remain secure.

If you need help, contact our support team.

Best Regards,  
Restaurant Team
`;


        await sendMail(user.email, subject, message);

        res.json({
            success: true,
            message: "Reset link sent to email",
            token
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.verifyResetLink = async (req, res) => {
    const { token } = req.params;

    const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
        return res.status(400).json({
            success: false,
            message: "Link expired"
        });
    }

    res.json({ success: true });
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
        const { token } = req.params;
        const { newPassword, confirmPassword } = req.body;

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match"
            });
        }

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Link expired"
            });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save();

        const loginToken = jwt.sign(
            {
                id: user._id,
                role: user.role,
                restaurantId: user.restaurantId || null,
            },
            process.env.JWT_SECRET || "MY_SUPER_SECRET_KEY",
            { expiresIn: "30d" }
        );

        res.json({
            success: true,
            message: "Password reset successful",
            token: loginToken,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                restaurantId: user.restaurantId,
            },
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
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

exports.getAllUsers = async (req, res) => {
    try {
        const { role, page = 1, limit = 10 } = req.query;
        const query = {};

        if (role) query.role = role;
        // if (isActive !== undefined) query.isActive = isActive === "true";

        const skip = (page - 1) * limit;

        const users = await User.find(query)
            .select("-password")
            .populate("restaurantId", "name email phone")
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(query);

        return res.status(200).json({
            success: true,
            message: "Users fetched successfully",
            count: users.length,
            total,
            data: users,
        });

    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching users",
            error: error.message
        });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id).select("-password")
            .populate("restaurantId", "name email phone");
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "User fetched successfully",
            data: user,
        });

    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching user",
            error: error.message
        });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await User.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({
            success: false,
            message: "User not found"
        });

        return res.status(200).json({
            success: true,
            message: "User deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting user",
            error: error.message
        });
    }
};

exports.getManagers = async (req, res) => {
    try {
        const { restaurantId } = req.query;

        const filter = {
            role: "manager",
            isActive: true
        };

        // Optional restaurant filter
        if (restaurantId) {
            if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid restaurantId"
                });
            }

            filter.restaurantId = restaurantId;
        }

        const managers = await User.find(filter)
            .select("-password")
            .populate("restaurantId", "name email phone");

        if (!managers.length) {
            return res.status(404).json({
                success: false,
                message: restaurantId
                    ? "No managers found for this restaurant"
                    : "No managers found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Managers fetched successfully",
            count: managers.length,
            data: managers
        });

    } catch (error) {
        console.error("Error fetching managers:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching managers",
            error: error.message
        });
    }
};

exports.getStaffs = async (req, res) => {
    try {
        const { restaurantId } = req.query;

        const filter = {
            role: { $in: ["Host", "Manager"] },
        };

        if (restaurantId) {
            if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid restaurantId"
                });
            }

            filter.restaurantId = restaurantId;
        }

        const staffs = await User.find(filter)
            .select("-password")
            .populate("restaurantId", "venueName email phone");

        if (!staffs.length) {
            return res.status(404).json({
                success: false,
                message: restaurantId
                    ? "No staffs found for this restaurant"
                    : "No staffs found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Staffs fetched successfully",
            count: staffs.length,
            data: staffs
        });

    } catch (error) {
        console.error("Error fetching staffs:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching staffs",
            error: error.message
        });
    }
};

exports.updateUsersById = async (req, res) => {
    try {
        const { id, name, phone, email, restaurantId } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "userId is required",
            });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        let newImage = user.profileImage;

        if (req.file) {
            newImage = req.file.filename;

            // delete old image
            if (user.profileImage) {
                const oldPath = path.join(
                    __dirname,
                    "../uploads/users",
                    user.profileImage
                );

                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
        }

        user.name = name || user.name;
        user.phone = phone || user.phone;
        user.email = email || user.email;
        user.restaurantId = restaurantId || user.restaurantId;
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

exports.addStaff = async (req, res) => {
    try {
        const { id, email, password, role, restaurantId, isActive } = req.body;

        const allowedRoles = ["Host", "Manager"];

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        if (id) {

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid staff id"
                });
            }

            if (!role || !restaurantId || typeof isActive !== "boolean") {
                return res.status(400).json({
                    success: false,
                    message: "Role, restaurantId and status are required"
                });
            }

            if (!allowedRoles.includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: "Role must be either Host or Manager"
                });
            }

            if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid restaurantId"
                });
            }

            const existingStaff = await User.findById(id);
            if (!existingStaff) {
                return res.status(404).json({
                    success: false,
                    message: "Staff not found"
                });
            }

            const emailExists = await User.findOne({
                email: normalizedEmail,
                _id: { $ne: id }
            });

            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: "Staff with this email already exists"
                });
            }

            // Prepare update object
            const updateData = {
                email: normalizedEmail,
                role,
                restaurantId,
                isActive
            };

            // Only update password if provided
            if (password && password.trim() !== "") {
                const hashedPassword = await bcrypt.hash(password, 10);
                updateData.password = hashedPassword;
            }

            const updatedStaff = await User.findByIdAndUpdate(
                id,
                updateData,
                { new: true, runValidators: true }
            );

            const response = updatedStaff.toObject();
            delete response.password;

            return res.status(200).json({
                success: true,
                message: "Staff updated successfully",
                data: response
            });
        }
        if (!password || !role || !restaurantId || typeof isActive !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "All required fields must be provided"
            });
        }

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Role must be either Host or Manager"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid restaurantId"
            });
        }

        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Staff with this email already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newStaff = await User.create({
            email: normalizedEmail,
            password: hashedPassword,
            role,
            restaurantId,
            isActive
        });

        const staffResponse = newStaff.toObject();
        delete staffResponse.password;

        return res.status(201).json({
            success: true,
            message: "Staff added successfully",
            data: staffResponse
        });

    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({
            success: false,
            message: "Something went wrong",
            error: error.message
        });
    }
};

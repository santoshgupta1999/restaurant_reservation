const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
require('dotenv').config({ quiet: true });
const BlacklistToken = require("../models/blacklistToken.model");

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Authorization token missing'
        });
    }

    const token = authHeader.split(' ')[1];

    const blacklisted = await BlacklistToken.findOne({ token });
    if (blacklisted) {
        return res.status(401).json({
            success: false,
            message: "You are logged out, please login again"
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const userId = decoded.id || decoded.userId;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "Invalid token payload"
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        req.user = user;
        req.token = token;
        next();
    } catch (err) {
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};

const requireRole = (role) => (req, res, next) => {
    if (req.user?.role !== role) {
        return res.status(403).json({
            success: false,
            message: `Access denied: only ${role}s allowed`
        });
    }
    next();
};

module.exports = {
    verifyToken,
    requireRole
};

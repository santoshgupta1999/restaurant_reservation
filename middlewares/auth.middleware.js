const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
require('dotenv').config();

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Authorization token missing'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        req.user = user;
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

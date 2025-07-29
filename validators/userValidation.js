const { check, validationResult } = require("express-validator");

// Register Validation
const registerValidation = [
    check("name", "Name is required").notEmpty(),
    check("email", "Please enter a valid email").isEmail(),
    check("password", "Password must be at least 6 characters").isLength({ min: 6 }),
];

// Login Validation
const loginValidation = [
    check("email", "Please enter a valid email").isEmail(),
    check("password", "Password is required").notEmpty(),
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array(),
        });
    }
    next();
};

module.exports = {
    registerValidation,
    loginValidation,
    handleValidationErrors
};

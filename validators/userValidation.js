const { body } = require("express-validator");

exports.registerValidator = [
    body("name")
        .trim()
        .notEmpty()
        .withMessage("Name is required.")
        .isLength({ min: 3 })
        .withMessage("Name must be at least 3 characters."),

    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required.")
        .isEmail()
        .withMessage("Invalid email format."),

    body("phone")
        .optional()
        .matches(/^[0-9]{10}$/)
        .withMessage("Phone must be a valid 10-digit number."),

    body("password")
        .notEmpty()
        .withMessage("Password is required.")
        .isLength({ min: 6 })
        .withMessage("Password must be at least 6 characters."),

    body("role")
        .optional()
        .isIn(["admin", "host", "marketer", "manager"])
        .withMessage("Invalid role provided."),

    body("restaurantId")
        .optional()
        .isMongoId()
        .withMessage("Invalid restaurant ID format."),
];

exports.loginValidator = [
    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required.")
        .isEmail()
        .withMessage("Invalid email format."),

    body("password")
        .notEmpty()
        .withMessage("Password is required.")
        .isLength({ min: 6 })
        .withMessage("Password must be at least 6 characters."),
];

exports.updateProfileValidator = [
    body("name")
        .optional()
        .trim()
        .isLength({ min: 2 })
        .withMessage("Name must be at least 2 characters."),

    body("phone")
        .optional()
        .matches(/^[0-9]{10}$/)
        .withMessage("Phone must be a valid 10-digit number."),

    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required.")
        .isEmail()
        .withMessage("Invalid email format."),
];

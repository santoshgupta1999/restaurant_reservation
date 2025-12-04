const { body, param, query } = require("express-validator");

exports.createGuestValidator = [
    body("firstName").notEmpty().withMessage("First name is required."),
    body("email").optional().isEmail().withMessage("Invalid email format."),
    body("phone").optional().isLength({ min: 8, max: 15 }).withMessage("Invalid phone number"),
];

exports.updateGuestValidator = [
    param("id").isMongoId().withMessage("Invalid guest ID."),
    body("email").optional().isEmail().withMessage("Invalid email"),
    body("phone").optional().isLength({ min: 8, max: 15 }).withMessage("Invalid phone"),
];

exports.searchGuestValidator = [
    query("keyword").notEmpty().withMessage("Keyword is required."),
];

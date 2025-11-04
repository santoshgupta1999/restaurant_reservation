const { body } = require("express-validator");

exports.tableValidator = [
    body("restaurantId")
        .notEmpty().withMessage("Restaurant ID is required")
        .isMongoId().withMessage("Invalid restaurant ID"),

    body("roomName")
        .notEmpty().withMessage("Room name is required")
        .isIn(["Main Dining", "First Floor", "Bar", "Outdoor", "Terrace"])
        .withMessage("Invalid room name"),

    body("tableNumber")
        .notEmpty().withMessage("Table number is required")
        .trim(),

    body("capacity")
        .notEmpty().withMessage("Capacity is required")
        .isInt({ min: 1 }).withMessage("Capacity must be at least 1"),

    body("shape")
        .optional()
        .isIn(["Square", "Round", "Rectangle"])
        .withMessage("Invalid shape type"),

    body("status")
        .optional()
        .isIn(["Available", "Reserved", "Seated", "OutOfService"])
        .withMessage("Invalid status"),

    body("isJoined")
        .optional()
        .isBoolean().withMessage("isJoined must be a boolean"),

    body("joinedWith")
        .optional()
        .isArray().withMessage("joinedWith must be an array of table IDs"),

    body("joinedWith.*")
        .optional()
        .isMongoId().withMessage("Invalid table ID in joinedWith"),

    body("position.x")
        .optional()
        .isNumeric().withMessage("Position x must be a number"),

    body("position.y")
        .optional()
        .isNumeric().withMessage("Position y must be a number"),

    body("rotation")
        .optional()
        .isNumeric().withMessage("Rotation must be a number"),
];

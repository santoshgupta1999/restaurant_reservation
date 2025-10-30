const { body } = require("express-validator");

exports.reservationValidator = [
    body("restaurantId")
        .notEmpty().withMessage("Restaurant ID is required.")
        .isMongoId().withMessage("Invalid Restaurant ID."),

    body("shiftId")
        .notEmpty().withMessage("Shift ID is required.")
        .isMongoId().withMessage("Invalid Shift ID."),

    body("guestName").notEmpty().withMessage("Guest name is required."),
    body("guestEmail").isEmail().withMessage("Invalid email."),
    body("guestPhone")
        .notEmpty().withMessage("Phone number is required."),
        // .matches(/^[0-9]{10}$/).withMessage("Phone must be 10 digits."),

    body("date")
        .notEmpty().withMessage("Reservation date is required.")
        .isISO8601().toDate().withMessage("Invalid date format."),

    body("time")
        .notEmpty().withMessage("Time is required.")
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage("Invalid time format (HH:mm)."),

    body("partySize")
        .isInt({ min: 1 }).withMessage("Party size must be at least 1.")
];

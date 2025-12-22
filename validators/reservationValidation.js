const { body } = require("express-validator");

exports.reservationValidator = [
    body("restaurantId")
        .notEmpty().withMessage("Restaurant ID is required.")
        .isMongoId().withMessage("Invalid Restaurant ID."),

    // body("shiftId")
    //     .notEmpty().withMessage("Shift ID is required.")
    //     .isMongoId().withMessage("Invalid Shift ID."),

    body("tableId")
        .notEmpty().withMessage("Table ID is required.")
        .isMongoId().withMessage("Invalid Table ID."),

    body("firstName").notEmpty().withMessage("first name is required."),
    body("lastName").notEmpty().withMessage("last name is required."),
    body("guestEmail").isEmail().withMessage("Invalid email."),
    body("guestPhone")
        .trim()
        .notEmpty()
        .withMessage("Phone number is required.")
        .custom((value) => {
            const digitsOnly = value.replace(/[\s-]/g, "");

            if (!/^[0-9]+$/.test(digitsOnly)) {
                throw new Error("Phone number can contain only digits, spaces, or dashes.");
            }

            if (digitsOnly.length > 15) {
                throw new Error("Phone number must not be more than 15 digits.");
            }

            return true;
        }),

    body("date")
        .notEmpty().withMessage("Reservation date is required.")
        .isISO8601().toDate().withMessage("Invalid date format."),

    body("time")
        .notEmpty().withMessage("Time is required.")
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage("Invalid time format (HH:mm)."),

    body("partySize")
        .isInt({ min: 1 }).withMessage("Party size must be at least 1."),

    body("source")
        .notEmpty()
        .withMessage("Source is required.")
        .isIn(["Online", "Walk-in", "Phone", "Email", "Remi"])
        .withMessage("Source name must be one of: Online, Walk-in, Phone, Email, Remi."),
];

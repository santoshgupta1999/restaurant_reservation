const { body, validationResult } = require('express-validator');

exports.restaurantValidator = [
    body('name')
        .notEmpty().withMessage('Restaurant name is required.'),

    body('email')
        .notEmpty().withMessage('Email is required.')
        .isEmail().withMessage('Invalid email format.'),

    // body('phone')
    //     .notEmpty().withMessage('Phone number is required.')
    //     .matches(/^[0-9]{10}$/).withMessage('Phone number must be 10 digits.'),

    body('address')
        .notEmpty().withMessage('Address is required.'),

    body('openingHours')
        .notEmpty().withMessage('Opening hours are required.')
        .matches(/^([1-9]|1[0-2])(AM|PM)-([1-9]|1[0-2])(AM|PM)$/)
        .withMessage('Invalid opening hours format (e.g., 9AM-10PM).'),

    body('status')
        .optional()
        .isIn(['active', 'inactive'])
        .withMessage('Invalid status.'),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }
        next();
    }
];

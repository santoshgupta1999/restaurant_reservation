const { body, validationResult } = require('express-validator');

exports.restaurantValidator = [
    body('name').notEmpty().withMessage('Restaurant name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('address').notEmpty().withMessage('Address is required'),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }
        next();
    }
];

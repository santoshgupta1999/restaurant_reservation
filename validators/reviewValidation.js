const { body } = require('express-validator');
const Review = require('../models/review.model');

exports.reviewValidator = [
    body('restaurantId')
        .notEmpty().withMessage('Restaurant ID is required')
        .isMongoId().withMessage('Invalid Restaurant ID'),

    body('rating')
        .notEmpty().withMessage('Rating is required')
        .isFloat({ min: 1, max: 5 })
        .withMessage('Rating must be between 1 and 5'),

    body('comment')
        .optional()
        .isString().withMessage('Comment must be a string')
];

exports.checkDuplicateReview = async (req, res, next) => {
    const userId = req.user._id;
    const { restaurantId } = req.body;

    const existingReview = await Review.findOne({ userId: userId, restaurantId: restaurantId });

    if (existingReview) {
        return res.status(400).json({
            success: false,
            message: 'You have already reviewed this restaurant.'
        });
    }

    next();
};

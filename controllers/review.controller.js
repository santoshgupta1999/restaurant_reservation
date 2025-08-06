const Review = require('../models/review.model');
const Restaurant = require('../models/restaurant.model');
const mongoose = require('mongoose');

exports.createReview = async (req, res) => {
    try {
        const { restaurantId, rating, comment } = req.body;

        const review = new Review({
            userId: req.user._id,
            restaurantId: restaurantId,
            rating,
            comment
        });

        await review.save();

        return res.status(201).json({
            success: true,
            message: 'Review submitted successfully',
            data: review
        });

    } catch (error) {
        console.error('Error submitting review:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting review',
            error: error.message
        });
    }
};

exports.getReviews = async (req, res) => {
    try {
        const { restaurantId } = req.query;
        const userId = req.user._id;

        const query = { userId };

        if (restaurantId) {
            query.restaurantId = restaurantId;
        }

        const reviews = await Review.find(query)
            .populate('restaurantId', 'name')
            .populate('userId', 'name');

        res.status(200).json({
            success: true,
            message: 'User reviews fetched successfully',
            data: reviews
        });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching reviews',
            error: error.message
        });
    }
};


exports.getAllReviewsByAdmin = async (req, res) => {
    try {
        const reviews = await Review.find()
            .populate('userId', 'name email')
            .populate('restaurantId', 'name');

        return res.status(200).json({
            success: true,
            message: 'All reviews fetched successfully',
            data: reviews
        });
    } catch (error) {
        console.error('Error fetching all reviews:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching reviews',
            error: error.message
        });
    }
};


exports.getAverageRating = async (req, res) => {
    try {
        const { restaurantId } = req.params;

        const result = await Review.aggregate([
            { $match: { restaurantId: new mongoose.Types.ObjectId(restaurantId) } },
            {
                $group: {
                    _id: '$restaurantId',
                    averageRating: { $avg: '$rating' },
                    totalReviews: { $sum: 1 }
                }
            }
        ]);

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No reviews found for this restaurant'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Average rating fetched successfully',
            data: {
                averageRating: result[0].averageRating.toFixed(1),
                totalReviews: result[0].totalReviews
            }
        });
    } catch (error) {
        console.error('Error fetching average rating:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching average rating',
            error: error.message
        });
    }
};

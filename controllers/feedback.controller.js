const Feedback = require('../models/feedback.model');
const Restaurant = require('../models/restaurant.model');
const Reservation = require('../models/reservation.model');
const { default: mongoose } = require('mongoose');


exports.createFeedback = async (req, res) => {
    try {
        const {
            restaurantId,
            reservationId,
            guestName,
            rating,
            comment
        } = req.body;

        const restaurantExists = await Restaurant.findById(restaurantId);
        if (!restaurantExists) {
            return res.status(404).json({
                success: false,
                message: "Restaurant not found"
            });
        }

        const reservationExists = await Reservation.findById(reservationId);
        if (!reservationExists) {
            return res.status(404).json({
                success: false,
                message: 'Reservation not found'
            });
        }

        const newFeedback = await Feedback.create({
            restaurantId,
            reservationId,
            guestName,
            rating,
            comment,
            respondedBy: req.user ? req.user._id : null,
        });

        return res.status(200).json({
            success: true,
            message: 'Feedback submitted successfully',
            data: newFeedback
        });

    } catch (error) {
        console.error('Error while creating feedback', error);
        res.status(500).json({
            success: false,
            message: 'Error while creating feedback',
            Error: error.message
        });
    }
};

exports.getAllFeedback = async (req, res) => {
    try {
        const {
            restaurantId,
            reservationId,
            minRating,
            maxRating
        } = req.query;

        const filter = {};
        if (restaurantId) filter.restaurantId = restaurantId;
        if (reservationId) filter.reservationId = reservationId;
        if (minRating || maxRating) {
            filter.rating = {};
            if (minRating) filter.rating.$gte = parseInt(minRating);
            if (maxRating) filter.rating.$lte = parseInt(maxRating);
        }

        const feedback = await Feedback.find(filter)
            .populate("restaurantId", "name")
            .populate("reservationId", "guestName date time")
            .populate("respondedBy", "name email role")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: 'Feedbacks fetched successfully',
            count: feedback.length,
            data: feedback
        });

    } catch (error) {
        console.error('Error while fetching all feedbacks', error);
        return res.status(500).json({
            success: false,
            message: 'Error while fetching all feedbacks',
            Error: error.message
        });
    }
};

exports.getFeedbackById = async (req, res) => {
    try {
        const feedback = await Feedback.findById(req.params.id)
            .populate("restaurantId", "name")
            .populate("reservationId", "guestName date time")
            .populate("respondedBy", "name email");

        if (!feedback) {
            return res.status(404).json({
                success: false,
                message: "feedback not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Feedback details fetched sucessfully',
            data: feedback
        });

    } catch (error) {
        console.error('Error fetching feedback', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching feedback',
            Error: error.message
        });
    }
};

exports.updateFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, comment } = req.body;

        const updateFeedback = await Feedback.findByIdAndUpdate(
            id,
            { rating, comment },
            { new: true, runValidators: true }
        );

        if (!updateFeedback) {
            return res.status(404).json({
                success: false,
                message: 'Feedback not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'feedback updated successfully',
            data: updateFeedback
        });

    } catch (error) {
        console.error('Error while updating feedback');
        res.status(500).json({
            success: false,
            message: 'Error while updating feedback',
            Error: error.message
        });
    }
};

exports.deleteFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const deletefeedback = await Feedback.findByIdAndDelete(id);

        if (!deletefeedback) {
            return res.status(404).json({
                success: false,
                message: 'Feedback not found'
            });
        }

        return res.status(200).json({
            success: false,
            message: 'Feedback deleted successfully'
        });

    } catch (error) {
        console.error('Error while deleting feedback', error);
        res.status(500).json({
            success: true,
            message: 'Error while deleting feedback',
            Error: error.message
        });
    }
};

exports.getFeedbackByRestaurant = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid restaurant ID'
            });
        }

        const restaurantExists = await Restaurant.findById(id);
        if (!restaurantExists) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found'
            });
        }

        const feedbacks = await Feedback.find({ restaurantId: id })
            .populate("reservationId", "guestName date time")
            .populate("respondedBy", "name email role")
            .sort({ createdAt: -1 });

        // Always return average rating even if no feedback found
        const ratingStats = await Feedback.aggregate([
            {
                $match: {
                    restaurantId: new mongoose.Types.ObjectId(id)
                }
            },
            {
                $group: {
                    _id: "$restaurantId",
                    averageRating: { $avg: "$rating" },
                    totalFeedback: { $sum: 1 }
                }
            }
        ]);

        const averageRating = ratingStats.length
            ? parseFloat(ratingStats[0].averageRating.toFixed(1))
            : 0;

        const totalFeedback = ratingStats.length
            ? ratingStats[0].totalFeedback
            : 0;

        return res.status(200).json({
            success: true,
            message: 'Feedback fetched successfully for restaurant',
            averageRating,
            totalFeedback,
            count: feedbacks.length,
            data: feedbacks
        });

    } catch (error) {
        console.error('Error while fetching feedback by restaurant', error);
        res.status(500).json({
            success: false,
            message: 'Error while fetching feedback by restaurant',
            Error: error.message
        });
    }
};

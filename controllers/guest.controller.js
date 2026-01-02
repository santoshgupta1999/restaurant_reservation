const { default: mongoose } = require("mongoose");
const Guest = require("../models/guest.model");

exports.createGuest = async (req, res) => {
    try {
        const guest = new Guest(req.body);
        await guest.save();

        return res.status(201).json({
            success: true,
            message: "Guest created successfully",
            data: guest,
        });
    } catch (error) {
        console.error("Error creating guest:", error);
        res.status(500).json({
            success: false,
            message: "Error creating guests",
            error: error.message
        });
    }
};

exports.getGuests = async (req, res) => {
    try {
        const { page = 1, limit = 10, keyword, sortBy = "createdAt", order = "desc", isActive } = req.query;

        const filter = {};

        if (keyword) {
            filter.$or = [
                { firstName: { $regex: keyword, $options: "i" } },
                { lastName: { $regex: keyword, $options: "i" } },
                { email: { $regex: keyword, $options: "i" } },
                { phone: { $regex: keyword, $options: "i" } },
            ];
        }

        if (isActive !== undefined) filter.isActive = isActive === "true";

        const sortOrder = order === "asc" ? 1 : -1;

        const guests = await Guest.find(filter)
            .sort({ [sortBy]: sortOrder })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await Guest.countDocuments(filter);

        res.status(200).json({
            success: true,
            message: "Guests fetched successfully",
            total,
            page: Number(page),
            limit: Number(limit),
            data: guests,
        });

    } catch (error) {
        console.error("Error fetching guests:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching guests",
            error: error.message
        });
    }
};

exports.getGuestById = async (req, res) => {
    try {
        const guest = await Guest.findById(req.params.id);

        if (!guest) {
            return res.status(404).json({
                success: false,
                message: "Guest not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Guest fetched successfully",
            data: guest,
        });

    } catch (error) {
        console.error("Error fetching guest:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching guest",
            error: error.message
        });
    }
};

exports.updateGuest = async (req, res) => {
    try {
        const guest = await Guest.findByIdAndUpdate(req.params.id, req.body, { new: true });

        if (!guest) {
            return res.status(404).json({
                success: false,
                message: "Guest not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Guest updated successfully",
            data: guest,
        });

    } catch (error) {
        console.error("Error updating guest:", error);
        res.status(500).json({
            success: false,
            message: "Error updating guest",
            error: error.message
        });
    }
};

exports.deleteGuest = async (req, res) => {
    try {
        const guest = await Guest.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });

        if (!guest) {
            return res.status(404).json({
                success: false,
                message: "Guest not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Guest deactivated successfully",
            data: guest,
        });

    } catch (error) {
        console.error("Error deleting guest:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting guest",
            error: error.message
        });
    }
};

exports.getGuestVisitHistory = async (req, res) => {
    try {
        const { guestId } = req.params;

        const history = await Reservation.find({ guestId })
            .populate("restaurantId", "name")
            .populate("tableId", "tableNumber roomName")
            .sort({ date: -1 });

        res.status(200).json({
            success: true,
            message: "Visit history fetched successfully",
            count: history.length,
            data: history
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching visit history",
            error: error.message
        });
    }
};

exports.updateGuestStatus = async (req, res) => {
    try {
        const { id, isActive } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Guest ID"
            });
        }

        if (typeof isActive !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "isActive must be true or false"
            });
        }

        const updateGuest = await Guest.findByIdAndUpdate(
            id,
            { isActive },
            { new: true }
        );

        if (!updateGuest) {
            return res.status(404).json({
                success: false,
                message: "Guest not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: `Guest ${isActive ? "activated" : "deactivated"} successfully`,
            data: {
                id: updateGuest._id,
                firstName: updateGuest.firstName,
                lastName: updateGuest.lastName,
                isActive: updateGuest.isActive
            }
        });

    } catch (error) {
        console.error("Error while updating the Status", error);
        res.status(500).json({
            success: false,
            message: "Error while updating the Status",
            Error: error.message
        });
    }
};

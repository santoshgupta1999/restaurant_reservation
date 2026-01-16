const { default: mongoose } = require("mongoose");
const Guest = require("../models/guest.model");

exports.createGuest = async (req, res) => {
    try {
        const {
            restaurantId,
            firstName,
            lastName,
            gender,
            dob,
            email,
            phone,
            notes,
            tags,
            jobTitle,
            company
        } = req.body;

        if (!restaurantId || !firstName) {
            return res.status(400).json({
                success: false,
                message: "restaurantId and firstName are required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid restaurantId"
            });
        }

        let existingGuest = null;

        if (phone) {
            existingGuest = await Guest.findOne({ restaurantId, phone });
        }

        if (!existingGuest && email) {
            existingGuest = await Guest.findOne({
                restaurantId,
                email: email.toLowerCase()
            });
        }

        if (existingGuest) {
            return res.status(409).json({
                success: false,
                message: "Guest already exists for this restaurant",
                data: existingGuest
            });
        }

        const guest = await Guest.create({
            restaurantId,
            firstName,
            lastName,
            gender,
            dob,
            email,
            phone,
            notes,
            tags,
            jobTitle,
            company
        });

        return res.status(201).json({
            success: true,
            message: "Guest created successfully",
            data: guest
        });

    } catch (error) {
        console.error("Create guest error:", error);
        return res.status(500).json({
            success: false,
            message: "Error creating guest",
            error: error.message
        });
    }
};

exports.getGuests = async (req, res) => {
    try {
        const {
            restaurantId,
            page = 1,
            limit = 10,
            search,
            isActive,
            tags,
            sortBy = "createdAt",
            order = "desc"
        } = req.body || {};

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "restaurantId is required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid restaurantId"
            });
        }

        const skip = (Number(page) - 1) * Number(limit);

        let filter = {
            restaurantId
        };

        // 🔹 Active / Inactive filter
        if (isActive !== undefined) {
            filter.isActive = isActive;
        }

        // 🔹 Tags filter
        if (tags && tags.length) {
            filter.tags = { $in: tags };
        }

        // 🔹 Global Search
        if (search) {
            filter.$or = [
                { firstName: { $regex: search, $options: "i" } },
                { lastName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } }
            ];
        }

        // 🔹 Sorting
        const sortOrder = order === "asc" ? 1 : -1;
        const sort = { [sortBy]: sortOrder };

        const [guests, total] = await Promise.all([
            Guest.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(Number(limit)),

            Guest.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            message: "Guest list fetched successfully",
            data: guests,
            pagination: {
                totalRecords: total,
                currentPage: Number(page),
                totalPages: Math.ceil(total / limit),
                limit: Number(limit)
            }
        });

    } catch (error) {
        console.error("Get guests error:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching guests",
            error: error.message
        });
    }
};

exports.getGuestById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "guestId is required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid guestId"
            });
        }

        const guest = await Guest.findById(id);

        if (!guest) {
            return res.status(404).json({
                success: false,
                message: "Guest not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Guest fetched successfully",
            data: guest
        });

    } catch (error) {
        console.error("Get guest by id error:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching guest",
            error: error.message
        });
    }
};

exports.updateGuest = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "guestId is required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid guestId"
            });
        }

        const allowedFields = [
            "firstName",
            "lastName",
            "gender",
            "dob",
            "email",
            "phone",
            "notes",
            "tags",
            "jobTitle",
            "company",
            "isActive"
        ];

        const updateData = {};

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });

        if (!Object.keys(updateData).length) {
            return res.status(400).json({
                success: false,
                message: "No valid fields provided for update"
            });
        }

        const updatedGuest = await Guest.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true }
        );

        if (!updatedGuest) {
            return res.status(404).json({
                success: false,
                message: "Guest not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Guest updated successfully",
            data: updatedGuest
        });

    } catch (error) {
        console.error("Update guest error:", error);
        return res.status(500).json({
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

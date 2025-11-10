const Restaurant = require('../models/restaurant.model');
const Shift = require('../models/shift.model');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const baseUrl = process.env.BASE_URL;


exports.createRestaurant = async (req, res) => {
    try {
        const {
            name, email, phone, address, openingHours
        } = req.body;

        const existingRestaurant = await Restaurant.findOne({ email });
        if (existingRestaurant) {
            return res.status(400).json({
                success: false,
                message: 'Email already in use. Please use another email.'
            });
        }

        const logo = req.files['logo']
            ? `${req.files['logo'][0].filename}`
            : null;

        const createdBy = req.user?._id;

        const newRestaurant = new Restaurant({
            name,
            email,
            phone,
            address,
            openingHours: JSON.parse(openingHours),
            logo,
            createdBy
        });

        await newRestaurant.save();
        return res.status(201).json({
            success: true,
            message: 'Restaurant created successfully',
            data: newRestaurant
        });

    } catch (err) {
        console.error('Error creating restaurant:', err);
        res.status(500).json({
            success: false,
            message: 'Error creating restaurant',
            error: err.message
        });
    }
};

exports.getRestaurants = async (req, res) => {
    try {
        const { page = 1, limit = 10, name, status } = req.query;

        const query = {};
        if (name) query.name = { $regex: name, $options: 'i' };
        if (status) query.status = status;

        const total = await Restaurant.countDocuments(query);
        const restaurants = await Restaurant.find(query)
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const host = `${req.protocol}://${req.get('host')}`;

        const transformed = restaurants.map((r) => ({
            ...r._doc,
            logo: r.logo ? `${host}/uploads/restaurants/logo/${r.logo}` : null,
        }));

        return res.status(200).json({
            success: true,
            message: 'Restaurants fetched successfully',
            data: transformed,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.log('Error fetching restaurants');
        res.status(500).json({
            success: false,
            message: 'Error fetching restaurants',
            error: err.message
        });
    }
};

exports.getRestaurantById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid restaurant ID'
            });
        }

        const restaurant = await Restaurant.findById(id);
        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found'
            });
        }

        const host = `${req.protocol}://${req.get('host')}`;
        const transformed = {
            ...restaurant._doc,
            logo: restaurant.logo ? `${host}/uploads/restaurants/logo/${restaurant.logo}` : null
        };

        return res.status(200).json({
            success: true,
            message: 'Restaurant fetched successfully',
            data: transformed
        });

    } catch (err) {
        console.error('Error fetching restaurant', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching restaurant',
            error: err.message
        });
    }
};

exports.updateRestaurant = async (req, res) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id);

        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found'
            });
        }

        const updateFields = { ...req.body };

        if (updateFields.openingHours) {
            try {
                updateFields.openingHours = JSON.parse(updateFields.openingHours);
            } catch (e) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid JSON in openingHours',
                    error: e.message
                });
            }
        }

        if (req.files?.logo) {
            const newLogo = req.files.logo[0].filename;

            // Delete old logo if exists
            if (restaurant.logo) {
                const oldLogoPath = path.join(__dirname, '../uploads/restaurants/logo/', restaurant.logo);
                if (fs.existsSync(oldLogoPath)) {
                    fs.unlinkSync(oldLogoPath);
                }
            }

            updateFields.logo = newLogo;
        }

        const updatedRestaurant = await Restaurant.findByIdAndUpdate(
            req.params.id,
            updateFields,
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: 'Restaurant updated successfully',
            data: updatedRestaurant
        });

    } catch (err) {
        console.error('Error updating restaurant:', err);
        return res.status(500).json({
            success: false,
            message: 'Error updating restaurant',
            error: err.message
        });
    }
};

exports.deleteRestaurant = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid restaurant ID'
            });
        }

        const restaurant = await Restaurant.findByIdAndDelete(id);

        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found'
            });
        }

        // Auto-delete logo file if exists
        if (restaurant.logo) {
            const logoPath = path.join(__dirname, '../uploads/restaurants/logo/', restaurant.logo);
            if (fs.existsSync(logoPath)) fs.unlinkSync(logoPath);
        }

        return res.status(200).json({
            success: true,
            message: 'Restaurant deleted successfully'
        });

    } catch (err) {
        console.error('Error deleting restaurant', err);
        res.status(500).json({
            success: false,
            message: 'Error deleting restaurant',
            error: err.message
        });
    }
};

exports.getActiveRestaurants = async (req, res) => {
    try {
        const {
            keyword = "",
            page = 1,
            limit = 10,
            sortBy = "createdAt",
            order = "desc"
        } = req.query;

        const filter = { status: "active" };

        if (keyword.trim() !== "") {
            filter.$or = [
                { name: { $regex: keyword, $options: "i" } },
                { address: { $regex: keyword, $options: "i" } }
            ];
        }

        const pageNumber = parseInt(page, 10);
        const pageSize = parseInt(limit, 10);
        const skip = (pageNumber - 1) * pageSize;

        const sortOrder = order === "asc" ? 1 : -1;
        const sortQuery = { [sortBy]: sortOrder };

        const [restaurants, total] = await Promise.all([
            Restaurant.find(filter)
                .populate("createdBy", "name email")
                .sort(sortQuery)
                .skip(skip)
                .limit(pageSize),
            Restaurant.countDocuments(filter)
        ]);

        if (!restaurants.length) {
            return res.status(404).json({
                success: false,
                message:
                    keyword.trim() !== ""
                        ? "No matching active restaurants found."
                        : "No active restaurants found."
            });
        }

        const totalPages = Math.ceil(total / pageSize);

        return res.status(200).json({
            success: true,
            message:
                keyword.trim() !== ""
                    ? "Matching active restaurants fetched successfully."
                    : "Active restaurants fetched successfully.",
            count: restaurants.length,
            data: restaurants,
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages
            }
        });
    } catch (error) {
        console.error("Error fetching active restaurants:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching active restaurants.",
            error: error.message
        });
    }
};

exports.updateRestaurantStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        // const userId = req.user?._id;

        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be "active" or "inactive".'
            });
        }

        const restaurant = await Restaurant.findById(id);
        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found'
            });
        }

        // if (restaurant.createdBy.toString() !== userId.toString()) {
        //     return res.status(403).json({
        //         success: false,
        //         message: 'You are not authorized to update this restaurant'
        //     });
        // }

        restaurant.status = status;
        await restaurant.save();

        return res.status(200).json({
            success: true,
            message: `Restaurant status updated to ${status} successfully`
            // data: restaurant
        });

    } catch (error) {
        console.error('Error updating restaurant status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating restaurant status',
            error: error.message
        });
    }
};

// -------------------------------------------- Shift -------------------------------------------- //

exports.createShift = async (req, res) => {
    try {
        const shift = await Shift.create(req.body);

        return res.status(201).json({
            success: true,
            message: "Shift created successfully",
            data: shift
        });

    } catch (error) {
        console.error('Error creating shift', error);
        res.status(500).json({
            success: false,
            message: 'Error during creating shifts',
            Error: error.message
        });
    }
};

exports.getAllShift = async (req, res) => {
    try {
        const { restaurantId } = req.query;
        const query = {};

        if (restaurantId) query.restaurantId = restaurantId;

        const shifts = await Shift.find(query).populate("restaurantId", "name email phone");

        res.status(200).json({
            success: true,
            message: 'Shift fetched successfully',
            count: shifts.length,
            data: shifts
        });

    } catch (error) {
        console.error("Error fetching shifts:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

exports.getShiftById = async (req, res) => {
    try {
        const { id } = req.params;

        const shift = await Shift.findById(id).populate("restaurantId", "name");
        if (!shift) {
            return res.status(404).json({
                success: false,
                message: 'Shift not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Shifts fetched successfully',
            data: shift
        });

    } catch (error) {
        console.error('Error while fetching shifts');
        res.status(500).json({
            success: false,
            message: 'Error fetching shifts',
            Error: error.message
        });
    }
};

exports.updateShift = async (req, res) => {
    try {
        const { id } = req.params;

        const updatedShift = await Shift.findOneAndUpdate({ _id: id }, req.body, { new: true });
        if (!updatedShift) {
            return res.status(404).json({
                success: false,
                message: 'Shift not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Shift updated successfully',
            data: updatedShift
        });

    } catch (error) {
        console.error('Error while updating shifts', error);
        res.status(500).json({
            success: false,
            message: 'Error while updating shifts',
            Error: error.message
        });
    }
};

exports.deleteShift = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedShift = await Shift.findByIdAndDelete(id);

        if (!deletedShift) {
            return res.status(404).json({
                success: false,
                message: "Shift not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Shift deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting shift:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

exports.getActiveShiftsForToday = async (req, res) => {
    try {
        const { restaurantId } = req.query;

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "restaurantId is required in query params."
            });
        }

        const today = new Date();
        const dayOfWeek = today.toLocaleDateString("en-US", { weekday: "long" });

        const shifts = await Shift.find({
            restaurantId,
            isActive: true,
            $or: [
                { isIndefinite: true },
                {
                    $and: [
                        { startDate: { $lte: today } },
                        { endDate: { $gte: today } }
                    ]
                }
            ],
            daysActive: dayOfWeek
        }).sort({ startTime: 1 });

        if (!shifts.length) {
            return res.status(404).json({
                success: false,
                message: `No active shifts found for ${dayOfWeek}.`
            });
        }

        return res.status(200).json({
            success: true,
            message: `Active shifts for ${dayOfWeek} fetched successfully.`,
            count: shifts.length,
            data: shifts
        });

    } catch (error) {
        console.error("Error fetching active shifts:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

exports.getShiftsCalendarView = async (req, res) => {
    try {
        const { restaurantId, startDate, endDate } = req.query;

        if (!restaurantId || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "restaurantId, startDate, and endDate are required."
            });
        }

        const shifts = await Shift.find({
            restaurantId,
            $or: [
                { type: "Recurring" },
                {
                    startDate: { $lte: new Date(endDate) },
                    endDate: { $gte: new Date(startDate) }
                }
            ],
            isActive: true
        }).sort({ startTime: 1 });

        const groupedShifts = {};
        shifts.forEach(shift => {
            if (shift.type === "Recurring") {
                shift.daysActive.forEach(day => {
                    if (!groupedShifts[day]) groupedShifts[day] = [];
                    groupedShifts[day].push(shift);
                });
            } else {
                const dayKey = shift.startDate?.toISOString()?.split("T")[0];
                if (!groupedShifts[dayKey]) groupedShifts[dayKey] = [];
                groupedShifts[dayKey].push(shift);
            }
        });

        return res.status(200).json({
            success: true,
            message: "Shifts calendar data fetched successfully.",
            data: groupedShifts
        });

    } catch (error) {
        console.error("Error fetching shift calendar:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching shift calendar view.",
            error: error.message
        });
    }
};

exports.updateShiftStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        if (typeof isActive !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "Invalid input. 'isActive' must be true or false."
            });
        }

        const updatedShift = await Shift.findByIdAndUpdate(
            id,
            { isActive },
            { new: true, runValidators: true }
        ).populate("restaurantId", "name email phone address");

        if (!updatedShift) {
            return res.status(404).json({
                success: false,
                message: "Shift not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: `Shift has been ${isActive ? "activated" : "deactivated"} successfully.`,
            data: {
                id: updatedShift._id,
                name: updatedShift.name,
                restaurantId: updatedShift.restaurantId,
                type: updatedShift.type,
                startTime: updatedShift.startTime,
                endTime: updatedShift.endTime,
                isActive: updatedShift.isActive
            }
        });

    } catch (error) {
        console.error("Error updating shift status:", error);
        return res.status(500).json({
            success: false,
            message: "Error updating shift status.",
            error: error.message
        });
    }
};

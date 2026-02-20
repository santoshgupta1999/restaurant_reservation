const Restaurant = require("../models/Restaurant.model");
const Reservation = require("../models/reservation.model");
const Tier = require("../models/Tier");
const Shift = require('../models/shift.model');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const baseUrl = process.env.BASE_URL;
const { validationResult } = require("express-validator");
const User = require("../models/user.model");
const bcrypt = require("bcryptjs");
const moment = require("moment");


// exports.createRestaurant = async (req, res) => {
//     try {
//         const {
//             name, email, phone, address, openingHours
//         } = req.body;

//         const existingRestaurant = await Restaurant.findOne({ email });
//         if (existingRestaurant) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Email already in use. Please use another email.'
//             });
//         }

//         const logo = req.files['logo']
//             ? `${req.files['logo'][0].filename}`
//             : null;

//         const createdBy = req.user?._id;

//         const newRestaurant = new Restaurant({
//             name,
//             email,
//             phone,
//             address,
//             openingHours,
//             logo,
//             createdBy
//         });

//         await newRestaurant.save();
//         return res.status(201).json({
//             success: true,
//             message: 'Restaurant created successfully',
//             data: newRestaurant
//         });

//     } catch (err) {
//         console.error('Error creating restaurant:', err);
//         res.status(500).json({
//             success: false,
//             message: 'Error creating restaurant',
//             error: err.message
//         });
//     }
// };


exports.createRestaurant = async (req, res) => {
    try {
        let {
            venueName,
            country,
            city,
            managerEmail,
            tier,
            status,
            trialEndDate,

            cuisines,
            pricePoint,
            vibeTags,
            shortDescription,
            longDescription,
            website,
            googleMapsLink,
            menuLink,
            openingHours,

            instagram,
            facebook,
            tiktok,
            x
        } = req.body;

        if (typeof openingHours === "string") {
            openingHours = JSON.parse(openingHours);
        }
        if (typeof cuisines === "string") {
            cuisines = JSON.parse(cuisines);
        }
        if (typeof vibeTags === "string") {
            vibeTags = JSON.parse(vibeTags);
        }

        // REQUIRED
        if (!venueName || !country || !city || !managerEmail || !tier || !status) {
            return res.status(400).json({
                message: "Required fields missing"
            });
        }

        // Validate tier ID
        if (!mongoose.Types.ObjectId.isValid(tier)) {
            return res.status(400).json({ message: "Invalid tier ID" });
        }

        const tierExists = await Tier.findOne({
            _id: tier,
            status: "Active"
        });
        if (!tierExists) {
            return res.status(400).json({ message: "No Active Tier not found" });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(managerEmail)) {
            return res.status(400).json({ message: "Invalid manager email" });
        }

        // agar Trial hai aur date nahi di
        if (status === "Trial" && !trialEndDate) {
            return res.status(400).json({
                message: "Trial end date required for trial plan"
            });
        }

        // agar Trial nahi hai aur date di hui hai
        if (status !== "Trial" && trialEndDate) {
            return res.status(400).json({
                message: "Trial end date only allowed when status is Trial"
            });
        }

        const existingRestaurant = await Restaurant.findOne({ managerEmail });
        if (existingRestaurant) {
            return res.status(400).json({
                message: 'Manager email already in use'
            });
        }

        // STATUS & trialEndDate
        status = status.trim();
        const allowedStatus = ["Trial", "Active", "Suspended", "Locked"];
        if (!allowedStatus.includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }
        if (status === "Trial") {
            if (!trialEndDate) return res.status(400).json({ message: "Trial end date required" });
            if (new Date(trialEndDate) <= new Date()) return res.status(400).json({ message: "Trial end date must be future date" });
        } else if (trialEndDate) {
            return res.status(400).json({ message: "Trial end date only allowed when status is Trial" });
        }

        // Validate cuisines and vibeTags
        if (cuisines) {
            if (!Array.isArray(cuisines) || cuisines.length > 3) {
                return res.status(400).json({ message: "Max 3 cuisines allowed" });
            }
        }

        if (vibeTags) {
            if (!Array.isArray(vibeTags) || vibeTags.length > 3) {
                return res.status(400).json({ message: "Max 3 vibe tags allowed" });
            }
        }

        // IMAGE upload
        let heroImage = null;
        if (req.files?.heroImage?.length > 0) {
            heroImage = req.files.heroImage[0].filename;
        }

        // CREATE RESTAURANT
        const venue = new Restaurant({
            venueName: venueName.trim(),
            country: country.trim(),
            city: city.trim(),
            managerEmail: managerEmail.toLowerCase(),
            tier,
            status,
            trialEndDate,
            cuisines,
            pricePoint,
            vibeTags,
            shortDescription,
            longDescription,
            website,
            googleMapsLink,
            menuLink,
            openingHours,
            socialHandles: { instagram, facebook, tiktok, x },
            heroImage,
            createdBy: req.user?._id
        });

        await venue.save();

        // CREATE MANAGER USER if not exists
        let manager = await User.findOne({ email: managerEmail.toLowerCase() });
        if (!manager) {
            const hashed = await bcrypt.hash("Temp@123", 10);
            manager = await User.create({
                name: "Manager",
                email: managerEmail.toLowerCase(),
                password: hashed,
                role: "manager",
                restaurantId: venue._id
            });
        }

        venue.managerUserId = manager._id;
        await venue.save();

        res.status(201).json({
            success: true,
            message: "Restaurant + Manager created successfully",
            venue
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

exports.editVenue = async (req, res) => {
    try {
        let {
            venueId,
            venueName,
            address,
            googleMapsLink,
            website,
            cuisines,
            pricePoint,
            longDescription,
            createdAt
        } = req.body || {};

        if (!venueId) return res.status(400).json({ success: false, message: "venueId is required" });

        const restaurant = await Restaurant.findById(venueId);
        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: "Restaurant not found"
            });
        }

        if (!venueName || venueName.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "venueName is required"
            });
        }

        if (!address || address.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "address is required"
            });
        }

        if (!googleMapsLink || googleMapsLink.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "googleMapsLink is required"
            });
        }

        if (!website || website.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "website is required"
            });
        }

        // BASIC
        restaurant.venueName = venueName.trim();
        restaurant.city = address.trim();
        restaurant.googleMapsLink = googleMapsLink.trim();
        restaurant.website = website.trim();
        if (pricePoint) restaurant.pricePoint = pricePoint;
        if (longDescription) restaurant.longDescription = longDescription;

        // cuisines array (max 3)
        if (cuisines) {
            let cuisineArray = typeof cuisines === "string" ? JSON.parse(cuisines) : cuisines;
            if (!Array.isArray(cuisineArray)) cuisineArray = [cuisineArray];
            if (cuisineArray.length > 3) return res.status(400).json({ message: "Max 3 cuisines allowed" });
            restaurant.cuisines = cuisineArray;
        }

        if (createdAt) {
            const date = new Date(createdAt);
            if (isNaN(date.getTime())) {
                return res.status(400).json({ message: "Invalid createdAt date" });
            }
            restaurant.createdAt = date;
        }


        // image
        if (req.file) {
            // old image delete
            if (restaurant.heroImage) {
                const fs = require("fs");
                const path = require("path");

                const oldPath = path.join(
                    __dirname,
                    "../uploads/restaurants",
                    restaurant.heroImage
                );

                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }

            restaurant.heroImage = req.file.filename;
        }

        await restaurant.save();

        res.status(200).json({
            success: true,
            message: "Restaurant updated successfully"
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.opertionalMetrics = async (req, res) => {
    try {
        const { venueId } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(venueId)) {
            return res.status(400).json({ message: "Invalid venueId" });
        }

        const restaurant = await Restaurant.findById(venueId);
        if (!restaurant) {
            return res.status(404).json({ message: "Venue not found" });
        }

        // last 30 days date
        const last30 = new Date();
        last30.setDate(last30.getDate() - 30);

        // all reservations last 30 days
        const reservations = await Reservation.find({
            restaurantId: venueId,
            date: { $gte: last30 }
        });

        // total bookings
        const totalBookings = reservations.length;

        // no show
        const noShowCount = reservations.filter(
            r => r.status === "No-show"
        ).length;

        const noShowRate =
            totalBookings === 0
                ? 0
                : ((noShowCount / totalBookings) * 100).toFixed(1);

        // last booking
        const lastBooking = await Reservation.findOne({
            restaurantId: venueId
        }).sort({ date: -1 });

        // unique users
        const uniqueUsers = await Reservation.distinct("guestId", {
            restaurantId: venueId,
            guestId: { $ne: null }
        });

        let enabledFeatures = [];
        if (restaurant.tier) {
            const tier = await Tier.findById(restaurant.tier);
            if (tier && tier.features) {
                for (const [key, value] of Object.entries(tier.features)) {
                    if (value === true) enabledFeatures.push(key); // only push name
                }
            }
        }

        res.json({
            totalBookingsLast30Days: totalBookings,
            noShowRateLast30Days: Number(noShowRate),
            lastBooking: lastBooking ? lastBooking.date : null,
            uniqueRemiUsersTouched: uniqueUsers.length,
            enabledTierFeatures: enabledFeatures
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
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

        // if (updateFields.openingHours) {
        //     try {
        //         updateFields.openingHours = JSON.parse(updateFields.openingHours);
        //     } catch (e) {
        //         return res.status(400).json({
        //             success: false,
        //             message: 'Invalid JSON in openingHours',
        //             error: e.message
        //         });
        //     }
        // }

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

        /* ================= VALIDATION ================= */
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        let payload = { ...req.body };
        const shiftId = payload.id || payload._id;

        delete payload.id;
        delete payload._id;

        /* ================= DURATION LOGIC ================= */
        if (payload.sameDurationForAll) {
            delete payload.durationByPartySize;
        } else {
            delete payload.duration;
        }

        /* ================= PAYMENT LOGIC ================= */
        if (!payload.includePayment) {
            payload.payment = undefined;
        }

        let shift;

        /* ================= UPDATE ================= */
        if (shiftId) {
            shift = await Shift.findByIdAndUpdate(
                shiftId,
                payload,
                { new: true }
            );

            if (!shift) {
                return res.status(404).json({
                    success: false,
                    message: "Shift not found"
                });
            }

            return res.status(200).json({
                success: true,
                message: "Shift updated successfully",
                data: shift
            });
        }

        /* ================= CREATE ================= */
        shift = await Shift.create(payload);

        return res.status(201).json({
            success: true,
            message: "Shift created successfully",
            data: shift
        });

    } catch (error) {
        console.error("Error creating/updating shift:", error);
        res.status(500).json({
            success: false,
            message: "Error during creating/updating shift",
            error: error.message
        });
    }
};

exports.getAllShift = async (req, res) => {
    try {
        const { restaurantId, type } = req.query;

        const query = {};

        if (restaurantId) {
            if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid restaurantId",
                });
            }
            query.restaurantId = restaurantId;
        }

        if (type) {
            query.type = type;
        }

        const shiftsRaw = await Shift.find(query)
            .populate("restaurantId", "name email phone address")
            .sort({ createdAt: -1 });

        /* ===============================
           DATE TRIM FUNCTION
        =============================== */
        const formatShiftDates = (shift) => {
            const obj = shift.toObject();

            if (obj.startDate) {
                obj.startDate = new Date(obj.startDate)
                    .toISOString()
                    .split("T")[0];
            }

            if (obj.endDate) {
                obj.endDate = new Date(obj.endDate)
                    .toISOString()
                    .split("T")[0];
            }

            if (obj.createdAt) {
                obj.createdAt = new Date(obj.createdAt)
                    .toISOString()
                    .split("T")[0];
            }

            if (obj.updatedAt) {
                obj.updatedAt = new Date(obj.updatedAt)
                    .toISOString()
                    .split("T")[0];
            }

            return obj;
        };

        const shifts = shiftsRaw.map(formatShiftDates);

        return res.status(200).json({
            success: true,
            message: "Active shifts fetched successfully.",
            count: shifts.length,
            data: shifts,
        });

    } catch (error) {
        console.error("Error fetching shifts:", error.message);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message,
        });
    }
};

exports.getShiftById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid shift ID"
            });
        }

        const shift = await Shift.findById(id)
            .populate("restaurantId", "name email phone");

        if (!shift) {
            return res.status(404).json({
                success: false,
                message: "Shift not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Shift fetched successfully",
            data: shift
        });

    } catch (error) {
        console.error("Error while fetching shift:", error.message);

        return res.status(500).json({
            success: false,
            message: "Error fetching shift",
            error: error.message
        });
    }
};

exports.updateShift = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid shift ID.",
            });
        }

        const restrictedFields = ["_id", "createdAt", "updatedAt"];
        restrictedFields.forEach(field => delete req.body[field]);

        const updatedShift = await Shift.findByIdAndUpdate(
            id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updatedShift) {
            return res.status(404).json({
                success: false,
                message: "Shift not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Shift updated successfully.",
            data: updatedShift,
        });

    } catch (error) {
        console.error("Error while updating shift:", error.message);

        return res.status(500).json({
            success: false,
            message: "Error while updating shift.",
            error: error.message,
        });
    }
};

exports.deleteShift = async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Shift ID is required in body.",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid shift ID.",
            });
        }

        const deletedShift = await Shift.findByIdAndDelete(id);

        if (!deletedShift) {
            return res.status(404).json({
                success: false,
                message: "Shift not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Shift deleted successfully.",
        });

    } catch (error) {
        console.error("Error deleting shift:", error.message);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message,
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

exports.getRestaurantSlots = async (req, res) => {
    try {

        const { restaurantId, date, partySize = 1 } = req.body;

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "restaurantId is required"
            });
        }

        if (!date) {
            return res.status(400).json({
                success: false,
                message: "Date is required"
            });
        }

        const selectedDate = moment(date, "YYYY-MM-DD", true);

        if (!selectedDate.isValid()) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format. Use YYYY-MM-DD"
            });
        }

        const now = moment();

        /* ================= FETCH ACTIVE SHIFTS ================= */

        const shifts = await Shift.find({
            restaurantId,
            isActive: true
        }).sort({ startTime: 1 });

        if (!shifts.length) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        const selectedDay = selectedDate.format("dd"); // Mo, Tu, We...

        let groupedSlots = [];

        for (let shift of shifts) {

            /* ================= DAY CHECK (Recurring Only) ================= */

            const isRecurringValid =
                shift.type === "Recurring" &&
                (!shift.daysActive?.length || shift.daysActive.includes(selectedDay)) &&
                (!shift.startDate || !selectedDate.isBefore(moment(shift.startDate), "day")) &&
                (shift.isIndefinite ||
                    !shift.endDate ||
                    !selectedDate.isAfter(moment(shift.endDate), "day"));

            const isSpecialValid =
                shift.type === "Special" &&
                shift.startDate &&
                !selectedDate.isBefore(moment(shift.startDate), "day") &&
                (!shift.endDate ||
                    !selectedDate.isAfter(moment(shift.endDate), "day"));

            if (!isRecurringValid && !isSpecialValid) {
                continue;
            }
            /* ================= DATE RANGE CHECK ================= */

            if (shift.startDate && selectedDate.isBefore(moment(shift.startDate), "day")) {
                continue;
            }

            if (!shift.isIndefinite && shift.endDate &&
                selectedDate.isAfter(moment(shift.endDate), "day")) {
                continue;
            }

            /* ================= ADVANCE BOOKING WINDOW ================= */

            if (shift.advanceBookingWindow) {
                const maxAllowedDate = now.clone().add(shift.advanceBookingWindow, "days");
                if (selectedDate.isAfter(maxAllowedDate, "day")) {
                    continue;
                }
            }

            /* ================= DURATION LOGIC ================= */

            let duration = shift.duration;

            if (!shift.sameDurationForAll && shift.durationByPartySize?.length) {
                const rule = shift.durationByPartySize.find(r => {
                    const [min, max] = r.range.split("-").map(Number);
                    return partySize >= min && partySize <= max;
                });
                if (rule) duration = rule.duration;
            }

            if (!duration) continue;

            /* ================= SLOT GENERATION ================= */

            let shiftSlots = [];

            let start = moment(
                `${date} ${shift.startTime}`,
                "YYYY-MM-DD HH:mm"
            );

            let end = moment(
                `${date} ${shift.endTime}`,
                "YYYY-MM-DD HH:mm"
            );

            while (
                start.clone().add(duration + shift.bufferTime, "minutes")
                    .isSameOrBefore(end)
            ) {

                /* ---------- Lead Time Check ---------- */
                if (shift.leadTime) {
                    const minAllowedTime = now.clone().add(shift.leadTime, "minutes");
                    if (start.isBefore(minAllowedTime)) {
                        start.add(shift.slotInterval, "minutes");
                        continue;
                    }
                }

                shiftSlots.push({
                    startTime: start.format("HH:mm"),                 // 24H format
                    // startTime: start.format("hh:mm A"),            // 12H format
                    // endTime: start.clone().add(duration, "minutes").format("hh:mm A")
                });

                start.add(shift.slotInterval, "minutes");
            }

            if (shiftSlots.length > 0) {
                groupedSlots.push({
                    shiftId: shift._id,
                    shiftName: shift.name,
                    shiftType: shift.type,
                    slots: shiftSlots
                });
            }
        }

        return res.status(200).json({
            success: true,
            restaurantId,
            date,
            totalShifts: groupedSlots.length,
            data: groupedSlots
        });

    } catch (error) {
        console.error("Restaurant slot generation error:", error);
        res.status(500).json({
            success: false,
            message: "Error generating restaurant slots",
            error: error.message
        });
    }
};

exports.getVenueList = async (req, res) => {
    try {
        let sortStage = { remiId: 1 }; // default ASC

        const venues = await Restaurant.aggregate([

            // 🔗 join reservations for last booking
            {
                $lookup: {
                    from: "reservations",
                    localField: "_id",
                    foreignField: "restaurantId",
                    as: "reservations"
                }
            },

            {
                $addFields: {
                    lastBookingRaw: { $max: "$reservations.createdAt" }
                }
            },

            {
                $addFields: {
                    lastBooking: {
                        $cond: [
                            { $ifNull: ["$lastBookingRaw", false] },
                            {
                                $dateToString: {
                                    format: "%B %d, %Y",
                                    date: "$lastBookingRaw",
                                    timezone: "Asia/Kolkata"
                                }
                            },
                            "-"
                        ]
                    }
                }
            },

            // ⏳ trial days left
            {
                $addFields: {
                    trialDaysLeft: {
                        $cond: [
                            { $ifNull: ["$trialEndDate", false] },
                            {
                                $max: [
                                    {
                                        $dateDiff: {
                                            startDate: "$$NOW",
                                            endDate: "$trialEndDate",
                                            unit: "day"
                                        }
                                    },
                                    0
                                ]
                            },
                            null
                        ]
                    }
                }
            },

            // 🔗 join Tier collection to get tierName
            {
                $lookup: {
                    from: "tiers",           // collection name
                    localField: "tier",
                    foreignField: "_id",
                    as: "tierData"
                }
            },
            { $unwind: { path: "$tierData", preserveNullAndEmptyArrays: true } },
            { $addFields: { tierName: "$tierData.tierName" } },

            // ✅ select only required fields
            {
                $project: {
                    venueName: 1,
                    remiId: 1,
                    city: 1,
                    tierName: 1,
                    status: 1,
                    googleMapsLink: 1,
                    website: 1,
                    managerEmail: 1,
                    lastBooking: 1,
                    cuisines: 1,
                    heroImage: {
                        $cond: [
                            { $ifNull: ["$heroImage", false] },
                            { $concat: [process.env.BASE_URL, "/uploads/restaurants/others/", "$heroImage"] },
                            null
                        ]
                    },
                    pricePoint: 1,
                    longDescription: 1,
                    createdAt: 1,
                    trialDaysLeft: 1
                }
            },

            { $sort: sortStage }

        ]);

        res.json({
            success: true,
            count: venues.length,
            data: venues
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.editVenuePlanAndStatus = async (req, res) => {
    try {
        const {
            venueId,
            tier,                  // Plan / Tier (ObjectId)
            status,                // Trial, Active, Suspended, Locked
            trialEndDate,          // Required if Trial
            billingEmail,          // Optional
        } = req.body;

        if (!venueId || !mongoose.Types.ObjectId.isValid(venueId)) {
            return res.status(400).json({ success: false, message: "Invalid venueId" });
        }

        const venue = await Restaurant.findById(venueId);
        if (!venue) {
            return res.status(404).json({ success: false, message: "Venue not found" });
        }

        if (!tier || !status || !billingEmail) {
            return res.status(400).json({
                success: false,
                message: "Requried filled is missing"
            })
        }

        if (tier) {
            if (!mongoose.Types.ObjectId.isValid(tier)) {
                return res.status(400).json({ success: false, message: "Invalid Tier ID" });
            }
            const tierExists = await Tier.findById(tier);
            if (!tierExists) {
                return res.status(400).json({ success: false, message: "Tier not found" });
            }
            venue.tier = tier;
        }

        const allowedStatus = ["Trial", "Active", "Suspended", "Locked"];
        if (status) {
            if (!allowedStatus.includes(status)) {
                return res.status(400).json({ success: false, message: "Invalid status" });
            }
            venue.status = status;
        }

        //  Validate Trial End Date
        if (status === "Trial") {
            if (!trialEndDate) {
                return res.status(400).json({ success: false, message: "Trial End Date is required for Trial status" });
            }
            const trialDate = new Date(trialEndDate);
            if (isNaN(trialDate.getTime()) || trialDate <= new Date()) {
                return res.status(400).json({ success: false, message: "Trial End Date must be a valid future date" });
            }
            venue.trialEndDate = trialDate;
        } else {
            // Remove trialEndDate if status is not Trial
            venue.trialEndDate = undefined;
        }

        //  Billing info
        if (billingEmail) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(billingEmail)) {
                return res.status(400).json({ success: false, message: "Invalid billing email" });
            }
            venue.billingEmail = billingEmail.toLowerCase();
        }

        await venue.save();

        res.status(200).json({
            success: true,
            message: "Venue plan and status updated",
            venue
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}



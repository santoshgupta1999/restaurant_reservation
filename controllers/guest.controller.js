const { default: mongoose } = require("mongoose");
const Guest = require("../models/guest.model");
const Reservation = require('../models/reservation.model');
const Table = require('../models/table.model');
const Restaurant = require('../models/Restaurant.model');
const { formatDate } = require('../utils/dateFormatter');

const formatTimeRange = (time) => {
    if (!time) return null;

    const [h, m] = time.split(":").map(Number);
    const start = new Date();
    start.setHours(h, m, 0);

    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    const opt = { hour: "numeric", minute: "2-digit", hour12: true };
    return `${start.toLocaleTimeString("en-US", opt)}–${end.toLocaleTimeString("en-US", opt)}`;
};

const formatDateDDMMYYYY = (date) => {
    if (!date) return null;

    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();

    return `${day}/${month}/${year}`;
};

exports.createGuest = async (req, res) => {
    try {
        const {
            restaurantId,
            firstName,
            lastName,
            gender,
            dob,
            email,
            countryCode,
            phone,
            notes,
            tags,
            jobTitle,
            preffered,
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
            countryCode,
            notes,
            tags,
            jobTitle,
            preffered,
            company
        });

        return res.status(201).json({
            success: true,
            message: "Guest created successfully"
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
            isActive,
            tags,
            sortBy = "createdAt",
            order = "desc"
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid restaurantId"
            });
        }

        const sortOrder = order === "asc" ? 1 : -1;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let match = {
            restaurantId: new mongoose.Types.ObjectId(restaurantId)
        };

        if (isActive !== undefined) match.isActive = isActive;
        if (tags?.length) match.tags = { $in: tags };

        const validStatuses = ["Seated", "Finished"];

        const guests = await Guest.aggregate([
            { $match: match },

            /* ================= LAST 3 VISITS ================= */
            {
                $lookup: {
                    from: "reservations",
                    let: { guestId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$guestId", "$$guestId"] },
                                        { $eq: ["$restaurantId", new mongoose.Types.ObjectId(restaurantId)] },
                                        { $in: ["$status", validStatuses] },
                                        { $lte: ["$date", today] }
                                    ]
                                }
                            }
                        },
                        { $sort: { date: -1 } },
                        { $limit: 3 },
                        {
                            $lookup: {
                                from: "tables",
                                localField: "tableId",
                                foreignField: "_id",
                                as: "table"
                            }
                        },
                        { $unwind: { path: "$table", preserveNullAndEmptyArrays: true } }
                    ],
                    as: "last3Visits"
                }
            },

            /* ================= UPCOMING VISITS ================= */
            {
                $lookup: {
                    from: "reservations",
                    let: { guestId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$guestId", "$$guestId"] },
                                        { $eq: ["$restaurantId", new mongoose.Types.ObjectId(restaurantId)] },
                                        { $in: ["$status", ["Pending", "Confirmed"]] },
                                        { $gt: ["$date", today] }
                                    ]
                                }
                            }
                        },
                        { $sort: { date: 1 } }
                    ],
                    as: "upcomingVisits"
                }
            },

            /* ================= TOTAL VISITS ================= */
            {
                $lookup: {
                    from: "reservations",
                    let: { guestId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$guestId", "$$guestId"] },
                                        { $eq: ["$restaurantId", new mongoose.Types.ObjectId(restaurantId)] },
                                        { $in: ["$status", validStatuses] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "allVisits"
                }
            },

            /* ================= CALCULATED FIELDS ================= */
            {
                $addFields: {
                    totalVisits: { $size: "$allVisits" },

                    lastVisit: {
                        $cond: [
                            { $gt: [{ $size: "$last3Visits" }, 0] },
                            { $arrayElemAt: ["$last3Visits.date", 0] },
                            null
                        ]
                    },

                    upcomingVisitAt: {
                        $cond: [
                            { $gt: [{ $size: "$upcomingVisits" }, 0] },
                            { $arrayElemAt: ["$upcomingVisits.date", 0] },
                            null
                        ]
                    }
                }
            },

            { $project: { allVisits: 0 } },

            { $sort: { [sortBy]: sortOrder } }
        ]);

        const formattedGuests = guests.map(g => {
            const lastVisits = g.last3Visits.map(v => ({
                date: formatDate(v.date),
                time: formatTimeRange(v.time),
                pax: v.partySize,
                table: v.table?.tableNumber || null
            }));

            const upcoming = g.upcomingVisits.map(v => ({
                date: formatDate(v.date),
                time: formatTimeRange(v.time),
                pax: v.partySize
            }));

            return {
                ...g,

                createdAt: formatDate(g.createdAt),
                updatedAt: formatDate(g.updatedAt),
                dob: formatDate(g.dob),

                last3Visits: lastVisits,

                lastVisit: formatDate(g.lastVisit),
                upcomingVisitAt: formatDate(g.upcomingVisitAt),

                upcomingVisits: upcoming,

                upcomingVisitAt: upcoming.length
                    ? upcoming[0].date
                    : null
            };
        });

        return res.status(200).json({
            success: true,
            message: "Guest list fetched successfully",
            Total: formattedGuests.length,
            data: formattedGuests
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

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid guestId"
            });
        }

        /* ================= GUEST ================= */
        const guest = await Guest.findById(id);

        if (!guest) {
            return res.status(404).json({
                success: false,
                message: "Guest not found"
            });
        }

        /* ================= RESERVATIONS ================= */
        const reservations = await Reservation.find({
            guestId: id
        })
            .sort({ date: -1 })
            .populate("restaurantId", "venueName")
            .populate("tableId", "tableNumber")
            .lean();

        const validStatuses = ["Seated", "Finished"];

        const totalVisits = reservations.filter(r =>
            validStatuses.includes(r.status)
        ).length;

        /* ================= LAST VISIT ================= */
        const lastVisitObj = reservations.find(r =>
            validStatuses.includes(r.status)
        );

        const lastVisit = lastVisitObj
            ? formatDate(lastVisitObj.date)
            : null;

        /* ================= UPCOMING VISIT ================= */
        const upcomingVisitObj = reservations.find(r =>
            ["Pending", "Confirmed"].includes(r.status) &&
            new Date(r.date) > new Date()
        );

        const upcomingVisit = upcomingVisitObj
            ? formatDate(upcomingVisitObj.date)
            : null;

        /* ================= LAST 3 VISITS ================= */
        const last3Visits = reservations
            .filter(r => validStatuses.includes(r.status))
            .slice(0, 3)
            .map(r => ({
                date: formatDate(r.date),
                time: formatTimeRange(r.time),
                pax: r.partySize,
                table: r.tableId?.tableNumber || null,
                restaurant: r.restaurantId?.venueName || null
            }));

        const guestObj = guest.toObject();
        guestObj.dob = formatDate(guestObj.dob);

        /* ================= RESPONSE ================= */
        return res.status(200).json({
            success: true,
            message: "Guest full details fetched successfully",
            data: {
                guest: guestObj,
                insights: {
                    totalVisits,
                    lastVisit,
                    upcomingVisit,
                    last3Visits,
                    preferences: {
                        smoking: guest.smokingPreference || "Non smoking",
                        seating: guest.seatingPreference || "Indoor",
                        occasion: guest.occasion || null
                    }
                }
            }
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
            "countryCode",
            "notes",
            "tags",
            "jobTitle",
            "preffered",
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

        const guest = await Guest.findByIdAndDelete(id);

        if (!guest) {
            return res.status(404).json({
                success: false,
                message: "Guest not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Guest deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting guest:", error);
        return res.status(500).json({
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

exports.getRemiUsersList = async (req, res) => {
    try {

        const pipeline = [
            //  Only users jinke paas remiId hai
            {
                $match: {
                    remiId: { $exists: true, $ne: null }
                }
            },

            //  Reservations lookup (for stats)
            {
                $lookup: {
                    from: "reservations",
                    localField: "_id",
                    foreignField: "guestId",
                    as: "reservations"
                }
            },

            //  Stats calculate
            {
                $addFields: {
                    visits: { $size: "$reservations" },
                    venues: {
                        $size: {
                            $setUnion: ["$reservations.restaurantId", []]
                        }
                    },
                    lastVisit: { $max: "$reservations.date" },
                    noShows: {
                        $size: {
                            $filter: {
                                input: "$reservations",
                                as: "r",
                                cond: { $eq: ["$$r.status", "No-Show"] }
                            }
                        }
                    }
                }
            },

            //  Response fields
            {
                $project: {
                    guestId: "$_id",
                    restaurantId: "$restaurantId",

                    firstName: 1,
                    lastName: 1,
                    email: 1,
                    secondaryEmail: 1,
                    phone: 1,
                    countryCode: 1,
                    secondaryPhone: 1,
                    address: 1,
                    gender: 1,
                    marketingOptIn: 1,

                    name: { $concat: ["$firstName", " ", "$lastName"] },

                    remiId: 1,
                    visits: 1,
                    venues: 1,
                    noShows: 1,

                    dob: {
                        $cond: [
                            { $ifNull: ["$dob", false] },
                            { $dateToString: { format: "%Y-%m-%d", date: "$dob" } },
                            null
                        ]
                    },

                    anniversary: {
                        $cond: [
                            { $ifNull: ["$anniversary", false] },
                            { $dateToString: { format: "%Y-%m-%d", date: "$anniversary" } },
                            null
                        ]
                    },

                    createdAt: {
                        $cond: [
                            { $ifNull: ["$createdAt", false] },
                            { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                            null
                        ]
                    },

                    lastVisit: {
                        $cond: [
                            { $ifNull: ["$lastVisit", false] },
                            { $dateToString: { format: "%Y-%m-%d", date: "$lastVisit" } },
                            null
                        ]
                    },

                    _id: 0
                }
            },

            //  REMIID SORT (IMPORTANT)
            { $sort: { remiId: 1 } },
        ];

        const [data, total] = await Promise.all([
            Guest.aggregate(pipeline),
            Guest.countDocuments({ remiId: { $exists: true, $ne: null } })
        ]);

        return res.status(200).json({
            success: true,
            message: "Remi users fetched successfully",
            total,
            data
        });

    } catch (error) {
        console.error("Remi Users List Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch Remi users list",
            error: error.message
        });
    }
};

exports.editGuest = async (req, res) => {
    try {
        const {
            guestId,
            restaurantId,

            firstName,
            lastName,
            gender,
            dob,
            anniversary,

            email,
            secondaryEmail,
            phone,
            secondaryPhone,
            address,
            createdAt,

            notes,
            tags,
            jobTitle,
            company,
            preffered,
            marketingOptIn,

            isActive
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(guestId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid guestId"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid restaurantId"
            });
        }

        const guest = await Guest.findOne({
            _id: guestId,
            restaurantId
        });

        if (!guest) {
            return res.status(404).json({
                success: false,
                message: "Guest not found"
            });
        }

        if (firstName !== undefined) guest.firstName = firstName;
        if (lastName !== undefined) guest.lastName = lastName;
        if (gender !== undefined) guest.gender = gender;

        if (dob !== undefined) guest.dob = dob;
        if (anniversary !== undefined) guest.anniversary = anniversary;

        if (email !== undefined) guest.email = email;
        if (secondaryEmail !== undefined) guest.secondaryEmail = secondaryEmail;

        if (phone !== undefined) guest.phone = phone;
        if (secondaryPhone !== undefined) guest.secondaryPhone = secondaryPhone;

        if (address !== undefined) guest.address = address;

        if (notes !== undefined) guest.notes = notes;
        if (tags !== undefined) guest.tags = tags;

        if (jobTitle !== undefined) guest.jobTitle = jobTitle;
        if (company !== undefined) guest.company = company;
        if (preffered !== undefined) guest.preffered = preffered;

        if (marketingOptIn !== undefined) guest.marketingOptIn = marketingOptIn;

        if (isActive !== undefined) guest.isActive = isActive;
        if (createdAt !== undefined) guest.createdAt = createdAt;

        await guest.save();

        return res.status(200).json({
            success: true,
            message: "Guest updated successfully",
            data: guest
        });

    } catch (error) {
        console.error("Edit guest error:", error);
        return res.status(500).json({
            success: false,
            message: "Error updating guest",
            error: error.message
        });
    }
};

exports.getCrossVenue = async (req, res) => {
    try {
        const { guestId } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(guestId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid guestId"
            });
        }

        const data = await Reservation.aggregate([
            //  Guest filter
            {
                $match: {
                    guestId: new mongoose.Types.ObjectId(guestId)
                }
            },

            //  Restaurant ke hisaab se group
            {
                $group: {
                    _id: "$restaurantId",
                    visits: { $sum: 1 },
                    lastVisit: { $max: "$date" },
                    noShows: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "No-Show"] }, 1, 0]
                        }
                    }
                }
            },

            //  Restaurant details lao
            {
                $lookup: {
                    from: "restaurants",
                    localField: "_id",
                    foreignField: "_id",
                    as: "restaurant"
                }
            },

            { $unwind: "$restaurant" },

            //  Final response format
            {
                $project: {
                    _id: 1,
                    // restaurantId: "$restaurant._id",
                    restaurantName: "$restaurant.venueName",
                    visits: 1,
                    noShows: 1,
                    lastVisit: {
                        $dateToString: {
                            format: "%d/%m/%Y",
                            date: "$lastVisit"
                        }
                    }
                }
            },

            //  Sort (optional)
            { $sort: { visits: -1 } }
        ]);

        return res.status(200).json({
            success: true,
            message: "Cross venue fetched successfully",
            count: data.length,
            data
        });

    } catch (error) {
        console.error("Guest booking summary error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch guest booking summary",
            error: error.message
        });
    }
};

exports.getGlobalVisit = async (req, res) => {
    try {
        const { guestId } = req.body || {};

        if (!guestId) {
            return res.status(400).json({
                success: false,
                message: "guestId is required"
            });
        }

        const reservations = await Reservation.find({ guestId })
            .select("_id date restaurantId partySize source status tableId")
            .populate("restaurantId", "venueName")
            .populate("tableId", "tableNumber")
            .sort({ date: 1 });

        const formattedData = reservations.map(d => ({
            id: d._id,

            date: d.date
                ? d.date.toISOString().split("T")[0]
                : null,

            restaurantName: d.restaurantId?.venueName || null,
            partySize: d.partySize,
            source: d.source,
            status: d.status,
            tableNo: d.tableId?.tableNumber || null
        }));

        return res.status(200).json({
            success: true,
            message: "Global visits fetched successfully",
            count: formattedData.length,
            data: formattedData
        });

    } catch (error) {
        console.error("Get Global Visit Error:", error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getRemiUserDashboard = async (req, res) => {
    try {
        const { guestId } = req.body;

        if (!guestId) {
            return res.status(400).json({ message: "guestId required" });
        }

        const id = new mongoose.Types.ObjectId(guestId);

        const totalReservations = await Reservation.countDocuments({ guestId: id });

        const totalVisits = await Reservation.countDocuments({
            guestId: id,
            status: "Finished"
        });

        const noShow = await Reservation.countDocuments({
            guestId: id,
            status: "No-Show"
        });

        const venues = await Reservation.distinct("restaurantId", {
            guestId: id
        });

        const channels = await Reservation.aggregate([
            { $match: { guestId: id } },
            {
                $group: {
                    _id: "$source",
                    count: { $sum: 1 }
                }
            }
        ]);


        const result = channels.map(i => ({
            source: i._id,
            percentage: ((i.count / totalReservations) * 100).toFixed(1) + "%"
        }));

        res.json({
            success: true,
            data: {
                totalVisits,
                totalVenuesVisited: venues.length,
                noShow,
                totalReservations,
                topChannels: result
            }
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getGuestDetails = async (req, res) => {
    try {
        const { phone, restaurantId, countryCode } = req.body;

        /* ================= VALIDATION ================= */

        if (!phone || !restaurantId) {
            return res.status(400).json({
                success: false,
                message: "phone and restaurantId are required"
            });
        }

        if (!countryCode) {
            return res.status(400).json({
                success: false,
                message: "countryCode is required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid restaurantId"
            });
        }

        const normalizedPhone = phone.trim();
        const normalizedCode = countryCode ? countryCode.trim() : undefined;

        /* ================= QUERY ================= */

        const query = {
            restaurantId,
            phone: normalizedPhone
        };

        // Optional: countryCode bhi match karo agar bheja ho
        if (normalizedCode) {
            query.countryCode = normalizedCode;
        }

        const guest = await Guest.findOne(query)
            .select("-__v")
            .lean();

        if (!guest) {
            return res.status(404).json({
                success: false,
                message: "Guest not found"
            });
        }

        /* ================= RESPONSE ================= */

        return res.status(200).json({
            success: true,
            message: "Guest details fetched successfully",
            data: {
                id: guest._id,
                remiId: guest.remiId,
                firstName: guest.firstName,
                lastName: guest.lastName,
                email: guest.email,
                phone: guest.phone,
                countryCode: guest.countryCode,
                gender: guest.gender,
                dob: formatDate(guest.dob),
                anniversary: guest.anniversary,
                totalVisits: guest.totalVisits,
                lastVisitAt: formatDate(guest.lastVisitAt),
                upcomingVisitAt: formatDate(guest.upcomingVisitAt),
                tags: guest.tags,
                notes: guest.notes,
                isActive: guest.isActive
            }
        });

    } catch (error) {
        console.error("getGuestDetails error:", error);

        return res.status(500).json({
            success: false,
            message: "Error fetching guest details",
            error: error.message
        });
    }
};

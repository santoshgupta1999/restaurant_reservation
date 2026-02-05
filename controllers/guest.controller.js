const { default: mongoose } = require("mongoose");
const Guest = require("../models/guest.model");
const Reservation = require('../models/reservation.model');
const Table = require('../models/table.model');
const Restaurant = require('../models/Restaurant.model');

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
            sortBy = "firstName",
            order = "asc"
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

        const guests = await Guest.aggregate([
            { $match: match },

            /* ================= LAST 3 VISITS (PAST ONLY) ================= */
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
                                        { $in: ["$status", ["Confirmed", "Completed"]] },
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

            /* ================= UPCOMING VISITS (FUTURE ONLY) ================= */
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
                                        { $eq: ["$restaurantId", new mongoose.Types.ObjectId(restaurantId)] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "allVisits"
                }
            },

            {
                $addFields: {
                    totalVisits: { $size: "$allVisits" }
                }
            },

            { $project: { allVisits: 0 } },
            { $sort: { [sortBy]: sortOrder } }
        ]);

        /* ================= DATE TRIM HELPER ================= */
        const trimDate = (val) =>
            val ? new Date(val).toISOString().split("T")[0] : null;

        /* ================= NODE FORMAT ================= */
        const formattedGuests = guests.map(g => {
            const lastVisits = g.last3Visits.map(v => ({
                date: trimDate(v.date),
                time: formatTimeRange(v.time),
                pax: v.partySize,
                table: v.table?.tableNumber || null
            }));

            const upcoming = g.upcomingVisits.map(v => ({
                date: trimDate(v.date),
                time: formatTimeRange(v.time),
                pax: v.partySize
            }));

            return {
                ...g,
                createdAt: trimDate(g.createdAt),
                updatedAt: trimDate(g.updatedAt),
                dob: trimDate(g.dob),

                last3Visits: lastVisits,
                lastVisit: lastVisits.length ? lastVisits[0].date : null,

                upcomingVisits: upcoming,
                upcomingVisitAt: upcoming.length ? upcoming[0].date : null
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
            .sort({ reservationDate: -1 })
            .populate("restaurantId", "name")
            .lean();

        const totalVisits = reservations.length;

        /* ================= LAST VISIT ================= */
        const lastVisit = reservations.find(r => r.status === "Completed");

        /* ================= UPCOMING VISIT ================= */
        const upcomingVisit = reservations.find(
            r => new Date(r.reservationDate) > new Date()
        );

        /* ================= LAST 3 VISITS ================= */
        const last3Visits = reservations
            .filter(r => r.status === "Completed")
            .slice(0, 3)
            .map(r => ({
                date: r.reservationDate,
                time: `${r.startTime} - ${r.endTime}`,
                pax: r.partySize,
                table: r.tableNo || null,
                restaurant: r.restaurantId?.name || null
            }));

        /* ================= RESPONSE ================= */
        return res.status(200).json({
            success: true,
            message: "Guest full details fetched successfully",
            data: {
                guest,
                insights: {
                    totalVisits,
                    lastVisit: lastVisit ? lastVisit.reservationDate : null,
                    upcomingVisit: upcomingVisit ? upcomingVisit.reservationDate : null,
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

// exports.getRemiUsersList = async (req, res) => {
//     try {
//         const {
//             search = "",
//             page = 1,
//             limit = 30,
//             dateFrom,
//             dateTo,
//             minVisits,
//             maxNoShows
//         } = req.body;

//         const skip = (page - 1) * limit;
//         const REMI_REGEX = /(Remi user|Remi influencer)/i;

//         const matchGuest = {
//             tags: { $elemMatch: { $regex: REMI_REGEX } }
//         };

//         if (search) {
//             matchGuest.$or = [
//                 { firstName: { $regex: search, $options: "i" } },
//                 { lastName: { $regex: search, $options: "i" } },
//                 { email: { $regex: search, $options: "i" } },
//                 { phone: { $regex: search, $options: "i" } }
//             ];
//         }

//         const reservationMatch = {};
//         if (dateFrom && dateTo) {
//             reservationMatch.date = {
//                 $gte: new Date(dateFrom),
//                 $lte: new Date(dateTo)
//             };
//         }

//         const pipeline = [
//             { $match: matchGuest },

//             {
//                 $lookup: {
//                     from: "reservations",
//                     localField: "_id",
//                     foreignField: "guestId",
//                     pipeline: [
//                         { $match: reservationMatch }
//                     ],
//                     as: "reservations"
//                 }
//             },

//             {
//                 $addFields: {
//                     visits: { $size: "$reservations" },
//                     venues: {
//                         $size: {
//                             $setUnion: ["$reservations.restaurantId", []]
//                         }
//                     },
//                     lastVisit: { $max: "$reservations.date" },
//                     noShows: {
//                         $size: {
//                             $filter: {
//                                 input: "$reservations",
//                                 as: "r",
//                                 cond: { $eq: ["$$r.status", "No-show"] }
//                             }
//                         }
//                     }
//                 }
//             },

//             ...(minVisits ? [{ $match: { visits: { $gte: minVisits } } }] : []),
//             ...(maxNoShows ? [{ $match: { noShows: { $lte: maxNoShows } } }] : []),

//             // {
//             //     $project: {
//             //         guestId: "$_id",
//             //         restaurantId: "$restaurantId",
//             //         name: { $concat: ["$firstName", " ", "$lastName"] },
//             //         remiId: 1,
//             //         email: 1,
//             //         phone: 1,
//             //         visits: 1,
//             //         venues: 1,
//             //         lastVisit: 1,
//             //         noShows: 1,
//             //         _id: 0
//             //     }
//             // },

//             {
//                 $project: {
//                     guestId: "$_id",

//                     // 👇 BASIC USER INFO
//                     firstName: 1,
//                     lastName: 1,
//                     email: 1,
//                     secondaryEmail: 1,
//                     phone: 1,
//                     secondaryPhone: 1,
//                     dob: 1,
//                     address: 1,
//                     anniversary: 1,
//                     gender: 1,
//                     createdAt: 1,
//                     marketingOptIn: 1,

//                     // 👇 OPTIONAL (agar frontend ko name chahiye)
//                     name: { $concat: ["$firstName", " ", "$lastName"] },

//                     // 👇 REMI / STATS
//                     remiId: 1,
//                     visits: 1,
//                     venues: 1,
//                     lastVisit: 1,
//                     noShows: 1,

//                     _id: 0
//                 }
//             },

//             { $sort: { visits: -1 } },
//             { $skip: skip },
//             { $limit: Number(limit) }
//         ];

//         const [data, total] = await Promise.all([
//             Guest.aggregate(pipeline),
//             Guest.countDocuments(matchGuest)
//         ]);

//         return res.json({
//             success: true,
//             total,
//             page: Number(page),
//             limit: Number(limit),
//             data
//         });

//     } catch (error) {
//         console.error("Remi Users List Error:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to fetch Remi users list",
//             error: error.message
//         });
//     }
// };

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
                                cond: { $eq: ["$$r.status", "No-show"] }
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
                            $cond: [{ $eq: ["$status", "No-show"] }, 1, 0]
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

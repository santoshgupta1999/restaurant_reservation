const Restaurant = require("../models/Restaurant.model");
const Tier = require("../models/Tier");
const Reservation = require("../models/reservation.model");
const Guest = require("../models/guest.model");

exports.getVenues = async (req, res) => {
    try {

        const baseQuery = { isDeleted: false };

        //  Dates
        const now = new Date();
        const last30Days = new Date(now);
        last30Days.setDate(now.getDate() - 30);

        const prev30Days = new Date(now);
        prev30Days.setDate(now.getDate() - 60);

        const next7 = new Date(now);
        next7.setDate(now.getDate() + 7);

        //  PARALLEL MAIN COUNTS
        const [
            totalVenues,
            activeVenues,
            trialVenues,
            suspendedVenues,
            lockedVenues,
            tiers,
            newLast30,
            newPrev30
        ] = await Promise.all([

            Restaurant.countDocuments(baseQuery),

            Restaurant.countDocuments({ ...baseQuery, status: "Active" }),
            Restaurant.countDocuments({ ...baseQuery, status: "Trial" }),
            Restaurant.countDocuments({ ...baseQuery, status: "Suspended" }),
            Restaurant.countDocuments({ ...baseQuery, status: "Locked" }),

            Tier.find({ status: "Active" }).select("_id tierName"),

            Restaurant.countDocuments({
                ...baseQuery,
                createdAt: { $gte: last30Days }
            }),

            Restaurant.countDocuments({
                ...baseQuery,
                createdAt: { $gte: prev30Days, $lt: last30Days }
            })
        ]);

        //  TIER COUNTS PARALLEL
        const venuesByTier = await Promise.all(
            tiers.map(async (t) => {
                const count = await Restaurant.countDocuments({
                    ...baseQuery,
                    tier: t._id
                });

                return { tierName: t.tierName, count };
            })
        );

        //  TREND %
        let trend = 0;
        if (newPrev30 > 0) {
            trend = ((newLast30 - newPrev30) / newPrev30) * 100;
        }

        //  TREND CALC
        let trendPercent = 0;
        let trendType = "no-change"; // increase | decrease | no-change
        let difference = newLast30 - newPrev30;

        if (newPrev30 === 0 && newLast30 > 0) {
            trendPercent = 100;
            trendType = "increase";
        }
        else if (newPrev30 > 0) {
            trendPercent = ((difference) / newPrev30) * 100;

            if (difference > 0) trendType = "increase";
            else if (difference < 0) trendType = "decrease";
            else trendType = "no-change";
        }

        const restaurants = await Restaurant.find({
            status: "Trial",
            trialEndDate: { $gte: now, $lte: next7 },
            isDeleted: false
        }).lean();

        return res.status(200).json({
            success: true,
            message: "Venues fetched successfully",
            data: {

                totalVenues: {
                    totalVenues,
                    activeVenues,
                    trialVenues,
                    suspendedVenues,
                    lockedVenues
                },

                venuesByTier,

                newVenues: {
                    last30Days: newLast30,
                    trendPercent: Number(Math.abs(trendPercent).toFixed(1)),
                    trendType         // +5 ya -3
                },

                TrialEnd: restaurants.length

            }
        });

    } catch (error) {
        console.error("DASHBOARD ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

exports.getBooking24hTrend = async (req, res) => {
    try {
        const now = new Date();

        const last24 = new Date(now.getTime() - 24 * 60 * 60 * 1000); // last 24h

        // venue timezone: yaha 'Asia/Kolkata' ya venue.timezone dynamic ho sakta hai
        const timezone = "Asia/Kolkata";

        const bookings = await Reservation.aggregate([
            {
                $match: {
                    createdAt: { $gte: last24 }
                }
            },
            {
                $group: {
                    _id: {
                        $hour: {
                            date: "$createdAt",
                            timezone: timezone // 🟢 important
                        }
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        let result = [];

        for (let i = 0; i < 24; i++) {
            const found = bookings.find(b => b._id === i);
            result.push({
                hour: i,
                // label: `${i}:00-${i}:59`,
                count: found ? found.count : 0
            });
        }

        res.json({ success: true, data: result });

    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false });
    }
};

exports.getBookingKPIs = async (req, res) => {
    try {

        const now = new Date();

        // ---------- TODAY ----------
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(todayStart.getDate() - 1);

        const yesterdayEnd = new Date(todayEnd);
        yesterdayEnd.setDate(todayEnd.getDate() - 1);

        // ---------- WEEK ----------
        const day = now.getDay() || 7;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - day + 1);
        weekStart.setHours(0, 0, 0, 0);

        const prevWeekStart = new Date(weekStart);
        prevWeekStart.setDate(weekStart.getDate() - 7);

        const prevWeekEnd = new Date(weekStart);
        prevWeekEnd.setMilliseconds(-1);

        // ---------- MONTH ----------
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthEnd = new Date(monthStart);
        prevMonthEnd.setMilliseconds(-1);

        // ---------- YEAR ----------
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const prevYearEnd = new Date(yearStart);
        prevYearEnd.setMilliseconds(-1);

        const field = "createdAt"; //  change if needed

        const [
            today,
            yesterday,
            week,
            prevWeek,
            month,
            prevMonth,
            year,
            prevYear
        ] = await Promise.all([

            Reservation.countDocuments({ [field]: { $gte: todayStart, $lte: todayEnd } }),
            Reservation.countDocuments({ [field]: { $gte: yesterdayStart, $lte: yesterdayEnd } }),

            Reservation.countDocuments({ [field]: { $gte: weekStart } }),
            Reservation.countDocuments({ [field]: { $gte: prevWeekStart, $lte: prevWeekEnd } }),

            Reservation.countDocuments({ [field]: { $gte: monthStart } }),
            Reservation.countDocuments({ [field]: { $gte: prevMonthStart, $lte: prevMonthEnd } }),

            Reservation.countDocuments({ [field]: { $gte: yearStart } }),
            Reservation.countDocuments({ [field]: { $gte: prevYearStart, $lte: prevYearEnd } })
        ]);

        // % calc
        const calc = (cur, prev) => {
            if (prev === 0) return { percent: 100, type: "increase" };
            const p = ((cur - prev) / prev) * 100;
            return {
                percent: Math.abs(p).toFixed(1),
                type: p >= 0 ? "increase" : "decrease"
            };
        };
        // I am safe okk ye esa nhi hota okk

        res.json({
            success: true,
            data: {

                today: {
                    value: today,
                    previous: yesterday,
                    ...calc(today, yesterday)
                },

                week: {
                    value: week,
                    previous: prevWeek,
                    ...calc(week, prevWeek)
                },

                month: {
                    value: month,
                    previous: prevMonth,
                    ...calc(month, prevMonth)
                },

                year: {
                    value: year,
                    previous: prevYear,
                    ...calc(year, prevYear)
                }

            }
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false });
    }
};

exports.mostActiveVenues = async (req, res) => {
    try {
        let { range } = req.body || {};

        //  agar empty, null, undefined → 12months
        if (!range) {
            range = "12months";
        }

        let startDate = new Date();

        if (range === "24h") {
            startDate.setHours(startDate.getHours() - 24);
        }
        else if (range === "7days") {
            startDate.setDate(startDate.getDate() - 7);
        }
        else if (range === "30days") {
            startDate.setDate(startDate.getDate() - 30);
        }
        else if (range === "3months") {
            startDate.setMonth(startDate.getMonth() - 3);
        }
        else if (range === "12months") {
            startDate.setMonth(startDate.getMonth() - 12);
        }

        const data = await Reservation.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: "$restaurantId",
                    total: { $sum: 1 }
                }
            },
            {
                $sort: { total: -1 }
            },
            {
                $limit: 5
            },
            {
                $lookup: {
                    from: "restaurants",
                    localField: "_id",
                    foreignField: "_id",
                    as: "restaurant"
                }
            },
            { $unwind: "$restaurant" },
            {
                $project: {
                    venueName: "$restaurant.venueName",
                    visits: "$total"
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            message: "Most active venue fetched successfully.",
            data
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
};

exports.getRemiUsersStats = async (req, res) => {
    try {
        const now = new Date();

        const last30 = new Date(now);
        last30.setDate(now.getDate() - 30);

        const prev30 = new Date(now);
        prev30.setDate(now.getDate() - 60);

        //  TOTAL UNIQUE REMI USERS
        const totalUsersAgg = await Guest.distinct("remiId");
        const totalUsers = totalUsersAgg.length;

        //  NEW LAST 30
        const newLast30Agg = await Guest.distinct("remiId", {
            createdAt: { $gte: last30 }
        });
        const newLast30 = newLast30Agg.length;

        //  PREVIOUS 30
        const newPrev30Agg = await Guest.distinct("remiId", {
            createdAt: { $gte: prev30, $lt: last30 }
        });
        const newPrev30 = newPrev30Agg.length;

        //  TREND %
        let trend = 0;
        let trendType = "no_change";

        if (newPrev30 > 0) {
            trend = ((newLast30 - newPrev30) / newPrev30) * 100;

            if (trend > 0) trendType = "increase";
            else if (trend < 0) trendType = "decrease";
        }

        return res.status(200).json({
            success: true,
            data: {
                totalRemiUsers: {
                    value: totalUsers,
                    trendPercent: Number(trend.toFixed(1)),
                    trendType
                },
                newRemiUsers: {
                    value: newLast30,
                    previous30Days: newPrev30,
                    trendPercent: Number(trend.toFixed(1)),
                    trendType
                }
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getRishAndStatus = async (req, res) => {
    try {
        const range = req.body?.range || "12m";

        // 12m, 3m, 30d, 7d, 24h

        let startDate = new Date();

        if (range === "24h") startDate.setHours(startDate.getHours() - 24);
        if (range === "7d") startDate.setDate(startDate.getDate() - 7);
        if (range === "30d") startDate.setDate(startDate.getDate() - 30);
        if (range === "3m") startDate.setMonth(startDate.getMonth() - 3);
        if (range === "12m") startDate.setMonth(startDate.getMonth() - 12);

        // ==============================
        //  HIGH NO SHOW VENUES
        // ==============================
        const noShowData = await Reservation.aggregate([
            {
                $match: {
                    restaurantId: { $ne: null },
                    date: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: "$restaurantId",
                    total: { $sum: 1 },
                    noShow: {
                        $sum: {
                            $cond: [
                                { $in: ["$status", ["No-Show", "No Show", "noshow"]] },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {
                $addFields: {
                    noShowRate: {
                        $cond: [
                            { $eq: ["$total", 0] },
                            0,
                            {
                                $multiply: [
                                    { $divide: ["$noShow", "$total"] },
                                    100
                                ]
                            }
                        ]
                    }
                }
            },

            {
                $match: {
                    noShowRate: { $gt: 15 }
                }
            },

            { $sort: { noShowRate: -1 } },
            { $limit: 4 },

            {
                $lookup: {
                    from: "restaurants",
                    localField: "_id",
                    foreignField: "_id",
                    as: "restaurant"
                }
            },
            { $unwind: "$restaurant" },

            {
                $project: {
                    name: "$restaurant.venueName",
                    rate: { $round: ["$noShowRate", 1] }
                }
            }
        ]);


        // ==============================
        //  PAYMENT ISSUES
        // ==============================
        const paymentIssues = await Restaurant.countDocuments({
            status: "Suspended"
        });

        // ==============================
        //  SUSPENDED / LOCKED
        // ==============================
        const suspendedVenues = await Restaurant.countDocuments({
            status: { $in: ["Suspended", "Locked"] }
        });

        // ==============================
        //  TOTAL BILLED
        // (demo static for now)
        // ==============================
        const billed = 18450.75;
        const noShowFees = 12340.5;
        const deposits = 6110.25;

        res.json({
            countNoShowVenues: noShowData.length,
            highNoShowVenues: noShowData,
            paymentIssues,
            suspendedVenues,
            billedCharges: billed,
            noShowFees,
            deposits
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Dashboard error" });
    }
};
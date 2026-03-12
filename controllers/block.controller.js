const Block = require("../models/block.model");
const Table = require("../models/table.model");
const Shift = require("../models/shift.model");


// exports.createBlock = async (req, res) => {
//     try {
//         const {
//             restaurantId,
//             reason,
//             status, // Draft | Active
//             isFullRestaurantBlock,
//             tableIds,
//             roomName,
//             shiftIds,
//             startDate,
//             endDate,
//             daysActive,
//             note
//         } = req.body;

//         if (!restaurantId || !reason) {
//             return res.status(400).json({
//                 success: false,
//                 message: "restaurantId and reason are required."
//             });
//         }

//         if (status !== "Draft" && (!startDate || !endDate)) {
//             return res.status(400).json({
//                 success: false,
//                 message: "startDate & endDate are required for active blocks."
//             });
//         }

//         /* ===============================
//            PRIORITY CALCULATION
//         =============================== */
//         let priority = 1;
//         if (isFullRestaurantBlock) priority = 3;
//         else if (roomName) priority = 2;

//         /* ===============================
//            CONFLICT CHECK
//         =============================== */

//         if (status !== "Draft") {
//             const conflictQuery = {
//                 restaurantId,
//                 status: "Active",
//                 isExpired: false,
//                 startDate: { $lte: new Date(endDate) },
//                 endDate: { $gte: new Date(startDate) }
//             };

//             const activeBlocks = await Block.find(conflictQuery);

//             const conflicts = [];

//             for (const block of activeBlocks) {

//                 // Full restaurant conflict
//                 if (block.isFullRestaurantBlock || isFullRestaurantBlock) {
//                     conflicts.push({
//                         type: "FULL_RESTAURANT",
//                         blockId: block._id,
//                         priority: block.priority
//                     });
//                     continue;
//                 }

//                 // Room conflict
//                 if (roomName && block.roomName === roomName) {
//                     conflicts.push({
//                         type: "ROOM",
//                         roomName,
//                         blockId: block._id,
//                         priority: block.priority
//                     });
//                 }

//                 // Table conflict
//                 if (tableIds?.length && block.tableIds?.length) {
//                     const overlap = tableIds.some(id =>
//                         block.tableIds.map(t => t.toString()).includes(id.toString())
//                     );

//                     if (overlap) {
//                         conflicts.push({
//                             type: "TABLE",
//                             blockId: block._id,
//                             priority: block.priority
//                         });
//                     }
//                 }

//                 // Shift conflict
//                 if (shiftIds?.length && block.shiftIds?.length) {
//                     const overlap = shiftIds.some(id =>
//                         block.shiftIds.map(s => s.toString()).includes(id.toString())
//                     );

//                     if (overlap) {
//                         conflicts.push({
//                             type: "SHIFT",
//                             blockId: block._id,
//                             priority: block.priority
//                         });
//                     }
//                 }
//             }

//             // BLOCK CREATE STOPPED
//             if (conflicts.length > 0) {
//                 return res.status(409).json({
//                     success: false,
//                     message: "Block conflict detected. Please review existing blocks.",
//                     conflicts
//                 });
//             }
//         }

//         /* ===============================
//            FIND TABLES TO BLOCK
//         =============================== */

//         let finalTableIds = [];

//         if (isFullRestaurantBlock) {
//             const allTables = await Table.find({ restaurantId }).select("_id");
//             finalTableIds = allTables.map(t => t._id);
//         }
//         else if (roomName) {
//             const roomTables = await Table.find({
//                 restaurantId,
//                 roomName
//             }).select("_id");

//             finalTableIds = roomTables.map(t => t._id);
//         }
//         else if (tableIds?.length) {
//             finalTableIds = tableIds;
//         }

//         /* ===============================
//            CREATE BLOCK
//         =============================== */

//         const block = await Block.create({
//             restaurantId,
//             reason,
//             status: status || "Active",
//             priority,
//             isExpired: false,
//             isFullRestaurantBlock: isFullRestaurantBlock || false,
//             tableIds: finalTableIds,
//             roomName,
//             shiftIds: shiftIds || [],
//             startDate: status === "Draft" ? null : startDate,
//             endDate: status === "Draft" ? null : endDate,
//             daysActive: daysActive || [],
//             note
//         });

//         /* ===============================
//            DEACTIVATE ENTITIES
//         =============================== */

//         if (finalTableIds.length) {
//             await Table.updateMany(
//                 { _id: { $in: finalTableIds } },
//                 { $set: { isActive: false, blockPriority: priority } }
//             );
//         }

//         if (shiftIds?.length) {
//             await Shift.updateMany(
//                 { _id: { $in: shiftIds }, restaurantId },
//                 { $set: { isActive: false, blockPriority: priority } }
//             );
//         }

//         return res.status(201).json({
//             success: true,
//             message: "Block created successfully",
//             data: block
//         });

//     } catch (error) {
//         console.error("Create block error:", error);
//         res.status(500).json({
//             success: false,
//             message: "Error creating block",
//             error: error.message
//         });
//     }
// };

function convertTo12Hour(time) {
    if (!time) return time;

    const [hours, minutes] = time.split(":");
    let h = parseInt(hours, 10);

    const ampm = h >= 12 ? "PM" : "AM";

    h = h % 12;
    if (h === 0) h = 12;

    return `${h.toString().padStart(2, "0")}:${minutes} ${ampm}`;
}

exports.createBlock = async (req, res) => {
    try {
        const {
            blockId,

            restaurantId,
            reason,
            status, // Draft | Active
            isFullRestaurantBlock,
            tableIds,
            roomName,
            shiftIds,
            startDate,
            endDate,
            daysActive,
            note
        } = req.body;

        if (!restaurantId || !reason) {
            return res.status(400).json({
                success: false,
                message: "restaurantId and reason are required."
            });
        }

        if (status !== "Draft" && (!startDate || !endDate)) {
            return res.status(400).json({
                success: false,
                message: "startDate & endDate are required for active blocks."
            });
        }

        /* ===============================
           PRIORITY
        =============================== */
        let priority = 1;
        if (isFullRestaurantBlock) priority = 3;
        else if (roomName) priority = 2;

        /* ===============================
           FETCH EXISTING BLOCK (UPDATE)
        =============================== */
        let existingBlock = null;
        if (blockId) {
            existingBlock = await Block.findById(blockId);
            if (!existingBlock) {
                return res.status(404).json({
                    success: false,
                    message: "Block not found"
                });
            }
        }

        /* ===============================
           CONFLICT CHECK
        =============================== */
        if (status !== "Draft") {
            const conflictQuery = {
                restaurantId,
                status: "Active",
                isExpired: false,
                startDate: { $lte: new Date(endDate) },
                endDate: { $gte: new Date(startDate) }
            };

            if (blockId) conflictQuery._id = { $ne: blockId };

            const activeBlocks = await Block.find(conflictQuery);
            const conflicts = [];

            for (const block of activeBlocks) {

                if (block.isFullRestaurantBlock || isFullRestaurantBlock) {
                    conflicts.push({
                        type: "FULL_RESTAURANT",
                        blockId: block._id
                    });
                    continue;
                }

                if (roomName && block.roomName === roomName) {
                    conflicts.push({
                        type: "ROOM",
                        roomName,
                        blockId: block._id
                    });
                }

                if (tableIds?.length && block.tableIds?.length) {
                    const overlap = tableIds.some(id =>
                        block.tableIds.map(t => t.toString()).includes(id.toString())
                    );
                    if (overlap) {
                        conflicts.push({
                            type: "TABLE",
                            blockId: block._id
                        });
                    }
                }

                if (shiftIds?.length && block.shiftIds?.length) {
                    const overlap = shiftIds.some(id =>
                        block.shiftIds.map(s => s.toString()).includes(id.toString())
                    );
                    if (overlap) {
                        conflicts.push({
                            type: "SHIFT",
                            blockId: block._id
                        });
                    }
                }
            }

            if (conflicts.length) {
                return res.status(409).json({
                    success: false,
                    message: "Block conflict detected",
                    conflicts
                });
            }
        }

        /* ===============================
           FIND TABLES TO BLOCK
        =============================== */
        let finalTableIds = [];

        if (isFullRestaurantBlock) {
            const allTables = await Table.find({ restaurantId }).select("_id");
            finalTableIds = allTables.map(t => t._id);
        } else if (roomName) {
            const roomTables = await Table.find({ restaurantId, roomName }).select("_id");
            finalTableIds = roomTables.map(t => t._id);
        } else if (tableIds?.length) {
            finalTableIds = tableIds;
        }

        /* ===============================
           RESET RESTAURANT (UPDATE ONLY)
           🔥 MOST IMPORTANT FIX
        =============================== */
        if (existingBlock) {
            await Table.updateMany(
                { restaurantId },
                { $set: { isActive: true, blockPriority: 0 } }
            );

            await Shift.updateMany(
                { restaurantId },
                { $set: { isActive: true, blockPriority: 0 } }
            );
        }

        /* ===============================
           CREATE / UPDATE BLOCK
        =============================== */
        const payload = {
            restaurantId,
            reason,
            status: status || "Active",
            priority,
            isExpired: false,
            isFullRestaurantBlock: !!isFullRestaurantBlock,
            tableIds: finalTableIds,
            roomName,
            shiftIds: shiftIds || [],
            startDate: status === "Draft" ? null : startDate,
            endDate: status === "Draft" ? null : endDate,
            daysActive: daysActive || [],
            note
        };

        const block = blockId
            ? await Block.findByIdAndUpdate(blockId, payload, { new: true })
            : await Block.create(payload);

        /* ===============================
           APPLY CURRENT BLOCK
        =============================== */
        if (finalTableIds.length) {
            await Table.updateMany(
                { _id: { $in: finalTableIds } },
                { $set: { isActive: false, blockPriority: priority } }
            );
        }

        if (shiftIds?.length) {
            await Shift.updateMany(
                { _id: { $in: shiftIds }, restaurantId },
                { $set: { isActive: false, blockPriority: priority } }
            );
        }

        return res.status(blockId ? 200 : 201).json({
            success: true,
            message: blockId ? "Block updated successfully" : "Block created successfully",
            data: block
        });

    } catch (error) {
        console.error("Block error:", error);
        return res.status(500).json({
            success: false,
            message: "Error processing block",
            error: error.message
        });
    }
};

exports.getAllBlocks = async (req, res) => {
    try {
        const { restaurantId } = req.query;

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "restaurantId is required"
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcomingRaw = await Block.find({
            restaurantId,
            endDate: { $gte: today }
        })
            .populate("tableIds", "tableNumber roomName capacity")
            .populate("shiftIds", "name startTime endTime")
            .sort({ startDate: 1 });

        const endedRaw = await Block.find({
            restaurantId,
            endDate: { $lt: today }
        })
            .populate("tableIds", "tableNumber roomName capacity")
            .populate("shiftIds", "name startTime endTime")
            .sort({ endDate: -1 });

        /* ===============================
           DATE TRIM FUNCTION
        =============================== */
        const formatBlockDates = (block) => {
            const obj = block.toObject();

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

            if (obj.shiftIds && obj.shiftIds.length) {
                obj.shiftIds = obj.shiftIds.map(shift => {
                    if (shift.startTime) {
                        shift.startTime = convertTo12Hour(shift.startTime);
                    }

                    if (shift.endTime) {
                        shift.endTime = convertTo12Hour(shift.endTime);
                    }

                    return shift;
                });
            }

            return obj;
        };

        const upcoming = upcomingRaw.map(formatBlockDates);
        const ended = endedRaw.map(formatBlockDates);

        return res.status(200).json({
            success: true,
            message: "Blocks fetched successfully",
            upcomingCount: upcoming.length,
            endedCount: ended.length,
            upcoming,
            ended
        });

    } catch (error) {
        console.error("Get blocks error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching blocks",
            error: error.message
        });
    }
};

exports.getBlockById = async (req, res) => {
    try {
        const { id } = req.params;

        const blockRaw = await Block.findById(id)
            .populate("restaurantId", "name")
            .populate("tableIds", "tableNumber roomName capacity")
            .populate("shiftIds", "name startTime endTime startDate endDate");

        if (!blockRaw) {
            return res.status(404).json({
                success: false,
                message: "Block not found"
            });
        }

        const block = blockRaw.toObject();

        /* ===== DATE FORMAT ===== */
        const trimDate = (val) =>
            val ? new Date(val).toISOString().split("T")[0] : null;

        block.startDate = trimDate(block.startDate);
        block.endDate = trimDate(block.endDate);
        block.createdAt = trimDate(block.createdAt);
        block.updatedAt = trimDate(block.updatedAt);

        /* ===== SHIFT TIME FORMAT ===== */
        if (block.shiftIds && block.shiftIds.length) {
            block.shiftIds = block.shiftIds.map(shift => {
                if (shift.startTime) {
                    shift.startTime = convertTo12Hour(shift.startTime);
                }

                if (shift.endTime) {
                    shift.endTime = convertTo12Hour(shift.endTime);
                }

                shift.startDate = trimDate(shift.startDate);
                shift.endDate = trimDate(shift.endDate);

                return shift;
            });
        }

        res.status(200).json({
            success: true,
            message: "Block fetched successfully",
            data: block
        });

    } catch (error) {
        console.error("Fetch block error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching block",
            error: error.message
        });
    }
};

exports.updateBlock = async (req, res) => {
    try {
        const { id } = req.params;
        const payload = req.body;

        const block = await Block.findById(id);
        if (!block) {
            return res.status(404).json({
                success: false,
                message: "Block not found"
            });
        }

        const finalStatus = payload.status || block.status;
        const finalStartDate = payload.startDate || block.startDate;
        const finalEndDate = payload.endDate || block.endDate;

        // Validate dates if moving to Active / Ended
        if (finalStatus !== "Draft") {
            if (!finalStartDate || !finalEndDate) {
                return res.status(400).json({
                    success: false,
                    message: "startDate and endDate are required for Active/Ended blocks"
                });
            }

            if (new Date(finalStartDate) > new Date(finalEndDate)) {
                return res.status(400).json({
                    success: false,
                    message: "startDate cannot be greater than endDate"
                });
            }
        }

        // 🔹 Full restaurant block logic
        if (payload.isFullRestaurantBlock === true) {
            payload.tableIds = [];
        }

        const updatedBlock = await Block.findByIdAndUpdate(
            id,
            {
                ...payload,
                startDate: finalStatus === "Draft" ? null : finalStartDate,
                endDate: finalStatus === "Draft" ? null : finalEndDate
            },
            {
                new: true,
                runValidators: true
            }
        );

        res.status(200).json({
            success: true,
            message: "Block updated successfully",
            data: updatedBlock
        });

    } catch (error) {
        console.error("Update block error:", error);
        res.status(500).json({
            success: false,
            message: "Error updating block",
            error: error.message
        });
    }
};

exports.deleteBlock = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Block id is required"
            });
        }

        // 1️⃣ Find block
        const block = await Block.findById(id);

        if (!block) {
            return res.status(404).json({
                success: false,
                message: "Block not found"
            });
        }

        /* ===============================
           UNBLOCK TABLES
        =============================== */
        if (block.tableIds?.length) {
            await Table.updateMany(
                { _id: { $in: block.tableIds } },
                {
                    $set: { isActive: true },
                    $unset: { blockPriority: "" }
                }
            );
        }

        /* ===============================
           UNBLOCK SHIFTS
        =============================== */
        if (block.shiftIds?.length) {
            await Shift.updateMany(
                { _id: { $in: block.shiftIds } },
                {
                    $set: { isActive: true },
                    $unset: { blockPriority: "" }
                }
            );
        }

        /* ===============================
           DELETE BLOCK
        =============================== */
        await Block.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "Block deleted successfully"
        });

    } catch (error) {
        console.error("Delete block error:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting block",
            error: error.message
        });
    }
};

exports.getBlocksCalendarView = async (req, res) => {
    try {
        const { restaurantId, startDate, endDate } = req.query;

        if (!restaurantId || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "restaurantId, startDate, and endDate are required."
            });
        }

        const blocks = await Block.find({
            restaurantId,
            startDate: { $lte: new Date(endDate) },
            endDate: { $gte: new Date(startDate) },
            isActive: true
        }).sort({ startDate: 1 });

        const groupedBlocks = {};
        blocks.forEach(block => {
            const dayKey = block.startDate.toISOString().split("T")[0];
            if (!groupedBlocks[dayKey]) groupedBlocks[dayKey] = [];
            groupedBlocks[dayKey].push(block);
        });

        return res.status(200).json({
            success: true,
            message: "Blocks calendar data fetched successfully.",
            data: groupedBlocks
        });

    } catch (error) {
        console.error("Error fetching block calendar:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching block calendar view.",
            error: error.message
        });
    }
};

exports.updateBlockStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        const block = await Block.findByIdAndUpdate(
            id,
            { isActive },
            { new: true }
        );

        if (!block) {
            return res.status(404).json({
                success: false,
                message: "Block not found"
            });
        }

        res.status(200).json({
            success: true,
            message: `Block ${isActive ? "activated" : "deactivated"} successfully`,
            data: block
        });

    } catch (error) {
        console.error("Status update error:", error);
        res.status(500).json({
            success: false,
            message: "Error updating block status",
            error: error.message
        });
    }
};

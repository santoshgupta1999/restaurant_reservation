const Table = require('../models/table.model');

exports.createTable = async (req, res) => {
    try {
        const { restaurantId, tableNumber, seatCount, areaName } = req.body;

        if (!restaurantId || !tableNumber || !seatCount || !areaName) {
            return res.status(400).json({
                success: false,
                message: 'All fields (restaurantId, tableNumber, seatCount, areaName) are required'
            });
        }

        const existingTable = await Table.findOne({ restaurantId, tableNumber });
        if (existingTable) {
            return res.status(400).json({
                success: false,
                message: 'Table number already exists for this restaurant'
            });
        }

        const newTable = new Table({ restaurantId, tableNumber, seatCount, areaName });
        await newTable.save();

        return res.status(201).json({
            success: true,
            message: 'Table added successfully',
            data: newTable
        });

    } catch (error) {
        console.error("Error adding table:", error);
        res.status(500).json({
            success: false,
            message: 'Error adding table',
            error: error.message
        });
    }
};

exports.getTablesByRestaurants = async (req, res) => {
    try {
        const { restaurantId } = req.query;

        const tables = await Table.find({ restaurantId });
        if (!tables) {
            return res.status(404).json({
                success: false,
                message: 'Tables not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Tables fetched successfully',
            Data: tables
        });

    } catch (error) {
        console.error('Error fetching tables', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching tables',
            Error: error.message
        });
    }
};

exports.updateTable = async (req, res) => {
    try {
        const { id } = req.params;
        const { restaurantId, tableNumber, seatCount, areaName } = req.body;

        if (!restaurantId || !tableNumber || !seatCount || !areaName) {
            return res.status(400).json({
                success: false,
                message: 'All fields (restaurantId, tableNumber, seatCount, areaName) are required.'
            });
        }

        const existingTable = await Table.findOne({
            restaurantId,
            tableNumber,
            _id: { $ne: id }
        });

        if (existingTable) {
            return res.status(400).json({
                success: false,
                message: 'Table number already exists for this restaurant.'
            });
        }

        const updatedTable = await Table.findByIdAndUpdate(
            id,
            { restaurantId, tableNumber, seatCount, areaName },
            { new: true }
        );

        if (!updatedTable) {
            return res.status(404).json({
                success: false,
                message: 'Table not found.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Table updated successfully.',
            data: updatedTable
        });

    } catch (error) {
        console.error('Error updating table:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating table.',
            error: error.message
        });
    }
};

exports.deleteTable = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Table.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Table not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Table deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting table');
        res.status(500).json({
            success: false,
            message: 'Error updating table',
            Error: error.message
        });
    }
};

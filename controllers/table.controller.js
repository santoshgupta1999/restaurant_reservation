const Table = require('../models/table.model');

exports.createTable = async (req, res) => {
    try {
        const { restaurantId, tableNumber, seatCount } = req.body;

        const newTable = new Table({ restaurantId, tableNumber, seatCount });
        if (!restaurantId || !tableNumber || !seatCount) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        const existingTable = await Table.findOne({ tableNumber });
        if (existingTable) {
            return res.status(400).json({
                success: false,
                message: 'Table No already exists'
            });
        }

        await newTable.save();

        return res.status(201).json({
            success: true,
            message: 'Table added successfully',
            data: newTable
        });
    } catch (error) {
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
        const {
            tableNumber,
            seatCount
        } = req.body;

        const existingTable = await Table.findOne({ tableNumber, _id: { $ne: id } });
        if (existingTable) {
            return res.status(400).json({
                success: false,
                message: 'Table Number already exists.'
            });
        }

        const updated = await Table.findByIdAndUpdate(id, { tableNumber, seatCount }, { new: true });
        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Table not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Table updated successfully',
        });

    } catch (error) {
        console.error('Error updating tables', error);
        res.status(500).json({
            success: false,
            message: 'Error updating tables',
            Error: error.message
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

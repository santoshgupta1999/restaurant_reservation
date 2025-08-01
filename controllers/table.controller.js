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
        await newTable.save();

        console.log('Table added successfully');
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

        console.log('Tables Fetched successfully');
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

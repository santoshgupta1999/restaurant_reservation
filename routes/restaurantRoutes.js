const express = require('express');
const router = express.Router();

const slotController = require('../controllers/slot.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const tableController = require('../controllers/table.controller');

router.post('/slot/add_update', verifyToken, requireRole('admin', 'manager'), slotController.addOrUpdateSlot);
router.get('/slot', verifyToken, requireRole('admin'), slotController.getSlotsByRestaurant);
router.delete('/slot/:id', verifyToken, requireRole('admin'), slotController.deleteSlot);

// ------------------------------------------- Table ----------------------------------- //

router.post('/table/add', verifyToken, requireRole('admin'), tableController.createTable);
router.get('/table/', verifyToken, requireRole('admin'), tableController.getTablesByRestaurants);

module.exports = router;

const express = require('express');
const router = express.Router();

const slotController = require('../controllers/slot.controller');
const tableController = require('../controllers/table.controller');
const reviewController = require('../controllers/review.controller');
const blockController = require('../controllers/block.controller');
const restaurantController = require('../controllers/restaurant.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const { reviewValidator, checkDuplicateReview } = require('../validators/reviewValidation');
const { validate } = require('../middlewares/validationResultHandler');
const { blockValidator } = require('../validators/blockValidator');
const { shiftValidator } = require('../validators/shiftValidator');

// ------------------------------------------- Slots ----------------------------------- //

router.post('/slot/add_update', slotController.addOrUpdateSlot);
router.get('/slot', slotController.getSlotsByRestaurant);
router.delete('/slot/:id', slotController.deleteSlot);

// ------------------------------------------- Table ----------------------------------- //

router.post('/table/add', tableController.createTable);
router.get('/table', tableController.getAllTables);
router.get('/table/:id', tableController.getTableById);
router.get('/tables/available', tableController.getAvailableTables);
router.put('/table/update/:id', tableController.updateTable);
router.delete('/table/:id', tableController.deleteTable);

router.post('/mergeTables', tableController.mergeTables);
router.put('/unmergeTables/:tableId', tableController.unmergeTables);
router.put('/unmergeSeatedTables', tableController.unmergeSeatedTables);
router.get('/getAllMergedTables', tableController.getAllMergedTables);

router.put('/lockTable/:tableId', verifyToken, tableController.lockTable);
router.put('/unlockTable/:tableId', tableController.unlockTable);
router.get('/getAllLockedTables', tableController.getAllLockedTables);
// ------------------------------------------- Review ----------------------------------- //

router.post('/review',
    verifyToken, requireRole('user'),
    reviewValidator, checkDuplicateReview,
    validate,
    reviewController.createReview
);
router.get('/review', verifyToken, requireRole('user'), reviewController.getReviews);
router.get('/admin/reviews', verifyToken, requireRole('admin'), reviewController.getAllReviewsByAdmin);
router.get('/avg_rating/:restaurantId', verifyToken, requireRole('admin'), reviewController.getAverageRating);


// ------------------------------------------- Block ------------------------------------- //

router.post('/block', blockValidator, validate, blockController.createBlock);
router.get('/block/all', blockController.getAllBlocks);
router.get('/block/:id', blockController.getBlockById);
router.put('/block/:id', blockValidator, validate, blockController.updateBlock);
router.delete('/block/:id', blockController.deleteBlock);
router.get('/getBlocksCalendarView', blockController.getBlocksCalendarView);

// ------------------------------------------ Shift -------------------------------------- //

router.post('/shift', shiftValidator, validate, restaurantController.createShift);
router.get('/shift_all', restaurantController.getAllShift);
router.get('/shift/:id', restaurantController.getShiftById);
router.put('/shift/:id', shiftValidator, validate, restaurantController.updateShift);
router.delete('/shift/:id', restaurantController.deleteShift);
router.get('/shift/active/today', restaurantController.getActiveShiftsForToday);
router.get('/getShiftsCalendarView', restaurantController.getShiftsCalendarView);

module.exports = router;

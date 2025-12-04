const express = require('express');
const router = express.Router();

const tableController = require('../controllers/table.controller');
const feedbackController = require('../controllers/feedback.controller');
const blockController = require('../controllers/block.controller');
const restaurantController = require('../controllers/restaurant.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const { feedbackValidator, updateFeedbackValidator } = require('../validators/feedbackValidation');
const { validate } = require('../middlewares/validationResultHandler');
const { blockValidator } = require('../validators/blockValidator');
const { shiftValidator } = require('../validators/shiftValidator');


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

router.put('/updateTableStatus/:id', tableController.updateTableStatus);
// ------------------------------------------- Feedback ----------------------------------- //

router.post('/createFeedback', feedbackValidator, validate, feedbackController.createFeedback);
router.get('/getAllFeedback', feedbackController.getAllFeedback);
router.get('/getFeedbackById/:id', feedbackController.getFeedbackById);
router.put("/updateFeedback/:id", updateFeedbackValidator, validate, feedbackController.updateFeedback);
router.delete('/deleteFeedback/:id', feedbackController.deleteFeedback);
router.get('/getFeedbackByRestaurant/:id', feedbackController.getFeedbackByRestaurant);
router.get('/getAverageRating/:restaurantId', feedbackController.getAverageRatingByRestaurant);


// ------------------------------------------- Block ------------------------------------- //

router.post('/block', blockValidator, validate, blockController.createBlock);
router.get('/block/all', blockController.getAllBlocks);
router.get('/block/:id', blockController.getBlockById);
router.put('/block/:id', blockValidator, validate, blockController.updateBlock);
router.delete('/block/:id', blockController.deleteBlock);
router.get('/getBlocksCalendarView', blockController.getBlocksCalendarView);
router.put('/updateBlockStatus/:id', blockController.updateBlockStatus);

// ------------------------------------------ Shift -------------------------------------- //

router.post('/shift', shiftValidator, validate, restaurantController.createShift);
router.get('/shift_all', restaurantController.getAllShift);
router.get('/shift/:id', restaurantController.getShiftById);
router.put('/shift/:id', shiftValidator, validate, restaurantController.updateShift);
router.delete('/shift/:id', restaurantController.deleteShift);
router.get('/shift/active/today', restaurantController.getActiveShiftsForToday);
router.get('/getShiftsCalendarView', restaurantController.getShiftsCalendarView);
router.put("/updateShiftStatus/:id", restaurantController.updateShiftStatus);

module.exports = router;

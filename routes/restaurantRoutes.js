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
const { blockValidator, updateBlockValidator } = require('../validators/blockValidator');
const { shiftValidator } = require('../validators/shiftValidator');
const seatingPreference = require("../controllers/seatingPreference");


// ------------------------------------------- Table ----------------------------------- //

router.post('/table/add', tableController.createTable);
router.get('/table', tableController.getAllTables);
router.get('/table/:id', tableController.getTableById);
router.get('/tables/available', tableController.getAvailableTables);
router.put('/table/update/:id', tableController.updateTable);

router.post('/deleteTable', tableController.deleteTable);
router.post('/deleteDecorative', tableController.deleteDecorative);
router.post('/deleteRoom', tableController.deleteRoom);

router.post('/updateRoomLayout', tableController.bulkUpdateLayout);

router.post('/mergeTables', tableController.mergeTables);
router.post('/unmergeTables', tableController.unmergeTables);
router.get('/getAllMergedTables', tableController.getAllMergedTables);

router.post('/unassignTable', tableController.unassignTable);
router.post('/changeTableAssignment', tableController.changeTableAssignment);

router.post('/lockTable', verifyToken, tableController.lockTable);
router.get('/getAllLockedTables', tableController.getAllLockedTables);
router.post('/getAllBookingsDetails', tableController.getAllBookingsDetails);

router.put('/updateTableStatus/:id', tableController.updateTableStatus);
router.post('/getAvailableTable', tableController.getAvailableTable);
// ------------------------------------------- Feedback ----------------------------------- //

router.post('/createFeedback', feedbackValidator, validate, feedbackController.createFeedback);
router.get('/getAllFeedback', feedbackController.getAllFeedback);
router.get('/getFeedbackById/:id', feedbackController.getFeedbackById);
router.put("/updateFeedback/:id", updateFeedbackValidator, validate, feedbackController.updateFeedback);
router.delete('/deleteFeedback/:id', feedbackController.deleteFeedback);
router.get('/getFeedbackByRestaurant/:id', feedbackController.getFeedbackByRestaurant);


// ------------------------------------------- Block ------------------------------------- //

router.post('/block', blockValidator, validate, blockController.createBlock);
router.get('/block/all', blockController.getAllBlocks);
router.get('/block/:id', blockController.getBlockById);
router.put('/block/:id', updateBlockValidator, validate, blockController.updateBlock);
router.delete('/block/:id', blockController.deleteBlock);
router.get('/getBlocksCalendarView', blockController.getBlocksCalendarView);
router.put('/updateBlockStatus/:id', blockController.updateBlockStatus);

// ------------------------------------------ Shift -------------------------------------- //

router.post('/shift', shiftValidator, validate, restaurantController.createShift);
router.get('/shift_all', restaurantController.getAllShift);
router.get('/shift/:id', restaurantController.getShiftById);
router.put('/shift/:id', shiftValidator, validate, restaurantController.updateShift);
router.post('/deleteShift', restaurantController.deleteShift);
router.get('/shift/active/today', restaurantController.getActiveShiftsForToday);
router.get('/getShiftsCalendarView', restaurantController.getShiftsCalendarView);
router.post("/updateShiftStatus/:id", restaurantController.updateShiftStatus);

router.post("/getRestaurantSlots", restaurantController.getRestaurantSlots);
router.post("/get-widget-slots/:restaurantId", restaurantController.getWidgetRestaurantSlots);

router.post("/shift-names/:restaurantId", restaurantController.getShiftNamesByRestaurant);

// -------------------------------- Preference -------------------------

router.post("/getSeatingPrefrencesName", seatingPreference.getSeatingPrefrencesName);
router.post("/getwidgetSeatingPrefrencesName/:restaurantId", seatingPreference.getwidgetSeatingPrefrencesName);
router.post("/addPreference", seatingPreference.addSeatingPreference);
router.delete("/deletePreference", seatingPreference.deleteSeatingPreference);
router.post("/togglePreferenceStatus", seatingPreference.toggleSeatingPreferenceStatus);
router.post("/getAllPreference", seatingPreference.getAllPreference);

router.post("/addStaff", seatingPreference.saveStaffAccount);
router.delete("/deleteStaff", seatingPreference.deleteStaff);
router.post("/getAllStaff", seatingPreference.getAllStaff);

router.post("/getRooms/:restaurantId", seatingPreference.getRoomsByRestaurant);

module.exports = router;

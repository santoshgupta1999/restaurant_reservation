const express = require("express");
const {
    register,
    login,
    getProfile,
    updateProfile,
    logout,
    changePassword,
    forgotPassword,
    verifyOtp,
    resetPassword,
    getAllActiveUser,
    updateUserStatus,
    getAllUsers,
    getUserById,
    deleteUser
} = require("../controllers/user.controllers.js");

const { registerValidator, loginValidator, updateProfileValidator, } = require("../validators/userValidation.js");
const { validate } = require('../middlewares/validationResultHandler.js');
const { verifyToken } = require("../middlewares/auth.middleware.js");
const notificationController = require('../controllers/notification.controller.js');
const upload = require('../middlewares/upload.middleware.js');
const router = express.Router();

router.post("/signup", registerValidator, validate, register);
router.post("/login", loginValidator, validate, login);
router.get('/profile', verifyToken, getProfile);
router.post('/profile', upload.single('profile'), verifyToken,
    updateProfileValidator, validate, updateProfile);

router.post('/logout', verifyToken, logout);
router.post('/change-password', verifyToken, changePassword);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyToken, verifyOtp);
router.post('/reset-password', verifyToken, resetPassword);

router.get('/all_active', getAllActiveUser);
router.get('/getAllUsers', getAllUsers);
router.get('/getUserById/:id', getUserById);
router.delete('/deleteUser/:id', deleteUser);
router.put('/updateUserStatus/:id', updateUserStatus);

router.post('/createNotification', notificationController.createNotification);
router.get('/getNotifications', notificationController.getNotifications);
router.put('/updateNotificationStatus/:id', notificationController.updateNotificationStatus);
router.delete('/deleteNotification/:id', notificationController.deleteNotification);
router.put('/markAllAsRead', verifyToken, notificationController.markAllAsRead);

module.exports = router;

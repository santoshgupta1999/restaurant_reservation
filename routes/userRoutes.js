const express = require("express");
const {
    register,
    login,
    getProfile,
    updateProfile,
    changePassword,
    forgotPassword,
    verifyOtp,
    resetPassword,
    getAllActiveUser,
    updateUserStatus,
    getAllUsers,
    getUserById,
    deleteUser,
    getManagers,
    updateManagerById,
    getStaffs,
    superAdminLogin,
    updateUsersById,
    addStaff,
    getUserRoleCounts,
    createSuperAdmin,
    getSuperAdmins,
    verifyResetLink
} = require("../controllers/user.controllers.js");

const { registerValidator, loginValidator, updateProfileValidator, } = require("../validators/userValidation.js");
const { validate } = require('../middlewares/validationResultHandler.js');
const { verifyToken, requireRole } = require("../middlewares/auth.middleware.js");
const notificationController = require('../controllers/notification.controller.js');
const upload = require('../middlewares/upload.middleware.js');
const router = express.Router();

router.post("/signup", registerValidator, validate, register);
router.post("/login", loginValidator, validate, login);
router.post("/super-admin/login", loginValidator, validate, superAdminLogin);
router.get('/profile', verifyToken, getProfile);
router.post('/profile', upload.single('profile'), verifyToken,
    updateProfileValidator, validate, updateProfile);

router.post('/change-password', verifyToken, changePassword);
router.post('/verify-otp', verifyToken, verifyOtp);
router.post('/forgot-password', forgotPassword);
router.get("/verify-reset/:token", verifyResetLink);
// router.post('/verify-otp', verifyToken, verifyOtp);
router.post("/reset-password/:token", resetPassword);

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

router.post('/getManagers', getManagers);
router.post('/getStaffs', getStaffs);
router.post('/add-staff', addStaff);

router.post('/getUserRoleCounts', getUserRoleCounts);
router.post('/createSuperAdmin', verifyToken, requireRole("super_admin"), createSuperAdmin);
router.post('/getSuperAdmins', verifyToken, requireRole("super_admin"), getSuperAdmins);

router.post('/updateUsersById', upload.single('profile'),
    updateProfileValidator, validate, updateUsersById);

module.exports = router;

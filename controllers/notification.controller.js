const Notification = require('../models/notification.model');
const User = require('../models/user.model');


exports.createNotification = async (req, res) => {
    try {
        const {
            recipientId,
            title,
            message,
            type,
            link
        } = req.body;

        const recipientExists = await User.findById(recipientId);
        if (!recipientExists) {
            return res.status(404).json({
                success: false,
                message: "Recipient user not found"
            });
        }

        const notification = await Notification.create({
            recipientId,
            title,
            message,
            type,
            link
        });

        return res.status(200).json({
            success: true,
            message: "Notification created successfully",
            data: notification
        });

    } catch (error) {
        console.error('Error while creating notification', error);
        res.status(500).json({
            success: false,
            message: 'Error while creating notification',
            Error: error.message
        });
    }
};

exports.getNotifications = async (req, res) => {
    try {
        const { recipientId, type, isRead } = req.query;
        const filter = {};

        if (recipientId) filter.recipientId = recipientId;
        if (type) filter.type = type;
        if (isRead !== undefined) filter.isRead = isRead = "true";

        const notification = await Notification.find(filter)
            .populate("recipientId", "name email role")
            .sort({ createdAr: -1 });

        return res.status(200).json({
            success: false,
            message: 'Notification fetched successfully',
            count: notification.length,
            data: notification
        });

    } catch (error) {
        console.error('Error while fetching notification', error);
        res.status(500).json({
            success: false,
            message: 'Error while fetching notification',
            Error: error.message
        });
    }
};

exports.updateNotificationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isRead } = req.body;

        const updateNotification = await Notification.findByIdAndUpdate(
            id,
            { isRead },
            { new: true }
        );
        if (!updateNotification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: `Notificatioin marked as ${isRead ? "read" : "unread"}.`,
            data: updateNotification
        });

    } catch (error) {
        console.error('Error while updating notification', error);
        res.status(500).json({
            success: false,
            message: 'Error while updating notification'
        });
    }
};

exports.deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Notification.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Notification deleted successfully'
        });

    } catch (error) {
        console.error('Error while deleting notification', error);
        res.status(500).json({
            success: false,
            message: 'Error while deleting notification',
            Error: error.message
        });
    }
};

exports.markAllAsRead = async (req, res) => {
    try {
        const userId = req.user._id;

        const unreadCount = await Notification.countDocuments({
            recipientId: userId,
            isRead: false
        });

        if (unreadCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'No unread notifications found.'
            });
        }

        await Notification.updateMany(
            { recipientId: userId, isRead: false },
            { $set: { isRead: true } }
        );

        return res.status(200).json({
            success: true,
            message: `${unreadCount} notifications marked as read`
        });

    } catch (error) {
        console.error('Error while mark all notification as read', error);
        res.status(500).json({
            success: false,
            message: 'Error while mark all notification as read',
            Error: error.message
        });
    }
};

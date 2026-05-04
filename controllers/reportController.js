const { User, Report, AdminLog, Notification } = require('../models');

// ─── REPORTS ──────────────────────────────────────────────────────────────────

exports.submitReport = async (req, res) => {
  try {
    const reporterId = req.user.id;
    const { reportedUserId, reason, details } = req.body;

    if (!reportedUserId || !reason) {
      return res.status(400).json({ status: 'fail', message: 'Reported user and reason are required.' });
    }

    const report = await Report.create({ reporterId, reportedUserId, reason, details: details || '' });

    const adminUsers = await User.findAll({ where: { userType: 'admin' } });
    if (adminUsers.length > 0) {
        const adminNotifs = adminUsers.map(a => ({
            receiverId: a.id,
            receiverType: 'admin',
            senderId: reporterId,
            message: `New User Report submitted. Reason: ${reason}`,
            type: "system",
            link: "/admin/reports"
        }));
        await Notification.bulkCreate(adminNotifs);
    }

    return res.status(201).json({ status: 'success', message: 'Report submitted. Our team will review it shortly.', data: report });
  } catch (error) {
    console.error('Report error:', error);
    return res.status(500).json({ status: 'fail', message: 'Failed to submit report.' });
  }
};

// Admin: get all reports
exports.getAllReports = async (req, res) => {
  try {
    const reports = await Report.findAll({
      include: [
        { model: User, as: 'reporter', attributes: ['id', 'name', 'email', 'picture'] },
        { model: User, as: 'reportedUser', attributes: ['id', 'name', 'email', 'picture', 'userType', 'accountStatus'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    return res.status(200).json({ status: 'success', data: reports });
  } catch (error) {
    console.error('Get reports error:', error);
    return res.status(500).json({ status: 'fail', message: 'Failed to fetch reports.' });
  }
};

// Admin: update report status (and optionally apply user action)
exports.updateReportStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, action, adminNote } = req.body; // status: 'pending' | 'reviewed' | 'resolved'. action: 'warn' | 'suspend' | 'ban'
    const adminId = req.user.id;

    const report = await Report.findByPk(reportId, {
       include: [{ model: User, as: 'reportedUser' }]
    });

    if (!report) return res.status(404).json({ status: 'fail', message: 'Report not found.' });
    
    if (status) {
       report.status = status;
    }

    let message = 'Report updated.';

    // If admin is taking action on the user
    if (action && report.reportedUser) {
        const user = report.reportedUser;
        if (action === 'suspend') {
            user.accountStatus = 'suspended';
            message = 'Report resolved and user suspended.';
        } else if (action === 'ban') {
            user.accountStatus = 'banned';
            message = 'Report resolved and user banned.';
        } else if (action === 'warn') {
            // Here you'd trigger an email warning
            message = 'Report resolved and user warned.';
        }
        await user.save();
        
        // Log action
        await AdminLog.create({
            adminId,
            action: `REPORT_ACTION_${action.toUpperCase()}`,
            targetId: user.id.toString(),
            details: `Admin applied ${action} from report #${report.id}. Note: ${adminNote || ''}`
        });
    }

    await report.save();
    return res.status(200).json({ status: 'success', message });
  } catch (error) {
    console.error('Update report error:', error);
    return res.status(500).json({ status: 'fail', message: 'Failed to update report.' });
  }
};

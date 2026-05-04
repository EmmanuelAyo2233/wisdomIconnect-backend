const { Announcement, User, AdminLog, Notification, Mentor, Mentee } = require('../models');

exports.createAnnouncement = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { title, content, targetAudience, sentViaEmail } = req.body;

    const announcement = await Announcement.create({
      title, content, targetAudience, sentViaEmail, adminId
    });

    await AdminLog.create({
      adminId,
      action: "CREATE_ANNOUNCEMENT",
      targetId: announcement.id.toString(),
      details: `Target: ${targetAudience}. Email: ${sentViaEmail}`
    });

    // Create notifications for the target audience
    let whereClause = {};
    if (targetAudience === 'mentors') whereClause.userType = 'mentor';
    if (targetAudience === 'mentees') whereClause.userType = 'mentee';
    // 'all' means no whereClause filter on userType

    const usersToNotify = await User.findAll({ 
       where: whereClause, 
       attributes: ['id', 'userType'],
       include: [
         { model: Mentor, as: 'mentor', attributes: ['id'] },
         { model: Mentee, as: 'mentee', attributes: ['id'] }
       ]
    });
    const validUsers = usersToNotify.filter(u => u.userType === 'mentor' || u.userType === 'mentee');
    
    if (validUsers.length > 0) {
       const notifications = validUsers.map(u => {
          let recId = null;
          if (u.userType === 'mentor' && u.mentor) recId = u.mentor.id;
          if (u.userType === 'mentee' && u.mentee) recId = u.mentee.id;
          
          if (!recId) return null; // skip if no profile found
          
          return {
            receiverId: recId,
            receiverType: u.userType,
            senderId: adminId,
            title: `Announcement: ${title}`,
            message: content, // Send full content, no truncation
            type: "system",
            link: "/notifications"
          };
       }).filter(n => n !== null);
       
       await Notification.bulkCreate(notifications);
    }

    res.status(201).json({ message: "Announcement created and broadcasted successfully", data: announcement });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getAllAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.findAll({
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'admin', attributes: ['name'] }]
    });
    res.json({ data: announcements });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getUserAnnouncements = async (req, res) => {
   try {
     const userType = req.user.userType; // 'mentor' | 'mentee' | 'admin'
     
     let targets = ['all'];
     if (userType === 'mentor') targets.push('mentors');
     if (userType === 'mentee') targets.push('mentees');
     
     const announcements = await Announcement.findAll({
        where: {
           targetAudience: targets
        },
        order: [['createdAt', 'DESC']]
     });
     res.json({ data: announcements });
   } catch (error) {
     res.status(500).json({ message: "Server error", error: error.message });
   }
};

exports.deleteAnnouncement = async (req, res) => {
  try {
    const adminId = req.user.id;
    const announcement = await Announcement.findByPk(req.params.id);
    
    if (!announcement) {
       return res.status(404).json({ message: "Announcement not found" });
    }

    await announcement.destroy();

    await AdminLog.create({
      adminId,
      action: "DELETE_ANNOUNCEMENT",
      targetId: req.params.id.toString(),
      details: `Deleted announcement: ${announcement.title}`
    });

    res.status(200).json({ message: "Announcement deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

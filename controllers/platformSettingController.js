const { PlatformSetting, AdminLog } = require('../models');

exports.getSettings = async (req, res) => {
  try {
    let settings = await PlatformSetting.findAll();
    if (settings.length === 0) {
      const defaults = [
        { key: 'platform_commission_rate', value: 10, description: 'Percentage cut platform takes from sessions' },
        { key: 'min_session_price', value: 1000, description: 'Minimum allowed price for a session in NGN' }
      ];
      for (const item of defaults) {
        await PlatformSetting.create(item);
      }
      settings = await PlatformSetting.findAll();
    }
    res.json({ data: settings });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.updateSetting = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { key } = req.params;
    const { value, description } = req.body;

    let setting = await PlatformSetting.findByPk(key);
    if (setting) {
      setting.value = value;
      if (description) setting.description = description;
      await setting.save();
    } else {
      setting = await PlatformSetting.create({ key, value, description });
    }

    await AdminLog.create({
      adminId,
      action: "UPDATE_SETTING",
      targetId: key,
      details: `New value: ${JSON.stringify(value)}`
    });

    res.json({ message: "Setting updated successfully", data: setting });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const { User, Mentor, Mentee } = require('../models');
const { Op } = require('../config/reuseablePackages');
const Wishlist = require('../models/wishlist');

// ─── WISHLIST ─────────────────────────────────────────────────────────────────

const toggleWishlist = async (req, res) => {
  try {
    const menteeId = req.user.id;
    const { mentorId } = req.params;

    const existing = await Wishlist.findOne({ where: { menteeId, mentorId } });
    if (existing) {
      await existing.destroy();
      return res.status(200).json({ status: 'success', saved: false, message: 'Removed from saved mentors.' });
    }

    await Wishlist.create({ menteeId, mentorId });
    return res.status(201).json({ status: 'success', saved: true, message: 'Mentor saved to wishlist!' });
  } catch (error) {
    console.error('Wishlist toggle error:', error);
    return res.status(500).json({ status: 'fail', message: 'Failed to update wishlist.' });
  }
};

const getWishlist = async (req, res) => {
  try {
    const menteeId = req.user.id;
    const entries = await Wishlist.findAll({ where: { menteeId } });

    if (!entries.length) return res.status(200).json({ status: 'success', data: [] });

    const mentorIds = entries.map(e => e.mentorId);

    const mentors = await Mentor.findAll({
      where: { id: { [Op.in]: mentorIds } },
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'picture', 'email'] }]
    });

    const data = mentors.map(m => ({
      mentorId: m.id,
      name: m.user?.name,
      picture: m.user?.picture,
      occupation: m.occupation,
      expertise: m.expertise,
      rating: m.rating || 0,
    }));

    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    console.error('Get wishlist error:', error);
    return res.status(500).json({ status: 'fail', message: 'Failed to get wishlist.' });
  }
};

const checkWishlist = async (req, res) => {
  try {
    const menteeId = req.user.id;
    const { mentorId } = req.params;
    const exists = await Wishlist.findOne({ where: { menteeId, mentorId } });
    return res.status(200).json({ status: 'success', saved: !!exists });
  } catch (error) {
    return res.status(500).json({ status: 'fail', message: 'Failed to check wishlist.' });
  }
};

module.exports = { toggleWishlist, getWishlist, checkWishlist };

const { Op } = require('sequelize');
const { User, user_logging } = require('../config/sequelize.js');

exports.markAttendance = async (req, res) => {
  const { user_Id } = req.body;

  if (!user_Id) {
    return res.status(400).json({ error: 'user_Id is required' });
  }

  try {
    // 1. Check if user exists
    const user = await User.findOne({ where: { user_Id: user_Id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 2. Find the last open attendance record for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastLog = await user_logging.findOne({
      where: {
        user_id: user_Id,
        time_Logged_out: null,
        log_Date: {
            [Op.gte]: today
        }
      },
      order: [['time_Logged_in', 'DESC']],
    });

    // 3. If a log exists, it's a 'Logout'
    if (lastLog) {
      lastLog.time_Logged_out = new Date();
      lastLog.log_Type = 'Logout';
      await lastLog.save();
      return res.status(200).json({ message: 'User logged out successfully', data: lastLog });
    } else {
      // 4. If no open log, it's a 'Login'
      const newLog = await user_logging.create({
        user_id: user_Id,
        log_Date: new Date(),
        time_Logged_in: new Date(),
        time_Logged_out: null,
        log_Type: 'Login',
        location: 'Office', // Default location, can be changed
      });
      return res.status(201).json({ message: 'User logged in successfully', data: newLog });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

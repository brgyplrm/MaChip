const { Op } = require('sequelize');
const { User, user_logging } = require('../config/sequelize.js');

exports.markAttendance = async (req, res) => {
  const { user_Id, log_Type } = req.body;

  if (!user_Id) {
    return res.status(400).json({ error: 'user_Id is required' });
  }

  try {
    // 1. Check if user exists
    const user = await User.findOne({ where: { user_Id: user_Id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (log_Type === 'Logout') {
      // Find the last open attendance record for today to close it
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

      if (lastLog) {
        lastLog.time_Logged_out = now.toTimeString().split(' ')[0];
        lastLog.log_Type = 'Logout';
        await lastLog.save();
        return res.status(200).json({ message: 'User logged out successfully', data: lastLog });
      } else {
        return res.status(400).json({ error: 'No active login session found for today to logout.' });
      }
    } else {
      // Default to Login or handle explicit Login
      const newLog = await user_logging.create({
        user_id: user_Id,
        log_Date: now.toISOString().split('T')[0],
        time_Logged_in: now.toTimeString().split(' ')[0],
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

exports.viewUserLogs = async (req, res) => {
  const { user_Id } = req.params;
  
  try {
    const logs = await user_logging.findAll({
      where: { user_id: user_Id },
      order: [['log_Date', 'DESC'], ['time_Logged_in', 'DESC']],
    });
    
    if (logs.length === 0) {
      return res.status(404).json({ error: 'No logs found for this user' });
    }
    res.status(200).json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.viewAllAttendance = async (req, res) => {
    try {
        const logs = await user_logging.findAll({
            include: [{
                model: User,
                as: 'user', // Explicitly name the joined object 'user'
                attributes: ['user_LastName', 'user_MachipId']
            }],
            order: [['log_Date', 'DESC'], ['time_Logged_in', 'DESC']]
        });
        res.status(200).json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

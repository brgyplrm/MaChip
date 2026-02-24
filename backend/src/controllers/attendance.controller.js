const { Op } = require('sequelize');
const { User, user_logging, employee_Logging_report } = require('../config/sequelize.js');

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

exports.deleteAllLogs = async (req, res) => {
    try {
        // First delete from the child table to avoid foreign key constraint errors
        await employee_Logging_report.destroy({ where: {} });
        // Then delete from the parent table
        await user_logging.destroy({ where: {} });
        
        res.status(200).json({ message: 'All attendance logs have been deleted successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.StatusLogic = async (req, res) => {
    const { user_Id } = req.params;
    const { mockTime } = req.query;
    try {
        let now = new Date();
        if (mockTime) {
            now = new Date(mockTime);
        }
        
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);

        let log = await user_logging.findOne({
            where: {
                user_id: user_Id,
                log_Date: {
                    [Op.gte]: today,
                    [Op.lt]: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                }
            },
            order: [['time_Logged_in', 'DESC']]
        });

        const fivePM = new Date(now);
        fivePM.setHours(17, 0, 0, 0);

        if (!log) {
            if (now >= fivePM) {
                // No login record found and it's past 5:00 PM, mark as Absent
                const logDate = now.toISOString().split('T')[0];
                
                log = await user_logging.create({
                    user_id: user_Id,
                    log_Date: logDate,
                    time_Logged_in: '17:00:00',
                    log_Type: 'Login',
                    status: 'Absent',
                    location: 'Office'
                });
                return res.status(201).json({ message: 'User marked as Absent (Mocked)', data: log });
            }
            return res.status(404).json({ error: 'No attendance record found for today' });
        }

        // If it's already marked as Absent or On-Leave, don't override with On-time/Late
        if (log.status === 'Absent' || log.status === 'On-Leave') {
            return res.status(200).json({ message: 'Attendance status', data: log });
        }

        const loginTime = new Date(`${log.log_Date}T${log.time_Logged_in}`);
        
        // Define thresholds for status logic (e.g., 9:00 AM for on-time)
        const lateThreshold = new Date(loginTime);
        lateThreshold.setHours(9, 0, 0, 0);

        let status = 'On-time';
        if (loginTime > lateThreshold) {
            status = 'Late';
        }

        log.status = status;
        await log.save();

        res.status(200).json({ message: 'Attendance status updated', data: log });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Office Occupancy (Logged in but not logged out today)
    const officeOccupancy = await user_logging.count({
      where: {
        log_Date: { [Op.gte]: today, [Op.lt]: tomorrow },
        time_Logged_out: null,
        log_Type: 'Login'
      }
    });

    // 2. On-time Today
    const onTimeCount = await user_logging.count({
      where: {
        log_Date: { [Op.gte]: today, [Op.lt]: tomorrow },
        status: 'On-time'
      }
    });

    // 3. Late Arrivals Today
    const lateArrivalsCount = await user_logging.count({
      where: {
        log_Date: { [Op.gte]: today, [Op.lt]: tomorrow },
        status: 'Late'
      }
    });

    res.status(200).json({
      officeOccupancy,
      onTimeCount,
      lateArrivalsCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
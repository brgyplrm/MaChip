const { Op, UUIDV1, Model } = require('sequelize');
const { User, user_logging, employee_Logging_report, logged_status, attendance_status } = require('../config/sequelize.js');

exports.markAttendance = async (req, res) => {
  const { user_Id} = req.body;

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
    const todayStr = now.toISOString().split('T')[0];

    const lastLog = await user_logging.findOne({
      where: { user_id: user_Id },
      order: [['user-loggingId', 'DESC']]
    });
    
    let nextStatus = 1;
    if (lastLog && lastLog.time_LoggedStatus === 1) {
      nextStatus = 2;
    }
    
    let attendanceVal = 1;
    if (nextStatus == 1) {
      const hour = now.getHours();
      if (hour >= 9 && hour < 17) attendanceVal = 2;
    }
    
    
    const newLog = await user_logging.create({
        user_id: user_Id,
        log_Date: now,
        time_Logged: now.toTimeString().split(' ')[0],
        time_LoggedStatus: nextStatus,
        attendance: attendanceVal
      });
      
    return res.status(201).json({
      message: `User ${nextStatus === 1 ? 'logged in' : 'logged out'} successfully`,
      data: newLog
    });
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
          },
            {
              model: logged_status,
              as: 'loggedStatus',
              attributes: ['statusName']
            },
            {
              model: attendance_status,
              as: 'attendanceStatus',
              attributes: ['statusName']
            }
          ],
          order: [['user_loggingId', 'DESC']]
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
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

        let log = await user_logging.findOne({
            where: {
                user_id: user_Id,
                log_Date: {
                    [Op.gte]: today,
                    [Op.lt]: tomorrow
                }
            },
            order: [['user_loggingId', 'DESC']]
        });

        const fivePM = new Date(now);
        fivePM.setHours(17, 0, 0, 0);

        if (!log) {
            if (now >= fivePM) {
                // No login record found and it's past 5:00 PM, mark as Absent
                
                log = await user_logging.create({
                    user_id: user_Id,
                    log_Date: logDate,
                    time_Logged: '17:00:00',
                    time_LoggedStatus: 2,
                    attendance: 3
                });
                return res.status(201).json({ message: 'User marked as Absent', data: log });
            }
            return res.status(404).json({ error: 'No attendance record found for today' });
        }

        // If it's already marked as Absent or On-Leave, don't override with On-time/Late
        if (log.attendance === '3' || log.attendance === '4') {
            return res.status(200).json({ message: 'Attendance status finalized', data: log });
      }      
      
      const firstLog = await user_logging.findOne({
        where: {
          user_id: user_Id,
          log_date: today,
          time_LoggedStatus: 1
        },
        order: [['user_loggingId', 'ASC']]
      });
      
      if (firstLog) {
        const [hours, minutes] = firstLog.time_Logged.split(':');
        const loginHour = parseInt(hours);
        
        let newAttendanceStatus = 1;
        if (loginHour >= 9) {
          newAttendanceStatus = 2;
      }
      
      firstLog.attendance = newAttendanceStatus;
      await firstLog.save();
      
      return res.status(200).json({ message: 'Attendance status updated', data: firstLog });
      
    }
      
      res.status(200).json({ message: 'Attendance status updated', data: log });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // 1. Office Occupancy (Logged in but not logged out today)
    const officeOccupancy = await user_logging.count({
      where: {
        log_Date: { [Op.gte]: today },
        time_LoggedStatus: 1
      }
    });

    // 2. On-time Today
    const onTimeCount = await user_logging.count({
      where: {
        log_Date: { [Op.gte]: today },
        attendance: 1
      }
    });

    // 3. Late Arrivals Today
    const lateArrivalsCount = await user_logging.count({
      where: {
        log_Date: { [Op.gte]: today },
        attendance: 2
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
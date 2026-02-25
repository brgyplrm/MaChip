module.exports = (sequelize, DataTypes) => {

  const logged_status = sequelize.define('logged_status', {
    statusId: { type: DataTypes.TINYINT(1), primaryKey: true },
    statusName: { type: DataTypes.STRING, allowNull: false },
  }, {
    timestamps: false
  });
  
  const attendance_status = sequelize.define('attendance_status', {
    statusId: { type: DataTypes.TINYINT(1), primaryKey: true },
    statusName: { type: DataTypes.STRING, allowNull: false },
  }, {
    timestamps: false
  });
  
  const user_logging = sequelize.define('user_logging', {
    user_id: { type: DataTypes.STRING, allowNull: false },
    user_loggingId: { type: DataTypes.INTEGER, allowNull: false, unique: true, primaryKey: true, autoIncrement: true },
    log_Date: { type: DataTypes.DATE, allowNull: false },
    time_Logged: { type: DataTypes.TIME, allowNull: false },
    time_LoggedStatus: { type: DataTypes.TINYINT(1), allowNull:false, defaultValue: 1 },
    attendance: { type: DataTypes.TINYINT(1), allowNull:false, defaultValue: 1 },
  }, {
    timestamps: false,
    freezeTableName: true
  });
  
  user_logging.belongsTo(attendance_status,
    {
      foreignKey: 'attendance',
      targetKey: 'statusId',
      as: 'attendanceStatus'
    });
  
  attendance_status.hasMany(user_logging,
    {
      foreignKey: 'attendance',
      sourceKey: 'statusId',
    });
  
  user_logging.belongsTo(logged_status,
    {
      foreignKey: 'time_LoggedStatus',
      targetKey: 'statusId',
      as: 'loggedStatus'
    });
  
  logged_status.hasMany(user_logging,
    {
      foreignKey: 'time_LoggedStatus',
      sourceKey: 'statusId',
    });
  

  const employee_Logging_report = sequelize.define('employee_Logging_report', {
    user_loggingId: { type: DataTypes.INTEGER, allowNull: false },
    employee_Logging_reportId: { type: DataTypes.INTEGER, allowNull: false, unique: true, primaryKey: true, autoIncrement: true },
    log_Date: { type: DataTypes.DATE, allowNull: false },
    time_Logged_inArr: { type: DataTypes.STRING, allowNull: false },
    time_Logged_outArr: { type: DataTypes.STRING, allowNull: true },
  }, {
    timestamps: false,
    freezeTableName: true
  });
  
  user_logging.hasMany(employee_Logging_report, { foreignKey: 'user_loggingId' });
  employee_Logging_report.belongsTo(user_logging, { foreignKey: 'user_loggingId' });

  return { user_logging, employee_Logging_report, logged_status, attendance_status };
};
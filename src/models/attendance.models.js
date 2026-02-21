module.exports = (sequelize, DataTypes) => {
  const user_logging = sequelize.define('user_logging', {
    user_id: { type: DataTypes.STRING, allowNull: false },
    user_loggingId: { type: DataTypes.INTEGER, allowNull: false, unique: true, primaryKey: true, autoIncrement: true },
    log_Date: { type: DataTypes.DATE, allowNull: false },
    time_Logged_in: { type: DataTypes.TIME, allowNull: false },
    time_Logged_out: { type: DataTypes.TIME, allowNull: true },
    log_Type: { type: DataTypes.ENUM('Login', 'Logout'), allowNull: false },
    location: { type: DataTypes.ENUM('Office'), allowNull: true },
  });

  const employee_Logging_report = sequelize.define('employee_Logging_report', {
    user_loggingId: { type: DataTypes.INTEGER, allowNull: false },
    employee_Logging_reportId: { type: DataTypes.INTEGER, allowNull: false, unique: true, primaryKey: true, autoIncrement: true },
    log_Date: { type: DataTypes.DATE, allowNull: false },
    time_Logged_inArr: { type: DataTypes.STRING, allowNull: false },
    time_Logged_outArr: { type: DataTypes.STRING, allowNull: true },
  });

  return { user_logging, employee_Logging_report };
};
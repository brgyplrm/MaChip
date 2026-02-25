const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_DATABASE,
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 4000,
    dialect: 'mysql',
    define: {
      freezeTableName: true, // Stops "Users" vs "User" duplicates
    },
    dialectOptions: {
      ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true 
      }
    },
    logging: false, 
    pool: {
      max: 10,        
      min: 0,         
      acquire: 30000, 
      idle: 10000     
    }
  }
);


// 2. Define all models by passing the sequelize instance
const User = require('../models/user.models')(sequelize, DataTypes);
const { user_logging, employee_Logging_report, logged_status, attendance_status } = require('../models/attendance.models')(sequelize, DataTypes);

// 3. Define associations
User.hasMany(user_logging, { foreignKey: 'user_id', sourceKey: 'user_Id' });
user_logging.belongsTo(User, { foreignKey: 'user_id', targetKey: 'user_Id', as: 'user' });

// 4. The connectDB function remains the same
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection to the database has been established successfully.');
    // Synchronize models (e.g., create tables if they don't exist)
    await sequelize.sync();
    console.log('All models were synchronized successfully.');
    
    const status_count = await logged_status.count()
    if (status_count == 0) {
      await logged_status.bulkCreate([
        { statusId: 1, statusName: 'Logged In' },
        { statusId: 2, statusName: 'Logged Out' }
      ]);
      console.log('Logged status data inserted successfully.');
    }
     
    const attendance_count = await attendance_status.count();
    if (attendance_count == 0) {
      await attendance_status.bulkCreate([
        { statusId: 1, statusName: 'On-Time' },
        { statusId: 2, statusName: 'Late' },
        { statusId: 3, statusName: 'Absent' },
        { statusId:  4, statusName: 'On-Leave' }
      ]);
      console.log('Attendance status data inserted successfully');
      }
    
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

// 5. Export everything
module.exports = {
  sequelize,
  connectDB,
  User,
  user_logging,
  employee_Logging_report,
  logged_status,
  attendance_status,
};

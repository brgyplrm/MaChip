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
const { user_logging, employee_Logging_report } = require('../models/attendance.models')(sequelize, DataTypes);

// 3. Define associations
User.hasMany(user_logging, { foreignKey: 'user_id', sourceKey: 'user_Id' });
user_logging.belongsTo(User, { foreignKey: 'user_id', targetKey: 'user_Id', as: 'user' });

user_logging.hasMany(employee_Logging_report, { foreignKey: 'user_loggingId' });
employee_Logging_report.belongsTo(user_logging, { foreignKey: 'user_loggingId' });

// 4. The connectDB function remains the same
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection to the database has been established successfully.');
    // Synchronize models (e.g., create tables if they don't exist)
    await sequelize.sync({ alter: true });
    console.log('All models were synchronized successfully.');
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
};

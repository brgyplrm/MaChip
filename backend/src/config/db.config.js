require("dotenv").config({ path: require('path').join(__dirname, "../../.env") });

module.exports = {
  development: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST || "127.0.0.1",
    port: process.env.DB_PORT || 5432,
    dialect: "postgres",
    timezone: "+08:00",
    define: {
      freezeTableName: true,
      useUTC: false,
      dateStrings: true,
      typeCast: true,
    },
    logging: false,
    pool: {
      max: 20,
      min: 2,
      acquire: 60000,
      idle: 10000,
    },
  },
  test: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE_TEST || process.env.DB_DATABASE || "machipdb_uat",
    host: process.env.DB_HOST || "127.0.0.1",
    port: process.env.DB_PORT || 5432,
    dialect: "postgres",
  },
  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    logging: false,
    pool: {
      max: 20,
      min: 2,
      acquire: 60000,
      idle: 10000,
    },
  },
};

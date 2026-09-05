'use strict';
const { sequelize } = require('../src/config/sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log("Starting dynamic additive schema synchronization...");
    
    const models = sequelize.models;
    const existingTables = await queryInterface.showAllTables();

    for (const modelName in models) {
      const model = models[modelName];
      const tableName = model.tableName;

      // 1. If table does not exist, create it
      if (!existingTables.includes(tableName)) {
        console.log(`Creating missing table: ${tableName}`);
        // Extract attributes from model for createTable
        const attributes = {};
        for (const attrName in model.getAttributes()) {
          attributes[attrName] = model.getAttributes()[attrName];
        }
        await queryInterface.createTable(tableName, attributes);
      } else {
        // 2. If table exists, check for missing columns
        const tableInfo = await queryInterface.describeTable(tableName);
        const modelAttributes = model.getAttributes();

        for (const attrName in modelAttributes) {
          if (!tableInfo[attrName]) {
            console.log(`Adding missing column '${attrName}' to table '${tableName}'`);
            
            const attributeDef = modelAttributes[attrName];
            
            // Clean up model-specific properties that queryInterface.addColumn doesn't need/like
            const columnDef = {
              type: attributeDef.type,
              allowNull: attributeDef.allowNull,
              defaultValue: attributeDef.defaultValue,
              primaryKey: attributeDef.primaryKey,
              autoIncrement: attributeDef.autoIncrement,
              unique: attributeDef.unique,
              comment: attributeDef.comment
            };

            await queryInterface.addColumn(tableName, attrName, columnDef);
          }
        }
      }
    }
    
    console.log("Dynamic synchronization complete.");
  },

  down: async (queryInterface, Sequelize) => {
    console.log("Down migration for dynamic sync is a no-op to preserve data.");
  }
};

const { SystemSettings, Holiday } = require("../config/sequelize.js");
const { getSystemTime } = require("../utils/systemTime.js");
const { QueryTypes } = require("sequelize");

exports.getHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.findAll({
      order: [['date', 'ASC']]
    });
    res.status(200).json(holidays);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSystemSettings = async (req, res) => {
  try {
    const settings = await SystemSettings.findOne();
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateSystemSettings = async (req, res) => {
  const { mockTimeEnabled, mockTimeValue } = req.body;
  try {
    const settings = await SystemSettings.findOne();
    if (!settings) {
      await SystemSettings.create({ mockTimeEnabled, mockTimeValue });
    } else {
      await settings.update({ mockTimeEnabled, mockTimeValue });
    }
    res.status(200).json({ message: "System settings updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSystemTime = async (req, res) => {
  try {
    const now = await getSystemTime();
    res.status(200).json({ systemTime: now });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const { Position } = require("../config/sequelize.js");
const { logAudit } = require("../utils/logger");

exports.getPositions = async (req, res) => {
  try {
    const positions = await Position.findAll({
      order: [['title', 'ASC']]
    });
    res.status(200).json(positions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPositionById = async (req, res) => {
  try {
    const { id } = req.params;
    const position = await Position.findByPk(id);
    if (!position) {
      return res.status(404).json({ error: "Position not found." });
    }
    res.status(200).json(position);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createPosition = async (req, res) => {
  try {
    const { title, department, baseMonthlyPay, baseDailyRate } = req.body;
    if (!title || !department) {
      return res.status(400).json({ error: "Title and department are required." });
    }
    const position = await Position.create({
      title,
      department,
      baseMonthlyPay: parseFloat(baseMonthlyPay) || 0,
      baseDailyRate: parseFloat(baseDailyRate) || 0
    });

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logAudit(req, currentAdminId, "System Settings", "CREATE_POSITION", "Position", position.positionId, null, position.toJSON());

    res.status(201).json(position);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updatePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, department, baseMonthlyPay, baseDailyRate } = req.body;

    const position = await Position.findByPk(id);
    if (!position) {
      return res.status(404).json({ error: "Position not found." });
    }

    const oldData = position.toJSON();
    await position.update({
      title,
      department,
      baseMonthlyPay: parseFloat(baseMonthlyPay) || 0,
      baseDailyRate: parseFloat(baseDailyRate) || 0
    });
    const newData = position.toJSON();

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logAudit(req, currentAdminId, "System Settings", "UPDATE_POSITION", "Position", position.positionId, oldData, newData);

    res.status(200).json(position);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deletePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const position = await Position.findByPk(id);
    if (!position) {
      return res.status(404).json({ error: "Position not found." });
    }

    const oldData = position.toJSON();
    await position.destroy();

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logAudit(req, currentAdminId, "System Settings", "DELETE_POSITION", "Position", id, oldData, null);

    res.status(200).json({ message: "Position deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const { User } = require('../config/sequelize.js');

exports.createTempUser = async (req, res) => {
  try {
    // This 'req.body' is where your temp data lives
    const newUser = await User.create(req.body);
    res.status(201).json({ message: "Temp User Added!", data: newUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
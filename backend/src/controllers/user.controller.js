const { User } = require('../config/sequelize.js');

exports.registerUser = async (req, res) => {
  try {

    const newUser = await User.create({ 
      user_Id: req.body.user_Id,
      user_FirstName: req.body.user_FirstName,
      user_LastName: req.body.user_LastName,
      user_MiddleName: req.body.user_MiddleName,
      user_MachipId: req.body.user_MachipId,
      user_Role: req.body.user_Role || 'Employee', // Default role is Employee
    });
    
    res.status(201).json({ message: "User Registered!", data: newUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// This will fetch all users from MySQL
exports.viewAllUsers = async (req, res) => {
    try {
        const users = await User.findAll();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.viewUserById = async (req, res) => {
  const { user_Id } = req.params;
  try {
    const user = await User.findOne({ where: { user_Id: user_Id } });
    if (user) {
      res.status(200).json(user);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  const { user_Id } = req.params;

  try {
    const deleted = await User.destroy({ where: { user_Id: user_Id } });
    if (deleted) {
      res.status(200).json({ message: 'User deleted successfully' });
    }
    else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  const { user_Id } = req.params;
  const { user_FirstName, user_LastName, user_MiddleName, user_MachipId, user_Role } = req.body;

  try {
    const [updated] = await User.update(
      { user_FirstName, user_LastName, user_MiddleName, user_MachipId, user_Role },
      { where: { user_Id: user_Id } }
    );

    if (updated) {
      const updatedUser = await User.findOne({ where: { user_Id: user_Id } });
      res.status(200).json({ message: 'User updated successfully', data: updatedUser });
    }
    else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
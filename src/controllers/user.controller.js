const { User } = require('../config/sequelize.js');

exports.registerUser = async (req, res) => {
  try {

    const newUser = await User.create({ 
      user_Number: req.body.user_Number,
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

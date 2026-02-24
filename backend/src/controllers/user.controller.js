const { User } = require('../config/sequelize.js');

exports.getNextUserId = async (req, res) => {
  try {
    const lastUser = await User.findOne({ order: [['user_Number', 'DESC']] });
    const nextNumber = (lastUser ? lastUser.user_Number : 0) + 1;
    const nextId = `MACJ-${String(nextNumber).padStart(3, '0')}`;
    res.status(200).json({ nextId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.generateRfid = async (req, res) => {
  try {
    const generatedRfid = Math.random().toString(36).substr(2, 9).toUpperCase();
    res.status(200).json({ rfid: generatedRfid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.registerUser = async (req, res) => {
  try {
    const { user_FirstName, user_LastName, user_MachipId } = req.body;

    // 1. Validate for missing required fields (excluding user_Id as we generate it)
    if (!user_FirstName || !user_LastName || !user_MachipId) {
      return res.status(400).json({ error: 'Missing required fields. Please fill out all required inputs.' });
    }

    // 2. Generate the next user_Id
    const lastUser = await User.findOne({ order: [['user_Number', 'DESC']] });
    const nextNumber = (lastUser ? lastUser.user_Number : 0) + 1;
    const generatedUserId = `MACJ-${String(nextNumber).padStart(3, '0')}`;

    if (req.body.user_MiddleName && /\d/.test(req.body.user_MiddleName)) {
      return res.status(400).json({ error: 'Middle Name must not contain numbers.' });
    }

    // 3. Create the user
    const newUser = await User.create({ 
      user_Id: generatedUserId,
      user_Username: req.body.user_Username,
      user_FirstName: req.body.user_FirstName,
      user_LastName: req.body.user_LastName,
      user_MiddleName: req.body.user_MiddleName,
      user_Email: req.body.user_Email,
      user_Password: req.body.user_Password,
      user_MachipId: req.body.user_MachipId,
      user_Role: req.body.user_Role || 'Employee', // Default role is Employee
    });
    
    res.status(201).json({ message: "User Registered!", data: newUser });
  } catch (error) {
    // Catch other potential errors (like database connection issues)
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

    if (req.body.user_MiddleName && /\d/.test(req.body.user_MiddleName)) {
      return res.status(400).json({ error: 'Middle Name must not contain numbers.' });
    }
    
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


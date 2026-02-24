const { User } = require('../config/sequelize.js');
const bcrypt = require('bcryptjs');

exports.loginUser = async (req, res) => {
    const { user_Id, password } = req.body;

    if (!user_Id || !password) {
        return res.status(400).json({ error: 'user_Id and password are required' });
    }

    try {
        const user = await User.findOne({ where: { user_Id: user_Id } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.user_Password);
        if (isMatch) {
            res.status(200).json({ message: 'Login successful', data: user });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
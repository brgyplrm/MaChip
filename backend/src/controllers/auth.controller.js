<<<<<<< HEAD
const { User } = require("../config/sequelize.js");
const bcrypt = require("bcryptjs");

exports.loginUser = async (req, res) => {
  const { user_Id, password } = req.body;

  console.log("[AUTH] Body received:", {
    user_Id,
    password: password ? "***" : undefined,
  });

  if (!user_Id || !password) {
    return res
      .status(400)
      .json({ error: "User ID and password are required." });
  }

  try {
    const user = await User.findOne({ where: { user_Id } });

    console.log(
      "[AUTH] User found:",
      user ? `yes (role: ${user.user_Role})` : "no",
    );

    if (!user) {
      return res.status(401).json({ error: "Invalid user ID or password." });
    }

    const isMatch = await bcrypt.compare(password, user.user_Password);

    console.log("[AUTH] Password match:", isMatch);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid user ID or password." });
    }

    if (user.user_Role !== "Admin") {
      console.log("[AUTH] Role denied:", user.user_Role);
      return res.status(403).json({ error: "Access denied. Admins only." });
    }

    // Strip password before sending back to client
    const { user_Password, ...userData } = user.toJSON();

    return res
      .status(200)
      .json({ message: "Login successful.", data: userData });
  } catch (error) {
    console.error("[AUTH] Error:", error.message);
    return res
      .status(500)
      .json({ error: "An internal server error occurred." });
  }
};
=======
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
>>>>>>> main

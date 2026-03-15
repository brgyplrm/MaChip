const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const bcrypt = require("bcryptjs");

exports.loginUser = async (req, res) => {
  const { user_Id, password } = req.body || {};

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
    const result = await sequelize.query(
      `SELECT u.*, r."roleName" as "user_Role"
       FROM "User" u
       LEFT JOIN "user_Role" r ON u."user_RoleId" = r."roleId"
       WHERE u."user_Id" = :user_Id
       AND u."deletedAt" IS NULL`,
      {
        replacements: { user_Id },
        type: QueryTypes.SELECT,
      },
    );

    const user = result[0];

    console.log(
      "[AUTH] User found:",
      user ? `yes (role: ${user.user_RoleId} - ${user.user_Role})` : "no",
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
    const { user_Password, ...userData } = user;

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

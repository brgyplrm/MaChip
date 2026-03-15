const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const bcrypt = require("bcryptjs");

// ── Get Next User ID ──────────────────────────────────────────────────────────
exports.getNextUserId = async (req, res) => {
  try {
    const result = await sequelize.query(
      `SELECT MAX("user_Id") AS "maxId" FROM "User"`,
      { type: QueryTypes.SELECT },
    );
    const nextId = (result[0].maxId ? parseInt(result[0].maxId) : 0) + 1;
    res.status(200).json({
      nextId,
      displayId: `MACJ-${String(nextId).padStart(3, "0")}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Generate RFID ─────────────────────────────────────────────────────────────
exports.generateRfid = async (req, res) => {
  try {
    const generatedRfid = Math.random().toString(36).substr(2, 9).toUpperCase();
    res.status(200).json({ rfid: generatedRfid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Register User ─────────────────────────────────────────────────────────────
exports.registerUser = async (req, res) => {
  try {
    const { user_FirstName, user_LastName, user_MachipId } = req.body || {};

    if (!user_FirstName || !user_LastName || !user_MachipId) {
      return res.status(400).json({
        error: "Missing required fields. Please fill out all required inputs.",
      });
    }

    if (req.body.user_MiddleName && /\d/.test(req.body.user_MiddleName)) {
      return res
        .status(400)
        .json({ error: "Middle Name must not contain numbers." });
    }

    // Get next ID
    const result = await sequelize.query(
      `SELECT MAX("user_Id") AS "maxId" FROM "User"`,
      { type: QueryTypes.SELECT },
    );
    const nextId = (result[0].maxId ? parseInt(result[0].maxId) : 0) + 1;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.user_Password, salt);

    // Insert new user
    await sequelize.query(
      `INSERT INTO "User" (
        "user_Id", "user_FirstName", "user_LastName",
        "user_MiddleName", "user_Email", "user_Password", "user_MachipId", "user_RoleId", "user_EmploymentStatusId", "createdAt", "updatedAt"
      ) VALUES (
        :user_Id, :user_FirstName, :user_LastName,
        :user_MiddleName, :user_Email, :user_Password, :user_MachipId, :user_RoleId, :user_EmploymentStatusId, NOW(), NOW()
      )`,
      {
        replacements: {
          user_Id: nextId,
          user_FirstName: req.body.user_FirstName,
          user_LastName: req.body.user_LastName,
          user_MiddleName: req.body.user_MiddleName || null,
          user_Email: req.body.user_Email || null,
          user_Password: hashedPassword,
          user_MachipId: req.body.user_MachipId,
          user_RoleId: req.body.user_RoleId || 2,
          user_EmploymentStatusId: req.body.user_EmploymentStatusId || 1,
        },
        type: QueryTypes.INSERT,
      },
    );

    // Fetch the created user to return
    const newUser = await sequelize.query(
      `SELECT * FROM "User" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id: nextId }, type: QueryTypes.SELECT },
    );

    res.status(201).json({ message: "User Registered!", data: newUser[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── View All Users ────────────────────────────────────────────────────────────
exports.viewAllUsers = async (req, res) => {
  try {
    const users = await sequelize.query(
      `SELECT * FROM "User" WHERE "deletedAt" IS NULL`,
      { type: QueryTypes.SELECT },
    );
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── View User By ID ───────────────────────────────────────────────────────────
exports.viewUserById = async (req, res) => {
  const { user_Id } = req.params;
  try {
    const user = await sequelize.query(
      `SELECT * FROM "User" WHERE "user_Id" = :user_Id AND "deletedAt" IS NULL`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );
    if (user.length > 0) {
      res.status(200).json(user[0]);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Soft Delete User ──────────────────────────────────────────────────────────
exports.deleteUser = async (req, res) => {
  const { user_Id } = req.params;
  const currentAdminId = req.user
    ? req.user.user_Id
    : req.headers["x-admin-id"];

  try {
    if (currentAdminId && parseInt(currentAdminId) === parseInt(user_Id)) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const result = await sequelize.query(
      `UPDATE "User" SET "deletedAt" = NOW()
       WHERE "user_Id" = :user_Id AND "deletedAt" IS NULL`,
      { replacements: { user_Id }, type: QueryTypes.UPDATE },
    );

    // result[1] = number of affected rows
    if (result[1] > 0) {
      res.status(200).json({ message: "User soft-deleted successfully." });
    } else {
      res.status(404).json({ message: "User not found." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Restore Soft-Deleted User ─────────────────────────────────────────────────
exports.restoreUser = async (req, res) => {
  const { user_Id } = req.params;

  try {
    // Check if user exists (including soft-deleted)
    const user = await sequelize.query(
      `SELECT * FROM "User" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }
    if (!user[0].deletedAt) {
      return res.status(400).json({ message: "User is not deleted." });
    }

    await sequelize.query(
      `UPDATE "User" SET "deletedAt" = NULL WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.UPDATE },
    );

    const restored = await sequelize.query(
      `SELECT * FROM "User" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );

    res
      .status(200)
      .json({ message: "User restored successfully.", data: restored[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Force Delete User (Hard Delete) ──────────────────────────────────────────
exports.forceDeleteUser = async (req, res) => {
  const { user_Id } = req.params;
  const currentAdminId = req.user
    ? req.user.user_Id
    : req.headers["x-admin-id"];

  try {
    if (currentAdminId && parseInt(currentAdminId) === parseInt(user_Id)) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const result = await sequelize.query(
      `DELETE FROM "User" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.DELETE },
    );

    if (result[1] > 0) {
      res.status(200).json({ message: "User permanently deleted." });
    } else {
      res.status(404).json({ message: "User not found." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Update User ───────────────────────────────────────────────────────────────
exports.updateUser = async (req, res) => {
  const { user_Id } = req.params;
  const {
    user_FirstName,
    user_LastName,
    user_MiddleName,
    user_MachipId,
    user_RoleId,
    user_Password,
  } = req.body || {};

  try {
    if (user_MiddleName && /\d/.test(user_MiddleName)) {
      return res
        .status(400)
        .json({ error: "Middle Name must not contain numbers." });
    }

    // Dynamically build SET clause depending on whether password is provided
    let setClause = `
      "user_FirstName" = :user_FirstName,
      "user_LastName"  = :user_LastName,
      "user_MiddleName"= :user_MiddleName,
      "user_MachipId"  = :user_MachipId,
      "user_RoleId"    = :user_RoleId
    `;

    const replacements = {
      user_Id,
      user_FirstName,
      user_LastName,
      user_MiddleName: user_MiddleName || null,
      user_MachipId,
      user_RoleId,
    };

    if (user_Password && user_Password.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(user_Password, salt);
      setClause += `, "user_Password" = :user_Password`;
      replacements.user_Password = hashedPassword;
    }

    const result = await sequelize.query(
      `UPDATE "User" SET ${setClause} WHERE "user_Id" = :user_Id AND "deletedAt" IS NULL`,
      { replacements, type: QueryTypes.UPDATE },
    );

    if (result[1] > 0) {
      const updatedUser = await sequelize.query(
        `SELECT * FROM "User" WHERE "user_Id" = :user_Id`,
        { replacements: { user_Id }, type: QueryTypes.SELECT },
      );
      res
        .status(200)
        .json({ message: "User updated successfully", data: updatedUser[0] });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

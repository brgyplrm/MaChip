const { sequelize } = require("./src/config/sequelize");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

const getTables = async () => {
  const [results] = await sequelize.query(`
    SELECT tablename 
    FROM pg_catalog.pg_tables 
    WHERE schemaname != 'pg_catalog' 
    AND schemaname != 'information_schema';
  `);
  return results.map((r) => r.tablename);
};

const runAction = async () => {
  console.log("\x1b[36m%s\x1b[0m", "\n--- MaChip Database Management Tool ---");
  
  try {
    await sequelize.authenticate();
    console.log("✔ Database connection verified.\n");

    const tables = await getTables();
    console.log("Detected Tables:", tables.join(", "));

    console.log("\nChoose an action:");
    console.log("1. TRUNCATE all tables (CASCADE + RESTART IDENTITY)");
    console.log("2. DROP all tables (CASCADE)");
    console.log("3. Selective TRUNCATE (Checklist)");
    console.log("q. Quit");

    const choice = await askQuestion("\nEnter choice: ");

    if (choice === "1") {
      const confirm = await askQuestion("\x1b[31mWARNING: This will delete ALL data in ALL tables. Type 'YES' to proceed: \x1b[0m");
      if (confirm === "YES") {
        console.log("Truncating...");
        for (const table of tables) {
          await sequelize.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);
          console.log(`- Truncated: ${table}`);
        }
        console.log("\x1b[32m%s\x1b[0m", "\n✔ All tables truncated and identities restarted.");
      } else {
        console.log("Action cancelled.");
      }
    } else if (choice === "2") {
      const confirm = await askQuestion("\x1b[31mDANGER: This will DROP ALL tables. Type 'DESTROY' to proceed: \x1b[0m");
      if (confirm === "DESTROY") {
        console.log("Dropping...");
        for (const table of tables) {
          await sequelize.query(`DROP TABLE IF EXISTS "${table}" CASCADE;`);
          console.log(`- Dropped: ${table}`);
        }
        console.log("\x1b[32m%s\x1b[0m", "\n✔ All tables dropped.");
      } else {
        console.log("Action cancelled.");
      }
    } else if (choice === "3") {
      console.log("\n--- Selective Truncate Checklist ---");
      for (const table of tables) {
        const confirm = await askQuestion(`Truncate "${table}"? (y/n): `);
        if (confirm.toLowerCase() === "y") {
          await sequelize.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);
          console.log(`  ✔ Truncated "${table}" with CASCADE and RESTART IDENTITY`);
        }
      }
    } else {
      console.log("Goodbye.");
    }

  } catch (error) {
    console.error("\x1b[31m%s\x1b[0m", "\n✖ Error: " + error.message);
  } finally {
    rl.close();
    process.exit();
  }
};

runAction();

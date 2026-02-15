const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/sequelize'); // Import connectDB

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Connect to the database
connectDB();

// Import the sequelize instance for raw queries
const { sequelize } = require('./config/sequelize');

// Basic route for testing
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to MaChip API.' });
});

// New route for testing database queries
app.get('/test-query', async (req, res) => {
  try {
    const [results, metadata] = await sequelize.query('SELECT 1+1 AS result');
    res.json({ message: 'Database query successful!', result: results });
  } catch (error) {
    console.error('Error during test query:', error);
    res.status(500).json({ message: 'Database query failed.', error: error.message });
  }
});

// Define port and start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});

const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/sequelize'); // Import connectDB

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: 'http://localhost:5173', // Your Vite/React URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.static('public'));

// Connect to the database
connectDB();

// Import the sequelize instance for raw queries
const { sequelize } = require('./config/sequelize');

// Basic route for testing
app.get('/Machip', (req, res) => {
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

// Routes for users
const userRoutes = require('./routes/user.routes.js');
app.use('/api/users', userRoutes);

// Routes for authentication
const authRoutes = require('./routes/auth.routes.js');
app.use('/api/auth', authRoutes);

// Routes for attendance
const attendanceRoutes = require('./routes/attendance.routes.js');
app.use('/api/attendance', attendanceRoutes);

// Define port and start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});

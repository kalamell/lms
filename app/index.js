import express from 'express';
import mysql from 'mysql2/promise';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Database connection pool
let dbPool;
async function initDatabase() {
  try {
    dbPool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    console.log('✅ Database connected');
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    setTimeout(initDatabase, 5000);
  }
}

// Redis connection
let redisClient;
async function initRedis() {
  try {
    redisClient = createClient({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD
    });

    redisClient.on('error', (err) => console.log('Redis Client Error:', err));
    redisClient.on('connect', () => console.log('✅ Redis connected'));

    await redisClient.connect();
  } catch (err) {
    console.error('❌ Redis connection error:', err.message);
    setTimeout(initRedis, 5000);
  }
}

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Hello World! 🚀',
    status: 'LMS App is running',
    services: {
      database: dbPool ? '✅ Connected' : '❌ Disconnected',
      redis: redisClient?.isOpen ? '✅ Connected' : '❌ Disconnected'
    }
  });
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const dbStatus = dbPool ? 'ok' : 'error';
    const redisStatus = redisClient?.isOpen ? 'ok' : 'error';

    res.json({
      status: 'ok',
      database: dbStatus,
      redis: redisStatus
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Test database connection
app.get('/test/db', async (req, res) => {
  try {
    if (!dbPool) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    const connection = await dbPool.getConnection();
    const [rows] = await connection.query('SELECT 1 as connection_test');
    connection.release();
    res.json({ success: true, message: 'Database connection OK', data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test redis connection
app.get('/test/redis', async (req, res) => {
  try {
    if (!redisClient?.isOpen) {
      return res.status(503).json({ error: 'Redis not connected' });
    }
    await redisClient.set('test-key', 'test-value');
    const value = await redisClient.get('test-key');
    res.json({ success: true, message: 'Redis connection OK', value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
async function startServer() {
  await initDatabase();
  await initRedis();

  app.listen(port, () => {
    console.log(`\n🎓 LMS App listening on http://localhost:${port}`);
    console.log(`📊 Services:`);
    console.log(`   - Database: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    console.log(`   - Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
    console.log(`\n🔗 Available endpoints:`);
    console.log(`   - GET / - Hello World`);
    console.log(`   - GET /health - Health check`);
    console.log(`   - GET /test/db - Test database`);
    console.log(`   - GET /test/redis - Test Redis`);
  });
}

startServer().catch(console.error);

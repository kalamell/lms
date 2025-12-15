import mysql from 'mysql2/promise';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// Database connection pools
let lmsDb = null;
let tescoDb = null;
let redisClient = null;

// Initialize LMS Database
export async function initLmsDatabase() {
  try {
    lmsDb = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    console.log('✅ Database connected (lms_database)');
    return lmsDb;
  } catch (err) {
    console.error('❌ LMS Database connection error:', err.message);
    throw err;
  }
}

// Initialize Tesco E-Learning Database
export async function initTescoDatabase() {
  try {
    tescoDb = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'tesco_elearning',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    console.log('✅ Database connected (tesco_elearning)');
    return tescoDb;
  } catch (err) {
    console.error('❌ Tesco Database connection error:', err.message);
    throw err;
  }
}

// Initialize Redis
export async function initRedis() {
  try {
    redisClient = createClient({
      socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
      },
      password: process.env.REDIS_PASSWORD
    });

    redisClient.on('error', (err) => console.log('❌ Redis Client Error:', err));
    redisClient.on('connect', () => console.log('✅ Redis connected'));

    await redisClient.connect();
    return redisClient;
  } catch (err) {
    console.error('❌ Redis connection error:', err.message);
    setTimeout(initRedis, 5000);
  }
}

// Get LMS Database pool
export function getLmsDb() {
  return lmsDb;
}

// Get Tesco Database pool
export function getTescoDb() {
  return tescoDb;
}

// Get Redis client
export function getRedis() {
  return redisClient;
}

export default {
  initLmsDatabase,
  initTescoDatabase,
  initRedis,
  getLmsDb,
  getTescoDb,
  getRedis
};

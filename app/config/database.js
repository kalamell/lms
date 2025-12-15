import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Database connection pools
let lmsDb = null;
let tescoDb = null;

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

// Get LMS Database pool
export function getLmsDb() {
  return lmsDb;
}

// Get Tesco Database pool
export function getTescoDb() {
  return tescoDb;
}

export default {
  initLmsDatabase,
  initTescoDatabase,
  getLmsDb,
  getTescoDb
};

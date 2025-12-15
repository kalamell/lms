import express from 'express';
import authRoutes from './auth.js';
import dashboardRoutes from './dashboard.js';
import settingsRoutes from './settings.js';
import courseRoutes from './course.js';
import uploadRoutes from './upload.js';
import userRoutes from './user.js';

const router = express.Router();

// ============================================
// Main Router - combines all route modules
// ============================================

// Auth routes (login, logout, SSO)
router.use('/', authRoutes);

// Dashboard routes
router.use('/', dashboardRoutes);

// Settings routes (organization management)
router.use('/settings', settingsRoutes);

// Course routes (course management)
router.use('/course', courseRoutes);

// Upload routes (file management)
router.use('/upload', uploadRoutes);

// User routes (user management)
router.use('/user', userRoutes);

// ============================================
// Root redirect
// ============================================
router.get('/', (req, res) => {
  if (req.session && req.session.user) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

// Legacy redirect
router.get('/home', (req, res) => {
  res.redirect('/dashboard');
});

// Redirect /courses to /course
router.get('/courses', (req, res) => {
  res.redirect('/course');
});

export default router;

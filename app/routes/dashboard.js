import express from 'express';
import DashboardController from '../controllers/DashboardController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// ============================================
// Dashboard Routes (require authentication)
// ============================================
router.get('/dashboard', requireAuth, (req, res) => DashboardController.index(req, res));
router.get('/analytics', requireAuth, (req, res) => DashboardController.analytics(req, res));

export default router;

import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import UserController from '../controllers/UserController.js';

const router = express.Router();

// Apply auth middleware to all user routes
router.use(requireAuth);

// ============================================
// API Routes (must be before :id to prevent matching)
// ============================================
router.get('/api/search', (req, res) => UserController.apiSearch(req, res));
router.get('/api/stats', (req, res) => UserController.apiStats(req, res));
router.get('/api/:id', (req, res) => UserController.apiGet(req, res));
router.get('/api/:id/courses', (req, res) => UserController.apiCourseHistory(req, res));

// ============================================
// User Routes
// ============================================
router.get('/', (req, res) => UserController.index(req, res));
router.get('/:id', (req, res) => UserController.show(req, res));
router.get('/:id/edit', (req, res) => UserController.edit(req, res));
router.post('/:id/edit', (req, res) => UserController.update(req, res));
router.post('/:id/delete', (req, res) => UserController.destroy(req, res));

export default router;

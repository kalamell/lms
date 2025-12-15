import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import FormatController from '../controllers/settings/FormatController.js';
import FunctionsController from '../controllers/settings/FunctionsController.js';
import DepartmentController from '../controllers/settings/DepartmentController.js';
import QuizController from '../controllers/QuizController.js';

const router = express.Router();

// Apply auth middleware to all settings routes
router.use(requireAuth);

// ============================================
// Format Routes
// ============================================
router.get('/format', (req, res) => FormatController.index(req, res));
router.get('/format/create', (req, res) => FormatController.create(req, res));
router.post('/format/create', (req, res) => FormatController.store(req, res));
router.get('/format/:id/edit', (req, res) => FormatController.edit(req, res));
router.post('/format/:id/edit', (req, res) => FormatController.update(req, res));
router.post('/format/:id/delete', (req, res) => FormatController.destroy(req, res));

// ============================================
// Functions Routes
// ============================================
router.get('/functions', (req, res) => FunctionsController.index(req, res));
router.get('/functions/create', (req, res) => FunctionsController.create(req, res));
router.post('/functions/create', (req, res) => FunctionsController.store(req, res));
router.get('/functions/:id/edit', (req, res) => FunctionsController.edit(req, res));
router.post('/functions/:id/edit', (req, res) => FunctionsController.update(req, res));
router.post('/functions/:id/delete', (req, res) => FunctionsController.destroy(req, res));

// ============================================
// Department Routes
// ============================================
router.get('/department', (req, res) => DepartmentController.index(req, res));
router.get('/department/create', (req, res) => DepartmentController.create(req, res));
router.post('/department/create', (req, res) => DepartmentController.store(req, res));
router.get('/department/:id/edit', (req, res) => DepartmentController.edit(req, res));
router.post('/department/:id/edit', (req, res) => DepartmentController.update(req, res));
router.post('/department/:id/delete', (req, res) => DepartmentController.destroy(req, res));

// ============================================
// Quiz Routes
// ============================================
router.get('/quiz', (req, res) => QuizController.index(req, res));
router.get('/quiz/create', (req, res) => QuizController.create(req, res));
router.post('/quiz/create', (req, res) => QuizController.store(req, res));
router.get('/quiz/:id/edit', (req, res) => QuizController.edit(req, res));
router.post('/quiz/:id/edit', (req, res) => QuizController.update(req, res));
router.post('/quiz/:id/delete', (req, res) => QuizController.destroy(req, res));

// Quiz Question APIs
router.post('/quiz/:id/question/abcd', (req, res) => QuizController.apiCreateQuestionAbcd(req, res));
router.get('/quiz/:id/question/abcd/:questionId', (req, res) => QuizController.apiGetQuestionAbcd(req, res));
router.put('/quiz/:id/question/abcd/:questionId', (req, res) => QuizController.apiUpdateQuestionAbcd(req, res));
router.delete('/quiz/:id/question/:questionId', (req, res) => QuizController.apiDeleteQuestion(req, res));
router.post('/quiz/:id/question/reorder', (req, res) => QuizController.apiReorderQuestions(req, res));

// Quiz API
router.get('/api/quiz', (req, res) => QuizController.apiList(req, res));
router.get('/api/quiz/:id', (req, res) => QuizController.apiGet(req, res));

// ============================================
// API Routes (Organization)
// ============================================
router.get('/api/functions/:formatId', (req, res) => FunctionsController.getByFormat(req, res));
router.get('/api/departments/:functionsId', (req, res) => DepartmentController.getByFunction(req, res));

export default router;

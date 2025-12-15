import express from 'express';
import AuthController from '../controllers/AuthController.js';
import { redirectIfAuthenticated } from '../middleware/auth.js';

const router = express.Router();

// ============================================
// Login Pages
// ============================================
router.get('/login', redirectIfAuthenticated, (req, res) => AuthController.showLogin(req, res));
router.get('/login-form', redirectIfAuthenticated, (req, res) => AuthController.showLoginForm(req, res));

// ============================================
// SSO Routes
// ============================================
router.get('/auth/sso/lotuss', (req, res) => AuthController.ssoLotuss(req, res));
router.get('/auth/sso/makro', (req, res) => AuthController.ssoMakro(req, res));

// ============================================
// Form Login Routes
// ============================================
router.post('/auth/login/makro', (req, res) => AuthController.loginMakro(req, res));
router.post('/auth/login', (req, res) => AuthController.login(req, res));

// ============================================
// Logout
// ============================================
router.get('/logout', (req, res) => AuthController.logout(req, res));

export default router;

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/auth.js';
import CourseController from '../controllers/CourseController.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup multer for course file uploads (using /storage path like Laravel)
const storageDir = path.join(__dirname, '..', 'public', 'storage', 'course');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create date-based path like Laravel: YYYY/MM/DD/HH/random
    const now = new Date();
    const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${String(now.getHours()).padStart(2, '0')}`;
    const randomDir = Math.random().toString(36).substring(2, 6);
    const targetDir = path.join(storageDir, datePath, randomDir);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Store the relative path for database
    req.uploadPath = `${datePath}/${randomDir}/`;

    cb(null, targetDir);
  },
  filename: function (req, file, cb) {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const ext = path.extname(file.originalname);
    const filename = `${dateStr}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max (for videos)
  fileFilter: function (req, file, cb) {
    // Allowed file types
    const imageTypes = /jpeg|jpg|png|gif|webp/;
    const videoTypes = /mp4|webm|mov|avi/;
    const docTypes = /pdf|doc|docx|xls|xlsx|ppt|pptx/;

    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const mimetype = file.mimetype;

    // Check images
    if (imageTypes.test(ext) || mimetype.startsWith('image/')) {
      return cb(null, true);
    }
    // Check videos
    if (videoTypes.test(ext) || mimetype.startsWith('video/')) {
      return cb(null, true);
    }
    // Check documents
    if (docTypes.test(ext) || mimetype === 'application/pdf' ||
        mimetype.includes('document') || mimetype.includes('spreadsheet') ||
        mimetype.includes('presentation')) {
      return cb(null, true);
    }

    cb(new Error('File type not allowed. Allowed: images, videos (mp4), documents (pdf, doc, xls, ppt)'));
  }
});

const courseUpload = upload.fields([
  { name: 'icon', maxCount: 1 },
  { name: 'cover', maxCount: 1 }
]);

// Apply auth middleware to all course routes
router.use(requireAuth);

// ============================================
// Course List & CRUD Routes
// ============================================
router.get('/', (req, res) => CourseController.index(req, res));
router.get('/create', (req, res) => CourseController.create(req, res));
router.post('/create', courseUpload, (req, res) => CourseController.store(req, res));
router.get('/:id/edit', (req, res) => CourseController.edit(req, res));
router.post('/:id/edit', courseUpload, (req, res) => CourseController.update(req, res));
router.post('/:id/delete', (req, res) => CourseController.destroy(req, res));
router.post('/:id/duplicate', (req, res) => CourseController.duplicate(req, res));

// ============================================
// API Routes
// ============================================
router.get('/api/list', (req, res) => CourseController.apiList(req, res));
router.get('/api/:id', (req, res) => CourseController.apiGet(req, res));

// Document APIs
router.get('/api/documents/search', (req, res) => CourseController.apiSearchDocuments(req, res));
router.get('/api/:id/documents', (req, res) => CourseController.apiGetCourseDocuments(req, res));
router.post('/api/:id/documents/add', (req, res) => CourseController.apiAddDocument(req, res));
router.post('/api/:id/documents/remove', (req, res) => CourseController.apiRemoveDocument(req, res));
router.post('/api/:id/documents/order', (req, res) => CourseController.apiUpdateDocumentOrder(req, res));

// Position APIs
router.get('/api/positions/search', (req, res) => CourseController.apiSearchPositions(req, res));
router.get('/api/:id/positions', (req, res) => CourseController.apiGetCoursePositions(req, res));
router.post('/api/:id/positions/sync', (req, res) => CourseController.apiSyncPositions(req, res));

export default router;

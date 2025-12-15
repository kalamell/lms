import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// Storage Configuration
// ============================================

// Base storage directory
const storageBase = path.join(__dirname, '..', 'public', 'storage');

// Create Laravel-style date path
function createDatePath() {
  const now = new Date();
  const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${String(now.getHours()).padStart(2, '0')}`;
  const randomDir = Math.random().toString(36).substring(2, 6);
  return `${datePath}/${randomDir}`;
}

// Get file type category
function getFileCategory(mimetype, ext) {
  if (mimetype.startsWith('image/')) return 'images';
  if (mimetype.startsWith('video/')) return 'videos';
  if (mimetype === 'application/pdf' || ext === '.pdf') return 'documents';
  if (mimetype.includes('document') || mimetype.includes('spreadsheet') ||
      mimetype.includes('presentation') || ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext)) {
    return 'documents';
  }
  return 'files';
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const category = getFileCategory(file.mimetype, ext);
    const datePath = createDatePath();
    const targetDir = path.join(storageBase, category, datePath);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Store path info in request for later use
    req.uploadInfo = {
      category,
      datePath,
      relativePath: `${category}/${datePath}/`
    };

    cb(null, targetDir);
  },
  filename: function (req, file, cb) {
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const ext = path.extname(file.originalname);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50);
    const filename = `${timestamp}.${safeName}${ext}`;
    cb(null, filename);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedImages = /jpeg|jpg|png|gif|webp|svg/;
  const allowedVideos = /mp4|webm|mov|avi|mkv/;
  const allowedDocs = /pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv/;

  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const mimetype = file.mimetype;

  // Check images
  if (allowedImages.test(ext) || mimetype.startsWith('image/')) {
    return cb(null, true);
  }
  // Check videos
  if (allowedVideos.test(ext) || mimetype.startsWith('video/')) {
    return cb(null, true);
  }
  // Check documents
  if (allowedDocs.test(ext) || mimetype === 'application/pdf' ||
      mimetype.includes('document') || mimetype.includes('spreadsheet') ||
      mimetype.includes('presentation')) {
    return cb(null, true);
  }

  cb(new Error('ไฟล์ประเภทนี้ไม่รองรับ'));
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max for videos
  },
  fileFilter: fileFilter
});

// ============================================
// Routes
// ============================================

// Apply auth middleware
router.use(requireAuth);

// Upload page
router.get('/', (req, res) => {
  res.render('upload/index', {
    pageTitle: 'File Upload',
    style: `<link rel="stylesheet" href="/theme/assets/vendor/libs/dropzone/dropzone.css" />`,
    script: ''
  });
});

// Single file upload API
router.post('/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'ไม่มีไฟล์ที่อัพโหลด' });
    }

    const file = req.file;
    const uploadInfo = req.uploadInfo;

    const result = {
      success: true,
      file: {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        originalName: file.originalname,
        filename: file.filename,
        path: uploadInfo.relativePath + file.filename,
        url: `/storage/${uploadInfo.relativePath}${file.filename}`,
        category: uploadInfo.category,
        mimetype: file.mimetype,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
        uploadedAt: new Date().toISOString()
      }
    };

    res.json(result);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Multiple files upload API
router.post('/files', upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'ไม่มีไฟล์ที่อัพโหลด' });
    }

    const uploadInfo = req.uploadInfo;
    const files = req.files.map(file => ({
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      originalName: file.originalname,
      filename: file.filename,
      path: uploadInfo.relativePath + file.filename,
      url: `/storage/${uploadInfo.relativePath}${file.filename}`,
      category: uploadInfo.category,
      mimetype: file.mimetype,
      size: file.size,
      sizeFormatted: formatFileSize(file.size),
      uploadedAt: new Date().toISOString()
    }));

    res.json({ success: true, files });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete file API
router.delete('/file', async (req, res) => {
  try {
    const { path: filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({ success: false, error: 'ไม่ได้ระบุ path ของไฟล์' });
    }

    // Security check - prevent directory traversal
    if (filePath.includes('..')) {
      return res.status(400).json({ success: false, error: 'Invalid path' });
    }

    const fullPath = path.join(storageBase, filePath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      res.json({ success: true, message: 'ลบไฟล์สำเร็จ' });
    } else {
      res.status(404).json({ success: false, error: 'ไม่พบไฟล์' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// List files API
router.get('/files', async (req, res) => {
  try {
    const { category = 'all', page = 1, limit = 50 } = req.query;
    const files = [];

    const categories = category === 'all'
      ? ['images', 'videos', 'documents', 'files']
      : [category];

    for (const cat of categories) {
      const catPath = path.join(storageBase, cat);
      if (fs.existsSync(catPath)) {
        scanDirectory(catPath, cat, files);
      }
    }

    // Sort by date (newest first)
    files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    // Pagination
    const total = files.length;
    const start = (page - 1) * limit;
    const paginatedFiles = files.slice(start, start + parseInt(limit));

    res.json({
      success: true,
      files: paginatedFiles,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper: Scan directory for files
function scanDirectory(dirPath, category, files, relativePath = '') {
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanDirectory(fullPath, category, files, path.join(relativePath, item));
    } else {
      const ext = path.extname(item).toLowerCase();
      files.push({
        id: Buffer.from(fullPath).toString('base64').substring(0, 20),
        filename: item,
        path: `${category}/${relativePath}/${item}`.replace(/\/+/g, '/'),
        url: `/storage/${category}/${relativePath}/${item}`.replace(/\/+/g, '/'),
        category,
        size: stat.size,
        sizeFormatted: formatFileSize(stat.size),
        extension: ext.replace('.', ''),
        uploadedAt: stat.mtime.toISOString()
      });
    }
  }
}

// Helper: Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default router;

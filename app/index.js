import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import session from 'express-session';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

// Config
import { initLmsDatabase, initTescoDatabase, getLmsDb, getTescoDb } from './config/database.js';

// Routes
import routes from './routes/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Debug: Log __dirname
const assetsPath = path.join(__dirname, 'assets');
console.log('📁 App directory:', __dirname);
console.log('📁 Assets path:', assetsPath);
console.log('📁 Assets exists:', fs.existsSync(assetsPath));
console.log('📁 Logo exists:', fs.existsSync(path.join(assetsPath, 'images', 'logo_axtra_ilearn_2.png')));

// Static files - MUST be before other middleware
app.use('/assets', express.static(assetsPath, {
  dotfiles: 'allow',
  index: false
}));
app.use('/theme', express.static(path.join(__dirname, 'theme')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use('/storage', express.static(path.join(__dirname, 'public', 'storage')));
app.use('/favicon.svg', express.static(path.join(__dirname, 'public', 'favicon.svg')));

// View Engine - EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'lms-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Make user available in all views
app.use((req, res, next) => {
  res.locals.user = req.session ? req.session.user : null;
  next();
});

// Setup multer for file uploads
const uploadDir = '/tmp/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'video/mp4' || file.originalname.endsWith('.mp4')) {
      cb(null, true);
    } else {
      cb(new Error('Only MP4 files are allowed'));
    }
  }
});

// Database pools (initialized in startServer)

// Redis connection
let redisClient;
async function initRedis() {
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
  } catch (err) {
    console.error('❌ Redis connection error:', err.message);
    setTimeout(initRedis, 5000);
  }
}

// Generate JWT Token for Ant Media
function generateAntMediaToken() {
  const secretKey = process.env.ANT_MEDIA_SECRET_KEY;
  if (!secretKey) {
    console.error('⚠️ ANT_MEDIA_SECRET_KEY not set in .env');
    return null;
  }

  // Use same payload format as Ant Media example
  const payload = {
    sub: 'token'
  };

  const token = jwt.sign(payload, secretKey, {
    algorithm: 'HS256',
    expiresIn: '7d'
  });

  return token;
}

// ============================================
// Mount All Routes (MVC Pattern)
// ============================================
app.use('/', routes);

// API Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    message: 'LMS API is running 🚀',
    status: 'ok',
    services: {
      database: getLmsDb() ? '✅ Connected' : '❌ Disconnected',
      tescoDb: getTescoDb() ? '✅ Connected' : '❌ Disconnected',
      redis: redisClient?.isOpen ? '✅ Connected' : '❌ Disconnected',
      antmedia: 'Check /health endpoint'
    }
  });
});

// Get JWT Token for Ant Media
app.get('/auth/token', (req, res) => {
  const token = generateAntMediaToken();
  if (!token) {
    return res.status(500).json({
      error: 'Failed to generate token',
      message: 'ANT_MEDIA_SECRET_KEY not set in .env'
    });
  }
  res.json({
    success: true,
    token,
    expiresIn: '7d',
    usage: 'Use header: ProxyAuthorization: ' + token
  });
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const dbStatus = getLmsDb() ? 'ok' : 'error';
    const redisStatus = redisClient?.isOpen ? 'ok' : 'error';

    // Check Ant Media Server
    let antmediaStatus = 'error';
    try {
      const response = await fetch('http://antmedia:5080/rest/v2/broadcasts/list?appName=LiveApp');
      if (response.ok) {
        antmediaStatus = 'ok';
      }
    } catch (err) {
      // Ant Media not available
    }

    res.json({
      status: 'ok',
      database: dbStatus,
      redis: redisStatus,
      antmedia: antmediaStatus
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Test database connection
app.get('/test/db', async (req, res) => {
  try {
    const dbPool = getLmsDb();
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

// ============================================
// Ant Media REST API Routes
// ============================================

const ANT_MEDIA_URL = process.env.ANT_MEDIA_URL || 'http://antmedia:5080';
const DEFAULT_APP = 'LiveApp';

// Helper: Make authenticated request to Ant Media
async function antMediaRequest(endpoint, options = {}) {
  const token = generateAntMediaToken();
  if (!token) throw new Error('Cannot generate JWT token');

  const url = `${ANT_MEDIA_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  return response;
}

// Test Ant Media connection
app.get('/test/antmedia', async (req, res) => {
  try {
    const token = generateAntMediaToken();
    const response = await antMediaRequest(`/${DEFAULT_APP}/rest/v2/broadcasts/list/0/10`);

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: 'Ant Media not responding',
        status: response.status,
        details: errorText,
        tokenUsed: token ? 'Yes' : 'No'
      });
    }

    const data = await response.json();
    res.json({
      success: true,
      message: 'Ant Media connection OK',
      url: ANT_MEDIA_URL,
      app: DEFAULT_APP,
      broadcasts: data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all broadcasts
app.get('/api/antmedia/broadcasts', async (req, res) => {
  try {
    const appName = req.query.app || DEFAULT_APP;
    const offset = req.query.offset || 0;
    const size = req.query.size || 50;

    const response = await antMediaRequest(`/${appName}/rest/v2/broadcasts/list/${offset}/${size}`);

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json({ success: true, count: data.length, broadcasts: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get broadcast by ID
app.get('/api/antmedia/broadcasts/:streamId', async (req, res) => {
  try {
    const { streamId } = req.params;
    const appName = req.query.app || DEFAULT_APP;

    const response = await antMediaRequest(`/${appName}/rest/v2/broadcasts/${streamId}`);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Broadcast not found' });
    }

    const data = await response.json();
    res.json({ success: true, broadcast: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new broadcast
app.post('/api/antmedia/broadcasts', async (req, res) => {
  try {
    const appName = req.query.app || DEFAULT_APP;
    const { name, description, type = 'liveStream' } = req.body;

    const response = await antMediaRequest(`/${appName}/rest/v2/broadcasts/create`, {
      method: 'POST',
      body: JSON.stringify({ name, description, type })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json({ success: true, broadcast: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete broadcast
app.delete('/api/antmedia/broadcasts/:streamId', async (req, res) => {
  try {
    const { streamId } = req.params;
    const appName = req.query.app || DEFAULT_APP;

    const response = await antMediaRequest(`/${appName}/rest/v2/broadcasts/${streamId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to delete broadcast' });
    }

    res.json({ success: true, message: 'Broadcast deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get VoD list
app.get('/api/antmedia/vod', async (req, res) => {
  try {
    const appName = req.query.app || DEFAULT_APP;
    const offset = req.query.offset || 0;
    const size = req.query.size || 50;

    const response = await antMediaRequest(`/${appName}/rest/v2/vods/list/${offset}/${size}`);

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json({ success: true, count: data.length, vods: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get server stats
app.get('/api/antmedia/stats', async (req, res) => {
  try {
    const appName = req.query.app || DEFAULT_APP;

    const [broadcastsRes, vodsRes] = await Promise.all([
      antMediaRequest(`/${appName}/rest/v2/broadcasts/list/0/1000`),
      antMediaRequest(`/${appName}/rest/v2/vods/list/0/1000`)
    ]);

    const broadcasts = broadcastsRes.ok ? await broadcastsRes.json() : [];
    const vods = vodsRes.ok ? await vodsRes.json() : [];

    res.json({
      success: true,
      stats: {
        totalBroadcasts: broadcasts.length,
        totalVods: vods.length,
        liveBroadcasts: broadcasts.filter(b => b.status === 'broadcasting').length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload MP4 to Ant Media Server (VoD) - Copy to shared streams folder
app.post('/api/antmedia/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Use field name "file"' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const appName = req.body.app || DEFAULT_APP;
    const videoName = req.body.name || originalName.replace('.mp4', '');

    // Generate unique stream ID
    const streamId = `vod_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const targetFileName = `${streamId}.mp4`;

    console.log(`📹 Uploading ${originalName} as ${targetFileName} to Ant Media (${appName})...`);

    // Copy file to Ant Media streams folder (shared volume)
    const streamsPath = process.env.ANTMEDIA_STREAMS_PATH || '/antmedia-streams';
    const targetPath = path.join(streamsPath, targetFileName);

    // Ensure streams directory exists
    if (!fs.existsSync(streamsPath)) {
      fs.mkdirSync(streamsPath, { recursive: true });
    }

    // Copy file to streams folder
    fs.copyFileSync(filePath, targetPath);
    console.log(`✅ File copied to ${targetPath}`);

    // Clean up temp file
    fs.unlinkSync(filePath);

    // Create VoD entry via API
    const token = generateAntMediaToken();
    let vodCreated = false;
    let apiResult = null;

    if (token) {
      try {
        const createResponse = await fetch(
          `${ANT_MEDIA_URL}/${appName}/rest/v2/broadcasts/create`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              streamId: streamId,
              name: videoName,
              type: 'vodFile'
            })
          }
        );

        if (createResponse.ok) {
          apiResult = await createResponse.json();
          vodCreated = true;
          console.log(`✅ VoD entry created:`, apiResult.streamId);
        }
      } catch (e) {
        console.log('⚠️ Could not create VoD entry via API:', e.message);
      }
    }

    const uploadedVideo = {
      id: streamId,
      streamId: streamId,
      name: videoName,
      originalName,
      appName,
      uploadedAt: new Date().toISOString(),
      size: req.file.size,
      sizeFormatted: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
      vodCreated,
      status: 'uploaded'
    };

    // Store in Redis
    if (redisClient?.isOpen) {
      await redisClient.lPush('uploaded_videos', JSON.stringify(uploadedVideo));
    }

    res.json({
      success: true,
      message: 'Video uploaded successfully',
      video: uploadedVideo,
      playUrl: `http://localhost:5080/${appName}/streams/${streamId}.mp4`,
      embedUrl: `http://localhost:5080/${appName}/play.html?id=${streamId}`,
      apiResult
    });
  } catch (err) {
    console.error('Upload error:', err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
});

// Legacy video upload (new upload system at /upload via routes)
app.get('/upload/video-legacy', (req, res) => {
  res.render('upload', { layout: false });
});

// Get uploaded videos list
app.get('/videos/uploaded', async (req, res) => {
  try {
    let videos = [];

    // Get from Redis
    if (redisClient?.isOpen) {
      const videosList = await redisClient.lRange('uploaded_videos', 0, -1);
      videos = videosList.map(v => JSON.parse(v));
    }

    res.json({
      success: true,
      count: videos.length,
      videos: videos
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HTML page for uploaded videos
app.get('/my-videos', async (req, res) => {
  try {
    let videos = [];

    // Get from Redis
    if (redisClient?.isOpen) {
      const videosList = await redisClient.lRange('uploaded_videos', 0, -1);
      videos = videosList.map(v => JSON.parse(v));
    }

    let videosHtml = videos
      .map(v => `
        <div class="video-item">
          <h3>${v.name}</h3>
          <p>ID: <code>${v.id}</code></p>
          <p>Uploaded: <span class="date">${new Date(v.uploadedAt).toLocaleString()}</span></p>
          <p>Size: <span class="size">${(v.size / 1024 / 1024).toFixed(2)} MB</span></p>
          <a href="/video/${v.antmediaId || v.id}" class="watch-btn">▶ Watch Video</a>
        </div>
      `)
      .join('');

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>My Videos - LMS</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: sans-serif; min-height: 100vh; padding: 40px 20px; }
          .container { max-width: 1000px; margin: 0 auto; }
          .header { background: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
          .header h1 { font-size: 32px; margin-bottom: 10px; }
          .upload-section { background: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
          .upload-section h2 { margin-bottom: 20px; }
          .upload-form { display: flex; gap: 10px; }
          .upload-form input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
          .upload-form button { background: #667eea; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
          .upload-form button:hover { background: #764ba2; }
          .videos { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
          .video-item { background: white; padding: 20px; border-radius: 8px; }
          .video-item h3 { margin-bottom: 10px; }
          .video-item p { color: #666; font-size: 14px; margin-bottom: 8px; }
          .video-item code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
          .date, .size { color: #999; font-size: 12px; }
          .watch-btn { display: inline-block; background: #667eea; color: white; padding: 10px 16px; border-radius: 4px; text-decoration: none; margin-top: 12px; }
          .watch-btn:hover { background: #764ba2; }
          .empty { background: white; padding: 40px; border-radius: 8px; text-align: center; color: #999; }
          .back-link { color: #0066cc; text-decoration: none; display: inline-block; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📹 My Videos</h1>
            <p>Total uploaded: <strong>${videos.length}</strong></p>
          </div>

          <div class="upload-section">
            <h2>Upload New Video</h2>
            <form class="upload-form" id="uploadForm">
              <input type="file" name="video" accept="video/mp4" required>
              <input type="text" name="name" placeholder="Video name (optional)">
              <button type="submit">Upload</button>
            </form>
            <div id="uploadStatus"></div>
          </div>

          <div class="videos">
            ${videosHtml || '<div class="empty"><p>No videos uploaded yet</p></div>'}
          </div>

          <a href="http://localhost:3000/" class="back-link">← Back to Home</a>
        </div>

        <script>
          document.getElementById('uploadForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const statusDiv = document.getElementById('uploadStatus');

            try {
              statusDiv.innerHTML = '⏳ Uploading...';
              const response = await fetch('/upload/mp4', {
                method: 'POST',
                body: formData
              });

              const data = await response.json();
              if (data.success) {
                statusDiv.innerHTML = '✅ Upload successful! Refreshing...';
                setTimeout(() => location.reload(), 2000);
              } else {
                statusDiv.innerHTML = '❌ Upload failed: ' + (data.error || 'Unknown error');
              }
            } catch (err) {
              statusDiv.innerHTML = '❌ Error: ' + err.message;
            }
          });
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`<h1>Error: ${err.message}</h1>`);
  }
});

// List broadcasts in Ant Media (JSON API)
app.get('/antmedia/broadcasts', async (req, res) => {
  try {
    const appName = req.query.appName || 'Media';
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJMTVMiLCJhdWQiOiJBbnRNZWRpYVNlcnZlciIsImlhdCI6MTc2MzA4NTgyNiwiZXhwIjoxNzYzNjkwNjI2fQ.571s8I4s0dbGqx2wQ9UJeVDCcLZtjnMgu64lcg4Z1Ow';

    const response = await fetch(
      `http://antmedia:5080/rest/v2/broadcasts/list?appName=${appName}`,
      {
        headers: {
          'ProxyAuthorization': token
        }
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch broadcasts', status: response.status });
    }

    const data = await response.json();
    res.json({ success: true, broadcasts: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Video player page
app.get('/video/:videoId', (req, res) => {
  const { videoId } = req.params;
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Video Player</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #1a1a1a; font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
        .container { width: 100%; max-width: 1200px; }
        .header { color: white; margin-bottom: 20px; }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .video-wrapper { background: black; border-radius: 8px; overflow: hidden; }
        video { width: 100%; height: auto; display: block; }
        .controls { background: #222; color: white; padding: 20px; }
        .back-link { color: #0066cc; text-decoration: none; margin-top: 20px; display: inline-block; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎬 Video Player</h1>
          <p style="color: #999;">Playing: ${videoId}</p>
        </div>
        <div class="video-wrapper">
          <video controls>
            <source src="http://localhost:5080/Media/streams/${videoId}.mp4" type="video/mp4">
            Your browser does not support the video tag.
          </video>
        </div>
        <div class="controls">
          <p>📹 Video ID: <code style="background: #333; padding: 4px 8px; border-radius: 3px;">${videoId}</code></p>
          <a href="http://localhost:3000/broadcasts" class="back-link">← Back to Broadcasts</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Broadcasts list page (HTML)
app.get('/broadcasts', async (req, res) => {
  try {
    const appName = req.query.appName || 'Media';

    // Try multiple endpoints with JWT token
    let response;
    let broadcasts = [];
    const token = generateAntMediaToken();

    if (!token) {
      return res.status(500).send('<h1>Error: Cannot generate JWT token</h1>');
    }

    // Try endpoint 1 with Authorization header (Ant Media JWT format)
    response = await fetch(
      `http://antmedia:5080/rest/v2/broadcasts/list?appName=${appName}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      // Try endpoint 2
      response = await fetch(
        `http://antmedia:5080/rest/v2/broadcasts?appName=${appName}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
    }

    if (!response.ok) {
      // Try endpoint 3 (without appName parameter)
      response = await fetch(
        `http://antmedia:5080/rest/v2/broadcasts`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
    }

    if (response.ok) {
      const data = await response.json();
      broadcasts = data.broadcasts || data || [];
    }


    let broadcastsHtml = broadcasts
      .map(b => `
        <div class="broadcast-item">
          <h3>${b.name || b.streamId}</h3>
          <p>ID: <code>${b.streamId}</code></p>
          <p>Status: <span class="status">${b.status || 'unknown'}</span></p>
          ${b.streamId ? `<a href="/video/${b.streamId}" class="watch-btn">▶ Watch Video</a>` : ''}
        </div>
      `)
      .join('');

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Broadcasts - Ant Media Server</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: sans-serif; min-height: 100vh; padding: 40px 20px; }
          .container { max-width: 1000px; margin: 0 auto; }
          .header { background: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
          .header h1 { font-size: 32px; margin-bottom: 10px; }
          .broadcasts { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
          .broadcast-item { background: white; padding: 20px; border-radius: 8px; }
          .broadcast-item h3 { margin-bottom: 10px; }
          .broadcast-item p { color: #666; font-size: 14px; margin-bottom: 8px; }
          .broadcast-item code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
          .status { display: inline-block; padding: 4px 8px; border-radius: 3px; font-size: 12px; font-weight: bold; background: #2196F3; color: white; }
          .watch-btn { display: inline-block; background: #667eea; color: white; padding: 10px 16px; border-radius: 4px; text-decoration: none; margin-top: 12px; }
          .watch-btn:hover { background: #764ba2; }
          .empty { background: white; padding: 40px; border-radius: 8px; text-align: center; color: #999; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📺 Ant Media Server - Broadcasts</h1>
            <p>App: <strong>${appName}</strong> | Total: <strong>${broadcasts.length}</strong></p>
          </div>
          <div class="broadcasts">
            ${broadcastsHtml || '<div class="empty"><p>No broadcasts available</p></div>'}
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`<h1>Error: ${err.message}</h1>`);
  }
});

// Start server
async function startServer() {
  // Initialize databases from config
  await initLmsDatabase();
  await initTescoDatabase();
  await initRedis();

  app.listen(port, () => {
    console.log(`\n🎓 LMS App listening on http://localhost:${port}`);
    console.log(`📊 Services:`);
    console.log(`   - Database: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    console.log(`   - Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
    console.log(`   - Ant Media: http://antmedia:5080`);
    console.log(`\n🔗 Available endpoints:`);
    console.log(`   - Dashboard: /dashboard`);
    console.log(`   - Settings: /settings/format, /settings/functions, /settings/department`);
    console.log(`\n📁 MVC Structure:`);
    console.log(`   - Models: /app/models/`);
    console.log(`   - Controllers: /app/controllers/`);
    console.log(`   - Routes: /app/routes/`);
  });
}

startServer().catch(console.error);

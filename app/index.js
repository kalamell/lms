import express from 'express';
import mysql from 'mysql2/promise';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

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

// Database connection pool
let dbPool;
async function initDatabase() {
  try {
    dbPool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    console.log('✅ Database connected');
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    setTimeout(initDatabase, 5000);
  }
}

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

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Hello World! 🚀',
    status: 'LMS App is running',
    services: {
      database: dbPool ? '✅ Connected' : '❌ Disconnected',
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
    const dbStatus = dbPool ? 'ok' : 'error';
    const redisStatus = redisClient?.isOpen ? 'ok' : 'error';

    // Check Ant Media Server
    let antmediaStatus = 'error';
    try {
      const response = await fetch('http://antmedia:5080/rest/v2/broadcasts/list?appName=Media');
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

// Test Ant Media connection
app.get('/test/antmedia', async (req, res) => {
  try {
    const response = await fetch('http://antmedia:5080/rest/v2/broadcasts/list?appName=Media');
    if (!response.ok) {
      return res.status(503).json({ error: 'Ant Media not responding', status: response.status });
    }
    const data = await response.json();
    res.json({ success: true, message: 'Ant Media connection OK', broadcasts: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload MP4 to Ant Media Server
app.post('/upload/mp4', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileName = req.file.filename;
    const appName = req.body.appName || 'Media'; // Default app name in Ant Media
    const token = '1r3wwsJbmBk7N7vY2wTQSNRaeKQK9rnL';

    console.log(`📹 Uploading ${fileName} to Ant Media...`);

    // Create form data for Ant Media API
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    // Upload to Ant Media Server's REST API
    const uploadResponse = await fetch(
      `http://antmedia:5080/rest/v2/broadcasts/upload?appName=${appName}`,
      {
        method: 'POST',
        body: form,
        headers: {
          ...form.getHeaders(),
          'ProxyAuthorization': token
        }
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Ant Media error:', errorText);
      fs.unlinkSync(filePath); // Clean up
      return res.status(uploadResponse.status).json({
        error: 'Failed to upload to Ant Media',
        details: errorText
      });
    }

    const result = await uploadResponse.json();

    // Clean up the temporary file
    fs.unlinkSync(filePath);

    // Save upload metadata to Redis
    const uploadedVideo = {
      id: result.streamId || `video_${Date.now()}`,
      name: req.body.name || fileName,
      fileName,
      appName,
      uploadedAt: new Date().toISOString(),
      size: req.file.size,
      antmediaId: result.streamId,
      status: 'uploaded'
    };

    // Store in Redis
    if (redisClient?.isOpen) {
      await redisClient.lPush('uploaded_videos', JSON.stringify(uploadedVideo));
      await redisClient.expire('uploaded_videos', 86400 * 7); // Keep for 7 days
    }

    res.json({
      success: true,
      message: 'Video uploaded successfully',
      video: uploadedVideo,
      antmediaResponse: result
    });
  } catch (err) {
    // Clean up on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
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
  await initDatabase();
  await initRedis();

  app.listen(port, () => {
    console.log(`\n🎓 LMS App listening on http://localhost:${port}`);
    console.log(`📊 Services:`);
    console.log(`   - Database: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    console.log(`   - Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
    console.log(`   - Ant Media: http://antmedia:5080`);
    console.log(`\n🔗 Available endpoints:`);
    console.log(`   - GET / - Hello World`);
    console.log(`   - GET /health - Health check`);
    console.log(`   - GET /test/db - Test database`);
    console.log(`   - GET /test/redis - Test Redis`);
    console.log(`   - GET /test/antmedia - Test Ant Media Server`);
    console.log(`   - POST /upload/mp4 - Upload MP4 to Ant Media (multipart/form-data with 'video' field)`);
    console.log(`   - GET /antmedia/broadcasts - List all broadcasts`);
  });
}

startServer().catch(console.error);

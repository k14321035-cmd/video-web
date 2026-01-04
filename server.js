const express = require('express');
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key-change-this-in-prod';

// Database Connection
const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString: connectionString,
    ssl: connectionString ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory
app.use('/uploads', express.static('uploads')); // Serve uploaded videos

// Ensure uploads directory exists
if (!fs.existsSync('uploads')){
    fs.mkdirSync('uploads');
}

// Multer Setup for File Uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'))
    }
});
const upload = multer({ storage: storage });

// Helper: Verify Token Middleware
// NOTE: For production, use firebase-admin to verify the token signature.
// Here we trust the client-provided header because we don't have service account keys.
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (token == null) return res.sendStatus(401);

    // Decode without verify (INSECURE - DEMO ONLY)
    // In production: await admin.auth().verifyIdToken(token)
    const decoded = jwt.decode(token); 
    
    if (!decoded || !decoded.email) {
        return res.sendStatus(403);
    }

    try {
        // Find or Create User in PG based on Firebase Email
        let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [decoded.email]);
        
        let user;
        if (userResult.rows.length === 0) {
            // Create shadow user
            // We use a dummy password or null since they auth via Firebase
            const insertResult = await pool.query(
                'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
                [decoded.email, 'firebase_oauth_placeholder']
            );
            user = insertResult.rows[0];
        } else {
            user = userResult.rows[0];
        }

        req.user = user;
        next();
    } catch (err) {
        console.error("Auth DB Error", err);
        return res.sendStatus(500);
    }
};

/* --- Auth Routes --- */
// Login/Register handled by Frontend via Firebase.
// We just verify the token in middleware.

// Get Current User (Me)
app.get('/api/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

/* --- Video Routes --- */

// Upload Video
app.post('/api/upload', authenticateToken, upload.single('video'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    const { title } = req.body;
    const userId = req.user.id;
    const filepath = 'uploads/' + req.file.filename;

    try {
        const result = await pool.query(
            'INSERT INTO videos (user_id, title, filename, filepath) VALUES ($1, $2, $3, $4) RETURNING *',
            [userId, title || req.file.originalname, req.file.filename, filepath]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// List Videos
app.get('/api/videos', async (req, res) => {
    try {
        // PERF: Join with users to get email
        const result = await pool.query(`
            SELECT v.*, u.email as user_email 
            FROM videos v 
            JOIN users u ON v.user_id = u.id 
            ORDER BY v.created_at DESC
        `);
        // Configure response to match what frontend expects
        // Frontend previously used: { fileUrl, title, userEmail, ... }
        const videos = result.rows.map(row => ({
            id: row.id,
            title: row.title,
            fileUrl: row.filepath, // This will be relative URL like 'uploads/filename.mp4'
            userEmail: row.user_email,
            createdAt: row.created_at
        }));
        res.json(videos);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

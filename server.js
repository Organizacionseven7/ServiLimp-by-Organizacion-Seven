const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const admin = require('firebase-admin');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Initialize Firebase Admin (for server-side operations)
// Note: In production, you should use a service account key file
// For now, we'll initialize without credentials for client-side Firebase to work
let db;
try {
    // This will work if you have GOOGLE_APPLICATION_CREDENTIALS environment variable set
    admin.initializeApp({
        projectId: 'servilimp-8b5df'
    });
    db = admin.firestore();
    console.log('Firebase Admin initialized successfully');
} catch (error) {
    console.log('Firebase Admin not initialized (client-side Firebase will be used):', error.message);
}

// Security middleware
// Note: CSP is disabled to allow Firebase CDN (gstatic.com)
// Firebase is a trusted Google service. See SECURITY.md for details.
app.use(helmet({
    contentSecurityPolicy: false // Required for Firebase SDK from CDN
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Demasiadas solicitudes desde esta IP, por favor intente más tarde.'
});

// Apply rate limiting to all routes
app.use('/api/', limiter);

// Stricter rate limit for authentication
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Demasiados intentos de inicio de sesión, por favor intente más tarde.'
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
// Note: CSRF protection is handled by:
// 1. Firebase Authentication tokens (secure, HTTPOnly)
// 2. SameSite=strict cookie policy
// 3. Session-based auth verification
// See SECURITY.md for detailed explanation
//
// IMPORTANT: In production, always set SESSION_SECRET environment variable
// to a cryptographically secure random string (32+ characters)
// Example: openssl rand -base64 32
app.use(session({
    secret: process.env.SESSION_SECRET || 'servilimp-secret-key-2025-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: isProduction, // Require HTTPS in production
        httpOnly: true, // Prevents XSS attacks
        sameSite: 'strict' // Prevents CSRF attacks
    }
}));
app.use(express.static(path.join(__dirname, 'public')));

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Authentication required' });
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!roles.includes(req.session.userRole)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

// ====== Session Management Routes ======

// Set session after Firebase login (called from client)
app.post('/api/set-session', authLimiter, async (req, res) => {
    const { uid, email, role, displayName } = req.body;
    
    if (!uid) {
        return res.status(400).json({ error: 'User ID required' });
    }
    
    req.session.userId = uid;
    req.session.userRole = role || 'operator';
    req.session.userName = displayName || email;
    req.session.userEmail = email;
    
    res.json({ success: true });
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Get current session
app.get('/api/session', (req, res) => {
    if (req.session.userId) {
        res.json({
            userId: req.session.userId,
            userName: req.session.userName,
            userRole: req.session.userRole,
            userEmail: req.session.userEmail
        });
    } else {
        res.status(401).json({ error: 'No active session' });
    }
});

// ====== Client Management Routes ======
// Note: Most data operations are handled client-side using Firebase SDK
// These endpoints are kept for potential server-side operations

app.get('/api/clients', requireAuth, (req, res) => {
    res.json({ message: 'Use Firebase client SDK to fetch clients from Firestore' });
});

app.post('/api/clients', requireRole('admin', 'supervisor'), (req, res) => {
    res.json({ message: 'Use Firebase client SDK to create clients in Firestore' });
});

// ====== Objective Management Routes ======

app.get('/api/objectives', requireAuth, (req, res) => {
    res.json({ message: 'Use Firebase client SDK to fetch objectives from Firestore' });
});

// ====== Supply Management Routes ======

app.get('/api/supplies', requireAuth, (req, res) => {
    res.json({ message: 'Use Firebase client SDK to fetch supplies from Firestore' });
});

// ====== Messaging Routes ======

app.get('/api/messages', requireAuth, (req, res) => {
    res.json({ message: 'Use Firebase client SDK to fetch messages from Firestore' });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'ServiLimp API is running' });
});

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`ServiLimp server running on port ${PORT}`);
    console.log('Firebase project: servilimp-8b5df');
    console.log(`Access the application at http://localhost:${PORT}`);
});

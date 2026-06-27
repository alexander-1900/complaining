const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Internal Imports
const { connectDB, sequelize } = require('./config/db');
const firewall = require('./middleware/firewall');
require('./models/SecurityLog');
require('./models/BlockedIP');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

/**
 * SERVER INITIALIZATION
 * Aflou Complaints Portal - Master Integration
 */
const app = express();

// 1. Production Trust Proxy (Essential for correct IP-based Rate Limiting behind Nginx)
app.set('trust proxy', 1);

// 2. Database Connection
connectDB();

// 3. Security Middleware (Firewall must come early)
app.use(firewall);

// 4. Global Security Middlewares
// Helmet: Hardens HTTP headers (CSP, HSTS, NoSniff, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow our local styles
      imgSrc: ["'self'", "data:", "blob:"],     // Allow local logo and attachments
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS: Restricted to trusted domains
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true, 
  methods: 'GET,POST,PATCH,DELETE',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// 3. Payload Parsing & Rate Limiting Controls
// Limits payload size to 10kb to prevent ReDoS and memory exhaustion attacks
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 4. Static Asset Management
// Serves the public frontend assets (index.html, style.css, script.js, logo.png)
app.use(express.static(path.join(__dirname, 'public')));

// 5. API Route Mounting
app.use('/api', apiRoutes); // Public citizen endpoints
app.use('/aflou-gov-gate', adminRoutes); // Secured admin endpoints (Hidden path)

// 6. Root Redirection
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// 7. Global Error-Handling Middleware
// Critical Security Control: Prevents Information Leakage
app.use((err, req, res, next) => {
  // Handle Multer specific errors (e.g., file size, invalid type)
  if (err.name === 'MulterError' || err.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  // Log the error internally for auditing and debugging
  console.error(`[INTERNAL ERROR LOG] ${new Date().toISOString()}:`, {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : 'REDACTED',
    path: req.path,
    ip: req.ip
  });

  // Return a generic, safe response to the client
  // Mitigates OWASP Improper Error Handling (Leaking database/system details)
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: 'An unexpected security event or system error occurred. Our IT division has been notified.'
  });
});

/**
 * SERVER STARTUP
 * Synchronizes models and begins listening for traffic.
 */
const PORT = process.env.PORT || 3000;

// FORCE ALTERATION: We set 'alter: true' directly here for local testing.
// This forces PostgreSQL to inspect your models and inject the missing "citizen_email" column automatically.
const syncOptions = { alter: true };

sequelize.sync(syncOptions).then(() => {
  app.listen(PORT, () => {
    console.log(`--------------------------------------------------`);
    console.log(`Aflou Complaints Portal is ONLINE`);
    console.log(`Port: ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
    console.log(`Security: Helmet, CSP, HSTS, and Rate Limiting ACTIVE`);
    console.log(`Database Sync: ${JSON.stringify(syncOptions)}`);
    console.log(`--------------------------------------------------`);
  });
}).catch(err => {
  console.error('Failed to sync database:', err);
  process.exit(1);
});

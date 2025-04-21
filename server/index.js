import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { contactRouter } from './routes/contact.js';
import { adminRouter } from './routes/admin.js';
import { portfolioRouter } from './routes/portfolio.js'; // Add this import
import { visitorMiddleware } from './middleware/visitor.js';
import { healthRouter } from './routes/health.js';

dotenv.config();

const app = express();

// Basic middleware
app.use(express.json());
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for simplicity in development
}));

// Determine if running on Railway
const isRailway = process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_SERVICE_ID;
console.log(`Running on Railway: ${isRailway ? 'Yes' : 'No'}`);

// Handle potential Railway path prefixes
app.use((req, res, next) => {
  // Log original URL to help with debugging
  if (process.env.NODE_ENV === 'production') {
    console.log(`Original request URL: ${req.originalUrl}`);
  }
  
  // Ensure API routes work regardless of base path
  if (req.path === '/portfolio' || 
      req.path === '/contact' || 
      req.path === '/admin' ||
      req.path === '/track') {
    // Rewrite to include /api prefix if missing
    req.url = `/api${req.url}`;
    console.log(`Rewritten URL: ${req.url}`);
  }
  
  next();
});

// Update CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'https://akriti-sharma.netlify.app',
      'http://localhost:3000'
    ];
    
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Custom IP detection middleware
app.use((req, res, next) => {
  req.realIp = req.ip || 
               req.headers['x-forwarded-for'] ||
               req.connection.remoteAddress || 
               req.socket.remoteAddress || 
               req.connection.socket?.remoteAddress;
  
  // Log request details in production to help debug
  if (process.env.NODE_ENV === 'production') {
    console.log(`${req.method} ${req.path} - IP: ${req.realIp.substring(0, 10)}...`);
  }
  
  next();
});

// Root route 
app.get('/', (req, res) => {
  res.json({ 
    message: 'Akriti Portfolio API is running', 
    endpoints: ['/api/portfolio', '/api/contact', '/api/admin', '/health'],
    environment: process.env.NODE_ENV,
    railway: isRailway ? true : false
  });
});

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Custom key generator using our detected IP
  keyGenerator: (req) => req.realIp,
  skip: (req) => req.path.startsWith('/api/admin') // Skip rate limiting for admin routes
});

// Apply rate limiter to non-admin routes
app.use('/api', (req, res, next) => {
  if (!req.path.startsWith('/admin')) {
    limiter(req, res, next);
  } else {
    next();
  }
});

// Track endpoint should be before general visitorMiddleware
app.post('/api/track', async (req, res) => {
  try {
    const { path, interactionType } = req.body;
    req.trackedPath = path;
    req.interactionType = interactionType || 'view';
    
    await visitorMiddleware(req, res, () => {
      res.status(200).json({ message: 'ok', tracked: { path, type: interactionType } });
    });
  } catch (error) {
    console.error('Track error:', error);
    res.status(500).json({ error: 'Failed to track' });
  }
});

// Track visitors
app.use(visitorMiddleware);

// Add health route before other routes
app.use('/health', healthRouter);

// Routes
app.use('/api/contact', contactRouter);
app.use('/api/admin', adminRouter);
app.use('/api/portfolio', portfolioRouter);

// Add a catch-all route for /api to help diagnose routing issues
app.get('/api', (req, res) => {
  res.json({ 
    message: 'API root accessed successfully', 
    availableEndpoints: [
      '/api/portfolio', 
      '/api/contact', 
      '/api/admin', 
      '/api/track'
    ],
    serverTime: new Date().toISOString()
  });
});

// Add a wildcard API handler to help with Railway path detection issues
app.all('/api/*', (req, res) => {
  console.log(`API wildcard route hit: ${req.path}`);
  res.status(404).json({
    error: 'API endpoint not found',
    requestedPath: req.path,
    availableEndpoints: ['/api/portfolio', '/api/contact', '/api/admin', '/api/track']
  });
});

// Add routes debugging middleware
app.use((req, res, next) => {
  console.log(`Route not found: ${req.method} ${req.url}`);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Add this after MongoDB connection
app.set('mongoose', mongoose);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Use different log messages for development vs production
  if (process.env.NODE_ENV === 'production') {
    const railwayUrl = process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN;
    if (railwayUrl) {
      console.log(`API available at: https://${railwayUrl}/api`);
    } else {
      console.log(`API running in production mode on port ${PORT}`);
    }
  } else {
    console.log(`API available at: http://localhost:${PORT}/api`);
  }
  
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
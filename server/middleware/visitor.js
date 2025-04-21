import UAParser from 'ua-parser-js';
import { Visitor } from '../models/Visitor.js';

// Updated visitor middleware to only track homepage visits
export const visitorMiddleware = async (req, res, next) => {
  try {
    // Skip tracking for non-homepage paths or certain paths
    if (
      req.path.startsWith('/health') || 
      req.path.includes('favicon') ||
      req.path.includes('static') ||
      req.path.includes('admin') ||
      req.path.includes('api/admin')
    ) {
      return next();
    }

    // Only track if the tracked path is homepage
    if (!req.trackedPath || req.trackedPath !== '/') {
      return next();
    }

    // Get client IP address
    const ip = req.realIp || '0.0.0.0';
    
    // Parse user agent
    const ua = new UAParser(req.headers['user-agent']);
    const browser = `${ua.getBrowser().name || 'Unknown'} ${ua.getBrowser().version || ''}`.trim();
    const os = `${ua.getOS().name || 'Unknown'} ${ua.getOS().version || ''}`.trim();
    const device = ua.getDevice().type || 'Desktop';
    
    // For homepage tracking, always use '/' as the section
    const section = '/';
    
    // Get current time
    const localTime = new Date().toLocaleString();
    
    // Check for duplicate entry in the last 30 minutes
    // This prevents counting the same visitor multiple times in a short period
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const existingVisit = await Visitor.findOne({
      ip,
      section: '/',
      timestamp: { $gt: thirtyMinutesAgo }
    });

    // If we found a recent duplicate entry, skip adding a new one
    if (existingVisit) {
      console.log(`Skipping duplicate homepage visit for ${ip}`);
      return next();
    }
    
    // Create visitor entry
    const newVisitor = new Visitor({
      ip,
      browser,
      os,
      device,
      section,
      path: '/',
      interactionType: 'pageview',
      localTime
    });
    
    // Save visitor
    await newVisitor.save();
    
    // Debug log
    console.log(`Homepage visit tracked: ${ip}`);
    
    next();
  } catch (error) {
    console.error('Error in visitor middleware:', error);
    next(); // Continue even if tracking fails
  }
};
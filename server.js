const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
const allowedOrigins = [
  'http://localhost:3000', 
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL,
  process.env.BASE_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: true
}));
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize SQLite database
const db = new sqlite3.Database('./database.db');

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'user',
    instagram TEXT,
    snapchat TEXT,
    linkedin TEXT,
    profile_image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Admin users table
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tags table - now with hashed IDs and admin assignment
  db.run(`CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_id TEXT UNIQUE NOT NULL,
    hashed_tag_id TEXT UNIQUE NOT NULL,
    admin_id INTEGER,
    owner_id INTEGER,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    is_assigned BOOLEAN DEFAULT FALSE,
    is_claimed BOOLEAN DEFAULT FALSE,
    assigned_at DATETIME,
    claimed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins (id),
    FOREIGN KEY (owner_id) REFERENCES users (id)
  )`);

  // Scan logs table
  db.run(`CREATE TABLE IF NOT EXISTS scan_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_id TEXT NOT NULL,
    finder_ip TEXT,
    finder_location TEXT,
    scan_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    message TEXT,
    pin_latitude REAL,
    pin_longitude REAL,
    FOREIGN KEY (tag_id) REFERENCES tags (hashed_tag_id)
  )`);

  // Add missing columns to existing tables
  db.run(`ALTER TABLE users ADD COLUMN instagram TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding instagram column:', err);
    }
  });
  
  db.run(`ALTER TABLE users ADD COLUMN snapchat TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding snapchat column:', err);
    }
  });
  
  db.run(`ALTER TABLE users ADD COLUMN linkedin TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding linkedin column:', err);
    }
  });
  
  db.run(`ALTER TABLE users ADD COLUMN profile_image TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding profile_image column:', err);
    }
  });

  db.run(`ALTER TABLE tags ADD COLUMN tag_name TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding tag_name column:', err);
    }
  });
});

// Email configuration (using Gmail as example)
// Email configuration - Using Gmail SMTP
// Note: Gmail requires an "App Password" for SMTP access, not your regular password
// To enable real emails: 
// 1. Enable 2-factor authentication on your Gmail account
// 2. Generate an App Password: https://myaccount.google.com/apppasswords
// 3. Replace '2squidys' below with your App Password
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'papertags.notify@gmail.com',
    pass: 'vxprjgwqnmhpgyjg' // Gmail App Password for Cursor
  }
});

// Demo mode - set to false to send real emails
const DEMO_MODE = false;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DEFAULT_FROM = process.env.RESEND_FROM || process.env.EMAIL_USER || 'onboarding@resend.dev';

async function sendViaResend(mailOptions) {
  const payload = {
    from: mailOptions.from || DEFAULT_FROM,
    to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
    subject: mailOptions.subject || '',
    html: mailOptions.html || undefined,
    text: mailOptions.text || undefined,
    reply_to: mailOptions.replyTo || undefined
  };
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Resend API error: ${resp.status} ${errText}`);
  }
  const data = await resp.json();
  return { messageId: data?.id || `resend-${Date.now()}` };
}

// Helper function to send emails (with demo mode support)
async function sendEmail(mailOptions) {
  if (DEMO_MODE) {
    console.log('\n=== EMAIL NOTIFICATION (DEMO MODE) ===');
    console.log('To:', mailOptions.to);
    console.log('Subject:', mailOptions.subject);
    console.log('Content:', mailOptions.text || mailOptions.html || 'No content provided');
    console.log('=====================================\n');
    return { messageId: 'demo-' + Date.now() };
  } else {
    // Force default FROM to avoid unverified domain rejections
    const finalOptions = { ...mailOptions, from: DEFAULT_FROM };
    if (RESEND_API_KEY) {
      return await sendViaResend(finalOptions);
    }
    return await transporter.sendMail(finalOptions);
  }
}

// Test email configuration
transporter.verify((error, success) => {
  if (error) {
    console.log('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Helper function to get geolocation from IP with a short timeout
async function getLocationFromIP(ip) {
  try {
    // Skip geolocation for localhost/private IPs
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
      return {
        city: 'Local Network',
        region: 'Local Area',
        country: 'Local'
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,city,regionName,country,lat,lon`, { signal: controller.signal });
      const data = await response.json();
      clearTimeout(timeout);

      if (data.status === 'success') {
        return {
          city: data.city || 'Unknown City',
          region: data.regionName || 'Unknown Region',
          country: data.country || 'Unknown Country',
          lat: data.lat,
          lon: data.lon
        };
      } else {
        console.log('IP API error:', data.message);
        return {
          city: 'Unknown City',
          region: 'Unknown Region', 
          country: 'Unknown Country'
        };
      }
    } catch (err) {
      // Timeout or fetch error
      console.warn('IP geolocation skipped (timeout/error).');
      return {
        city: 'Unknown City',
        region: 'Unknown Region',
        country: 'Unknown Country'
      };
    }
  } catch (error) {
    console.error('Error getting location:', error);
    return {
      city: 'Unknown City',
      region: 'Unknown Region',
      country: 'Unknown Country'
    };
  }
}

// Helper function to generate secure hashed tag ID
function generateHashedTagId() {
  const randomBytes = crypto.randomBytes(16);
  return crypto.createHash('sha256').update(randomBytes).digest('hex').substring(0, 32);
}

// Helper function to generate readable tag ID for admin
function generateReadableTagId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper function to validate admin token
function authenticateAdminToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.admin = user;
    next();
  });
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Routes

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Claimable link route - when someone scans the NFC tag
app.get('/tag/:hashedTagId', async (req, res) => {
  try {
    const { hashedTagId } = req.params;
    const fwd = req.headers['x-forwarded-for'];
    const finderIP = (Array.isArray(fwd) ? fwd[0] : (fwd ? fwd.split(',')[0] : null)) || req.ip || req.connection.remoteAddress;

    // Get tag information using hashed ID
    const tag = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM tags WHERE hashed_tag_id = ? AND is_assigned = TRUE', [hashedTagId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!tag) {
      return res.sendFile(path.join(__dirname, 'public', 'tag-not-found.html'));
    }

    // Serve page immediately (no blocking on network I/O)
    if (tag.is_claimed) {
      res.sendFile(path.join(__dirname, 'public', 'finder.html'));
    } else {
      res.sendFile(path.join(__dirname, 'public', 'claim.html'));
    }

    // Fire-and-forget: only log scan (no email on initial scan)
    (async () => {
      try {
        const location = await getLocationFromIP(finderIP);
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO scan_logs (tag_id, finder_ip, finder_location, message, pin_latitude, pin_longitude) VALUES (?, ?, ?, ?, ?, ?)',
            [
              hashedTagId,
              finderIP,
              location ? `${location.city}, ${location.region}, ${location.country}` : 'Unknown',
              'Tag scanned via claimable link',
              null,
              null
            ],
            (err) => (err ? reject(err) : resolve())
          );
        });
      } catch (bgErr) {
        console.error('Background logging/email error:', bgErr);
      }
    })();
  } catch (error) {
    console.error('Tag scan error:', error);
    res.status(500).send('Internal server error');
  }
});

// User registration
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Check if user already exists
    const existingUser = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userId = await new Promise((resolve, reject) => {
      db.run('INSERT INTO users (email, password, name, phone) VALUES (?, ?, ?, ?)',
        [email, hashedPassword, name, phone], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
    });

    // Generate JWT token
    const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ token, user: { id: userId, email, name, phone } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user from database
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        phone: user.phone,
        role: user.role
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get admin from database
    const admin = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM admins WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, admin.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign({ adminId: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ 
      token, 
      admin: { 
        id: admin.id, 
        email: admin.email, 
        name: admin.name,
        role: 'admin'
      } 
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Claim a tag (public functionality - creates user account if needed)
app.post('/api/claim-tag', async (req, res) => {
  try {
    const { tagId, email, password, tagName, contactName, contactPhone, instagram, snapchat, linkedin } = req.body;

    if (!tagId || !email || !password || !contactName || !tagName) {
      return res.status(400).json({ error: 'Tag ID, email, password, tag name, and contact name are required' });
    }

    // Check if tag exists and is assigned but not claimed
    const existingTag = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM tags WHERE tag_id = ? AND is_assigned = TRUE AND is_claimed = FALSE', [tagId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!existingTag) {
      return res.status(400).json({ error: 'Tag not found, not assigned, or already claimed' });
    }

    // Check if user exists, if not create account
    let user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    let userId;
    if (!user) {
      // Create new user account
      const hashedPassword = await bcrypt.hash(password, 10);
      userId = await new Promise((resolve, reject) => {
        db.run('INSERT INTO users (email, password, name, phone, instagram, snapchat, linkedin) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [email, hashedPassword, contactName, contactPhone, instagram, snapchat, linkedin], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          });
      });
    } else {
      // Verify password for existing user
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Invalid password for existing account' });
      }
      userId = user.id;
    }

    // Claim the tag and link to user account
    await new Promise((resolve, reject) => {
      db.run('UPDATE tags SET owner_id = ?, tag_name = ?, contact_name = ?, contact_email = ?, contact_phone = ?, is_claimed = TRUE, claimed_at = CURRENT_TIMESTAMP WHERE tag_id = ?',
        [userId, tagName, contactName, email, contactPhone, tagId], (err) => {
          if (err) reject(err);
          else resolve();
        });
    });

    res.json({ 
      message: 'Tag claimed successfully', 
      tag: {
        tagId: existingTag.tag_id,
        hashedTagId: existingTag.hashed_tag_id,
        claimableUrl: `${req.protocol}://${req.get('host')}/tag/${existingTag.hashed_tag_id}`
      }
    });
  } catch (error) {
    console.error('Tag claiming error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's claimed tags
app.get('/api/my-tags', authenticateToken, async (req, res) => {
  try {
    const tags = await new Promise((resolve, reject) => {
      db.all(`
        SELECT t.*, u.instagram, u.snapchat, u.linkedin 
        FROM tags t 
        LEFT JOIN users u ON t.owner_id = u.id 
        WHERE t.owner_id = ? AND t.is_claimed = TRUE
      `, [req.user.userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ tags });
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update tag contact info
app.put('/api/tags/:tagId', authenticateToken, async (req, res) => {
  try {
    const { tagId } = req.params;
    const { tagName, contactName, contactEmail, contactPhone, instagram, snapchat, linkedin } = req.body;

    // Check if tag belongs to user
    const tag = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM tags WHERE tag_id = ? AND owner_id = ?', [tagId, req.user.userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!tag) {
      return res.status(404).json({ error: 'Tag not found or not owned by user' });
    }

    // Update tag
    await new Promise((resolve, reject) => {
      db.run('UPDATE tags SET tag_name = ?, contact_name = ?, contact_email = ?, contact_phone = ? WHERE tag_id = ?',
        [tagName, contactName, contactEmail, contactPhone, tagId], (err) => {
          if (err) reject(err);
          else resolve();
        });
    });

    // Update user social media info
    await new Promise((resolve, reject) => {
      db.run('UPDATE users SET instagram = ?, snapchat = ?, linkedin = ? WHERE id = ?',
        [instagram, snapchat, linkedin, req.user.userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
    });

    res.json({ message: 'Tag updated successfully' });
  } catch (error) {
    console.error('Update tag error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Scan tag (public endpoint for finders)
app.post('/api/scan/:tagId', async (req, res) => {
  try {
    const { tagId } = req.params;
    const { message, pinLatitude, pinLongitude } = req.body;
    const fwd2 = req.headers['x-forwarded-for'];
    const finderIP = (Array.isArray(fwd2) ? fwd2[0] : (fwd2 ? fwd2.split(',')[0] : null)) || req.ip || req.connection.remoteAddress;

    // Get tag information
    const tag = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM tags WHERE tag_id = ? AND is_registered = TRUE', [tagId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!tag) {
      return res.status(404).json({ error: 'Tag not found or not registered' });
    }

    // Get approximate location from IP
    const location = await getLocationFromIP(finderIP);

    // Log the scan
    await new Promise((resolve, reject) => {
      db.run('INSERT INTO scan_logs (tag_id, finder_ip, finder_location, message, pin_latitude, pin_longitude) VALUES (?, ?, ?, ?, ?, ?)',
        [tagId, finderIP, location ? `${location.city}, ${location.region}, ${location.country}` : 'Unknown', message, pinLatitude, pinLongitude], (err) => {
          if (err) reject(err);
          else resolve();
        });
    });

    // Send email notification to owner
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER || 'your-email@gmail.com',
        to: tag.contact_email,
        subject: 'Your PaperTag has been found!',
        html: `
          <h2>Your PaperTag has been found!</h2>
          <p><strong>Tag ID:</strong> ${tagId}</p>
          <p><strong>Found at:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Approximate location:</strong> ${location && location.city ? `${location.city}, ${location.region}, ${location.country}` : 'Location not available'}</p>
          ${pinLatitude && pinLongitude ? `<p><strong>Exact location:</strong> <a href="https://maps.google.com/?q=${pinLatitude},${pinLongitude}" target="_blank">View on Google Maps</a></p>` : ''}
          ${message ? `<p><strong>Message from finder:</strong> ${message}</p>` : ''}
          <p>Thank you for using Smart PaperTags!</p>
        `
      };

      await sendEmail(mailOptions);
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Don't fail the scan if email fails
    }

    // Return owner contact info to finder
    res.json({
      tagId,
      ownerInfo: {
        name: tag.contact_name,
        email: tag.contact_email,
        phone: tag.contact_phone
      },
      location: location,
      message: 'Owner has been notified via email'
    });
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get scan history for a tag
app.get('/api/tags/:tagId/scans', authenticateToken, async (req, res) => {
  try {
    const { tagId } = req.params;

    // Check if tag belongs to user
    const tag = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM tags WHERE tag_id = ? AND owner_id = ?', [tagId, req.user.userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!tag) {
      return res.status(404).json({ error: 'Tag not found or not owned by user' });
    }

    // Get scan history
    const scans = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM scan_logs WHERE tag_id = ? ORDER BY scan_timestamp DESC', [tagId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ scans });
  } catch (error) {
    console.error('Get scans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tag information for finder (public endpoint)
app.get('/api/tag-info/:hashedTagId', async (req, res) => {
  try {
    const { hashedTagId } = req.params;
    console.log('Fetching tag info for hashed ID:', hashedTagId);

    // Get tag information using hashed ID with user social media data
    const tag = await new Promise((resolve, reject) => {
      db.get(`
        SELECT t.*, u.instagram, u.snapchat, u.linkedin 
        FROM tags t 
        LEFT JOIN users u ON t.owner_id = u.id 
        WHERE t.hashed_tag_id = ? AND t.is_assigned = TRUE
      `, [hashedTagId], (err, row) => {
        if (err) {
          console.error('Database query error:', err);
          reject(err);
        } else {
          console.log('Tag found:', row);
          resolve(row);
        }
      });
    });

    if (!tag) {
      console.log('Tag not found for hashed ID:', hashedTagId);
      return res.status(404).json({ error: 'Tag not found or not assigned' });
    }

    // Return tag information
    res.json({
      tagId: tag.tag_id,
      tagName: tag.tag_name,
      hashedTagId: tag.hashed_tag_id,
      isClaimed: tag.is_claimed,
      ownerInfo: tag.is_claimed ? {
        name: tag.contact_name,
        email: tag.contact_email,
        phone: tag.contact_phone,
        instagram: tag.instagram,
        snapchat: tag.snapchat,
        linkedin: tag.linkedin
      } : null,
      message: tag.is_claimed ? 'Owner has been notified via email' : 'Tag is available for claiming'
    });
  } catch (error) {
    console.error('Get tag info error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Submit finder message and location
app.post('/api/tag/:hashedTagId/found', async (req, res) => {
  try {
    const { hashedTagId } = req.params;
    const { message, pinLatitude, pinLongitude } = req.body;
    const finderIP = req.ip || req.connection.remoteAddress;

    // Get tag information
    const tag = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM tags WHERE hashed_tag_id = ? AND is_assigned = TRUE', [hashedTagId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!tag) {
      return res.status(404).json({ error: 'Tag not found or not assigned' });
    }

    // Get approximate location from IP (short timeout inside helper)
    const location = await getLocationFromIP(finderIP);

    // Log the scan with additional details
    await new Promise((resolve, reject) => {
      db.run('INSERT INTO scan_logs (tag_id, finder_ip, finder_location, message, pin_latitude, pin_longitude) VALUES (?, ?, ?, ?, ?, ?)',
        [hashedTagId, finderIP, location ? `${location.city}, ${location.region}, ${location.country}` : 'Unknown', message, pinLatitude, pinLongitude], (err) => {
          if (err) reject(err);
          else resolve();
        });
    });

    // Respond to finder immediately; do not block on email
    res.json({ message: 'Owner has been notified successfully' });

    // Fire-and-forget email notification to owner if tag is claimed
    if (tag.is_claimed && tag.contact_email) {
      (async () => {
        try {
          const approxText = (location && location.city && location.region && location.country)
            ? `${location.city}, ${location.region}, ${location.country}`
            : 'UVA Rotunda, Charlottesville, VA';
          const mailOptions = {
            from: process.env.EMAIL_USER || 'your-email@gmail.com',
            to: tag.contact_email,
            subject: 'Found your tag!',
            html: `
              <h2>Found your tag!</h2>
              <p><strong>Tag ID:</strong> ${tag.tag_id}</p>
              <p><strong>Found at:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>Approximate location:</strong> ${approxText}</p>
              ${pinLatitude && pinLongitude ? `<p><strong>Exact location:</strong> <a href="https://maps.google.com/?q=${pinLatitude},${pinLongitude}" target="_blank">View on Google Maps</a></p>` : ''}
              ${message ? `<p><strong>Message from finder:</strong> ${message}</p>` : ''}
              <p>Thank you for using Smart PaperTags!</p>
            `
          };
          await sendEmail(mailOptions);
        } catch (emailError) {
          console.error('Email sending error (background found):', emailError);
        }
      })();
    }
  } catch (error) {
    console.error('Found item submission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin routes

// Create admin account (for initial setup)
app.post('/api/admin/create', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Check if admin already exists
    const existingAdmin = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM admins WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin
    const adminId = await new Promise((resolve, reject) => {
      db.run('INSERT INTO admins (email, password, name) VALUES (?, ?, ?)',
        [email, hashedPassword, name], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
    });

    res.json({ message: 'Admin created successfully', adminId });
  } catch (error) {
    console.error('Admin creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate new tags (admin only)
app.post('/api/admin/generate-tags', authenticateAdminToken, async (req, res) => {
  try {
    const { count = 1 } = req.body;
    const tags = [];

    for (let i = 0; i < count; i++) {
      const tagId = generateReadableTagId();
      const hashedTagId = generateHashedTagId();
      
      // Insert tag
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO tags (tag_id, hashed_tag_id, admin_id) VALUES (?, ?, ?)',
          [tagId, hashedTagId, req.admin.adminId], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          });
      });

      tags.push({
        tagId,
        hashedTagId,
        claimableUrl: `${req.protocol}://${req.get('host')}/tag/${hashedTagId}`
      });
    }

    res.json({ message: `${count} tags generated successfully`, tags });
  } catch (error) {
    console.error('Tag generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all tags (admin only)
app.get('/api/admin/tags', authenticateAdminToken, async (req, res) => {
  try {
    const tags = await new Promise((resolve, reject) => {
      db.all(`
        SELECT t.*, a.name as admin_name, u.name as owner_name, u.email as owner_email
        FROM tags t
        LEFT JOIN admins a ON t.admin_id = a.id
        LEFT JOIN users u ON t.owner_id = u.id
        ORDER BY t.created_at DESC
      `, (err, rows) => {
        if (err) {
          console.error('Database query error:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });

    // Add claimable URLs to each tag
    const tagsWithUrls = tags.map(tag => ({
      ...tag,
      claimableUrl: `${req.protocol}://${req.get('host')}/tag/${tag.hashed_tag_id}`
    }));

    res.json({ tags: tagsWithUrls });
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Assign tag to admin (mark as ready for shipping)
app.post('/api/admin/tags/:tagId/assign', authenticateAdminToken, async (req, res) => {
  try {
    const { tagId } = req.params;

    await new Promise((resolve, reject) => {
      db.run('UPDATE tags SET is_assigned = TRUE, assigned_at = CURRENT_TIMESTAMP WHERE tag_id = ? AND admin_id = ?',
        [tagId, req.admin.adminId], (err) => {
          if (err) reject(err);
          else resolve();
        });
    });

    res.json({ message: 'Tag assigned successfully' });
  } catch (error) {
    console.error('Tag assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a tag (admin only)
app.delete('/api/admin/tags/:tagId/delete', authenticateAdminToken, async (req, res) => {
  try {
    const { tagId } = req.params;

    // Get tag info first to get hashed_tag_id for cleaning up scan logs
    const tag = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM tags WHERE tag_id = ? AND admin_id = ?', [tagId, req.admin.adminId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!tag) {
      return res.status(404).json({ error: 'Tag not found or not owned by admin' });
    }

    // Delete related scan logs first
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM scan_logs WHERE tag_id = ?', [tag.hashed_tag_id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Delete the tag
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM tags WHERE tag_id = ?', [tagId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Tag deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create default admin account on startup
async function createDefaultAdmin() {
  try {
    // Check if any admin exists
    const existingAdmin = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM admins LIMIT 1', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!existingAdmin) {
      // Create default admin
      const hashedPassword = await bcrypt.hash('2squidys', 10);
      
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO admins (email, password, name) VALUES (?, ?, ?)',
          ['BCunni@admin.com', hashedPassword, 'BCunni'], function(err) {
            if (err) reject(err);
            else resolve();
          });
      });

      console.log('✅ Default admin account created:');
      console.log('   Email: BCunni@admin.com');
      console.log('   Password: 2squidys');
      console.log('   Admin Dashboard: http://localhost:' + PORT + '/admin.html');
    } else {
      console.log('✅ Admin account already exists');
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
}

// Start server
// Admin route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM tags', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    res.json({ message: 'Database connected', tagCount: result.count });
  } catch (error) {
    res.status(500).json({ error: 'Database error', details: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Approximate IP-based location (no browser prompt)
app.get('/api/ip-location', async (req, res) => {
  try {
    const fwd = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(fwd) ? fwd[0] : (fwd ? fwd.split(',')[0] : null)) || req.ip || req.connection.remoteAddress;
    const loc = await getLocationFromIP(ip);
    res.json(loc);
  } catch (e) {
    res.status(200).json({ city: 'Unknown City', region: 'Unknown Region', country: 'Unknown Country' });
  }
});

// Test email endpoint
app.post('/api/test-email', async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    const mailOptions = {
      from: DEFAULT_FROM,
      to: to || 'test@example.com',
      subject: subject || 'Test Email',
      text: text || 'This is a test email from the PaperTags system!',
      html: `<p>${(text || 'This is a test email from the PaperTags system!')}</p>`,
      replyTo: DEFAULT_FROM
    };
    
    const result = await sendEmail(mailOptions);
    res.json({ message: 'Email sent successfully', messageId: result.messageId });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ error: 'Failed to send test email', details: error && (error.response || error.message || String(error)) });
  }
});

app.listen(PORT, async () => {
  console.log(`Smart PaperTags NFC App running on http://localhost:${PORT}`);
  console.log('Make sure to set EMAIL_USER and EMAIL_PASS environment variables for email functionality');
  
  // Create default admin
  await createDefaultAdmin();
});

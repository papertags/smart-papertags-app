# Smart PaperTags NFC App - Deployment Guide

## 🚀 Deployment Options

### Option 1: Railway (Recommended - Easiest)
**Best for**: Quick deployment with database included

1. **Prepare your app**:
   ```bash
   # Create a start script
   echo 'node server.js' > start.sh
   chmod +x start.sh
   ```

2. **Deploy to Railway**:
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub
   - Click "New Project" → "Deploy from GitHub repo"
   - Connect your GitHub account
   - Select your repository
   - Railway will automatically detect Node.js and deploy

3. **Set Environment Variables**:
   - In Railway dashboard, go to your project
   - Click "Variables" tab
   - Add: `EMAIL_USER=papertags.notify@gmail.com`
   - Add: `EMAIL_PASS=vxprjgwqnmhpgyjg`
   - Add: `PORT=3000`

4. **Get your URL**:
   - Railway will give you a URL like: `https://your-app-name.railway.app`
   - Update your NFC tags to use this URL

---

### Option 2: Heroku (Popular Choice)
**Best for**: Established platform with good documentation

1. **Install Heroku CLI**:
   ```bash
   # macOS
   brew install heroku/brew/heroku
   
   # Or download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Prepare your app**:
   ```bash
   # Create Procfile
   echo 'web: node server.js' > Procfile
   
   # Create .gitignore
   echo 'node_modules/
   .env
   *.log
   papertags.db' > .gitignore
   ```

3. **Deploy**:
   ```bash
   # Login to Heroku
   heroku login
   
   # Create app
   heroku create your-papertags-app
   
   # Set environment variables
   heroku config:set EMAIL_USER=papertags.notify@gmail.com
   heroku config:set EMAIL_PASS=vxprjgwqnmhpgyjg
   
   # Deploy
   git add .
   git commit -m "Deploy to Heroku"
   git push heroku main
   ```

4. **Get your URL**:
   - Heroku will give you: `https://your-papertags-app.herokuapp.com`

---

### Option 3: Vercel (Great for Frontend)
**Best for**: Fast deployment with automatic HTTPS

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Prepare for Vercel**:
   ```bash
   # Create vercel.json
   echo '{
     "version": 2,
     "builds": [
       {
         "src": "server.js",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "server.js"
       }
     ]
   }' > vercel.json
   ```

3. **Deploy**:
   ```bash
   vercel
   # Follow prompts
   vercel --prod
   ```

---

### Option 4: DigitalOcean App Platform
**Best for**: Full control with managed database

1. **Create DigitalOcean Account**
2. **Go to App Platform**
3. **Create New App**:
   - Connect GitHub repository
   - Select Node.js
   - Add environment variables
   - Deploy

---

## 🔧 Pre-Deployment Checklist

### 1. Update Email Configuration
```javascript
// In server.js, update the email configuration for production
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'papertags.notify@gmail.com',
    pass: process.env.EMAIL_PASS || 'vxprjgwqnmhpgyjg'
  }
});
```

### 2. Update CORS Settings
```javascript
// In server.js, update CORS for production
app.use(cors({
  origin: ['https://your-domain.com', 'https://www.your-domain.com'],
  credentials: true
}));
```

### 3. Update Base URL in Emails
```javascript
// In server.js, update the base URL for emails
const baseUrl = process.env.BASE_URL || 'https://your-domain.com';
```

### 4. Database Considerations
- **SQLite**: Works for small to medium apps
- **PostgreSQL**: Better for production (Railway, Heroku provide this)
- **MongoDB**: Alternative option

---

## 🌐 Domain Setup (Optional)

### 1. Buy a Domain
- Go to [Namecheap](https://namecheap.com) or [GoDaddy](https://godaddy.com)
- Buy a domain like `papertags.com` or `smartpapertags.com`

### 2. Connect Domain to Host
- **Railway**: Add custom domain in project settings
- **Heroku**: Add domain in app settings
- **Vercel**: Add domain in project settings

### 3. SSL Certificate
- Most platforms provide free SSL certificates
- Your app will be accessible via `https://yourdomain.com`

---

## 📱 NFC Tag Setup

### 1. Update NFC Tags
Once deployed, update your NFC tags with the new URL:
```
https://your-app-name.railway.app/tag/{hashedTagId}
```

### 2. Test NFC Tags
- Write the new URL to physical NFC tags
- Test with a phone's NFC reader
- Should open your deployed app

---

## 🔒 Security Considerations

### 1. Environment Variables
- Never commit `.env` files
- Use platform environment variable settings
- Rotate email passwords regularly

### 2. Database Security
- Use connection pooling
- Regular backups
- Monitor for suspicious activity

### 3. Rate Limiting
Consider adding rate limiting:
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);
```

---

## 📊 Monitoring & Analytics

### 1. Add Logging
```javascript
// Add to server.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### 2. Health Check Endpoint
```javascript
// Add to server.js
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
```

---

## 🚀 Quick Start (Railway - Recommended)

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/smart-papertags-app.git
   git push -u origin main
   ```

2. **Deploy on Railway**:
   - Go to [railway.app](https://railway.app)
   - Connect GitHub
   - Select your repo
   - Add environment variables
   - Deploy!

3. **Update NFC Tags**:
   - Use the Railway URL for your NFC tags
   - Test with a phone

**Your app will be live at**: `https://your-app-name.railway.app`

---

## 🆘 Troubleshooting

### Common Issues:
1. **Email not working**: Check environment variables
2. **Database errors**: Ensure database is accessible
3. **CORS errors**: Update CORS settings for your domain
4. **NFC not working**: Verify URL format in NFC tags

### Support:
- Check platform documentation
- Monitor logs in platform dashboard
- Test locally first before deploying

---

## 📈 Scaling Considerations

### For High Traffic:
1. **Database**: Move to PostgreSQL or MongoDB
2. **Caching**: Add Redis for session management
3. **CDN**: Use CloudFlare for static assets
4. **Load Balancing**: Multiple server instances

### Cost Estimates:
- **Railway**: $5-20/month
- **Heroku**: $7-25/month
- **Vercel**: $0-20/month
- **DigitalOcean**: $12-25/month

---

**Ready to deploy? Start with Railway for the easiest experience!** 🚀

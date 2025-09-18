# 🚀 Quick Deploy Guide - Smart PaperTags NFC App

## Option 1: Railway (Easiest - 5 minutes)

### Step 1: Push to GitHub
```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Smart PaperTags NFC App"

# Create GitHub repository at github.com/new
# Then push your code
git remote add origin https://github.com/YOURUSERNAME/smart-papertags-app.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Railway
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your `smart-papertags-app` repository
5. Railway will automatically deploy!

### Step 3: Set Environment Variables
In Railway dashboard:
- Go to your project
- Click "Variables" tab
- Add these variables:
  - `EMAIL_USER` = `papertags.notify@gmail.com`
  - `EMAIL_PASS` = `vxprjgwqnmhpgyjg`
  - `JWT_SECRET` = `your-random-secret-key-here`

### Step 4: Get Your URL
- Railway will give you a URL like: `https://smart-papertags-app-production.railway.app`
- **This is your live app URL!**

---

## Option 2: Heroku (Popular - 10 minutes)

### Step 1: Install Heroku CLI
```bash
# macOS
brew install heroku/brew/heroku

# Or download from https://devcenter.heroku.com/articles/heroku-cli
```

### Step 2: Deploy
```bash
# Login to Heroku
heroku login

# Create app
heroku create your-papertags-app

# Set environment variables
heroku config:set EMAIL_USER=papertags.notify@gmail.com
heroku config:set EMAIL_PASS=vxprjgwqnmhpgyjg
heroku config:set JWT_SECRET=$(openssl rand -base64 32)

# Deploy
git push heroku main
```

### Step 3: Get Your URL
- Heroku will give you: `https://your-papertags-app.herokuapp.com`

---

## Option 3: Vercel (Fast - 5 minutes)

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Deploy
```bash
# Login to Vercel
vercel login

# Deploy
vercel

# Set environment variables in Vercel dashboard
# EMAIL_USER = papertags.notify@gmail.com
# EMAIL_PASS = vxprjgwqnmhpgyjg
```

---

## 🏷️ Update Your NFC Tags

Once deployed, update your NFC tags with the new URL:

**Format**: `https://your-app-url.com/tag/{hashedTagId}`

**Example**: `https://smart-papertags-app-production.railway.app/tag/abc123def456`

---

## ✅ Test Your Deployment

1. **Health Check**: Visit `https://your-app-url.com/health`
2. **Main App**: Visit `https://your-app-url.com`
3. **Admin**: Visit `https://your-app-url.com/admin.html`
4. **Test Email**: Use the test email endpoint

---

## 🔧 Troubleshooting

### Common Issues:
- **Email not working**: Check environment variables
- **Database errors**: SQLite should work fine for small apps
- **CORS errors**: The app is configured to allow all origins in production

### Check Logs:
- **Railway**: Go to project → "Deployments" → View logs
- **Heroku**: `heroku logs --tail`
- **Vercel**: Go to project → "Functions" → View logs

---

## 📱 NFC Tag Testing

1. **Write URL to NFC tag**:
   ```
   https://your-app-url.com/tag/abc123def456
   ```

2. **Test with phone**:
   - Tap NFC tag with phone
   - Should open your deployed app
   - Test claiming and finding flows

---

## 🌐 Custom Domain (Optional)

### Buy a Domain:
- [Namecheap](https://namecheap.com) - $10-15/year
- [GoDaddy](https://godaddy.com) - $10-15/year

### Connect to Your App:
- **Railway**: Project settings → "Domains"
- **Heroku**: App settings → "Domains"
- **Vercel**: Project settings → "Domains"

---

## 💰 Cost Estimates

- **Railway**: $5-20/month (free tier available)
- **Heroku**: $7-25/month (free tier discontinued)
- **Vercel**: $0-20/month (generous free tier)

---

## 🎉 You're Live!

Your Smart PaperTags NFC App is now deployed and ready for real-world use!

**Next Steps:**
1. Test everything thoroughly
2. Write URLs to physical NFC tags
3. Share with users
4. Monitor usage and performance
5. Consider upgrading to a custom domain

**Need Help?** Check the full `DEPLOYMENT_GUIDE.md` for detailed instructions.

#!/bin/bash

# Smart PaperTags NFC App - Deployment Script
echo "🚀 Deploying Smart PaperTags NFC App..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit - Smart PaperTags NFC App"
fi

# Check if remote exists
if ! git remote | grep -q origin; then
    echo "⚠️  No remote origin found. Please add your GitHub repository:"
    echo "   git remote add origin https://github.com/yourusername/smart-papertags-app.git"
    echo "   git push -u origin main"
    exit 1
fi

# Deploy to Railway (if Railway CLI is installed)
if command -v railway &> /dev/null; then
    echo "🚂 Deploying to Railway..."
    railway login
    railway link
    railway up
    echo "✅ Deployed to Railway!"
    echo "🌐 Your app URL: https://$(railway status | grep 'https://' | head -1 | cut -d' ' -f2)"
else
    echo "📝 Railway CLI not found. Install it with:"
    echo "   npm install -g @railway/cli"
    echo "   railway login"
    echo "   railway link"
    echo "   railway up"
fi

# Deploy to Heroku (if Heroku CLI is installed)
if command -v heroku &> /dev/null; then
    echo "🟣 Deploying to Heroku..."
    heroku create smart-papertags-app-$(date +%s)
    heroku config:set EMAIL_USER=papertags.notify@gmail.com
    heroku config:set EMAIL_PASS=vxprjgwqnmhpgyjg
    heroku config:set JWT_SECRET=$(openssl rand -base64 32)
    git push heroku main
    echo "✅ Deployed to Heroku!"
    echo "🌐 Your app URL: https://smart-papertags-app-$(date +%s).herokuapp.com"
else
    echo "📝 Heroku CLI not found. Install it with:"
    echo "   brew install heroku/brew/heroku"
    echo "   heroku login"
    echo "   heroku create your-app-name"
    echo "   git push heroku main"
fi

echo "🎉 Deployment complete!"
echo "📋 Next steps:"
echo "   1. Update your NFC tags with the new URL"
echo "   2. Test the deployment"
echo "   3. Monitor logs for any issues"
echo "   4. Set up a custom domain (optional)"

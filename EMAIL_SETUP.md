# Email Setup Guide

## Current Status
✅ Email system is working in DEMO MODE (logs emails to console)
✅ All email notifications are functional
✅ Server is running properly

## To Enable Real Email Sending

### Step 1: Enable 2-Factor Authentication
1. Go to your Gmail account: https://myaccount.google.com/
2. Click "Security" in the left sidebar
3. Under "Signing in to Google", click "2-Step Verification"
4. Follow the prompts to enable 2FA

### Step 2: Generate App Password
1. Go to: https://myaccount.google.com/apppasswords
2. Select "Mail" as the app
3. Select "Other" as the device and name it "PaperTags App"
4. Click "Generate"
5. Copy the 16-character password (it will look like: abcd efgh ijkl mnop)

### Step 3: Update Server Configuration
1. Open `server.js` in your editor
2. Find line 90: `pass: '2squidys'`
3. Replace `'2squidys'` with your App Password (keep the quotes)
4. Find line 95: `const DEMO_MODE = true;`
5. Change to: `const DEMO_MODE = false;`
6. Save the file and restart the server

### Step 4: Test Real Email
```bash
# Restart server
pkill -f "node server.js" && node server.js

# Test email
curl -X POST "http://localhost:3000/api/test-email" \
  -H "Content-Type: application/json" \
  -d '{"to":"bmcunningham18@gmail.com","subject":"Test Real Email","text":"This is a real email!"}'
```

## Current Demo Mode
- All emails are logged to the console
- No actual emails are sent
- Perfect for testing and development
- All functionality works exactly the same

## Troubleshooting
- If you get "Invalid login" errors, make sure you're using the App Password, not your regular password
- App Passwords are 16 characters with spaces (remove spaces when pasting)
- Make sure 2FA is enabled before generating App Password

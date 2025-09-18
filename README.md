# Smart PaperTags NFC App

A complete web application for managing NFC-enabled paper tags for lost and found items. This app allows users to register NFC tags with their contact information and enables finders to contact owners when items are found.

## Features

### User Registration & Tag Management
- User registration and authentication
- Register NFC tags with contact information
- Edit and update tag information
- View all registered tags

### NFC Tag Scanning
- Scan tags to retrieve owner information
- Automatic email notifications to tag owners
- Geolocation tracking with manual pin placement
- Secure contact information sharing

### Security & Privacy
- JWT-based authentication
- Password hashing with bcrypt
- Tag ownership validation
- Secure API endpoints

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Gmail account for email notifications (optional)

### Quick Start

1. **Clone or download the project**
   ```bash
   cd smart-papertags-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables (optional)**
   Create a `.env` file in the root directory:
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   JWT_SECRET=your-secret-key
   PORT=3000
   ```

4. **Start the application**
   ```bash
   npm start
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

### Development Mode
For development with auto-restart:
```bash
npm run dev
```

## Project Structure

```
smart-papertags-app/
├── package.json          # Dependencies and scripts
├── server.js             # Express server and API routes
├── papertags.db          # SQLite database (created automatically)
├── public/               # Frontend files
│   ├── index.html        # Main HTML file
│   ├── styles.css        # CSS styles
│   └── app.js           # Frontend JavaScript
└── README.md            # This file
```

## API Endpoints

### Authentication
- `POST /api/register` - User registration
- `POST /api/login` - User login

### Tag Management
- `POST /api/register-tag` - Register a new tag
- `GET /api/my-tags` - Get user's tags
- `PUT /api/tags/:tagId` - Update tag information
- `DELETE /api/tags/:tagId` - Delete a tag

### Scanning
- `POST /api/scan/:tagId` - Scan a tag (public endpoint)
- `GET /api/tags/:tagId/scans` - Get scan history

## Usage Guide

### For Tag Owners

1. **Register an Account**
   - Open the app and click "Register"
   - Fill in your details and create an account

2. **Add a PaperTag**
   - Click "Add New Tag" on the dashboard
   - Enter the NFC Tag ID from your physical tag
   - Add your contact information
   - Save the tag

3. **Manage Tags**
   - View all your registered tags
   - Edit contact information as needed
   - Delete tags you no longer need

### For Finders

1. **Scan a Tag**
   - Click "Scan Tag" in the navigation
   - Enter the NFC Tag ID from the found item
   - The app will retrieve owner information
   - Contact the owner using the provided details

2. **Location Services**
   - Allow location access for automatic geolocation
   - The owner will receive an email with your location
   - You can also manually pin the exact location

## Database Schema

### Users Table
- `id` - Primary key
- `email` - User email (unique)
- `password` - Hashed password
- `name` - User's full name
- `phone` - Phone number (optional)
- `created_at` - Registration timestamp

### Tags Table
- `id` - Primary key
- `tag_id` - NFC Tag ID (unique)
- `owner_id` - Foreign key to users table
- `contact_name` - Contact name for the tag
- `contact_email` - Contact email for the tag
- `contact_phone` - Contact phone (optional)
- `is_registered` - Registration status
- `created_at` - Registration timestamp

### Scan Logs Table
- `id` - Primary key
- `tag_id` - Foreign key to tags table
- `finder_ip` - IP address of finder
- `finder_location` - Approximate location
- `scan_timestamp` - When the scan occurred
- `message` - Optional message from finder
- `pin_latitude` - Manual pin latitude
- `pin_longitude` - Manual pin longitude

## Email Configuration

The app uses Nodemailer with Gmail for sending notifications. To set up email:

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password for the application
3. Set the `EMAIL_USER` and `EMAIL_PASS` environment variables

## Security Features

- **Password Hashing**: Uses bcrypt for secure password storage
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Protection**: Parameterized queries
- **CORS Protection**: Configured for security
- **Rate Limiting**: Built-in protection against abuse

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Troubleshooting

### Common Issues

1. **Email not sending**
   - Check your Gmail app password
   - Verify EMAIL_USER and EMAIL_PASS environment variables
   - Check Gmail's security settings

2. **Location not working**
   - Ensure HTTPS in production
   - Check browser location permissions
   - Verify geolocation API support

3. **Database errors**
   - Check file permissions for SQLite database
   - Ensure the app has write access to the directory

### Development Tips

- Use browser developer tools to debug API calls
- Check the server console for error messages
- Test with different browsers and devices
- Use the network tab to monitor API requests

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support or questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation

---

**Note**: This is a demonstration application. For production use, consider additional security measures, database optimization, and proper deployment practices.
# Smart PaperTags NFC App - Deployed to Railway

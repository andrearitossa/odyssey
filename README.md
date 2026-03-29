# Odyssey - AI-Powered Interactive Storytelling

## RUN:
**Frontend**:
```bash
cd frontend
npm start
```

**Backend**:
```bash
cd backend
npm run dev
```

### DEPLOY

#### Backend Deployment
```bash
cd backend
wrangler deploy
```

#### Frontend Deployment
```bash
cd frontend
npm run deploy
```


## SETUP:
- Node.js 20
- Cloudflare account -> easily setup trough google login
- Google Cloud Console account (for OAuth)

### Google OAuth

#### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one, with:
   - Google+ API
   - Google OAuth2 API

#### 2. Create OAuth 2.0 Credentials

1. Navigate to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**

2. WEB: ADD:
   - Application type: "Web application"
   - Name: "Odyssey Web Client"
   - Authorized redirect URIs:
     ```
     http://localhost:8787/auth/google/callback
     https://your-backend-domain.workers.dev/auth/google/callback
     ```

3. **For Mobile Application:**
   - Application type: "Android" or "iOS"
   - Add your package name and SHA-1 certificate fingerprint

#### 3. Configure Environment Variables

**Frontend** -> inside `.env` set:
```bash
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

**Backend** -> set, trough terminal:
```bash
# Development
wrangler secret put GOOGLE_CLIENT_ID --env development
wrangler secret put GOOGLE_CLIENT_SECRET --env development

# Production
wrangler secret put GOOGLE_CLIENT_ID --env production
wrangler secret put GOOGLE_CLIENT_SECRET --env production
```

#### 4. Verify

Run the following to check your setup:
```bash
# Frontend
npm start
# Check console for OAuth validation messages

# Backend
wrangler dev
# Check logs for OAuth validation messages
```

### Installation

#### Backend Setup
```bash
cd backend
npm install

# Set up OAuth secrets (replace with your actual values)
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET

# Optional: AI service keys
wrangler secret put GEMINI_API_KEY
wrangler secret put HUGGINGFACE_API_KEY

# Run locally
wrangler dev
```

#### Frontend Setup
```bash
cd frontend

npm install
npm start
```

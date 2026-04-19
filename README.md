# MoodPulse

[![Backend CI/CD](https://github.com/vines/moodpulse/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/vines/moodpulse/actions/workflows/backend-ci.yml)
[![Frontend CI/CD](https://github.com/vines/moodpulse/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/vines/moodpulse/actions/workflows/frontend-ci.yml)

A real-time public mood board where anyone can submit their current mood and see a live animated visualization of all moods. 

## Features

- **Share Moods**: Submit an emoji, intensity, and optional note.
- **Live Canvas Visualization**: Floating mood bubbles based on intensity and mood type.
- **Stats Dashboard**: View the most common mood today, average intensity, and filter by time.
- **Graceful Offline Mode**: Visual indicator of API health, with fallback messaging.

## Architecture

```text
    [ Frontend / Vercel ]
           │   (Vanilla JS + HTML + CSS)
           ▼
    [ GitHub Actions CI/CD Pipeline ]
           │
           ▼
    [ Backend / Railway ]
           │   (Node.js + Express.js)
           ▼
    [ Database / MongoDB Atlas ]
```

## Setup & Running Locally

1. **Clone the repository**
   ```sh
   git clone https://github.com/user/moodpulse.git
   cd moodpulse
   ```

2. **Backend Setup**
   ```sh
   cd backend
   npm install
   cp .env.example .env
   # Start MongoDB locally or provide Atlas URI in .env
   npm run dev
   ```

3. **Frontend Setup**
   Since frontend is plain HTML/JS/CSS, you can simply open `frontend/index.html` in a browser or use a live server.
   *(Note: Set the `REAL_API_URL` to `http://localhost:5000/api` in `frontend/app.js` during local dev).*

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Backend server port (Default: 5000) |
| `MONGO_URI` | MongoDB connection string |
| `FRONTEND_URL` | Used for CORS (e.g. `http://localhost:3000`) |

## CI/CD Flow

- **Backend CI/CD**: On push to `main` (if changes in `backend/`), it starts a MongoDB service, installs dependencies, runs Jest tests (Supertest + MongoMemoryServer), and deploys to Railway using the `railway-action`.
- **Frontend CI/CD**: On push to `main` (if changes in `frontend/`), it triggers a deployment to Vercel using `vercel-action`.

## Live Demo

- **Frontend**: [https://moodpulse-demo.vercel.app](#) *(Placeholder)*
- **Backend API**: [https://moodpulse-backend.up.railway.app/api/health](#) *(Placeholder)*

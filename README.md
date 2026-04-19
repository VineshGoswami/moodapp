# MoodPulse V2

[![Backend CI/CD](https://github.com/vines/moodpulse/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/vines/moodpulse/actions/workflows/backend-ci.yml)
[![Frontend CI/CD](https://github.com/vines/moodpulse/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/vines/moodpulse/actions/workflows/frontend-ci.yml)

A production-ready Full Stack Web Application deployed via robust CI/CD pipelines, equipped with real-time socket updates and advanced aggregations.

## Tech Stack
- **Frontend**: Vanilla JS + DOM + CSS + Socket.IO
- **Backend**: Node.js + Express.js + Socket.IO
- **Database**: MongoDB Atlas (mongoose ODM)
- **CI/CD**: GitHub Actions
- **Deployments**: Vercel (Frontend), Railway (Backend)

## V2 Features Highlights
- **Real-Time Canvas Updates**: View mood bubbles popping instantly as people submit them globally thanks to Socket.IO.
- **Live User Tracking**: Active live connection count syncing.
- **Mood Heatmap**: A sophisticated aggregation calculating your last 7 days of general sentiment.
- **Mood Battle**: Random top moods pit against each other daily, with animated voting and a leaderboard tracking all-time favorites.
- **Daily Streak Mechanics**: Client-tracked identity driving streak data pulled via aggregation to trigger visual glowing CSS animations.
- **Image Export**: Native pure JS canvas screenshotting to export the live moodboard as a `.png`.
- **Hidden Admin Panel**: Protected query param rendering pure CSS admin functionality.

## Usage
1. Setup your remote databases and API strings in `.env` inside `backend`.
2. Run `npm install` and `npm run dev` in the backend. 
3. Run `npm install` and `npm start` in the frontend or simply open `index.html`.
4. Run tests with `npm test`.

# Echoes | Living Memory Profiles

Preserve the voices and stories of your loved ones for generations to come using GenAI.

## Getting Started

To run this project locally, follow these steps:

### 1. Prerequisites
- Node.js (v18 or higher)
- A Google Gemini API Key (from [Google AI Studio](https://aistudio.google.com/app/apikey))

### 2. Environment Variables
Create a `.env` file in the root directory and add your API key:
```bash
GOOGLE_GENAI_API_KEY=your_actual_key_here
```

### 3. Installation
```bash
npm install
```

### 4. Development
```bash
npm run dev
```
Open [http://localhost:9002](http://localhost:9002) in your browser.

## Deployment

This app is designed to be deployed on **Firebase App Hosting**. 

1. Push your code to GitHub.
2. Connect your repository to Firebase App Hosting in the [Firebase Console](https://console.firebase.google.com/).
3. Add your `GOOGLE_GENAI_API_KEY` as a secret in the App Hosting settings.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **AI Engine**: Genkit with Google Gemini
- **UI**: Tailwind CSS + ShadCN
- **Persistence**: LocalStorage + Puter.js Cloud Sync

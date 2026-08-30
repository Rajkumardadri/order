# QuestionBank Web Application (Vercel Ready)

This is the web application for **QuestionBank Hub**. It allows you to practice unattempted/wrong questions in interactive MCQ mode, track daily progress reports, extract questions from PDFs, and create smart revision decks.

## 🚀 Features
1. **Interactive MCQ Practice Arena**: Attempt missed questions with immediate option validation, detailed explanations, and status updates (`Pending`, `Solved`, `Needs Revision`).
2. **Daily Progress Analytics**: Built-in Chart.js report tracking daily question attempts, accuracy %, and daily activity.
3. **PDF Question Extractor**: Built-in client-side PDF parser (PDF.js) that reads uploaded test paper PDFs or raw text, extracts MCQs, options (A, B, C, D), and answers automatically, letting you preview and save them into Firebase with 1 click.
4. **Smart Study Decks**: Converts your study notes, formulas, and missed questions into active-recall flashcard decks for rapid revision.

## 🌐 Deploy to Vercel
1. Install Vercel CLI (optional) or push this folder to GitHub.
   ```bash
   npm i -g vercel
   vercel
   ```
2. Alternatively, log in to [Vercel Dashboard](https://vercel.com), click **Add New Project**, import your GitHub repository, and click **Deploy**.
3. Your web application will be live instantly!

## ⚙️ Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Create a free project and enable **Firestore Database**.
3. Create a collection named `questions`.
4. Open the Web Application -> Click the Settings (⚙️) icon in top right -> Enter your Firebase `Project ID` & `API Key`.

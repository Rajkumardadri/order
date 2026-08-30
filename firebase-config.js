// QuestionBank Firebase & Storage Integration Module with 30-Day Recycle Bin System
window.QB = window.QB || {};

const DEFAULT_CONFIG = {
  apiKey: "AIzaSyCw_eug46aDoSnluYLqFJE7ub89105s6k0",
  authDomain: "questionsbank-23100.firebaseapp.com",
  projectId: "questionsbank-23100",
  storageBucket: "questionsbank-23100.appspot.com",
  messagingSenderId: "224623678941",
  appId: "1:224623678941:web:48a2d7d8699f62202a9234"
};

QB.getFirebaseConfig = function() {
  const saved = localStorage.getItem("qb_firebase_config");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.projectId && parsed.apiKey) return parsed;
    } catch (e) {}
  }
  return DEFAULT_CONFIG;
};

QB.saveFirebaseConfig = function(config) {
  localStorage.setItem("qb_firebase_config", JSON.stringify(config));
  QB.initFirebaseInstance();
};

QB.db = null;

QB.initFirebaseInstance = function() {
  const config = QB.getFirebaseConfig();
  if (config.projectId && config.apiKey && window.firebase) {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }
      QB.db = firebase.firestore();
      console.log("✅ Firebase Firestore connected:", config.projectId);
    } catch (err) {
      console.error("⚠️ Firebase initialization error:", err);
      QB.db = null;
    }
  } else {
    QB.db = null;
  }
};

// Fetch Questions (includeDeleted = false hides soft-deleted items)
QB.fetchQuestions = async function(includeDeleted = false) {
  let allQuestions = [];

  if (QB.db) {
    try {
      const snapshot = await QB.db.collection("questions").orderBy("createdAt", "desc").get();
      snapshot.forEach(doc => {
        allQuestions.push({ id: doc.id, ...doc.data() });
      });
    } catch (err) {
      console.warn("Firestore fetch error, reading local backup:", err);
    }
  }

  if (!allQuestions || allQuestions.length === 0) {
    allQuestions = getLocalQuestions();
  } else {
    saveLocalQuestions(allQuestions);
  }

  // Auto-purge items that have been in Recycle Bin for > 30 days
  autoPurgeExpiredQuestions(allQuestions);

  if (includeDeleted) {
    return allQuestions.filter(q => q.deleted === true);
  } else {
    return allQuestions.filter(q => !q.deleted);
  }
};

function getLocalQuestions() {
  const local = localStorage.getItem("qb_local_questions");
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch(e){}
  }
  const mock = QB.getMockQuestions();
  saveLocalQuestions(mock);
  return mock;
}

function saveLocalQuestions(questions) {
  localStorage.setItem("qb_local_questions", JSON.stringify(questions));
}

// 30-Day Auto Purge Engine
async function autoPurgeExpiredQuestions(questionsList) {
  const now = Date.now();
  const expired = questionsList.filter(q => q.deleted && q.expiresAt && now > q.expiresAt);

  for (const q of expired) {
    await QB.permanentDeleteQuestion(q.id);
  }
}

QB.saveQuestion = async function(questionData) {
  const qObj = {
    id: questionData.id || "q_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    title: questionData.title || "Untitled Question",
    questionText: questionData.questionText || "",
    options: questionData.options || [],
    correctAnswerIndex: typeof questionData.correctAnswerIndex === 'number' ? questionData.correctAnswerIndex : 0,
    explanation: questionData.explanation || "No explanation provided.",
    source: questionData.source || "manual",
    status: questionData.status || "pending",
    subject: questionData.subject || "General Subject",
    topic: questionData.topic || questionData.subject || "General Topic",
    subfolder: questionData.subfolder || "General Subfolder",
    tags: questionData.tags || [],
    createdAt: questionData.createdAt || new Date().toISOString(),
    lastAttemptedAt: questionData.lastAttemptedAt || null,
    attemptCount: questionData.attemptCount || 0,
    wrongAttemptsCount: questionData.wrongAttemptsCount || 0,
    userSelectedOption: questionData.userSelectedOption ?? null,
    // Spaced Repetition (SRS SM-2) Memory Engine Fields
    srsInterval: questionData.srsInterval || 1,
    srsRepetition: questionData.srsRepetition || 0,
    srsEaseFactor: questionData.srsEaseFactor || 2.5,
    nextReviewDate: questionData.nextReviewDate || new Date().toISOString(),
    userNote: questionData.userNote || "",
    deleted: questionData.deleted || false,
    deletedAt: questionData.deletedAt || null,
    expiresAt: questionData.expiresAt || null
  };

  if (QB.db) {
    try {
      await QB.db.collection("questions").doc(qObj.id).set(qObj);
    } catch (err) {
      console.warn("Firestore save error:", err);
    }
  }

  const questions = getLocalQuestions();
  const idx = questions.findIndex(q => q.id === qObj.id);
  if (idx >= 0) questions[idx] = qObj;
  else questions.unshift(qObj);
  saveLocalQuestions(questions);

  return qObj;
};

// Soft Delete (Moves to Recycle Bin for 30 Days)
QB.deleteQuestion = async function(questionId) {
  const now = Date.now();
  const deletedAtIso = new Date().toISOString();
  const expiresAtMs = now + (30 * 24 * 60 * 60 * 1000); // 30 Days in milliseconds

  if (QB.db) {
    try {
      await QB.db.collection("questions").doc(questionId).update({
        deleted: true,
        deletedAt: deletedAtIso,
        expiresAt: expiresAtMs
      });
    } catch (err) {
      console.warn("Firestore soft delete error:", err);
    }
  }

  const questions = getLocalQuestions();
  const q = questions.find(item => item.id === questionId);
  if (q) {
    q.deleted = true;
    q.deletedAt = deletedAtIso;
    q.expiresAt = expiresAtMs;
    saveLocalQuestions(questions);
  }
};

// Restore Question from Recycle Bin
QB.restoreQuestion = async function(questionId) {
  if (QB.db) {
    try {
      await QB.db.collection("questions").doc(questionId).update({
        deleted: false,
        deletedAt: null,
        expiresAt: null
      });
    } catch (err) {
      console.warn("Firestore restore error:", err);
    }
  }

  const questions = getLocalQuestions();
  const q = questions.find(item => item.id === questionId);
  if (q) {
    q.deleted = false;
    q.deletedAt = null;
    q.expiresAt = null;
    saveLocalQuestions(questions);
  }
};

// Permanent Hard Delete (Erases forever)
QB.permanentDeleteQuestion = async function(questionId) {
  if (QB.db) {
    try {
      await QB.db.collection("questions").doc(questionId).delete();
    } catch (err) {
      console.warn("Firestore hard delete error:", err);
    }
  }

  let questions = getLocalQuestions();
  questions = questions.filter(q => q.id !== questionId);
  saveLocalQuestions(questions);
};

// Soft Delete All Questions (Moves all to Recycle Bin)
QB.clearAllQuestions = async function() {
  const activeQuestions = await QB.fetchQuestions(false);
  for (const q of activeQuestions) {
    await QB.deleteQuestion(q.id);
  }
};

// Restore All Soft-Deleted Questions
QB.restoreAllDeletedQuestions = async function() {
  const deletedQuestions = await QB.fetchQuestions(true);
  for (const q of deletedQuestions) {
    await QB.restoreQuestion(q.id);
  }
};

// Permanent Clear Recycle Bin (Empty Trash)
QB.emptyRecycleBin = async function() {
  const deletedQuestions = await QB.fetchQuestions(true);
  for (const q of deletedQuestions) {
    await QB.permanentDeleteQuestion(q.id);
  }
};

// Update Question Status with Spaced Repetition (SRS SM-2) Memory Calculation
QB.updateQuestionStatus = async function(questionId, newStatus, selectedIdx = null) {
  const questions = await QB.fetchQuestions(false);
  const q = questions.find(item => item.id === questionId);
  if (q) {
    q.status = newStatus;
    q.lastAttemptedAt = new Date().toISOString();
    q.attemptCount = (q.attemptCount || 0) + 1;
    
    // Spaced Repetition (SM-2) Interval Calculation
    let rep = q.srsRepetition || 0;
    let interval = q.srsInterval || 1;
    let ease = q.srsEaseFactor || 2.5;

    if (newStatus === "solved") {
      rep += 1;
      if (rep === 1) interval = 1;
      else if (rep === 2) interval = 3;
      else interval = Math.round(interval * ease);
      ease = Math.min(3.0, ease + 0.1);
    } else { // needs_revision or wrong attempt
      q.wrongAttemptsCount = (q.wrongAttemptsCount || 0) + 1;
      rep = 0;
      interval = 1; // Due tomorrow
      ease = Math.max(1.3, ease - 0.2);
    }

    q.srsRepetition = rep;
    q.srsInterval = interval;
    q.srsEaseFactor = ease;

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);
    q.nextReviewDate = nextDate.toISOString();

    if (selectedIdx !== null) q.userSelectedOption = selectedIdx;
    await QB.saveQuestion(q);
    QB.recordDailyAttempt(newStatus === "solved");
  }
};

QB.updateQuestionNote = async function(questionId, noteText) {
  noteText = noteText ? noteText.trim() : "";

  if (QB.db) {
    try {
      await QB.db.collection("questions").doc(questionId).update({ userNote: noteText });
    } catch (err) {
      console.warn("Firestore update note error:", err);
    }
  }

  const questions = getLocalQuestions();
  const q = questions.find(item => item.id === questionId);
  if (q) {
    q.userNote = noteText;
    saveLocalQuestions(questions);
  }
};

QB.recordDailyAttempt = function(isCorrect) {
  const today = new Date().toISOString().split('T')[0];
  const reports = QB.getDailyReports();
  let todayReport = reports.find(r => r.date === today);
  if (!todayReport) {
    todayReport = { date: today, attemptedCount: 0, correctCount: 0, wrongCount: 0 };
    reports.unshift(todayReport);
  }
  todayReport.attemptedCount += 1;
  if (isCorrect) todayReport.correctCount += 1;
  else todayReport.wrongCount += 1;

  localStorage.setItem("qb_local_daily_reports", JSON.stringify(reports));
};

QB.getDailyReports = function() {
  const raw = localStorage.getItem("qb_local_daily_reports");
  if (raw) {
    try { return JSON.parse(raw); } catch(e){}
  }
  return [{ date: new Date().toISOString().split('T')[0], attemptedCount: 0, correctCount: 0, wrongCount: 0 }];
};

QB.getDecks = function() {
  const raw = localStorage.getItem("qb_local_decks");
  if (raw) {
    try { return JSON.parse(raw); } catch(e){}
  }
  return [
    {
      id: "deck_1",
      title: "Fluid Mechanics Properties & Formulas",
      subject: "Mechanical Engineering",
      topic: "Fluid Mechanics",
      cards: [
        { front: "Kinematic Viscosity Formula & SI Unit", back: "ν = μ / ρ (Unit: m²/s or Stokes. 1 Stokes = 10⁻⁴ m²/s)." },
        { front: "Newton's Law of Viscosity", back: "Shear Stress τ = μ (du/dy)." }
      ]
    }
  ];
};

QB.saveDeck = function(deck) {
  const decks = QB.getDecks();
  const idx = decks.findIndex(d => d.id === deck.id);
  if (idx >= 0) decks[idx] = deck;
  else decks.unshift(deck);
  localStorage.setItem("qb_local_decks", JSON.stringify(decks));
};

QB.deleteDeck = function(deckId) {
  let decks = QB.getDecks();
  decks = decks.filter(d => d.id !== deckId);
  localStorage.setItem("qb_local_decks", JSON.stringify(decks));
};

QB.isSRSQuestionDue = function(q) {
  if (!q) return false;
  if (!q.nextReviewDate) return true;
  return new Date(q.nextReviewDate) <= new Date();
};

QB.getScreenshots = function() {
  const raw = localStorage.getItem("qb_local_screenshots");
  if (raw) {
    try { return JSON.parse(raw); } catch(e){}
  }
  return [];
};

QB.saveScreenshot = function(snapData) {
  const snaps = QB.getScreenshots();
  const obj = {
    id: snapData.id || "snap_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
    imageUrl: snapData.imageUrl || "",
    subject: snapData.subject || "Mechanical Engineering",
    topic: snapData.topic || "Engineering Mechanics",
    subfolder: snapData.subfolder || "Lecture Snaps",
    title: snapData.title || "Lecture Screenshot Note",
    notes: snapData.notes || "",
    createdAt: snapData.createdAt || new Date().toISOString()
  };
  snaps.unshift(obj);
  localStorage.setItem("qb_local_screenshots", JSON.stringify(snaps));
  return obj;
};

QB.deleteScreenshot = function(snapId) {
  let snaps = QB.getScreenshots();
  snaps = snaps.filter(s => s.id !== snapId);
  localStorage.setItem("qb_local_screenshots", JSON.stringify(snaps));
};

QB.getNotesTopics = function() {
  const saved = localStorage.getItem("qb_local_notes_topics");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch(e){}
  }
  const defaultNotesTopics = [
    { subject: "General Knowledge", topic: "VLC Lecture Snaps" },
    { subject: "Mechanical Engineering", topic: "Lecture Notes" }
  ];
  localStorage.setItem("qb_local_notes_topics", JSON.stringify(defaultNotesTopics));
  return defaultNotesTopics;
};

QB.saveNotesTopic = function(subject, topic) {
  if (!subject || !topic) return;
  let list = QB.getNotesTopics();
  if (!list.some(t => t.subject === subject && t.topic === topic)) {
    list.push({ subject, topic });
    localStorage.setItem("qb_local_notes_topics", JSON.stringify(list));
  }
};

QB.getCustomTopics = function() {
  const saved = localStorage.getItem("qb_custom_topics");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    } catch(e){}
  }
  return [];
};

QB.saveCustomTopic = function(subject, topic, subfolder) {
  if (!subject || !topic) return;
  let list = QB.getCustomTopics();
  if (!list.some(t => t.subject === subject && t.topic === topic && t.subfolder === (subfolder || ""))) {
    list.push({ subject, topic, subfolder: subfolder || "", createdAt: new Date().toISOString() });
    localStorage.setItem("qb_custom_topics", JSON.stringify(list));
  }
};

QB.getSRSForecast = function(questionsList) {
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);

  let dueToday = 0;
  let dueTomorrow = 0;
  let dueThisWeek = 0;
  let retainedMastered = 0;

  questionsList.forEach(q => {
    if (!q.nextReviewDate) {
      dueToday++;
      return;
    }
    const d = new Date(q.nextReviewDate);
    if (d <= now) dueToday++;
    else if (d <= tomorrow) dueTomorrow++;
    else if (d <= in7Days) dueThisWeek++;
    else retainedMastered++;
  });

  return { dueToday, dueTomorrow, dueThisWeek, retainedMastered };
};

QB.getMockQuestions = function() {
  return [
    {
      id: "q_mech_parallelogram_2",
      title: "Q2. Resultant R of two forces P and Q acting at angle θ making angle α with P",
      questionText: "If the resultant R, of two forces P and Q acting at an angle θ makes an angle α with P, then",
      options: [
        "tan α = P sin θ / (Q - P sin θ)",
        "tan α = Q sin θ / (P + Q cos θ)",
        "tan α = P sin θ / (P + Q sin θ)",
        "tan α = P cos θ / (P + Q sin θ)"
      ],
      correctAnswerIndex: 1,
      explanation: "Ans. (b) : According to law of parallelogram:\nIn ΔAEC, tan α = CE / AE = CE / (AD + DE) = (Q sin θ) / (P + Q cos θ)\nExams: RRB-JE 30.08.2019 Ist Shift, ISRO VSSC 01-07-2018, Nagaland PSC 2018 Paper-I, ISRO VSSC 06-08-2017",
      source: "RRB-JE 30.08.2019 Ist Shift | ISRO VSSC 01-07-2018 | Nagaland PSC 2018 Paper-I | ISRO VSSC 06-08-2017",
      status: "pending",
      subject: "Mechanical Engineering",
      topic: "Engineering Mechanics",
      subfolder: "Forces & Resultants",
      createdAt: new Date().toISOString()
    }
  ];
};

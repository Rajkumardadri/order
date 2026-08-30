// Main Controller App
window.QB = window.QB || {};

let currentQuestionsList = [];
let parsedPdfQuestions = [];
let chartInstance = null;

let activeSubjectFilter = "all";
let activeTopicFilter = "all";
let activeSubfolderFilter = "all";

// SINGLE QUESTION PRACTICE ARENA INDEX & FULLSCREEN STATE
let currentPracticeIndex = 0;
let filteredPracticeQuestions = [];
let isFullscreenMode = false;

// DECK FILTERS STATE
let deckActiveSubject = "all";
let deckActiveTopic = "all";

// MCQ PRACTICE VIEW MODE SUB-OPTION ('cards', 'vertical', or 'table')
let practiceViewMode = 'cards';

// TOPICS MANAGER NESTED LEVEL STATE
let selectedSubjectFolder = null; // null = Level 1 (All Subject Folders), string = Level 2 (Topics inside selected Subject)

// HOURLY MISTAKE SPOTLIGHT STATE
let hourlyTimerInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  try {
    QB.initFirebaseInstance();
  } catch(e) {}
  try {
    await loadDashboardData();
  } catch(e) {}
  try {
    initDailyChart();
  } catch(e) {}
  try {
    startHourlyTimerCountdown();
  } catch(e) {}
  try {
    initDDayTimer();
  } catch(e) {}

  // GLOBAL KEYBOARD SHORTCUT: LISTEN FOR 'ESC' KEY TO DISMISS ANY MODAL OR FULL SCREEN MODE
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      const scorecard = document.getElementById('modal-test-scorecard');
      if (scorecard && !scorecard.classList.contains('hidden')) {
        closeTestScorecard();
        return;
      }

      const reviewModal = document.getElementById('modal-test-review-solutions');
      if (reviewModal && !reviewModal.classList.contains('hidden')) {
        closeTestReviewModal();
        return;
      }

      const snapModal = document.getElementById('modal-add-screenshot');
      if (snapModal && !snapModal.classList.contains('hidden')) {
        closeAddScreenshotModal();
        return;
      }

      const modals = ['modal-config', 'modal-test-setup', 'modal-create-deck', 'modal-edit-deck', 'modal-create-topic', 'modal-edit-topic', 'modal-move-question', 'modal-edit-question', 'modal-recycle-bin', 'modal-dday-setup', 'modal-topic-reader'];
      for (const mId of modals) {
        const m = document.getElementById(mId);
        if (m && !m.classList.contains('hidden')) {
          m.classList.add('hidden');
          return;
        }
      }

      if (isFullscreenMode) {
        toggleFullscreenPractice();
      }
    }
  });
});

  window.switchTab = switchTab;
  window.togglePracticeViewMode = togglePracticeViewMode;
  window.toggleFullscreenPractice = toggleFullscreenPractice;
  window.openConfigModal = openConfigModal;
  window.closeConfigModal = closeConfigModal;
  window.saveConfigFromModal = saveConfigFromModal;
  window.handlePdfUpload = handlePdfUpload;
  window.handleImageUpload = handleImageUpload;
  window.processImageOCR = processImageOCR;
  window.parseRawText = parseRawText;
  window.saveAllParsedQuestions = saveAllParsedQuestions;
  window.onPdfSubjectSelectChange = onPdfSubjectSelectChange;
  window.onPdfTopicSelectChange = onPdfTopicSelectChange;
  window.openDDaySetupModal = openDDaySetupModal;
  window.closeDDaySetupModal = closeDDaySetupModal;
  window.saveDDayConfigModal = saveDDayConfigModal;

  // GLOBAL CLIPBOARD PASTE LISTENER FOR QUESTION IMAGES (CTRL + V)
  window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || window.clipboardData)?.items;
    if (!items) return;
    for (let item of items) {
      if (item.type.indexOf("image") === 0) {
        const blob = item.getAsFile();
        if (blob) {
          switchTab('pdf');
          processImageOCR(blob);
          e.preventDefault();
          break;
        }
      }
    }
  });

  // GLOBAL KEYBOARD SHORTCUTS LISTENER FOR MCQ PRACTICE & TIMED MOCK TEST
  window.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement ? document.activeElement.tagName.toUpperCase() : "";
    if (activeTag === "INPUT" || activeTag === "TEXTAREA" || (document.activeElement && document.activeElement.isContentEditable)) {
      return;
    }

    const isMcqTabActive = !document.getElementById('tab-practice')?.classList.contains('hidden');
    const isSingleMode = practiceViewMode === 'card';

    if ((isMcqTabActive && isSingleMode) || isMockTestActive) {
      if (e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        nextPracticeQuestion();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevPracticeQuestion();
      } else if (['1', '2', '3', '4', 'a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(e.key)) {
        const keyMap = {'1':0, 'a':0, 'A':0, '2':1, 'b':1, 'B':1, '3':2, 'c':2, 'C':2, '4':3, 'd':3, 'D':3};
        const optIdx = keyMap[e.key];
        const qList = isMockTestActive ? currentMockTestQuestions : filteredPracticeQuestions;
        const qIdx = isMockTestActive ? currentMockTestIndex : currentPracticeIndex;
        const q = qList[qIdx];
        if (q && typeof optIdx === 'number') {
          attemptQuestion(q.id, optIdx, q.correctAnswerIndex);
        }
      }
    }
  });

  window.loadPracticeQuestions = loadPracticeQuestions;
  window.renderVerticalQuestions = renderVerticalQuestions;
  window.jumpToPracticeQuestion = jumpToPracticeQuestion;
  window.nextPracticeQuestion = nextPracticeQuestion;
  window.prevPracticeQuestion = prevPracticeQuestion;
  window.attemptQuestion = attemptQuestion;
  window.attemptHourlySpotlightQuestion = attemptHourlySpotlightQuestion;
  window.toggleSolutionVisibility = toggleSolutionVisibility;
  window.generateGeminiHinglishSolution = generateGeminiHinglishSolution;
  window.updateQuestionStatus = updateQuestionStatus;
  window.toggleMarkForReview = toggleMarkForReview;
  window.renderQuestionsTable = renderQuestionsTable;

  // DECKS TOPIC MANAGER WINDOW EXPORTS
  window.renderDecks = renderDecks;
  window.openCreateDeckModal = openCreateDeckModal;
  window.closeCreateDeckModal = closeCreateDeckModal;
  window.onCreateDeckSubjectChange = onCreateDeckSubjectChange;
  window.onCreateDeckTopicChange = onCreateDeckTopicChange;
  window.saveCreateDeckModal = saveCreateDeckModal;
  window.openEditDeckModal = openEditDeckModal;
  window.closeEditDeckModal = closeEditDeckModal;
  window.onEditDeckSubjectChange = onEditDeckSubjectChange;
  window.onEditDeckTopicChange = onEditDeckTopicChange;
  window.saveEditDeckModal = saveEditDeckModal;
  window.deleteDeck = deleteDeck;
  window.onDeckSubjectFilterChange = onDeckSubjectFilterChange;
  window.flipDeckCard = flipDeckCard;

  window.deleteQuestion = deleteQuestion;
  window.clearAllQuestions = clearAllQuestions;
  window.filterByHierarchy = filterByHierarchy;
  window.onSubjectDropdownChange = onSubjectDropdownChange;
  window.toggleTheme = toggleTheme;
  window.startAlertRevision = startAlertRevision;
  window.dismissAlertBanner = dismissAlertBanner;
  window.renderSRSMemorySchedule = renderSRSMemorySchedule;
  window.startSRSPracticeSession = startSRSPracticeSession;

  // CUSTOM TIMED MOCK TEST EXPORTS
  window.openTestSetupModal = openTestSetupModal;
  window.closeTestSetupModal = closeTestSetupModal;
  window.onTestSubjectChange = onTestSubjectChange;
  window.setTestQuestionCount = setTestQuestionCount;
  window.setTestDuration = setTestDuration;
  window.updateTestTimerHint = updateTestTimerHint;
  window.startMockTest = startMockTest;
  window.submitMockTest = submitMockTest;
  window.closeTestScorecard = closeTestScorecard;
  window.reviewAllTestQuestionsInArena = reviewAllTestQuestionsInArena;
  window.openTestReviewModal = openTestReviewModal;
  window.closeTestReviewModal = closeTestReviewModal;
  window.filterReviewModalQuestions = filterReviewModalQuestions;
  window.toggleQuestionNoteInput = toggleQuestionNoteInput;
  window.saveQuestionNote = saveQuestionNote;

  // TOPICS MANAGER WINDOW EXPORTS
  window.renderTopicsManager = renderTopicsManager;
  window.openSubjectFolder = openSubjectFolder;
  window.backToAllSubjects = backToAllSubjects;
  window.openEditTopicModal = openEditTopicModal;
  window.closeEditTopicModal = closeEditTopicModal;
  window.saveEditTopicModal = saveEditTopicModal;
  window.openTopicReaderModal = openTopicReaderModal;
  window.closeTopicReaderModal = closeTopicReaderModal;
  window.deleteTopic = deleteTopic;
  window.practiceSpecificTopic = practiceSpecificTopic;

  // CREATE TOPIC MODAL WINDOW EXPORTS
  window.openCreateTopicModal = openCreateTopicModal;
  window.closeCreateTopicModal = closeCreateTopicModal;
  window.onCreateSubjectSelectChange = onCreateSubjectSelectChange;
  window.saveCreateTopicModal = saveCreateTopicModal;

  // 30-DAY RECYCLE BIN WINDOW EXPORTS
  window.openRecycleBinModal = openRecycleBinModal;
  window.closeRecycleBinModal = closeRecycleBinModal;
  window.renderRecycleBin = renderRecycleBin;
  window.restoreSingleQuestion = restoreSingleQuestion;
  window.permanentDeleteSingleQuestion = permanentDeleteSingleQuestion;
  window.restoreAllDeleted = restoreAllDeleted;
  window.emptyRecycleBinPrompt = emptyRecycleBinPrompt;

  // MOVE & EDIT QUESTION WINDOW EXPORTS
  window.openMoveQuestionModal = openMoveQuestionModal;
  window.closeMoveQuestionModal = closeMoveQuestionModal;
  window.onMoveSubjectChange = onMoveSubjectChange;
  window.onMoveTopicChange = onMoveTopicChange;
  window.saveMoveQuestionModal = saveMoveQuestionModal;
  window.openEditQuestionModal = openEditQuestionModal;
  window.closeEditQuestionModal = closeEditQuestionModal;
  window.saveEditQuestionModal = saveEditQuestionModal;

function initTheme() {
  const savedTheme = localStorage.getItem('qb_theme') || 'dark';
  applyTheme(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

function applyTheme(theme) {
  const icon = document.getElementById('theme-icon');
  const label = document.getElementById('theme-label');

  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    localStorage.setItem('qb_theme', 'dark');
    if (icon) icon.className = "fa-solid fa-moon text-indigo-400";
    if (label) label.innerText = "Dark";
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('qb_theme', 'light');
    if (icon) icon.className = "fa-solid fa-sun text-amber-500";
    if (label) label.innerText = "Light";
  }

  if (chartInstance) initDailyChart();
}

// TOGGLE FULLSCREEN FOCUS PRACTICE MODE
function toggleFullscreenPractice() {
  isFullscreenMode = !isFullscreenMode;
  const body = document.body;
  const icon = document.getElementById('fullscreen-icon');
  const text = document.getElementById('fullscreen-text');

  if (isFullscreenMode) {
    body.classList.add('is-fullscreen-practice');
    if (icon) icon.className = "fa-solid fa-compress text-rose-400";
    if (text) text.innerText = "❌ Exit Full Screen";
  } else {
    body.classList.remove('is-fullscreen-practice');
    if (icon) icon.className = "fa-solid fa-expand";
    if (text) text.innerText = "🖥️ Full Screen Mode";
  }

  if (practiceViewMode === 'cards') loadPracticeQuestions();
  else if (practiceViewMode === 'vertical') renderVerticalQuestions();
  else renderQuestionsTable();
}

function formatDateDisplay(isoStr) {
  if (!isoStr) return "Never";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "Never";
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ", " +
           d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch (e) {
    return "Never";
  }
}

function getSourceBadgeHtml(sourceStr, q = {}) {
  const s = (sourceStr || 'manual').toLowerCase();
  const testName = q.testTitle || q.sourceTitle || q.subfolder || (sourceStr && sourceStr !== 'testbook' && sourceStr !== 'pdf' && sourceStr !== 'manual' ? sourceStr : '');

  if (testName) {
    return `<span class="bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold">🌐 ${escapeHtml(testName)}</span>`;
  }

  if (s.includes('testbook')) {
    return `<span class="bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold">🌐 Testbook Scraped</span>`;
  } else if (s.includes('pdf')) {
    return `<span class="bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold">📄 PDF Upload</span>`;
  } else {
    return `<span class="bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold">✏️ Manual Input</span>`;
  }
}

function formatMathSymbols(str) {
  if (!str) return "";
  let s = str;

  // 1. Fix Testbook / OCR Scraped Square Root & Fraction Noise (e.g. Ep---- √(Ep) -> √(E/p) or √(E · p))
  s = s.replace(/Ep[-–—\s]*[-–—]{2,}\s*√\s*\(?Ep\)?/gi, '√(E · p)');
  s = s.replace(/Ep[-–—\s]*[-–—]{2,}\s*√\s*\(?E\s*\/\s*p\)?/gi, '√(E/p)');
  s = s.replace(/p\/E[-–—\s]*[-–—]{2,}\s*√\s*\(?p\/E\)?/gi, '√(p/E)');
  s = s.replace(/1\/pE[-–—\s]*[-–—]{2,}\s*√\s*\(?1\/pE\)?/gi, '√(1/pE)');

  s = s.replace(/([a-zA-Z0-9\/\s]+)[-–—]{2,}\s*√\s*\(?([a-zA-Z0-9\/\s]+)\)?/g, '√($2)');
  s = s.replace(/\s*[-–—]{3,}\s*/g, ' ');

  if (/\bA[\.\)]\s*[\s\S]*\bB[\.\)]\s*[\s\S]*\bC[\.\)]\s*[\s\S]*\bD[\.\)]/i.test(s) && !s.includes("<table")) {
    s = s.replace(/\s*([A-D][\.\)])\s*/g, '<br><strong class="text-indigo-600 dark:text-indigo-400 font-black">$1</strong> ');
  }

  // 2. Format LaTeX \sqrt{expr} and unicode √ (expr) with radical overline styling
  s = s.replace(/\\sqrt\{([^}]+)\}/g, (match, body) => {
    return `<span class="inline-flex items-baseline text-indigo-600 dark:text-indigo-400 font-extrabold font-mono px-1.5 py-0.5 rounded bg-indigo-50/70 dark:bg-indigo-950/70 border border-indigo-300/60 dark:border-indigo-800/50 shadow-sm"><span class="text-base font-black mr-0.5 select-none">√</span><span class="border-t-2 border-indigo-600 dark:border-indigo-400 pt-0.5 px-0.5">${body.trim()}</span></span>`;
  });

  s = s.replace(/√\s*\(?([a-zA-Z0-9\/\s\.\+\-·\*\(\)]+)\)?/g, (match, body) => {
    const cleanBody = body.trim().replace(/^\(|\)$/g, '');
    return `<span class="inline-flex items-baseline text-indigo-600 dark:text-indigo-400 font-extrabold font-mono px-1.5 py-0.5 rounded bg-indigo-50/70 dark:bg-indigo-950/70 border border-indigo-300/60 dark:border-indigo-800/50 shadow-sm"><span class="text-base font-black mr-0.5 select-none">√</span><span class="border-t-2 border-indigo-600 dark:border-indigo-400 pt-0.5 px-0.5">${cleanBody}</span></span>`;
  });

  // 3. Greek & Engineering Symbols
  s = s.replace(/\brho\b/gi, 'ρ');
  s = s.replace(/\bmu\b/gi, 'μ');
  s = s.replace(/\btau\b/gi, 'τ');
  s = s.replace(/\bnu\b/gi, 'ν');
  s = s.replace(/\bpi\b/gi, 'π');
  s = s.replace(/\btheta\b/gi, 'θ');
  s = s.replace(/\bsigma\b/gi, 'σ');
  s = s.replace(/\balpha\b/gi, 'α');
  s = s.replace(/\bbeta\b/gi, 'β');
  s = s.replace(/\bgamma\b/gi, 'γ');
  s = s.replace(/\bdelta\b/gi, 'Δ');
  s = s.replace(/\bomega\b/gi, 'ω');
  s = s.replace(/\bepsilon\b/gi, 'ε');
  s = s.replace(/\bphi\b/gi, 'φ');
  s = s.replace(/\blambda\b/gi, 'λ');

  return s;
}

function formatSubSupScripts(str) {
  if (!str) return "";
  let formatted = formatMathSymbols(str);

  // 1. Fractional Powers (e.g. ^(1/2), ^1/2, ^(3/2))
  formatted = formatted.replace(/\^\(1\/2\)/g, '<sup class="text-amber-600 dark:text-amber-400 font-bold">½</sup>');
  formatted = formatted.replace(/\^1\/2/g, '<sup class="text-amber-600 dark:text-amber-400 font-bold">½</sup>');
  formatted = formatted.replace(/\^\(3\/2\)/g, '<sup class="text-amber-600 dark:text-amber-400 font-bold">1.5</sup>');

  // 2. Explicit Powers (e.g. x^2, 10^5, 10^-3, a^(n+1))
  formatted = formatted.replace(/\^\(([^)]+)\)/g, '<sup class="text-amber-600 dark:text-amber-400 font-bold">$1</sup>');
  formatted = formatted.replace(/\^([+-]?\d+|[a-zA-Zα-ωΑ-Ω]+)/g, '<sup class="text-amber-600 dark:text-amber-400 font-bold">$1</sup>');

  // 3. Common Engineering Units with Powers (e.g., m/s2 -> m/s², N/m2 -> N/m², cm3 -> cm³)
  formatted = formatted.replace(/\b(m|cm|mm|km|s|N|Pa|J|W|kg)\s*\/?\s*s?([234])\b/g, (m, unit, p) => {
    const supMap = {'2':'²', '3':'³', '4':'⁴'};
    return `${unit}${supMap[p] || p}`;
  });

  // 4. Reciprocal expressions like 1x -> 1/x, 1x2 -> 1/x²
  formatted = formatted.replace(/\b1([a-zA-Z])([2-9])?\b/g, (m, letter, p) => {
    return p ? `1/${letter}<sup class="text-amber-600 dark:text-amber-400 font-bold">${p}</sup>` : `1/${letter}`;
  });

  // 5. Algebraic single letter powers (e.g., x2 -> x², y3 -> y³, a2 -> a²)
  formatted = formatted.replace(/\b([a-wyzA-WYZ])([2-9])\b/g, '$1<sup class="text-amber-600 dark:text-amber-400 font-bold">$2</sup>');

  // 6. Subscripts e.g., P_1, V_2, T_1, ρ_1, H_max
  formatted = formatted.replace(/_([0-9a-zA-Z]+)/g, '<sub>$1</sub>');

  // 7. Chemical / Dimensional Formulas
  formatted = formatted.replace(/([MLTθKI])(-?\d+)/g, '$1<sup class="text-amber-600 dark:text-amber-400 font-bold">$2</sup>');
  formatted = formatted.replace(/(H|N|O|C)2/g, '$1<sub>2</sub>');
  formatted = formatted.replace(/(CO)2/g, '$1<sub>2</sub>');
  formatted = formatted.replace(/\b([PVTFAv])([1-9])\b/g, '$1<sub>$2</sub>');
  formatted = formatted.replace(/(ρ|rho)([A-Z1-9a-z])/g, '$1<sub>$2</sub>');

  // 8. Clean up spaces around equals sign =
  formatted = formatted.replace(/([a-zA-Z0-9</sup></sub>])\s*=\s*([a-zA-Z0-9</sup></sub>])/g, '$1 = $2');

  formatted = processImageTagsInHtml(formatted);

  return formatted;
}

function triggerKaTeXAutoRender(container = document.body) {
  if (window.renderMathInElement) {
    try {
      window.renderMathInElement(container, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError: false
      });
    } catch(e) {
      console.warn("KaTeX render error:", e);
    }
  }
}

function processImageTagsInHtml(str) {
  if (!str) return "";

  let res = str.replace(/\[IMG:\s*(.*?)\]/gi, (match, url) => {
    const cleanUrl = url.trim();
    return `<div class="my-4 text-center"><img src="${cleanUrl}" alt="Question Diagram" class="max-w-full max-h-96 rounded-2xl border-2 border-indigo-500/30 shadow-xl inline-block bg-white dark:bg-zinc-900 p-2 transition hover:scale-105 cursor-pointer" onclick="window.open('${cleanUrl}', '_blank')" title="Click to view full diagram image" /></div>`;
  });

  return res;
}

function cleanQuestionTextDisplay(rawStr) {
  if (!rawStr) return "";
  let str = rawStr;

  str = str.replace(/^(?:\s*|\d+%\s*answered\s*correctly|Question\s*No\.\s*\d+|Skipped|Incorrect|Unattempted|Wrong|You:|\d{2}:\d{2}|Avg:|\d{2}:\d{2}|Marks\s*[-+\d.]+|Save|Saved|Report|Reported|Text Size\s*A-?\s*A\+?|View in (?:English|Hindi))+/gi, '');
  str = str.replace(/^(?:\s*|Save|Saved|Report|Reported|\d+%\s*answered\s*correctly|Question:\s*)+/gi, '');

  const footerIdx = str.search(/(?:Re-attempt|123456789|CEDELSubmit|SubmitSubmit|Re-attempt mode|Now You can re-attempt|View Solution|Click here|Your First Attempt|AnswersSolution|Shortcut Trick|Successive ratio|Original amount|Formula Used|Calculations?:|Given:)/i);
  if (footerIdx > 0) {
    str = str.substring(0, footerIdx);
  }

  // Deduplicate exact repeated question text (e.g., "If x+1x=5, then x2+1x2=?If x+1x=5, then x2+1x2=?")
  str = str.trim();
  if (str.length > 8) {
    const halfLen = Math.floor(str.length / 2);
    for (let offset = -2; offset <= 2; offset++) {
      const mid = halfLen + offset;
      if (mid > 0 && mid < str.length) {
        const left = str.substring(0, mid).trim();
        const right = str.substring(mid).trim();
        if (left === right) {
          str = left;
          break;
        }
      }
    }
    const dupRegex = /^([\s\S]{5,})\1$/;
    const dupMatch = str.match(dupRegex);
    if (dupMatch) {
      str = dupMatch[1];
    }
  }

  str = formatMatchListText(str.trim());
  return str;
}

function formatMatchListText(rawStr) {
  if (!rawStr) return "";
  let str = rawStr;

  if (/Match\s+list\s+I|List\s+I[\s\S]*List\s+II/i.test(str)) {
    const lines = str.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    let matchPairs = [];
    let stemLines = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      if (/^[A-D][\.\)]?$/i.test(line) && i + 3 < lines.length && /^[1-5][\.\)]?$/.test(lines[i+2])) {
        const itemLetter = line.toUpperCase().replace('.', '');
        const itemDesc = lines[i+1];
        const numIndex = lines[i+2].replace('.', '');
        const numDesc = lines[i+3];

        matchPairs.push(`${itemLetter}. ${itemDesc}   ➡   ${numIndex}. ${numDesc}`);
        i += 4;
        continue;
      }
      
      if (/^[A-D]\.\s+/i.test(line) && i + 1 < lines.length && /^[1-5]\.\s+/.test(lines[i+1])) {
        matchPairs.push(`${line}   ➡   ${lines[i+1]}`);
        i += 2;
        continue;
      }

      if (!line.match(/^(?:List I|List II|--------------------------------------------|\(Loss\)|\(Parameter responsible\))$/i)) {
        stemLines.push(line);
      }
      i++;
    }

    if (matchPairs.length > 0) {
      const stem = stemLines.join("\n");
      return `${stem}\n\n${matchPairs.join("\n")}`;
    }
  }

  return str;
}

function renderFormattedQuestionHTML(rawStr) {
  if (!rawStr) return "";
  let str = cleanQuestionTextDisplay(rawStr);

  if (/Match\s+list\s+I|List\s+I[\s\S]*List\s+II|➡/i.test(str)) {
    const lines = str.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    let matchPairs = [];
    let stemLines = [];

    lines.forEach(line => {
      const pairMatch = line.match(/^([A-D])[\.\)]?\s+(.*?)\s*➡\s*([1-5])[\.\)]?\s+(.*)$/i);
      if (pairMatch) {
        matchPairs.push({
          let: pairMatch[1].toUpperCase(),
          leftText: pairMatch[2],
          num: pairMatch[3],
          rightText: pairMatch[4]
        });
        return;
      }

      if (!line.match(/^(?:List I|List II|--------------------------------------------|\(Loss\)|\(Parameter responsible\))$/i)) {
        stemLines.push(line);
      }
    });

    if (matchPairs.length > 0) {
      const stemHtml = formatSubSupScripts(escapeHtml(stemLines.join("\n")));

      const tableRows = matchPairs.map(p => `
        <tr class="hover:bg-slate-100 dark:hover:bg-zinc-900 transition">
          <td class="p-3 border-r border-slate-300 dark:border-zinc-800 font-extrabold text-slate-900 dark:text-white">
            <span class="text-indigo-600 dark:text-indigo-400 font-black mr-2">${p.let}.</span>${formatSubSupScripts(escapeHtml(p.leftText))}
          </td>
          <td class="p-3 font-extrabold text-slate-900 dark:text-white">
            <span class="text-indigo-600 dark:text-indigo-400 font-black mr-2">${p.num}.</span>${formatSubSupScripts(escapeHtml(p.rightText))}
          </td>
        </tr>
      `).join('');

      const tableHtml = `
        <div class="my-4 overflow-hidden rounded-xl border border-slate-300 dark:border-zinc-800 shadow-sm">
          <table class="w-full text-left border-collapse text-xs">
            <thead class="bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-b border-slate-300 dark:border-zinc-800 font-black uppercase">
              <tr>
                <th class="p-3 border-r border-slate-300 dark:border-zinc-800 w-1/2">List I (Description / Parameter)</th>
                <th class="p-3 w-1/2">List II (Dimensional Formula / Match)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-300 dark:divide-zinc-800">
              ${tableRows}
            </tbody>
          </table>
        </div>
      `;

      return `${stemHtml}${tableHtml}`;
    }
  }

  return formatSubSupScripts(escapeHtml(str));
}

function cleanExplanationDisplay(rawStr) {
  if (!rawStr) return "";
  let str = rawStr;

  str = str.replace(/Re-attempt answer[\s\S]*?AnswersSolutionConcept:/gi, '');
  str = str.replace(/Re-attempt answer[\s\S]*?AnswersSolution/gi, '');
  str = str.replace(/Re-attempt mode:[\s\S]*?see the answer now/gi, '');
  str = str.replace(/Your First Attempt Answers[\s\S]*?Concept:/gi, '');
  str = str.replace(/Your First Attempt Answers/gi, '');
  str = str.replace(/Hide Solution Click here to see the answer now/gi, '');
  str = str.replace(/123456789\.0\+\/-/gi, '');
  str = str.replace(/CEDELSubmit/gi, '');
  str = str.replace(/^(?:\s*Solution\s*&\s*Concept:\s*|\s*Click here to see the answer now|\s*Your First Attempt Answers|\s*AnswersSolution|\s*SolutionConcept:|\s*View Solution)+/gi, '');
  str = str.replace(/\n?\s*Was the solution helpful\?\s*(?:Yes\s*No|Yes|No)?[\s\S]*/gi, '');

  return formatSubSupScripts(str.trim());
}

async function loadDashboardData() {
  currentQuestionsList = await QB.fetchQuestions(false);

  currentQuestionsList.forEach(async (q) => {
    q.questionText = cleanQuestionTextDisplay(q.questionText);
    q.explanation = cleanExplanationDisplay(q.explanation);
    if (!q.subject) q.subject = "Mechanical Engineering";
    if (!q.topic) q.topic = "Fluid Mechanics";

    // Auto-migrate Thermodynamics questions that were previously saved under Fluid Mechanics
    const qTextLower = (q.questionText + " " + q.explanation + " " + (q.subfolder || "")).toLowerCase();
    const thermoKeywords = [
      "steam", "thermodynam", "ideal gas", "spontaneous", "entropy", "enthalpy",
      "carnot", "polytropic", "isothermal", "adiabatic", "refrigeran", "heat engine",
      "saturated pressure", "sub-cooled", "super-heated", "saturated condition"
    ];

    if (q.topic === "Fluid Mechanics" && thermoKeywords.some(kw => qTextLower.includes(kw))) {
      console.log(`🔄 Auto-migrating Thermodynamics question to correct topic: "${q.title || q.id}"`);
      q.topic = "Thermodynamics";
      await QB.saveQuestion(q);
    }

    if (q.questionText.includes("Newtonian fluid") && q.options && q.options.length >= 4) {
      q.options.forEach((opt, idx) => {
        if (opt.includes("Product of the fluid viscosity and the velocity gradient perpendicular")) {
          q.correctAnswerIndex = idx;
        }
      });
    }
  });

  const total = currentQuestionsList.length;
  const pending = currentQuestionsList.filter(q => q.status === 'pending').length;
  const solved = currentQuestionsList.filter(q => q.status === 'solved').length;
  const revision = currentQuestionsList.filter(q => q.status === 'needs_revision').length;

  const reports = QB.getDailyReports();
  const totalUserAttempts = reports.reduce((acc, r) => acc + (r.attemptedCount || 0), 0);
  const attemptedCount = Math.max(solved + revision, totalUserAttempts);
  const accuracyPct = attemptedCount > 0 ? Math.round((solved / attemptedCount) * 100) : 0;

  const dangerZoneCount = currentQuestionsList.filter(q => (q.wrongAttemptsCount || 0) >= 2 || q.status === 'needs_revision').length;

  if (document.getElementById('stat-total')) document.getElementById('stat-total').innerText = total;
  if (document.getElementById('stat-attempted-total')) document.getElementById('stat-attempted-total').innerText = attemptedCount;
  if (document.getElementById('stat-solved')) document.getElementById('stat-solved').innerText = solved;
  if (document.getElementById('stat-revision')) document.getElementById('stat-revision').innerText = revision;
  if (document.getElementById('stat-accuracy')) document.getElementById('stat-accuracy').innerText = `${accuracyPct}%`;
  if (document.getElementById('stat-attempted-sub')) document.getElementById('stat-attempted-sub').innerText = `${attemptedCount} Attempted`;
  if (document.getElementById('stat-danger-count')) document.getElementById('stat-danger-count').innerText = dangerZoneCount;

  const today = new Date().toISOString().split('T')[0];
  const todayReport = reports.find(r => r.date === today) || { attemptedCount: 0, correctCount: 0, wrongCount: 0 };

  if (document.getElementById('today-attempted')) document.getElementById('today-attempted').innerText = todayReport.attemptedCount;
  if (document.getElementById('today-correct')) document.getElementById('today-correct').innerText = todayReport.correctCount;
  if (document.getElementById('today-wrong')) document.getElementById('today-wrong').innerText = todayReport.wrongCount;

  renderHourlyMistakeSpotlight();
  renderSRSMemorySchedule();
  renderRevisionAnalytics();
  renderQuestionsTable();
  renderDecks();
  renderTopicsManager();
  updateSubjectAndTopicDropdowns();
  populatePdfExtractorDropdowns();
  updateDeckDropdowns();
  checkRevisionAlerts();
}

function renderSRSMemorySchedule() {
  const container = document.getElementById('srs-schedule-forecast');
  if (!container) return;

  const forecast = QB.getSRSForecast(currentQuestionsList);

  container.innerHTML = `
    <div class="p-4 rounded-xl border border-rose-300 dark:border-rose-500/40 bg-rose-50/80 dark:bg-rose-950/30 space-y-1">
      <div class="flex items-center justify-between text-rose-700 dark:text-rose-400 font-extrabold text-xs">
        <span>⏰ Due Today</span>
        <i class="fa-solid fa-clock-rotate-left"></i>
      </div>
      <div class="text-2xl font-black text-rose-700 dark:text-rose-400">${forecast.dueToday}</div>
      <p class="text-[10px] font-bold text-rose-800 dark:text-rose-300">Action Required Today</p>
    </div>

    <div class="p-4 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50/80 dark:bg-amber-950/30 space-y-1">
      <div class="flex items-center justify-between text-amber-700 dark:text-amber-400 font-extrabold text-xs">
        <span>📅 Due Tomorrow</span>
        <i class="fa-solid fa-calendar-day"></i>
      </div>
      <div class="text-2xl font-black text-amber-700 dark:text-amber-400">${forecast.dueTomorrow}</div>
      <p class="text-[10px] font-bold text-amber-800 dark:text-amber-300">Review Schedule Next</p>
    </div>

    <div class="p-4 rounded-xl border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50/80 dark:bg-indigo-950/30 space-y-1">
      <div class="flex items-center justify-between text-indigo-700 dark:text-indigo-400 font-extrabold text-xs">
        <span>🗓️ In 3-7 Days</span>
        <i class="fa-solid fa-calendar-week"></i>
      </div>
      <div class="text-2xl font-black text-indigo-700 dark:text-indigo-400">${forecast.dueThisWeek}</div>
      <p class="text-[10px] font-bold text-indigo-800 dark:text-indigo-300">Upcoming Spaced Reviews</p>
    </div>

    <div class="p-4 rounded-xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/80 dark:bg-emerald-950/30 space-y-1">
      <div class="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-extrabold text-xs">
        <span>🧠 Retained & Mastered</span>
        <i class="fa-solid fa-graduation-cap"></i>
      </div>
      <div class="text-2xl font-black text-emerald-700 dark:text-emerald-400">${forecast.retainedMastered}</div>
      <p class="text-[10px] font-bold text-emerald-800 dark:text-emerald-300">Next Review > 7 Days</p>
    </div>
  `;
}

function startSRSPracticeSession() {
  const statusSelect = document.getElementById('practice-filter-status');
  if (statusSelect) {
    statusSelect.value = "srs_due";
  }
  switchTab('practice');

  if (practiceViewMode === 'cards') loadPracticeQuestions();
  else if (practiceViewMode === 'vertical') renderVerticalQuestions();
  else renderQuestionsTable();
}

function getSRSBadgeHtml(q) {
  if (!q) return '';
  if (!q.nextReviewDate) {
    return `<span class="bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-2.5 py-0.5 rounded-full text-xs font-black">⏰ Due Today</span>`;
  }
  const now = new Date();
  const reviewDate = new Date(q.nextReviewDate);
  const diffDays = Math.ceil((reviewDate - now) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return `<span class="bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-2.5 py-0.5 rounded-full text-xs font-black">⏰ Due Today</span>`;
  } else if (diffDays === 1) {
    return `<span class="bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-xs font-black">📅 Due Tomorrow</span>`;
  } else {
    return `<span class="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-black">🧠 Review in ${diffDays}d</span>`;
  }
}

// HOURLY HIGH-MISTAKE SPOTLIGHT (HIGH-CONTRAST THEME COLORS)
function renderHourlyMistakeSpotlight() {
  const container = document.getElementById('hourly-mistake-card');
  if (!container) return;

  let highMistakeQuestions = currentQuestionsList.filter(q => (q.wrongAttemptsCount || 0) >= 1 || q.status === 'needs_revision');

  if (highMistakeQuestions.length === 0) {
    highMistakeQuestions = currentQuestionsList.filter(q => q.status === 'pending');
  }
  if (highMistakeQuestions.length === 0) {
    highMistakeQuestions = currentQuestionsList;
  }

  if (highMistakeQuestions.length === 0) {
    container.innerHTML = `
      <div class="p-6 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
        No questions available for hourly mistake challenge. Sync questions from Testbook or upload PDF!
      </div>
    `;
    return;
  }

  const currentHourSeed = Math.floor(Date.now() / (1000 * 60 * 60));
  const selectedIdx = currentHourSeed % highMistakeQuestions.length;
  const q = highMistakeQuestions[selectedIdx];

  const wrongCount = q.wrongAttemptsCount || (q.status === 'needs_revision' ? 2 : 1);
  const formattedContent = renderFormattedQuestionHTML(q.questionText);

  const optionsHtml = q.options.map((opt, optIdx) => `
    <button onclick="attemptHourlySpotlightQuestion('${q.id}', ${optIdx}, ${q.correctAnswerIndex})" id="spotlight-opt-${q.id}-${optIdx}" class="w-full text-left p-3.5 bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 border border-slate-300 dark:border-zinc-700/60 rounded-xl text-xs font-extrabold text-slate-900 dark:text-white transition flex items-center space-x-3 group shadow-sm">
      <span class="w-6 h-6 rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 group-hover:bg-rose-600 group-hover:text-white font-extrabold text-xs flex items-center justify-center border border-slate-300 dark:border-zinc-700 transition">
        ${String.fromCharCode(65 + optIdx)}
      </span>
      <span class="flex-1 font-extrabold text-slate-900 dark:text-white">${formatSubSupScripts(escapeHtml(opt))}</span>
    </button>
  `).join('');

  container.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
        <div class="flex flex-wrap items-center gap-2">
          <span class="bg-rose-600 text-white px-3 py-1 rounded-full text-xs font-black flex items-center space-x-1 shadow-sm">
            <i class="fa-solid fa-fire"></i>
            <span>❌ Failed ${wrongCount} Time${wrongCount > 1 ? 's' : ''} in Past Attempts</span>
          </span>
          <span class="text-indigo-600 dark:text-amber-400 font-extrabold">📁 ${escapeHtml(q.subject || 'General')} → 📂 ${escapeHtml(q.topic || 'General')}</span>
        </div>

        <div class="flex items-center space-x-2">
          <button onclick="practiceSpecificTopic('${escapeHtml(q.subject)}', '${escapeHtml(q.topic)}')" class="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-extrabold shadow-sm transition">⚡ Open Full Practice</button>
        </div>
      </div>

      <div class="text-sm font-black leading-relaxed bg-slate-100 dark:bg-black p-4 rounded-xl border border-slate-300 dark:border-zinc-800 text-slate-900 dark:text-white shadow-sm">${formattedContent}</div>

      <div class="space-y-2" id="spotlight-options-${q.id}">
        ${optionsHtml}
      </div>

      <div id="spotlight-sol-${q.id}" class="hidden p-4 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-indigo-500/40 text-xs font-semibold space-y-2">
        <div class="text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center space-x-1">
          <i class="fa-solid fa-lightbulb text-amber-500"></i>
          <span>Concept Solution Note:</span>
        </div>
        <div class="text-slate-900 dark:text-slate-200 whitespace-pre-wrap font-mono">${cleanExplanationDisplay(q.explanation)}</div>
      </div>
    </div>
  `;
}

async function attemptHourlySpotlightQuestion(qId, selectedIdx, correctIdx) {
  const container = document.getElementById(`spotlight-options-${qId}`);
  const solBox = document.getElementById(`spotlight-sol-${qId}`);
  if (!container) return;

  const buttons = container.querySelectorAll('button');
  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === correctIdx) {
      btn.className = "w-full text-left p-3.5 bg-emerald-100 dark:bg-emerald-950 border-2 border-emerald-500 rounded-xl text-xs font-extrabold text-emerald-950 dark:text-emerald-200 flex items-center justify-between";
      btn.innerHTML += `<span class="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded text-[10px]">✓ Correct</span>`;
    } else if (idx === selectedIdx && selectedIdx !== correctIdx) {
      btn.className = "w-full text-left p-3.5 bg-rose-100 dark:bg-rose-950 border-2 border-rose-500 rounded-xl text-xs font-extrabold text-rose-950 dark:text-rose-200 flex items-center justify-between";
      btn.innerHTML += `<span class="bg-rose-600 text-white font-bold px-2 py-0.5 rounded text-[10px]">✗ Wrong</span>`;
    }
  });

  if (solBox) solBox.classList.remove('hidden');

  const isCorrect = (selectedIdx === correctIdx);
  const newStatus = isCorrect ? 'solved' : 'needs_revision';
  await QB.updateQuestionStatus(qId, newStatus, selectedIdx);

  await loadDashboardData();
}

function startHourlyTimerCountdown() {
  if (hourlyTimerInterval) clearInterval(hourlyTimerInterval);

  function updateTimer() {
    const now = new Date();
    const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0);
    const diffMs = nextHour - now;

    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diffMs % (1000 * 60)) / 1000);

    const timerEl = document.getElementById('hourly-timer-countdown');
    if (timerEl) {
      timerEl.innerText = `${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    }

    if (diffMs <= 1000) {
      setTimeout(() => renderHourlyMistakeSpotlight(), 1500);
    }
  }

  updateTimer();
  hourlyTimerInterval = setInterval(updateTimer, 1000);
}

function togglePracticeViewMode(mode) {
  practiceViewMode = mode;

  const cardsContainer = document.getElementById('quiz-card-container');
  const verticalContainer = document.getElementById('practice-vertical-container');
  const tableContainer = document.getElementById('practice-table-container');

  const btnCards = document.getElementById('btn-view-cards');
  const btnVertical = document.getElementById('btn-view-vertical');
  const btnTable = document.getElementById('btn-view-table');

  [btnCards, btnVertical, btnTable].forEach(btn => {
    if (btn) btn.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white";
  });

  if (cardsContainer) cardsContainer.classList.add('hidden');
  if (verticalContainer) verticalContainer.classList.add('hidden');
  if (tableContainer) tableContainer.classList.add('hidden');

  if (mode === 'vertical') {
    if (verticalContainer) verticalContainer.classList.remove('hidden');
    if (btnVertical) btnVertical.className = "px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center space-x-1.5 bg-indigo-600 text-white shadow-sm";
    renderVerticalQuestions();
  } else if (mode === 'table') {
    if (tableContainer) tableContainer.classList.remove('hidden');
    if (btnTable) btnTable.className = "px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center space-x-1.5 bg-indigo-600 text-white shadow-sm";
    renderQuestionsTable();
  } else {
    if (cardsContainer) cardsContainer.classList.remove('hidden');
    if (btnCards) btnCards.className = "px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center space-x-1.5 bg-indigo-600 text-white shadow-sm";
    loadPracticeQuestions();
  }
}

function renderVerticalQuestions() {
  const container = document.getElementById('practice-vertical-container');
  if (!container) return;

  const subjectFilter = document.getElementById('practice-filter-subject')?.value || 'all';
  const topicFilter = document.getElementById('practice-filter-topic')?.value || 'all';
  const statusFilter = document.getElementById('practice-filter-status')?.value || 'all';
  const sourceFilter = document.getElementById('practice-filter-source')?.value || 'all';

  let list = [...currentQuestionsList];

  if (subjectFilter !== 'all') {
    list = list.filter(q => (q.subject || 'Mechanical Engineering') === subjectFilter);
  }
  if (topicFilter !== 'all') {
    list = list.filter(q => (q.topic || 'Fluid Mechanics') === topicFilter);
  }
  if (activeSubfolderFilter !== 'all' && activeSubfolderFilter !== '') {
    list = list.filter(q => (q.subfolder || '') === activeSubfolderFilter);
  }
  if (statusFilter === 'srs_due') {
    list = list.filter(q => QB.isSRSQuestionDue(q));
  } else if (statusFilter !== 'all') {
    const filteredByStatus = list.filter(q => q.status === statusFilter);
    if (filteredByStatus.length > 0) {
      list = filteredByStatus;
    }
  }
  if (sourceFilter !== 'all') {
    list = list.filter(q => q.source === sourceFilter);
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="glass p-8 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center space-y-3 bg-white dark:bg-zinc-950 max-w-4xl mx-auto">
        <i class="fa-solid fa-circle-check text-4xl text-slate-500"></i>
        <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">No Questions Found in Selected Hierarchy</h3>
        <p class="text-xs font-semibold text-slate-500 dark:text-slate-400">Sync questions from Testbook or upload PDF to populate this folder!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map((q, idx) => {
    const formattedQuestionContent = renderFormattedQuestionHTML(q.questionText);
    const cleanSol = cleanExplanationDisplay(q.explanation);

    const optionsHtml = q.options.map((opt, optIdx) => `
      <button onclick="attemptQuestion('${q.id}', ${optIdx}, ${q.correctAnswerIndex})" id="opt-${q.id}-${optIdx}" class="w-full text-left p-4 bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white transition flex items-center space-x-3 group shadow-sm">
        <span class="w-7 h-7 rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-slate-300 group-hover:bg-indigo-600 group-hover:text-white font-extrabold text-xs flex items-center justify-center border border-slate-300 dark:border-zinc-700 transition">
          ${String.fromCharCode(65 + optIdx)}
        </span>
        <span class="flex-1 font-extrabold text-slate-900 dark:text-white">${formatSubSupScripts(escapeHtml(opt))}</span>
      </button>
    `).join('');

    let statusBadge = `<span class="bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-xs font-extrabold">Unattempted</span>`;
    if (q.status === 'solved') {
      statusBadge = `<span class="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-extrabold">✓ Correct / Solved</span>`;
    } else if (q.status === 'needs_revision') {
      statusBadge = `<span class="bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-2.5 py-0.5 rounded-full text-xs font-extrabold">✗ Incorrect / Revision</span>`;
    }

    const subheaderBadge = (q.subfolder && q.subfolder.trim()) ? ` / <span class="text-slate-900 dark:text-slate-200 font-bold">📄 ${escapeHtml(q.subfolder)}</span>` : '';

    return `
      <div class="glass p-6 rounded-2xl space-y-5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-100 dark:bg-zinc-900 -mx-6 -mt-6 p-4 rounded-t-2xl border-b border-slate-200 dark:border-zinc-800">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-black text-slate-900 dark:text-white bg-slate-200 dark:bg-black/60 px-3.5 py-1 rounded-full border border-slate-300 dark:border-zinc-800">
              Question No. ${idx + 1} <span class="text-slate-500 dark:text-slate-400 font-normal">of ${list.length}</span>
            </span>
            ${statusBadge}
            ${getSRSBadgeHtml(q)}
            <span class="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-black">Marks 1</span>
            ${getSourceBadgeHtml(q.source, q)}
          </div>

          <div class="flex items-center space-x-1.5">
            <button onclick="toggleMarkForReview('${q.id}')" class="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-slate-950 px-2.5 py-1 rounded-lg border border-amber-500/30 transition font-bold">🔖 Mark</button>
            <button onclick="toggleSolutionVisibility('${q.id}')" class="text-xs bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white px-2.5 py-1 rounded-lg border border-indigo-500/30 transition font-bold">💡 Solution</button>
            <button onclick="openMoveQuestionModal('${q.id}')" class="text-xs bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 transition font-bold">📦 Move</button>
            <button onclick="openEditQuestionModal('${q.id}')" class="text-xs bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 transition font-bold">✏️ Edit</button>
            <button onclick="deleteQuestion('${q.id}')" class="text-xs bg-rose-600/20 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white px-2 py-1.5 rounded-lg border border-rose-500/30 transition font-bold">🗑️</button>
          </div>
        </div>

        <div class="text-xs font-extrabold text-slate-500 dark:text-slate-400 flex items-center space-x-2">
          <span>Folder:</span>
          <span class="text-amber-600 dark:text-amber-400 font-black">📁 ${escapeHtml(q.subject || 'General')}</span>
          <span>/</span>
          <span class="text-indigo-600 dark:text-indigo-400 font-black">📂 ${escapeHtml(q.topic || 'General')}</span>
          ${subheaderBadge}
        </div>

        <div class="text-base font-black leading-relaxed bg-slate-100 dark:bg-black p-5 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white shadow-sm">${formattedQuestionContent}</div>

        <div class="space-y-2.5" id="options-container-${q.id}">
          ${optionsHtml}
        </div>

        <div id="explanation-box-${q.id}" class="hidden p-5 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-indigo-500/40 space-y-3 shadow-xl">
          <div class="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">
            <i class="fa-solid fa-lightbulb text-amber-500"></i>
            <span>Testbook Detailed Solution & Concept Note</span>
          </div>
          <div class="text-xs text-slate-900 dark:text-white font-bold leading-relaxed font-mono whitespace-pre-wrap bg-white dark:bg-black p-4 rounded-xl border border-slate-200 dark:border-zinc-800">${cleanSol}</div>

          <div class="pt-2 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
            <span class="text-xs font-bold text-slate-500 dark:text-slate-400">Update status:</span>
            <div class="flex space-x-2">
              <button onclick="updateQuestionStatus('${q.id}', 'solved')" class="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg font-extrabold transition flex items-center space-x-1">
                <i class="fa-solid fa-check"></i> <span>Solved / Mastered</span>
              </button>
              <button onclick="updateQuestionStatus('${q.id}', 'needs_revision')" class="text-xs bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-1.5 rounded-lg font-extrabold transition flex items-center space-x-1">
                <i class="fa-solid fa-rotate-right"></i> <span>Needs Revision</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openCreateTopicModal() {
  const subjSelect = document.getElementById('create-subj-select');
  const customSubjInput = document.getElementById('create-subj-custom');
  const topicInput = document.getElementById('create-topic-name');
  const subfolderInput = document.getElementById('create-subfolder-name');

  if (!subjSelect) return;

  const subjects = Array.from(new Set(currentQuestionsList.map(item => item.subject || 'Mechanical Engineering')));

  subjSelect.innerHTML = subjects.map(s => `<option value="${escapeHtml(s)}">📁 ${escapeHtml(s)}</option>`).join('') +
    `<option value="__NEW_SUBJECT__">➕ Create New Subject...</option>`;

  if (subjects.length > 0) {
    subjSelect.value = subjects[0];
    customSubjInput.classList.add('hidden');
  } else {
    subjSelect.value = "__NEW_SUBJECT__";
    customSubjInput.classList.remove('hidden');
  }

  if (topicInput) topicInput.value = "";
  if (subfolderInput) subfolderInput.value = "";

  document.getElementById('modal-create-topic').classList.remove('hidden');
}

function onCreateSubjectSelectChange() {
  const subjSelect = document.getElementById('create-subj-select');
  const customSubjInput = document.getElementById('create-subj-custom');
  if (!subjSelect || !customSubjInput) return;

  if (subjSelect.value === '__NEW_SUBJECT__') {
    customSubjInput.classList.remove('hidden');
  } else {
    customSubjInput.classList.add('hidden');
  }
}

function closeCreateTopicModal() {
  document.getElementById('modal-create-topic').classList.add('hidden');
}

async function saveCreateTopicModal() {
  const subjSelect = document.getElementById('create-subj-select');
  const customSubjInput = document.getElementById('create-subj-custom');
  const topicInput = document.getElementById('create-topic-name');
  const subfolderInput = document.getElementById('create-subfolder-name');

  let finalSubj = subjSelect.value;
  if (finalSubj === '__NEW_SUBJECT__') {
    finalSubj = customSubjInput.value.trim();
  }

  if (!finalSubj) {
    alert("Please select or enter a Subject Name.");
    return;
  }

  const finalTopic = topicInput.value.trim();
  if (!finalTopic) {
    alert("Please enter a Topic Name.");
    return;
  }

  const finalSubfolder = subfolderInput.value.trim();

  await QB.saveQuestion({
    title: `${finalTopic} Study Notes & Practice`,
    questionText: `Concept Initialization & Study Notes for ${finalTopic}${finalSubfolder ? ' -> ' + finalSubfolder : ''}`,
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctAnswerIndex: 0,
    explanation: `Folder created for [${finalSubj} -> ${finalTopic}${finalSubfolder ? ' -> ' + finalSubfolder : ''}]. Sync questions from Testbook or upload PDF to populate this folder!`,
    source: "manual",
    status: "pending",
    subject: finalSubj,
    topic: finalTopic,
    subfolder: finalSubfolder
  });

  QB.saveNotesTopic(finalSubj, finalTopic);
  if (QB.saveCustomTopic) {
    QB.saveCustomTopic(finalSubj, finalTopic, finalSubfolder);
  }

  closeCreateTopicModal();
  alert(`Successfully created Topic: [${finalSubj} -> ${finalTopic}]!`);
  await loadDashboardData();
  renderTopicsManager();
  renderScreenshotNotes();
}

function openMoveQuestionModal(qId) {
  const q = currentQuestionsList.find(item => item.id === qId);
  if (!q) return;

  document.getElementById('move-q-id').value = q.id;
  document.getElementById('move-q-subfolder').value = q.subfolder || "";

  const subjSelect = document.getElementById('move-q-subject');
  const subjects = Array.from(new Set(currentQuestionsList.map(item => item.subject || 'Mechanical Engineering')));

  subjSelect.innerHTML = subjects.map(s => `<option value="${escapeHtml(s)}">📁 ${escapeHtml(s)}</option>`).join('') +
    `<option value="__NEW_SUBJECT__">➕ Create New Subject...</option>`;

  const currentSubj = q.subject || "Mechanical Engineering";
  if (subjects.includes(currentSubj)) {
    subjSelect.value = currentSubj;
  } else if (subjects.length > 0) {
    subjSelect.value = subjects[0];
  } else {
    subjSelect.value = "__NEW_SUBJECT__";
  }

  onMoveSubjectChange(q.topic);
  document.getElementById('modal-move-question').classList.remove('hidden');
}

function onMoveSubjectChange(targetTopicToSelect = null) {
  const subjSelect = document.getElementById('move-q-subject');
  const customSubjInput = document.getElementById('move-q-subject-custom');
  const topicSelect = document.getElementById('move-q-topic');
  if (!subjSelect || !topicSelect) return;

  const selectedSubj = subjSelect.value;

  if (selectedSubj === '__NEW_SUBJECT__') {
    customSubjInput.classList.remove('hidden');
    topicSelect.innerHTML = `<option value="__NEW_TOPIC__">➕ Create New Topic...</option>`;
    onMoveTopicChange();
    return;
  } else {
    customSubjInput.classList.add('hidden');
  }

  const matchingQuestions = currentQuestionsList.filter(item => (item.subject || 'Mechanical Engineering') === selectedSubj);
  const topics = Array.from(new Set(matchingQuestions.map(item => item.topic || 'Fluid Mechanics')));

  topicSelect.innerHTML = topics.map(t => `<option value="${escapeHtml(t)}">📂 ${escapeHtml(t)}</option>`).join('') +
    `<option value="__NEW_TOPIC__">➕ Create New Topic...</option>`;

  if (targetTopicToSelect && topics.includes(targetTopicToSelect)) {
    topicSelect.value = targetTopicToSelect;
  } else if (topics.length > 0) {
    topicSelect.value = topics[0];
  } else {
    topicSelect.value = "__NEW_TOPIC__";
  }

  onMoveTopicChange();
}

function onMoveTopicChange() {
  const topicSelect = document.getElementById('move-q-topic');
  const customTopicInput = document.getElementById('move-q-topic-custom');
  if (!topicSelect) return;

  if (topicSelect.value === '__NEW_TOPIC__') {
    customTopicInput.classList.remove('hidden');
  } else {
    customTopicInput.classList.add('hidden');
  }
}

function closeMoveQuestionModal() {
  document.getElementById('modal-move-question').classList.add('hidden');
}

async function saveMoveQuestionModal() {
  const qId = document.getElementById('move-q-id').value;
  const subjSelect = document.getElementById('move-q-subject');
  const customSubjInput = document.getElementById('move-q-subject-custom');
  const topicSelect = document.getElementById('move-q-topic');
  const customTopicInput = document.getElementById('move-q-topic-custom');
  const subfolderInput = document.getElementById('move-q-subfolder');

  let finalSubj = subjSelect.value;
  if (finalSubj === '__NEW_SUBJECT__') {
    finalSubj = customSubjInput.value.trim() || "General Subject";
  }

  let finalTopic = topicSelect.value;
  if (finalTopic === '__NEW_TOPIC__') {
    finalTopic = customTopicInput.value.trim() || "General Topic";
  }

  const finalSubfolder = subfolderInput.value.trim();

  const q = currentQuestionsList.find(item => item.id === qId);
  if (q) {
    q.subject = finalSubj;
    q.topic = finalTopic;
    q.subfolder = finalSubfolder;
    await QB.saveQuestion(q);
  }

  closeMoveQuestionModal();
  await loadDashboardData();

  if (practiceViewMode === 'cards') loadPracticeQuestions();
  else if (practiceViewMode === 'vertical') renderVerticalQuestions();
  else renderQuestionsTable();
}

function openEditQuestionModal(qId) {
  const q = currentQuestionsList.find(item => item.id === qId);
  if (!q) return;

  document.getElementById('edit-q-id').value = q.id;
  document.getElementById('edit-q-text').value = q.questionText || "";
  document.getElementById('edit-q-opt-0').value = q.options[0] || "";
  document.getElementById('edit-q-opt-1').value = q.options[1] || "";
  document.getElementById('edit-q-opt-2').value = q.options[2] || "";
  document.getElementById('edit-q-opt-3').value = q.options[3] || "";
  document.getElementById('edit-q-correct-idx').value = typeof q.correctAnswerIndex === 'number' ? q.correctAnswerIndex : 0;
  document.getElementById('edit-q-explanation').value = q.explanation || "";

  document.getElementById('modal-edit-question').classList.remove('hidden');
}

function closeEditQuestionModal() {
  document.getElementById('modal-edit-question').classList.add('hidden');
}

async function saveEditQuestionModal() {
  const qId = document.getElementById('edit-q-id').value;
  const qText = document.getElementById('edit-q-text').value.trim();
  const opt0 = document.getElementById('edit-q-opt-0').value.trim() || "Option A";
  const opt1 = document.getElementById('edit-q-opt-1').value.trim() || "Option B";
  const opt2 = document.getElementById('edit-q-opt-2').value.trim() || "Option C";
  const opt3 = document.getElementById('edit-q-opt-3').value.trim() || "Option D";
  const correctIdx = parseInt(document.getElementById('edit-q-correct-idx').value, 10);
  const explanation = document.getElementById('edit-q-explanation').value.trim();

  const q = currentQuestionsList.find(item => item.id === qId);
  if (q) {
    q.questionText = qText;
    q.options = [opt0, opt1, opt2, opt3];
    q.correctAnswerIndex = correctIdx;
    q.explanation = explanation;
    await QB.saveQuestion(q);
  }

  closeEditQuestionModal();
  await loadDashboardData();

  if (practiceViewMode === 'cards') loadPracticeQuestions();
  else if (practiceViewMode === 'vertical') renderVerticalQuestions();
  else renderQuestionsTable();
}

function renderRevisionAnalytics() {
  const container = document.getElementById('revision-stats-container');
  if (!container) return;

  const subjectsMap = {};

  currentQuestionsList.forEach(q => {
    const subj = q.subject || "Mechanical Engineering";
    const top = q.topic || "Fluid Mechanics";

    if (!subjectsMap[subj]) {
      subjectsMap[subj] = {
        subjectName: subj,
        total: 0,
        solved: 0,
        revision: 0,
        pending: 0,
        topics: {}
      };
    }

    if (!subjectsMap[subj].topics[top]) {
      subjectsMap[subj].topics[top] = {
        topicName: top,
        total: 0,
        solved: 0,
        revision: 0,
        pending: 0
      };
    }

    subjectsMap[subj].total += 1;
    subjectsMap[subj].topics[top].total += 1;

    if (q.status === 'solved') {
      subjectsMap[subj].solved += 1;
      subjectsMap[subj].topics[top].solved += 1;
    } else if (q.status === 'needs_revision') {
      subjectsMap[subj].revision += 1;
      subjectsMap[subj].topics[top].revision += 1;
    } else {
      subjectsMap[subj].pending += 1;
      subjectsMap[subj].topics[top].pending += 1;
    }
  });

  const subjects = Object.keys(subjectsMap);

  if (subjects.length === 0) {
    container.innerHTML = `
      <div class="col-span-full glass p-6 rounded-xl text-center text-xs text-slate-500 dark:text-slate-400">
        No question statistics yet. Sync questions from Testbook or upload PDF to see real-time revision analytics!
      </div>
    `;
    return;
  }

  container.innerHTML = subjects.map(subjName => {
    const s = subjectsMap[subjName];
    const subjectMasteryPct = s.total > 0 ? Math.round((s.solved / s.total) * 100) : 0;

    const topicsHtml = Object.keys(s.topics).map(topName => {
      const t = s.topics[topName];
      const topicMasteryPct = t.total > 0 ? Math.round((t.solved / t.total) * 100) : 0;

      let badgeHtml = `<span class="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/30">✓ 100% Mastered</span>`;
      let actionBtnHtml = `
        <button onclick="practiceSpecificTopic('${escapeHtml(subjName)}', '${escapeHtml(topName)}')" class="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center space-x-1">
          <i class="fa-solid fa-play"></i> <span>Practice</span>
        </button>
      `;

      if (t.revision > 0) {
        badgeHtml = `<span class="bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-rose-500/30">⚠️ ${t.revision} Revision Due</span>`;
        actionBtnHtml = `
          <button onclick="practiceSpecificTopic('${escapeHtml(subjName)}', '${escapeHtml(topName)}')" class="bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1 rounded-lg text-[11px] font-black transition flex items-center space-x-1 shadow-sm">
            <i class="fa-solid fa-bolt"></i> <span>Revise Now</span>
          </button>
        `;
      } else if (t.pending > 0) {
        badgeHtml = `<span class="bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-500/30">⏰ ${t.pending} Pending</span>`;
      }

      return `
        <div class="bg-white dark:bg-zinc-950 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2">
          <div class="flex items-center justify-between text-xs font-extrabold">
            <span class="text-slate-900 dark:text-white flex items-center space-x-1.5">
              <i class="fa-solid fa-folder text-indigo-500"></i>
              <span>${escapeHtml(topName)}</span>
            </span>
            <div class="flex items-center space-x-2">
              ${badgeHtml}
              ${actionBtnHtml}
            </div>
          </div>

          <div class="flex items-center space-x-2">
            <div class="flex-1 bg-slate-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden flex">
              <div class="bg-emerald-500 h-full" style="width: ${(t.solved / t.total) * 100}%" title="Solved: ${t.solved}"></div>
              <div class="bg-rose-500 h-full" style="width: ${(t.revision / t.total) * 100}%" title="Needs Revision: ${t.revision}"></div>
              <div class="bg-amber-500 h-full" style="width: ${(t.pending / t.total) * 100}%" title="Pending: ${t.pending}"></div>
            </div>
            <span class="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 shrink-0">${topicMasteryPct}% Ready</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="glass p-5 rounded-2xl space-y-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex flex-col justify-between">
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <div class="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-500 flex items-center justify-center font-bold text-sm">
                <i class="fa-solid fa-book"></i>
              </div>
              <div>
                <h3 class="font-black text-base text-slate-900 dark:text-white">${escapeHtml(subjName)}</h3>
                <p class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">${s.total} Questions • ${s.topics ? Object.keys(s.topics).length : 0} Topics</p>
              </div>
            </div>
            <span class="text-sm font-black text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950/80 px-2.5 py-1 rounded-xl border border-indigo-300 dark:border-indigo-800/40">
              ${subjectMasteryPct}% Mastered
            </span>
          </div>

          <div class="w-full bg-slate-200 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden flex">
            <div class="bg-emerald-500 h-full transition-all duration-500" style="width: ${(s.solved / s.total) * 100}%"></div>
            <div class="bg-rose-500 h-full transition-all duration-500" style="width: ${(s.revision / s.total) * 100}%"></div>
            <div class="bg-amber-500 h-full transition-all duration-500" style="width: ${(s.pending / s.total) * 100}%"></div>
          </div>

          <div class="space-y-2 pt-2">
            ${topicsHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function openRecycleBinModal() {
  const modal = document.getElementById('modal-recycle-bin');
  if (modal) modal.classList.remove('hidden');
  await renderRecycleBin();
}

function closeRecycleBinModal() {
  const modal = document.getElementById('modal-recycle-bin');
  if (modal) modal.classList.add('hidden');
}

async function renderRecycleBin() {
  const listEl = document.getElementById('recycle-bin-questions-list');
  const countText = document.getElementById('recycle-count-text');
  if (!listEl) return;

  const deletedQuestions = await QB.fetchQuestions(true);

  if (countText) {
    countText.innerText = `${deletedQuestions.length} Deleted Questions in Trash (30-Day Auto Purge)`;
  }

  if (deletedQuestions.length === 0) {
    listEl.innerHTML = `
      <div class="glass p-8 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center space-y-3 bg-white dark:bg-zinc-950">
        <i class="fa-solid fa-trash-can text-4xl text-emerald-500"></i>
        <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">Recycle Bin is Empty</h3>
        <p class="text-xs font-semibold text-slate-500 dark:text-slate-400">No deleted questions in trash!</p>
      </div>
    `;
    return;
  }

  const now = Date.now();

  listEl.innerHTML = deletedQuestions.map((q, idx) => {
    const expiresMs = q.expiresAt || (now + 30 * 24 * 60 * 60 * 1000);
    const daysLeft = Math.max(0, Math.ceil((expiresMs - now) / (1000 * 60 * 60 * 24)));
    const deletedDate = q.deletedAt ? new Date(q.deletedAt).toLocaleDateString() : 'Recently';

    return `
      <div class="glass p-5 rounded-2xl space-y-3 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
        <div class="flex items-center justify-between text-xs font-bold">
          <div class="flex items-center space-x-2">
            <span class="bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-black">Deleted</span>
            <span class="text-slate-500 dark:text-slate-400">Deleted: ${deletedDate}</span>
          </div>
          <span class="text-amber-500 font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30 text-[10px]">
            ⏳ Expires & Auto-Purges in ${daysLeft} days
          </span>
        </div>

        <div class="text-sm font-extrabold text-slate-900 dark:text-white leading-relaxed line-clamp-2">${renderFormattedQuestionHTML(q.questionText)}</div>

        <div class="text-xs font-bold text-slate-500 dark:text-slate-400">
          Folder: <span class="text-indigo-600 dark:text-indigo-400 font-bold">${escapeHtml(q.subject || 'General')} → ${escapeHtml(q.topic || 'General')}</span>
        </div>

        <div class="pt-2 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end space-x-2">
          <button onclick="restoreSingleQuestion('${q.id}')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center space-x-1 shadow-sm">
            <i class="fa-solid fa-rotate-left"></i>
            <span>Restore Question</span>
          </button>
          <button onclick="permanentDeleteSingleQuestion('${q.id}')" class="bg-rose-600/20 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold border border-rose-500/30 transition flex items-center space-x-1">
            <i class="fa-solid fa-fire"></i>
            <span>Delete Forever</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function restoreSingleQuestion(qId) {
  await QB.restoreQuestion(qId);
  await renderRecycleBin();
  await loadDashboardData();
}

async function permanentDeleteSingleQuestion(qId) {
  if (confirm("Permanently erase this question forever? It cannot be restored.")) {
    await QB.permanentDeleteQuestion(qId);
    await renderRecycleBin();
    await loadDashboardData();
  }
}

async function restoreAllDeleted() {
  if (confirm("Restore ALL deleted questions back to your active QuestionBank?")) {
    await QB.restoreAllDeletedQuestions();
    await renderRecycleBin();
    await loadDashboardData();
  }
}

async function emptyRecycleBinPrompt() {
  if (confirm("Permanently erase ALL items in the Recycle Bin forever? This action CANNOT be undone.")) {
    await QB.emptyRecycleBin();
    await renderRecycleBin();
    await loadDashboardData();
  }
}

function renderTopicsManager() {
  const grid = document.getElementById('topics-manager-grid');
  if (!grid) return;

  const query = document.getElementById('topics-search-input')?.value.toLowerCase().trim() || "";

  const subjectsMap = {};

  currentQuestionsList.forEach(q => {
    const subj = q.subject || "Mechanical Engineering";
    const top = q.topic || "Fluid Mechanics";

    if (!subjectsMap[subj]) {
      subjectsMap[subj] = {
        subjectName: subj,
        topicsCount: 0,
        questionsCount: 0,
        pendingCount: 0,
        topics: {}
      };
    }

    if (!subjectsMap[subj].topics[top]) {
      subjectsMap[subj].topics[top] = {
        subject: subj,
        topic: top,
        total: 0,
        pending: 0,
        solved: 0,
        revision: 0,
        questions: []
      };
      subjectsMap[subj].topicsCount += 1;
    }

    const tObj = subjectsMap[subj].topics[top];
    tObj.total += 1;
    subjectsMap[subj].questionsCount += 1;

    if (q.status === 'solved') tObj.solved += 1;
    else if (q.status === 'needs_revision') tObj.revision += 1;
    else {
      tObj.pending += 1;
      subjectsMap[subj].pendingCount += 1;
    }

    tObj.questions.push(q);
  });

  const customTopics = (QB.getCustomTopics ? QB.getCustomTopics() : []);
  customTopics.forEach(ct => {
    const subj = ct.subject || "Mechanical Engineering";
    const top = ct.topic || "General Topic";

    if (!subjectsMap[subj]) {
      subjectsMap[subj] = {
        subjectName: subj,
        topicsCount: 0,
        questionsCount: 0,
        pendingCount: 0,
        topics: {}
      };
    }

    if (!subjectsMap[subj].topics[top]) {
      subjectsMap[subj].topics[top] = {
        subject: subj,
        topic: top,
        total: 0,
        pending: 0,
        solved: 0,
        revision: 0,
        questions: []
      };
      subjectsMap[subj].topicsCount += 1;
    }
  });

  if (selectedSubjectFolder === null) {
    const subjNames = Object.keys(subjectsMap).filter(sName => {
      if (!query) return true;
      return sName.toLowerCase().includes(query) || Object.keys(subjectsMap[sName].topics).some(t => t.toLowerCase().includes(query));
    });

    if (subjNames.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full glass p-8 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center space-y-3 bg-white dark:bg-zinc-950">
          <i class="fa-solid fa-folder-closed text-4xl text-amber-500"></i>
          <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">No Subjects Found</h3>
          <p class="text-xs font-semibold text-slate-500 dark:text-slate-400">Click "Create New Topic" above or sync questions from Testbook!</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = subjNames.map(sName => {
      const sObj = subjectsMap[sName];

      return `
        <div onclick="openSubjectFolder('${escapeHtml(sName)}')" class="glass p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4 cursor-pointer hover:border-indigo-500 transition shadow-sm group">
          <div class="flex items-center justify-between">
            <div class="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 text-2xl group-hover:scale-110 transition">
              <i class="fa-solid fa-folder-closed"></i>
            </div>
            <span class="bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-xs font-mono font-bold px-3 py-1 rounded-full border border-indigo-300 dark:border-indigo-800/40">
              ${sObj.topicsCount} Topics • ${sObj.questionsCount} Questions
            </span>
          </div>

          <div>
            <h3 class="font-black text-xl text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">${escapeHtml(sName)}</h3>
            <p class="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">Click to open subject folder and view all topics</p>
          </div>

          <div class="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
            <span>Open Folder & Topics →</span>
            <span class="text-slate-500 dark:text-slate-400 font-mono">${sObj.pendingCount} Pending</span>
          </div>
        </div>
      `;
    }).join('');

    return;
  }

  const sObj = subjectsMap[selectedSubjectFolder];

  if (!sObj) {
    selectedSubjectFolder = null;
    renderTopicsManager();
    return;
  }

  const topicNames = Object.keys(sObj.topics).filter(tName => {
    if (!query) return true;
    return tName.toLowerCase().includes(query);
  });

  const breadcrumbHeader = `
    <div class="col-span-full flex items-center justify-between bg-slate-100 dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 mb-2">
      <button onclick="backToAllSubjects()" class="bg-white dark:bg-zinc-950 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-900 dark:text-white px-4 py-2 rounded-xl text-xs font-black border border-slate-300 dark:border-zinc-800 transition flex items-center space-x-2">
        <i class="fa-solid fa-arrow-left"></i>
        <span>← Back to All Subject Folders</span>
      </button>
      <div class="text-sm font-black text-slate-900 dark:text-white flex items-center space-x-2">
        <span class="text-amber-500">📁 ${escapeHtml(selectedSubjectFolder)}</span>
        <span class="text-xs font-bold text-slate-500 dark:text-slate-400">(${sObj.topicsCount} Topics)</span>
      </div>
    </div>
  `;

  if (topicNames.length === 0) {
    grid.innerHTML = breadcrumbHeader + `
      <div class="col-span-full glass p-8 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center space-y-3 bg-white dark:bg-zinc-950">
        <i class="fa-solid fa-folder-open text-4xl text-amber-500"></i>
        <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">No Topics inside ${escapeHtml(selectedSubjectFolder)}</h3>
      </div>
    `;
    return;
  }

  grid.innerHTML = breadcrumbHeader + topicNames.map(tName => {
    const t = sObj.topics[tName];

    return `
      <div class="glass p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4 flex flex-col justify-between hover:border-indigo-500/50 transition shadow-sm">
        <div>
          <div class="flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400 mb-2">
            <span>📁 ${escapeHtml(t.subject)}</span>
            <span class="bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-mono text-[10px] border border-indigo-300 dark:border-indigo-800/40">${t.total} Questions</span>
          </div>
          <h3 class="font-black text-lg text-slate-900 dark:text-white flex items-center space-x-2">
            <i class="fa-solid fa-folder text-indigo-500"></i>
            <span>${escapeHtml(t.topic)}</span>
          </h3>

          <div class="grid grid-cols-3 gap-2 mt-4 text-center">
            <div class="bg-amber-50 dark:bg-amber-950/20 p-2 rounded-xl border border-amber-500/20">
              <div class="text-sm font-black text-amber-600 dark:text-amber-400">${t.pending}</div>
              <div class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Pending</div>
            </div>
            <div class="bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded-xl border border-emerald-500/20">
              <div class="text-sm font-black text-emerald-600 dark:text-emerald-400">${t.solved}</div>
              <div class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Solved</div>
            </div>
            <div class="bg-rose-50 dark:bg-rose-950/20 p-2 rounded-xl border border-rose-500/20">
              <div class="text-sm font-black text-rose-600 dark:text-rose-400">${t.revision}</div>
              <div class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Revision</div>
            </div>
          </div>
        </div>

        <div class="space-y-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
          <div class="grid grid-cols-2 gap-2">
            <button onclick="openTopicReaderModal('${escapeHtml(t.subject)}', '${escapeHtml(t.topic)}')" class="py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 shadow-sm">
              <i class="fa-solid fa-book-open"></i>
              <span>Read Notes</span>
            </button>
            <button onclick="openEditTopicModal('${escapeHtml(t.subject)}', '${escapeHtml(t.topic)}')" class="py-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-900 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-300 dark:border-zinc-700 transition flex items-center justify-center space-x-1">
              <i class="fa-solid fa-pen-to-square"></i>
              <span>Edit Topic</span>
            </button>
          </div>

          <div class="flex items-center space-x-2">
            <button onclick="practiceSpecificTopic('${escapeHtml(t.subject)}', '${escapeHtml(t.topic)}')" class="flex-1 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white rounded-xl text-xs font-bold border border-emerald-500/30 transition flex items-center justify-center space-x-1">
              <i class="fa-solid fa-play"></i>
              <span>Practice Topic</span>
            </button>
            <button onclick="deleteTopic('${escapeHtml(t.subject)}', '${escapeHtml(t.topic)}')" class="p-2 bg-rose-600/20 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white rounded-xl text-xs border border-rose-500/30 transition" title="Move Topic Questions to Recycle Bin">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openSubjectFolder(subjName) {
  selectedSubjectFolder = subjName;
  renderTopicsManager();
}

function backToAllSubjects() {
  selectedSubjectFolder = null;
  renderTopicsManager();
}

function practiceSpecificTopic(subj, top) {
  const statusSelect = document.getElementById('practice-filter-status');
  if (statusSelect) {
    statusSelect.value = "all";
  }
  filterByHierarchy(subj, top, 'all');
}

function openEditTopicModal(subj, top) {
  document.getElementById('edit-orig-subject').value = subj;
  document.getElementById('edit-orig-topic').value = top;
  document.getElementById('edit-new-subject').value = subj;
  document.getElementById('edit-new-topic').value = top;
  document.getElementById('modal-edit-topic').classList.remove('hidden');
}

function closeEditTopicModal() {
  document.getElementById('modal-edit-topic').classList.add('hidden');
}

async function saveEditTopicModal() {
  const origSubj = document.getElementById('edit-orig-subject').value;
  const origTop = document.getElementById('edit-orig-topic').value;
  const newSubj = document.getElementById('edit-new-subject').value.trim() || origSubj;
  const newTop = document.getElementById('edit-new-topic').value.trim() || origTop;

  if (origSubj === newSubj && origTop === newTop) {
    closeEditTopicModal();
    return;
  }

  const matchingQuestions = currentQuestionsList.filter(q => (q.subject || 'Mechanical Engineering') === origSubj && (q.topic || 'Fluid Mechanics') === origTop);

  for (const q of matchingQuestions) {
    q.subject = newSubj;
    q.topic = newTop;
    await QB.saveQuestion(q);
  }

  closeEditTopicModal();
  alert(`Successfully updated topic name to [${newSubj} -> ${newTop}] across ${matchingQuestions.length} questions!`);
  await loadDashboardData();
}

function openTopicReaderModal(subj, top) {
  const modal = document.getElementById('modal-topic-reader');
  const titleEl = document.getElementById('reader-topic-title');
  const subtitleEl = document.getElementById('reader-topic-subtitle');
  const listEl = document.getElementById('reader-questions-list');

  if (!modal || !listEl) return;

  const topicQuestions = currentQuestionsList.filter(q => (q.subject || 'Mechanical Engineering') === subj && (q.topic || 'Fluid Mechanics') === top);

  titleEl.innerHTML = `<span>📖 Topic Reader: ${escapeHtml(top)}</span>`;
  subtitleEl.innerText = `Folder: [${subj} -> ${top}] • Total ${topicQuestions.length} questions & detailed concept notes`;

  listEl.innerHTML = topicQuestions.map((q, idx) => `
    <div class="glass p-5 rounded-2xl space-y-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
      <div class="flex items-center justify-between text-xs font-bold">
        <span class="text-indigo-600 dark:text-indigo-400">Question ${idx + 1} of ${topicQuestions.length}</span>
        <div class="flex items-center space-x-2">
          ${getSourceBadgeHtml(q.source, q)}
          <span class="bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[10px]">Correct: Option ${String.fromCharCode(65 + q.correctAnswerIndex)}</span>
        </div>
      </div>

      <div class="text-sm font-extrabold text-slate-900 dark:text-white leading-relaxed whitespace-pre-wrap">${renderFormattedQuestionHTML(q.questionText)}</div>

      <div class="grid grid-cols-2 gap-2 text-xs font-bold pt-1">
        ${q.options.map((opt, oIdx) => `
          <div class="p-2.5 rounded-xl border ${oIdx === q.correctAnswerIndex ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200' : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-300'}">
            <span class="font-black mr-1">${String.fromCharCode(65 + oIdx)})</span> ${formatSubSupScripts(escapeHtml(opt))}
          </div>
        `).join('')}
      </div>

      <div class="p-4 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-indigo-500/30 text-xs font-semibold space-y-1">
        <div class="text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center space-x-1">
          <i class="fa-solid fa-lightbulb text-amber-500"></i>
          <span>Concept Solution Note:</span>
        </div>
        <div class="text-slate-900 dark:text-white whitespace-pre-wrap font-mono">${cleanExplanationDisplay(q.explanation)}</div>
      </div>

      <div class="pt-2 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
        <div>
          <span>📅 Added: ${formatDateDisplay(q.createdAt)}</span> • 
          <span>⏱️ Last Attempted: ${formatDateDisplay(q.lastAttemptedAt)}</span>
        </div>
        <div class="flex items-center space-x-2">
          <button onclick="openMoveQuestionModal('${q.id}')" class="bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white px-2.5 py-1 rounded-lg border border-indigo-500/30 transition">📦 Move</button>
          <button onclick="openEditQuestionModal('${q.id}')" class="bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-900 dark:text-slate-200 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-zinc-700 transition">✏️ Edit</button>
        </div>
      </div>
    </div>
  `).join('');

  modal.classList.remove('hidden');
}

function closeTopicReaderModal() {
  document.getElementById('modal-topic-reader').classList.add('hidden');
}

async function deleteTopic(subj, top) {
  if (confirm(`Move ALL questions inside Topic [${subj} -> ${top}] to the 30-Day Recycle Bin?`)) {
    const toDelete = currentQuestionsList.filter(q => (q.subject || 'Mechanical Engineering') === subj && (q.topic || 'Fluid Mechanics') === top);
    for (const q of toDelete) {
      await QB.deleteQuestion(q.id);
    }
    await loadDashboardData();
  }
}

function checkRevisionAlerts() {
  const banner = document.getElementById('revision-alert-banner');
  const alertMsg = document.getElementById('alert-message');
  if (!banner || !alertMsg) return;

  const revisionQuestions = currentQuestionsList.filter(q => q.status === 'needs_revision');
  const pendingQuestions = currentQuestionsList.filter(q => q.status === 'pending');

  if (revisionQuestions.length > 0) {
    const dueTopic = revisionQuestions[0].topic || "Fluid Mechanics";
    const dueSub = (revisionQuestions[0].subfolder && revisionQuestions[0].subfolder.trim()) ? ` → ${revisionQuestions[0].subfolder}` : '';
    alertMsg.innerHTML = `⚠️ <strong class="text-amber-500">Revision Alert:</strong> It's been a while since you studied <strong class="text-indigo-600 dark:text-indigo-400 font-bold">[${escapeHtml(dueTopic)}${escapeHtml(dueSub)}]</strong> (${revisionQuestions.length} questions need revision). Time to revise now!`;
    banner.classList.remove('hidden');
  } else if (pendingQuestions.length > 0) {
    const dueTopic = pendingQuestions[0].topic || "Fluid Mechanics";
    const dueSub = (pendingQuestions[0].subfolder && pendingQuestions[0].subfolder.trim()) ? ` → ${pendingQuestions[0].subfolder}` : '';
    alertMsg.innerHTML = `⏰ <strong class="text-amber-500">Study Reminder:</strong> You have un-attempted missed questions in <strong class="text-indigo-600 dark:text-indigo-400 font-bold">[${escapeHtml(dueTopic)}${escapeHtml(dueSub)}]</strong> waiting for review!`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

function startAlertRevision() {
  const revisionQuestions = currentQuestionsList.filter(q => q.status === 'needs_revision');
  const statusSelect = document.getElementById('practice-filter-status');

  if (revisionQuestions.length > 0 && statusSelect) {
    statusSelect.value = "needs_revision";
  } else if (statusSelect) {
    statusSelect.value = "pending";
  }

  switchTab('practice');

  if (practiceViewMode === 'cards') loadPracticeQuestions();
  else if (practiceViewMode === 'vertical') renderVerticalQuestions();
  else renderQuestionsTable();
}

function dismissAlertBanner() {
  const banner = document.getElementById('revision-alert-banner');
  if (banner) banner.classList.add('hidden');
}

function updateSubjectAndTopicDropdowns() {
  const subjDropdown = document.getElementById('practice-filter-subject');
  const topicDropdown = document.getElementById('practice-filter-topic');

  if (!subjDropdown || !topicDropdown) return;

  const subjects = Array.from(new Set(currentQuestionsList.map(q => q.subject || 'Mechanical Engineering')));

  subjDropdown.innerHTML = `<option value="all">📁 All Subjects</option>` +
    subjects.map(s => `<option value="${escapeHtml(s)}">📁 ${escapeHtml(s)}</option>`).join('');

  if (activeSubjectFilter !== "all") {
    subjDropdown.value = activeSubjectFilter;
  }

  onSubjectDropdownChange();
}

function updateDeckDropdowns() {
  const deckSubj = document.getElementById('deck-filter-subject');
  const deckTopic = document.getElementById('deck-filter-topic');
  if (!deckSubj || !deckTopic) return;

  const allDecks = QB.getDecks();
  const subjects = Array.from(new Set([
    ...currentQuestionsList.map(q => q.subject || 'Mechanical Engineering'),
    ...allDecks.map(d => d.subject || 'Mechanical Engineering')
  ]));

  deckSubj.innerHTML = `<option value="all">📁 All Subjects</option>` +
    subjects.map(s => `<option value="${escapeHtml(s)}">📁 ${escapeHtml(s)}</option>`).join('');

  if (deckActiveSubject !== "all") {
    deckSubj.value = deckActiveSubject;
  }

  onDeckSubjectFilterChange();
}

function onDeckSubjectFilterChange() {
  const deckSubj = document.getElementById('deck-filter-subject');
  const deckTopic = document.getElementById('deck-filter-topic');
  if (!deckSubj || !deckTopic) return;

  const selectedSubj = deckSubj.value;
  deckActiveSubject = selectedSubj;

  const allDecks = QB.getDecks();

  let filteredQs = currentQuestionsList;
  let filteredDecks = allDecks;

  if (selectedSubj !== 'all') {
    filteredQs = currentQuestionsList.filter(q => (q.subject || 'Mechanical Engineering') === selectedSubj);
    filteredDecks = allDecks.filter(d => (d.subject || 'Mechanical Engineering') === selectedSubj);
  }

  const topics = Array.from(new Set([
    ...filteredQs.map(q => q.topic || 'Fluid Mechanics'),
    ...filteredDecks.map(d => d.topic || 'Fluid Mechanics')
  ]));

  deckTopic.innerHTML = `<option value="all">📂 All Topics in ${selectedSubj === 'all' ? 'All Subjects' : selectedSubj}</option>` +
    topics.map(t => `<option value="${escapeHtml(t)}">📂 ${escapeHtml(t)}</option>`).join('');

  if (deckActiveTopic !== "all" && topics.includes(deckActiveTopic)) {
    deckTopic.value = deckActiveTopic;
  } else {
    deckActiveTopic = "all";
    deckTopic.value = "all";
  }

  renderDecks();
}

function onSubjectDropdownChange() {
  const subjDropdown = document.getElementById('practice-filter-subject');
  const topicDropdown = document.getElementById('practice-filter-topic');
  if (!subjDropdown || !topicDropdown) return;

  const selectedSubj = subjDropdown.value;
  activeSubjectFilter = selectedSubj;

  let filteredQuestions = currentQuestionsList;
  if (selectedSubj !== 'all') {
    filteredQuestions = currentQuestionsList.filter(q => (q.subject || 'Mechanical Engineering') === selectedSubj);
  }

  const topics = Array.from(new Set(filteredQuestions.map(q => q.topic || 'Fluid Mechanics')));

  topicDropdown.innerHTML = `<option value="all">📂 All Topics in ${selectedSubj === 'all' ? 'All Subjects' : selectedSubj}</option>` +
    topics.map(t => `<option value="${escapeHtml(t)}">📂 ${escapeHtml(t)}</option>`).join('');

  if (activeTopicFilter !== "all" && topics.includes(activeTopicFilter)) {
    topicDropdown.value = activeTopicFilter;
  } else {
    activeTopicFilter = "all";
  }

  currentPracticeIndex = 0;

  if (practiceViewMode === 'cards') loadPracticeQuestions();
  else if (practiceViewMode === 'vertical') renderVerticalQuestions();
  else renderQuestionsTable();
}

function filterByHierarchy(subj, top, sub) {
  activeSubjectFilter = subj;
  activeTopicFilter = top;
  activeSubfolderFilter = (sub && sub !== 'all') ? sub : 'all';

  switchTab('practice');

  const subjDropdown = document.getElementById('practice-filter-subject');
  if (subjDropdown) {
    subjDropdown.value = subj;
  }

  const topicDropdown = document.getElementById('practice-filter-topic');
  if (topicDropdown) {
    let filteredQuestions = currentQuestionsList;
    if (subj !== 'all') {
      filteredQuestions = currentQuestionsList.filter(q => (q.subject || 'Mechanical Engineering') === subj);
    }
    const topics = Array.from(new Set(filteredQuestions.map(q => q.topic || 'Fluid Mechanics')));
    topicDropdown.innerHTML = `<option value="all">📂 All Topics in ${subj === 'all' ? 'All Subjects' : subj}</option>` +
      topics.map(t => `<option value="${escapeHtml(t)}">📂 ${escapeHtml(t)}</option>`).join('');

    if (top && top !== 'all' && topics.includes(top)) {
      topicDropdown.value = top;
      activeTopicFilter = top;
    } else {
      topicDropdown.value = 'all';
      activeTopicFilter = 'all';
    }
  }

  currentPracticeIndex = 0;

  if (practiceViewMode === 'cards') loadPracticeQuestions();
  else if (practiceViewMode === 'vertical') renderVerticalQuestions();
  else renderQuestionsTable();
}

function switchTab(tabName) {
  ['dashboard', 'practice', 'pdf', 'decks', 'notes', 'topics'].forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const nav = document.getElementById(`nav-${t}`);
    if (t === tabName) {
      if (el) el.classList.remove('hidden');
      if (nav) {
        nav.className = "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800/40";
      }
    } else {
      if (el) el.classList.add('hidden');
      if (nav) {
        nav.className = "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white";
      }
    }
  });

  if (tabName === 'practice') {
    if (practiceViewMode === 'cards') loadPracticeQuestions();
    else if (practiceViewMode === 'vertical') renderVerticalQuestions();
    else renderQuestionsTable();
  } else if (tabName === 'decks') {
    renderDecks();
  } else if (tabName === 'notes') {
    renderScreenshotNotes();
  } else if (tabName === 'topics') {
    renderTopicsManager();
  }
}

function renderQuestionsTable() {
  const tbody = document.getElementById('recent-questions-tbody');
  if (!tbody) return;

  const searchQuery = document.getElementById('questions-table-search')?.value.toLowerCase().trim() || "";

  let filtered = currentQuestionsList;
  if (searchQuery) {
    filtered = currentQuestionsList.filter(q => 
      (q.questionText || '').toLowerCase().includes(searchQuery) ||
      (q.subject || '').toLowerCase().includes(searchQuery) ||
      (q.topic || '').toLowerCase().includes(searchQuery) ||
      (q.subfolder || '').toLowerCase().includes(searchQuery)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500 dark:text-slate-400 font-bold">No questions match your search or database is empty. Sync from Testbook or upload PDF!</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(q => {
    let statusBadge = `<span class="bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-xs font-extrabold whitespace-nowrap">Skipped / Pending</span>`;
    if (q.status === 'solved') {
      statusBadge = `<span class="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-extrabold whitespace-nowrap">Solved</span>`;
    } else if (q.status === 'needs_revision') {
      statusBadge = `<span class="bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-2.5 py-0.5 rounded-full text-xs font-extrabold whitespace-nowrap">Incorrect / Wrong</span>`;
    }

    const cleanText = cleanQuestionTextDisplay(q.questionText);
    const subText = (q.subfolder && q.subfolder.trim()) ? ` → 📄 ${escapeHtml(q.subfolder)}` : '';

    return `
      <tr class="hover:bg-slate-100 dark:hover:bg-zinc-900 transition">
        <td class="p-3.5 font-extrabold text-slate-900 dark:text-white leading-relaxed">${renderFormattedQuestionHTML(cleanText)}</td>
        <td class="p-3.5 text-xs cursor-pointer" onclick="practiceSpecificTopic('${escapeHtml(q.subject)}', '${escapeHtml(q.topic)}')">
          <div class="font-black text-amber-600 dark:text-amber-400">📁 ${escapeHtml(q.subject || 'General')}</div>
          <div class="text-indigo-600 dark:text-indigo-400 font-bold">📂 ${escapeHtml(q.topic || 'General')}${subText}</div>
        </td>
        <td class="p-3.5 text-xs space-y-1.5">
          <div>${getSourceBadgeHtml(q.source, q)}</div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">📅 Added: ${formatDateDisplay(q.createdAt)}</div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">⏱️ Attempted: ${formatDateDisplay(q.lastAttemptedAt)}</div>
        </td>
        <td class="p-3.5">${statusBadge}</td>
        <td class="p-3.5">
          <div class="flex items-center space-x-1.5">
            <button onclick="practiceSpecificTopic('${escapeHtml(q.subject)}', '${escapeHtml(q.topic)}')" class="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition font-bold shadow-sm" title="Attempt Question">Attempt</button>
            <button onclick="openMoveQuestionModal('${q.id}')" class="text-xs bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white px-2.5 py-1.5 rounded-lg border border-indigo-500/30 transition" title="Move Question">📦</button>
            <button onclick="openEditQuestionModal('${q.id}')" class="text-xs bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 transition" title="Edit Question">✏️</button>
            <button onclick="deleteQuestion('${q.id}')" class="text-xs bg-rose-600/20 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-rose-500/30 transition" title="Move Question to Recycle Bin">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function deleteQuestion(qId) {
  if (confirm("Move this question to the 30-Day Recycle Bin? (You can restore it anytime within 30 days)")) {
    await QB.deleteQuestion(qId);
    await loadDashboardData();
  }
}

async function clearAllQuestions() {
  if (confirm("Move ALL active questions to the 30-Day Recycle Bin? (You can restore them anytime within 30 days)")) {
    await QB.clearAllQuestions();
    await loadDashboardData();
  }
}

function loadPracticeQuestions() {
  const container = document.getElementById('quiz-card-container');
  if (!container) return;

  if (isMockTestActive) {
    filteredPracticeQuestions = [...mockTestQuestionsList];
  } else {
    const subjectFilter = document.getElementById('practice-filter-subject')?.value || 'all';
    const topicFilter = document.getElementById('practice-filter-topic')?.value || 'all';
    const statusFilter = document.getElementById('practice-filter-status')?.value || 'pending';
    const sourceFilter = document.getElementById('practice-filter-source')?.value || 'all';

    filteredPracticeQuestions = [...currentQuestionsList];

    if (subjectFilter !== 'all') {
      filteredPracticeQuestions = filteredPracticeQuestions.filter(q => (q.subject || 'Mechanical Engineering') === subjectFilter);
    }
    if (topicFilter !== 'all') {
      filteredPracticeQuestions = filteredPracticeQuestions.filter(q => (q.topic || 'Fluid Mechanics') === topicFilter);
    }
    if (activeSubfolderFilter !== 'all' && activeSubfolderFilter !== '') {
      filteredPracticeQuestions = filteredPracticeQuestions.filter(q => (q.subfolder || '') === activeSubfolderFilter);
    }
    if (statusFilter === 'srs_due') {
      filteredPracticeQuestions = filteredPracticeQuestions.filter(q => QB.isSRSQuestionDue(q));
    } else if (statusFilter !== 'all') {
      filteredPracticeQuestions = filteredPracticeQuestions.filter(q => q.status === statusFilter);
    }
    if (sourceFilter !== 'all') {
      filteredPracticeQuestions = filteredPracticeQuestions.filter(q => q.source === sourceFilter);
    }
  }

  if (filteredPracticeQuestions.length === 0) {
    container.innerHTML = `
      <div class="glass p-8 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center space-y-3 bg-white dark:bg-zinc-950 max-w-4xl mx-auto">
        <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center mx-auto text-slate-500 text-xl">
          <i class="fa-solid fa-circle-check"></i>
        </div>
        <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">No Questions for Selected Hierarchy</h3>
        <p class="text-xs font-semibold text-slate-500 dark:text-slate-400">All questions in this folder have been completed or none match your selection.</p>
        <button onclick="activeSubfolderFilter='all'; document.getElementById('practice-filter-subject').value='all'; onSubjectDropdownChange();" class="mt-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold">Reset Hierarchy Filters</button>
      </div>
    `;
    return;
  }

  if (currentPracticeIndex >= filteredPracticeQuestions.length) {
    currentPracticeIndex = Math.max(0, filteredPracticeQuestions.length - 1);
  }

  const q = filteredPracticeQuestions[currentPracticeIndex];
  const totalQs = filteredPracticeQuestions.length;

  const solvedCount = filteredPracticeQuestions.filter(item => item.status === 'solved').length;
  const revisionCount = filteredPracticeQuestions.filter(item => item.status === 'needs_revision').length;
  const pendingCount = filteredPracticeQuestions.filter(item => item.status === 'pending').length;

  const formattedQuestionContent = renderFormattedQuestionHTML(q.questionText);
  const cleanSol = cleanExplanationDisplay(q.explanation);

  const optionsHtml = q.options.map((opt, optIdx) => `
    <button onclick="attemptQuestion('${q.id}', ${optIdx}, ${q.correctAnswerIndex})" id="opt-${q.id}-${optIdx}" class="w-full text-left p-4 bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white transition flex items-center space-x-3 group shadow-sm">
      <span class="w-7 h-7 rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-slate-300 group-hover:bg-indigo-600 group-hover:text-white font-extrabold text-xs flex items-center justify-center border border-slate-300 dark:border-zinc-700 transition">
        ${String.fromCharCode(65 + optIdx)}
      </span>
      <span class="flex-1 font-extrabold text-slate-900 dark:text-white">${formatSubSupScripts(escapeHtml(opt))}</span>
    </button>
  `).join('');

  let statusBadge = `<span class="bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-xs font-extrabold">Unattempted</span>`;
  if (q.status === 'solved') {
    statusBadge = `<span class="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-extrabold">✓ Correct / Solved</span>`;
  } else if (q.status === 'needs_revision') {
    statusBadge = `<span class="bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-2.5 py-0.5 rounded-full text-xs font-extrabold">✗ Incorrect / Revision</span>`;
  }

  const showNotes = !isMockTestActive;

  const paletteButtonsHtml = filteredPracticeQuestions.map((item, idx) => {
    let btnBgClass = "bg-white text-slate-900 border-slate-300 font-extrabold shadow-sm hover:bg-slate-100";
    if (item.status === 'solved') {
      btnBgClass = "bg-emerald-500 text-white border-emerald-600 font-extrabold shadow-sm";
    } else if (item.status === 'needs_revision') {
      btnBgClass = "bg-rose-500 text-white border-rose-600 font-extrabold shadow-sm";
    }

    const isActive = (idx === currentPracticeIndex);
    const activeRingClass = isActive ? "ring-4 ring-indigo-500 ring-offset-2 scale-110 font-black z-10" : "hover:scale-105";

    return `
      <button onclick="jumpToPracticeQuestion(${idx})" title="Question ${idx + 1}" class="w-10 h-10 rounded-xl text-xs flex items-center justify-center border transition ${btnBgClass} ${activeRingClass}">
        ${idx + 1}
      </button>
    `;
  }).join('');

  const subheaderBadge = (q.subfolder && q.subfolder.trim()) ? ` / <span class="text-slate-900 dark:text-slate-200 font-bold">📄 ${escapeHtml(q.subfolder)}</span>` : '';

  container.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
      <div class="lg:col-span-3 glass p-6 rounded-2xl space-y-5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex flex-col justify-between min-h-[550px]">
        <div class="space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-100 dark:bg-zinc-900 -mx-6 -mt-6 p-4 rounded-t-2xl border-b border-slate-200 dark:border-zinc-800">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-black text-slate-900 dark:text-white bg-slate-200 dark:bg-black/60 px-3.5 py-1 rounded-full border border-slate-300 dark:border-zinc-800">
                Question No.${currentPracticeIndex + 1} <span class="text-slate-500 dark:text-slate-400 font-normal">of ${totalQs}</span>
              </span>
              ${statusBadge}
              ${getSRSBadgeHtml(q)}
              
              <span class="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-black">
                Marks 1
              </span>

              ${getSourceBadgeHtml(q.source, q)}
            </div>

            <div class="flex items-center space-x-1.5">
              ${showNotes ? `
                <button onclick="toggleQuestionNoteInput('${q.id}')" ${q.userNote ? `title="📌 Mistake Comment: ${escapeHtml(q.userNote)}"` : ''} class="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-slate-950 px-2.5 py-1 rounded-lg border border-amber-500/30 transition font-bold flex items-center space-x-1">
                  <i class="fa-solid fa-comment-dots text-amber-500"></i>
                  <span>${q.userNote ? '✏️ Mistake Note' : '💬 Add Note'}</span>
                </button>
              ` : ''}
              <button onclick="toggleMarkForReview('${q.id}')" class="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-slate-950 px-2.5 py-1 rounded-lg border border-amber-500/30 transition font-bold" title="Bookmark / Mark for Review">
                🔖 Mark
              </button>
              <button onclick="toggleSolutionVisibility('${q.id}')" class="text-xs bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white px-2.5 py-1 rounded-lg border border-indigo-500/30 transition font-bold">
                💡 Solution
              </button>
              <button onclick="openMoveQuestionModal('${q.id}')" class="text-xs bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-zinc-700 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-zinc-700 transition font-bold" title="Move Question to another folder">
                📦 Move
              </button>
              <button onclick="openEditQuestionModal('${q.id}')" class="text-xs bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-zinc-700 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-zinc-700 transition font-bold" title="Edit Question Content">
                ✏️ Edit
              </button>
              <button onclick="deleteQuestion('${q.id}')" class="text-xs bg-rose-600/20 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white px-2 py-1 rounded-lg border border-rose-500/30 transition font-bold" title="Move Question to 30-Day Recycle Bin">
                🗑️
              </button>
            </div>
          </div>

          <div class="text-xs font-extrabold text-slate-500 dark:text-slate-400 flex items-center space-x-2">
            <span>Folder:</span>
            <span class="text-amber-600 dark:text-amber-400 font-black">📁 ${escapeHtml(q.subject || 'General')}</span>
            <span>/</span>
            <span class="text-indigo-600 dark:text-indigo-400 font-black">📂 ${escapeHtml(q.topic || 'General')}</span>
            ${subheaderBadge}
          </div>

          <div ${showNotes && q.userNote ? `title="📌 ${escapeHtml(q.userNote)}"` : ''} class="text-base font-black leading-relaxed bg-slate-100 dark:bg-black p-5 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white shadow-sm relative group cursor-pointer">
            ${formattedQuestionContent}
            ${showNotes && q.userNote ? `
              <div class="hidden group-hover:flex absolute left-4 right-4 -bottom-11 z-30 p-2.5 bg-amber-400 dark:bg-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-2xl border border-amber-600 items-center space-x-2 animate-fade-in">
                <i class="fa-solid fa-sticky-note text-slate-950"></i>
                <span>📌 "${escapeHtml(q.userNote)}"</span>
              </div>
            ` : ''}
          </div>

          ${showNotes ? `
            <div id="note-box-${q.id}" class="hidden p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-500/30 space-y-2 shadow-inner">
              <div class="flex items-center justify-between text-xs font-black text-amber-800 dark:text-amber-300">
                <span class="flex items-center space-x-1.5"><i class="fa-solid fa-sticky-note text-amber-500"></i><span>Note / Reflection:</span></span>
                <button onclick="saveQuestionNote('${q.id}')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1 rounded-lg text-xs font-black shadow-sm transition">Save Note</button>
              </div>
              <textarea id="note-input-${q.id}" rows="2" placeholder="✍️ Write what mistake you made here (e.g., Silly calculation error, forgot formula)..." class="w-full p-2.5 bg-white dark:bg-zinc-950 border border-amber-500/40 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500">${escapeHtml(q.userNote || '')}</textarea>
            </div>
          ` : ''}

          <div class="space-y-2.5" id="options-container-${q.id}">
            ${optionsHtml}
          </div>

          <div id="explanation-box-${q.id}" class="hidden p-5 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-indigo-500/40 space-y-3 shadow-xl transition-all duration-300">
            <div class="flex items-center justify-between text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">
              <span class="flex items-center space-x-2">
                <i class="fa-solid fa-lightbulb text-amber-500"></i>
                <span>Detailed Solution & Concept Note</span>
              </span>
              <button onclick="generateGeminiHinglishSolution('${q.id}')" class="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center space-x-1.5 shadow-md">
                <i class="fa-solid fa-wand-magic-sparkles text-amber-300"></i>
                <span>✨ Generate Hinglish AI Solution</span>
              </button>
            </div>

            <div id="ai-gemini-sol-container-${q.id}"></div>

            <div class="text-xs text-slate-900 dark:text-white font-bold leading-relaxed font-mono whitespace-pre-wrap bg-white dark:bg-black p-4 rounded-xl border border-slate-200 dark:border-zinc-800">${cleanSol}</div>

            <div class="pt-2 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <span class="text-xs font-bold text-slate-500 dark:text-slate-400">Update status:</span>
              <div class="flex space-x-2">
                <button onclick="updateQuestionStatus('${q.id}', 'solved')" class="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg font-extrabold transition flex items-center space-x-1">
                  <i class="fa-solid fa-check"></i> <span>Solved / Mastered</span>
                </button>
                <button onclick="updateQuestionStatus('${q.id}', 'needs_revision')" class="text-xs bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-1.5 rounded-lg font-extrabold transition flex items-center space-x-1">
                  <i class="fa-solid fa-rotate-right"></i> <span>Needs Revision</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="pt-4 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between mt-6">
          <button onclick="prevPracticeQuestion()" ${currentPracticeIndex === 0 ? 'disabled' : ''} class="px-5 py-2.5 rounded-xl text-xs font-black transition flex items-center space-x-2 ${currentPracticeIndex === 0 ? 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600 cursor-not-allowed border border-slate-300 dark:border-zinc-800' : 'bg-slate-200 dark:bg-zinc-800 hover:bg-indigo-600 hover:text-white text-slate-900 dark:text-white border border-slate-300 dark:border-zinc-700 shadow-sm'}">
            <i class="fa-solid fa-arrow-left"></i>
            <span>Previous</span>
          </button>

          <div class="text-xs font-bold text-slate-500 dark:text-slate-400 hidden sm:block">
            📅 Added: ${formatDateDisplay(q.createdAt)}
          </div>

          <button onclick="nextPracticeQuestion()" ${currentPracticeIndex === totalQs - 1 ? 'disabled' : ''} class="px-6 py-2.5 rounded-xl text-xs font-black transition flex items-center space-x-2 ${currentPracticeIndex === totalQs - 1 ? 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600 cursor-not-allowed border border-slate-300 dark:border-zinc-800' : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500 shadow-lg shadow-indigo-600/30'}">
            <span>Next</span>
            <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>

      <div class="lg:col-span-1 glass p-5 rounded-2xl space-y-4 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
        <div class="border-b border-slate-200 dark:border-zinc-800 pb-3 space-y-2">
          <h3 class="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
            <span>SECTION : TEST</span>
            <i class="fa-solid fa-grip text-indigo-500"></i>
          </h3>

          <div class="grid grid-cols-3 gap-1.5 text-center text-[10px] font-extrabold pt-1">
            <div class="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-1.5 rounded-lg border border-emerald-500/30">
              <div class="text-sm font-black">${solvedCount}</div>
              <div>Correct</div>
            </div>
            <div class="bg-rose-500/20 text-rose-600 dark:text-rose-400 p-1.5 rounded-lg border border-rose-500/30">
              <div class="text-sm font-black">${revisionCount}</div>
              <div>Incorrect</div>
            </div>
            <div class="bg-white text-slate-900 border border-slate-300 p-1.5 rounded-lg shadow-sm">
              <div class="text-sm font-black text-black">${pendingCount}</div>
              <div class="text-slate-700">Unattempted</div>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-xs font-extrabold text-slate-600 dark:text-slate-400 mb-2">Question Palette (${totalQs})</label>
          <div class="grid grid-cols-5 gap-2 max-h-80 overflow-y-auto pr-1">
            ${paletteButtonsHtml}
          </div>
        </div>

        <div class="text-[11px] font-bold text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-zinc-800 space-y-1.5">
          <div class="flex items-center space-x-1.5"><span class="w-3 h-3 rounded-md bg-white border border-slate-300 inline-block shadow-sm"></span> <span>White = Unattempted / Pending</span></div>
          <div class="flex items-center space-x-1.5"><span class="w-3 h-3 rounded-md bg-emerald-500 inline-block"></span> <span>Green = Correct / Solved</span></div>
          <div class="flex items-center space-x-1.5"><span class="w-3 h-3 rounded-md bg-rose-500 inline-block"></span> <span>Red = Incorrect / Revision</span></div>
        </div>
      </div>

    </div>
  `;
}

function jumpToPracticeQuestion(idx) {
  if (idx >= 0 && idx < filteredPracticeQuestions.length) {
    currentPracticeIndex = idx;
    loadPracticeQuestions();
  }
}

function nextPracticeQuestion() {
  if (currentPracticeIndex < filteredPracticeQuestions.length - 1) {
    currentPracticeIndex++;
    loadPracticeQuestions();
  }
}

function prevPracticeQuestion() {
  if (currentPracticeIndex > 0) {
    currentPracticeIndex--;
    loadPracticeQuestions();
  }
}

function toggleSolutionVisibility(qId) {
  const explanationBox = document.getElementById(`explanation-box-${qId}`);
  if (explanationBox) {
    explanationBox.classList.toggle('hidden');
  }
}

function cleanDimensionalAndDuplicatedString(str) {
  if (!str) return "";

  let s = str.trim();
  const halfLen = Math.floor(s.length / 2);
  if (halfLen > 5 && s.substring(0, halfLen) === s.substring(halfLen)) {
    s = s.substring(0, halfLen);
  }

  s = s.replace(/\bMLT-2\b/g, '[M L T⁻²]');
  s = s.replace(/\bML-1\/T-1\b/g, '[M L⁻¹ T⁻¹]');
  s = s.replace(/\bML-1T-1\b/g, '[M L⁻¹ T⁻¹]');
  s = s.replace(/\bML²T-1\b/g, '[M L² T⁻¹]');
  s = s.replace(/\bML2T-1\b/g, '[M L² T⁻¹]');
  s = s.replace(/\bML²T-3\b/g, '[M L² T⁻³]');
  s = s.replace(/\bML2T-3\b/g, '[M L² T⁻³]');
  s = s.replace(/\bML-1\/T-2\b/g, '[M L⁻¹ T⁻²]');
  s = s.replace(/\bML-1T-2\b/g, '[M L⁻¹ T⁻²]');
  s = s.replace(/\bML-2\b/g, '[M L⁻²]');
  s = s.replace(/\bL2\b/g, 'L²');

  s = s.replace(/SolutionDynamic viscosity:/gi, 'Dynamic Viscosity (μ):');
  s = s.replace(/WorkTimes/g, 'Work / Time');
  s = s.replace(/ForcexDistanceTime/g, '(Force × Distance) / Time');
  s = s.replace(/σ=E⇒E=σε=FAε=/g, 'E = Stress / Strain = Force / Area = ');

  return s;
}

function formatCleanStepByStepSolution(rawSol) {
  if (!rawSol) return "";

  let cleanText = rawSol
    .replace(/Re-attempt answer[\s\S]*?AnswersSolution/gi, '')
    .replace(/Re-attempt mode:[\s\S]*?see the answer now/gi, '')
    .replace(/Your First Attempt Answers/gi, '')
    .replace(/Hide Solution Click here to see the answer now/gi, '')
    .replace(/123456789\.0\+\/-/gi, '')
    .trim();

  cleanText = formatSubSupScripts(cleanText);

  const rawLines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  let formattedSteps = [];
  let stepCounter = 1;

  rawLines.forEach(line => {
    if (line.includes("Re-attempt") || line.includes("Click here to see")) return;

    let text = cleanDimensionalAndDuplicatedString(line);
    let isHeading = false;
    let headingTitle = "";

    if (/^(Given:|Given Values:)/i.test(text)) {
      headingTitle = "Start with the given equation / values:";
      text = text.replace(/^(Given:|Given Values:)/i, '').trim();
      isHeading = true;
    } else if (/^(Formula Used:|Main Formula:)/i.test(text)) {
      headingTitle = "Apply algebraic identity / formula:";
      text = text.replace(/^(Formula Used:|Main Formula:)/i, '').trim();
      isHeading = true;
    } else if (/^(Calculation:|Step-by-Step Derivation:)/i.test(text)) {
      headingTitle = "Simplify and solve step-by-step:";
      text = text.replace(/^(Calculation:|Step-by-Step Derivation:)/i, '').trim();
      isHeading = true;
    } else if (/^Shortcut Trick/i.test(text)) {
      headingTitle = "🔥 Quick Shortcut Method:";
      text = text.replace(/^Shortcut Trick/i, '').trim();
      isHeading = true;
    } else if (/^Alternate Method/i.test(text)) {
      headingTitle = "💡 Alternate Method:";
      text = text.replace(/^Alternate Method/i, '').trim();
      isHeading = true;
    } else if (/(Dynamic Viscosity|Angular momentum|Power|Volume modulus of elasticity)/i.test(text) && !text.includes("=")) {
      headingTitle = text;
      text = "";
      isHeading = true;
    }

    if (isHeading) {
      formattedSteps.push(`
        <div class="mt-4 mb-2 font-extrabold text-sm text-slate-900 dark:text-white flex items-center space-x-2.5">
          <span class="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-md shadow-indigo-600/30">${stepCounter++}</span>
          <span>${escapeHtml(headingTitle)}</span>
        </div>
      `);
    }

    if (!text) return;

    const isEquation = text.includes("=") || text.includes("⇒") || text.includes("∴") || text.includes("x²") || text.includes("1/x") || text.includes("[M L");

    if (isEquation && !text.toLowerCase().includes("the correct answer")) {
      formattedSteps.push(`
        <div class="my-2.5 p-3.5 bg-slate-100 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 text-center font-mono text-sm sm:text-base font-black text-indigo-600 dark:text-indigo-400 shadow-inner tracking-wide leading-relaxed">
          ${text}
        </div>
      `);
    } else if (text.toLowerCase().includes("the correct answer")) {
      formattedSteps.push(`
        <div class="mt-3 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-2">
          <i class="fa-solid fa-circle-check"></i>
          <span>${text}</span>
        </div>
      `);
    } else {
      formattedSteps.push(`
        <div class="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed py-1">
          ${text}
        </div>
      `);
    }
  });

  return formattedSteps.join("");
}

function generateSmartHinglishFallback(q) {
  let correctIdx = typeof q.correctAnswerIndex === 'number' ? q.correctAnswerIndex : 0;
  const rawSol = cleanExplanationDisplay(q.explanation || "");

  // Double-check explanation text for explicit "Ans. (x)" indicator to guarantee zero mismatch
  const ansMatch = rawSol.match(/(?:ans(?:wer)?|correct\s*option)[\s.#:-]*\(?\s*([a-d1-4])\s*\)?/i);
  if (ansMatch) {
    const char = ansMatch[1].toUpperCase();
    if (['A', '1'].includes(char)) correctIdx = 0;
    else if (['B', '2'].includes(char)) correctIdx = 1;
    else if (['C', '3'].includes(char)) correctIdx = 2;
    else if (['D', '4'].includes(char)) correctIdx = 3;
  }

  const correctOptLetter = String.fromCharCode(65 + correctIdx);
  const correctOptText = q.options && q.options[correctIdx] ? q.options[correctIdx] : "";
  const cleanStepsContent = formatCleanStepByStepSolution(rawSol);

  return `
    <div class="p-5 sm:p-6 bg-white dark:bg-zinc-900 border border-indigo-500/30 rounded-2xl space-y-4 text-left shadow-2xl my-3">
      <div class="flex items-center justify-between text-slate-900 dark:text-white border-b border-slate-200 dark:border-zinc-800 pb-3">
        <h3 class="font-black text-base flex items-center space-x-2">
          <i class="fa-solid fa-calculator text-indigo-500"></i>
          <span>Step-by-Step Solution</span>
        </h3>
        <span class="bg-indigo-600 text-white font-mono text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">Concept Notes</span>
      </div>

      <div class="space-y-1">
        ${cleanStepsContent}
      </div>

      <div class="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
        <span>✅ Correct Answer: Option (${correctOptLetter}) ${escapeHtml(correctOptText)}</span>
        <span class="text-[10px] bg-emerald-600 text-white px-2.5 py-0.5 rounded-full uppercase font-extrabold">Verified</span>
      </div>
    </div>
  `;
}

async function generateGeminiHinglishSolution(qId) {
  const box = document.getElementById(`ai-gemini-sol-container-${qId}`);
  if (!box) return;

  const firebaseCfg = QB.getFirebaseConfig();
  let userGeminiKey = (localStorage.getItem("qb_gemini_api_key") || "").trim();

  const q = currentQuestionsList.find(item => item.id === qId);
  if (!q) return;

  box.innerHTML = `
    <div class="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs text-indigo-700 dark:text-indigo-300 font-bold flex items-center space-x-2 my-2">
      <i class="fa-solid fa-spinner animate-spin text-base text-indigo-500"></i>
      <span>Generating Hinglish step-by-step solution...</span>
    </div>
  `;

  const promptText = `Analyze this multiple choice question and provide a crystal-clear, step-by-step explanation in simple, student-friendly Hinglish.

Question Statement: ${q.questionText}
Options: ${q.options ? q.options.join(", ") : ""}
Correct Answer: Option ${String.fromCharCode(65 + (q.correctAnswerIndex || 0))}

Instructions:
1. Explain the core concept in simple Hinglish (e.g. "Is question me hume...").
2. Provide step-by-step mathematical/logical derivations with bold formulas.
3. Keep line breaks clean.
4. Conclude why the correct option is right.`;

  const keysToTry = [userGeminiKey, firebaseCfg.apiKey, "AIzaSyCw_eug46aDoSnluYLqFJE7ub89105s6k0"].filter(Boolean);
  const modelsToTry = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];
  let rawAiText = null;

  for (const apiKey of keysToTry) {
    for (const modelName of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
        });

        const data = await res.json();
        if (data.error) continue;

        rawAiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawAiText) break;
      } catch (e) {}
    }
    if (rawAiText) break;
  }

  if (rawAiText) {
    const formattedAiText = formatSubSupScripts(escapeHtml(rawAiText)).replace(/\n/g, '<br>');
    box.innerHTML = `
      <div class="p-4 bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-500/40 rounded-xl space-y-2 text-left shadow-sm my-2">
        <div class="flex items-center justify-between text-indigo-700 dark:text-indigo-300 font-black text-xs border-b border-indigo-200 dark:border-indigo-800/60 pb-2">
          <span class="flex items-center space-x-1.5"><i class="fa-solid fa-wand-magic-sparkles text-amber-500"></i> <span>Gemini AI Hinglish Step-by-Step Explanation</span></span>
          <span class="bg-indigo-600 text-white font-mono text-[10px] px-2 py-0.5 rounded-full">Gemini AI</span>
        </div>
        <div class="text-xs text-slate-900 dark:text-slate-100 font-medium leading-relaxed">${formattedAiText}</div>
      </div>
    `;
  } else {
    // Seamless fallback to Smart Hinglish AI Formatter!
    box.innerHTML = generateSmartHinglishFallback(q);
  }
}

async function toggleMarkForReview(qId) {
  const q = currentQuestionsList.find(item => item.id === qId);
  if (!q) return;

  const newStatus = q.status === 'needs_revision' ? 'pending' : 'needs_revision';
  await QB.updateQuestionStatus(qId, newStatus);

  if (newStatus === 'needs_revision') {
    alert("Question marked for Review / Revision! 🔖");
  } else {
    alert("Question unmarked from Review.");
  }

  await loadDashboardData();
  if (practiceViewMode === 'cards') loadPracticeQuestions();
  else if (practiceViewMode === 'vertical') renderVerticalQuestions();
  else renderQuestionsTable();
}

async function attemptQuestion(qId, selectedIdx, correctIdx) {
  const optionsBox = document.getElementById(`options-container-${qId}`);
  const explanationBox = document.getElementById(`explanation-box-${qId}`);
  if (!optionsBox) return;

  const isCorrect = (selectedIdx === correctIdx);
  const buttons = optionsBox.querySelectorAll('button');

  if (isMockTestActive) {
    // REAL EXAM HALL MODE: Do NOT reveal right/wrong or solution!
    buttons.forEach((btn, idx) => {
      if (idx === selectedIdx) {
        btn.className = "w-full text-left p-4 bg-indigo-100 dark:bg-indigo-950/90 border-2 border-indigo-500 rounded-xl text-sm font-extrabold text-indigo-950 dark:text-indigo-200 flex items-center justify-between shadow-lg shadow-indigo-500/20";
      } else {
        btn.className = "w-full text-left p-4 bg-white dark:bg-zinc-900 opacity-60 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between";
      }
    });

    if (explanationBox) {
      explanationBox.classList.add('hidden');
    }

    mockTestUserAttempts[qId] = { selectedIdx, isCorrect };
    updateTestTimerTick();
    return;
  }

  // STANDARD PRACTICE MODE: Show green/red feedback & unhide solution
  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === correctIdx) {
      btn.className = "w-full text-left p-4 bg-emerald-100 dark:bg-emerald-950/90 border-2 border-emerald-500 rounded-xl text-sm font-extrabold text-emerald-950 dark:text-emerald-200 flex items-center justify-between shadow-lg shadow-emerald-500/20";
      btn.innerHTML += `<span class="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded text-xs">✓ Correct Answer</span>`;
    } else if (idx === selectedIdx && selectedIdx !== correctIdx) {
      btn.className = "w-full text-left p-4 bg-rose-100 dark:bg-rose-950/90 border-2 border-rose-500 rounded-xl text-sm font-extrabold text-rose-950 dark:text-rose-200 flex items-center justify-between shadow-lg shadow-rose-500/20";
      btn.innerHTML += `<span class="bg-rose-600 text-white font-bold px-2 py-0.5 rounded text-xs">✗ Your Selection</span>`;
    }
  });

  if (explanationBox) {
    explanationBox.classList.remove('hidden');
  }

  const newStatus = isCorrect ? 'solved' : 'needs_revision';
  await QB.updateQuestionStatus(qId, newStatus, selectedIdx);

  const currentQ = filteredPracticeQuestions.find(item => item.id === qId);
  if (currentQ) currentQ.status = newStatus;

  updateStatsNumbersOnly();
}

// ==========================================
// 🎯 CUSTOM TIMED MOCK TEST MODULE
// ==========================================
let isMockTestActive = false;
let testSelectedQuestionCount = 10;
let testDurationSeconds = 1800;
let testRemainingSeconds = 1800;
let testTimerInterval = null;
let mockTestQuestionsList = [];
let mockTestUserAttempts = {};
let testStartTime = null;

async function openTestSetupModal() {
  if (!currentQuestionsList || currentQuestionsList.length === 0) {
    currentQuestionsList = await QB.fetchQuestions(false);
  }
  populateTestSubjectDropdown();
  setTestQuestionCount(10);
  setTestDuration(30);
  document.getElementById('modal-test-setup')?.classList.remove('hidden');
}

function closeTestSetupModal() {
  document.getElementById('modal-test-setup')?.classList.add('hidden');
}

function populateTestSubjectDropdown() {
  const select = document.getElementById('test-subject-select');
  if (!select) return;

  const subjects = Array.from(new Set(currentQuestionsList.map(q => q.subject || 'Mechanical Engineering').filter(Boolean)));

  select.innerHTML = `<option value="all">📁 All Subjects (Full Syllabus Mock)</option>` +
    subjects.map(s => `<option value="${escapeHtml(s)}">📁 ${escapeHtml(s)}</option>`).join('');

  onTestSubjectChange();
}

function onTestSubjectChange() {
  const selectedSubj = document.getElementById('test-subject-select')?.value || 'all';
  const infoEl = document.getElementById('test-subject-count-info');
  if (!infoEl) return;

  let totalAvailable = currentQuestionsList.length;
  if (selectedSubj !== 'all') {
    totalAvailable = currentQuestionsList.filter(q => (q.subject || "Mechanical Engineering") === selectedSubj).length;
  }
  infoEl.innerText = `${totalAvailable} Questions Available`;
}

function setTestQuestionCount(count) {
  testSelectedQuestionCount = count;
  const btns = document.querySelectorAll('.test-count-btn');
  btns.forEach(b => {
    b.className = 'test-count-btn py-2.5 rounded-xl border border-slate-300 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-950 text-slate-700 dark:text-slate-300 font-bold text-xs hover:border-indigo-500 transition';
  });

  const activeBtn = document.getElementById(`btn-count-${count}`);
  if (activeBtn) {
    activeBtn.className = 'test-count-btn py-2.5 rounded-xl border border-indigo-600 bg-indigo-600 text-white font-black text-xs transition shadow-md';
  }
}

function setTestDuration(mins) {
  const input = document.getElementById('test-duration-minutes');
  if (input) input.value = mins;
  updateTestTimerHint();
}

function updateTestTimerHint() {
  const mins = parseInt(document.getElementById('test-duration-minutes')?.value || "30", 10);
  const hintEl = document.getElementById('test-timer-display-hint');
  if (hintEl) hintEl.innerText = `${mins} Minutes`;
}

function startMockTest() {
  const selectedSubject = document.getElementById('test-subject-select')?.value || 'all';
  const weaknessFocus = document.getElementById('test-weakness-focus')?.checked ?? true;
  const mins = parseInt(document.getElementById('test-duration-minutes')?.value || "30", 10);

  let pool = [...currentQuestionsList];
  if (selectedSubject !== 'all') {
    pool = pool.filter(q => (q.subject || "Mechanical Engineering") === selectedSubject);
  }

  if (pool.length === 0) {
    alert("No questions found for the selected subject!");
    return;
  }

  if (weaknessFocus) {
    pool.sort((a, b) => {
      const aScore = a.status === 'needs_revision' ? 2 : (a.status === 'pending' ? 1 : 0);
      const bScore = b.status === 'needs_revision' ? 2 : (b.status === 'pending' ? 1 : 0);
      return bScore - aScore;
    });
  } else {
    pool.sort(() => Math.random() - 0.5);
  }

  mockTestQuestionsList = pool.slice(0, testSelectedQuestionCount);
  isMockTestActive = true;
  mockTestUserAttempts = {};
  testDurationSeconds = (isNaN(mins) || mins <= 0 ? 30 : mins) * 60;
  testRemainingSeconds = testDurationSeconds;
  testStartTime = Date.now();

  closeTestSetupModal();
  switchTab('practice');

  // Auto-activate Fullscreen Practice Mode for Real Exam Hall Feel!
  if (!isFullscreenMode) {
    toggleFullscreenPractice();
  }

  const banner = document.getElementById('test-live-timer-banner');
  if (banner) banner.classList.remove('hidden');

  const subjBannerEl = document.getElementById('test-banner-subject');
  if (subjBannerEl) subjBannerEl.innerText = selectedSubject === 'all' ? 'FULL SYLLABUS' : selectedSubject.toUpperCase();

  filteredPracticeQuestions = [...mockTestQuestionsList];
  currentPracticeIndex = 0;
  practiceViewMode = 'cards';
  loadPracticeQuestions();

  if (testTimerInterval) clearInterval(testTimerInterval);
  testTimerInterval = setInterval(updateTestTimerTick, 1000);
  updateTestTimerTick();
}

function updateTestTimerTick() {
  if (!isMockTestActive) return;

  if (testRemainingSeconds <= 0) {
    clearInterval(testTimerInterval);
    alert("⏰ Time is UP! Submitting your Mock Exam now.");
    submitMockTest();
    return;
  }

  testRemainingSeconds--;
  const m = Math.floor(testRemainingSeconds / 60);
  const s = testRemainingSeconds % 60;
  const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  const countdownEl = document.getElementById('test-live-countdown');
  if (countdownEl) {
    countdownEl.innerText = timeStr;
    if (testRemainingSeconds < 300) {
      countdownEl.className = "text-xl font-mono font-black text-rose-500 animate-pulse";
    } else {
      countdownEl.className = "text-xl font-mono font-black text-amber-400";
    }
  }

  const progressEl = document.getElementById('test-banner-progress');
  if (progressEl) {
    const answeredCount = Object.keys(mockTestUserAttempts).length;
    progressEl.innerText = `Question ${currentPracticeIndex + 1} of ${filteredPracticeQuestions.length} • ${answeredCount} Answered`;
  }
}

function submitMockTest() {
  if (!isMockTestActive) return;

  isMockTestActive = false;
  if (testTimerInterval) clearInterval(testTimerInterval);

  // Exit Fullscreen Mode upon test submission
  if (isFullscreenMode) {
    toggleFullscreenPractice();
  }

  const banner = document.getElementById('test-live-timer-banner');
  if (banner) banner.classList.add('hidden');

  const totalQs = mockTestQuestionsList.length;
  let correctCount = 0;
  let incorrectCount = 0;
  let skippedCount = 0;
  const weakTopicsMap = {};

  mockTestQuestionsList.forEach(q => {
    const attempt = mockTestUserAttempts[q.id];
    if (attempt && attempt.selectedIdx !== undefined) {
      if (attempt.isCorrect) {
        correctCount++;
      } else {
        incorrectCount++;
        const tName = `${q.subject || 'General'} - ${q.topic || 'General'}`;
        weakTopicsMap[tName] = (weakTopicsMap[tName] || 0) + 1;
      }
    } else {
      skippedCount++;
    }
  });

  const attemptedTotal = correctCount + incorrectCount;
  const accuracy = attemptedTotal > 0 ? Math.round((correctCount / attemptedTotal) * 100) : 0;
  const timeSpentSec = Math.round((Date.now() - testStartTime) / 1000);
  const minsSpent = Math.floor(timeSpentSec / 60);
  const secsSpent = timeSpentSec % 60;

  const subjSelect = document.getElementById('test-subject-select')?.value || 'all';
  if (document.getElementById('scorecard-subject-name')) {
    document.getElementById('scorecard-subject-name').innerText = `Subject: ${subjSelect === 'all' ? 'All Subjects (Full Syllabus)' : subjSelect}`;
  }
  if (document.getElementById('scorecard-accuracy')) {
    document.getElementById('scorecard-accuracy').innerText = `${accuracy}%`;
  }
  if (document.getElementById('scorecard-correct')) {
    document.getElementById('scorecard-correct').innerText = correctCount;
  }
  if (document.getElementById('scorecard-incorrect')) {
    document.getElementById('scorecard-incorrect').innerText = incorrectCount;
  }
  if (document.getElementById('scorecard-skipped')) {
    document.getElementById('scorecard-skipped').innerText = skippedCount;
  }
  if (document.getElementById('scorecard-time-taken')) {
    document.getElementById('scorecard-time-taken').innerText = `${minsSpent}m ${secsSpent}s`;
  }

  const weakListEl = document.getElementById('scorecard-weak-topics-list');
  if (weakListEl) {
    let suggestionsHtml = [];

    const weakTopicsArray = Object.keys(weakTopicsMap);
    if (weakTopicsArray.length > 0) {
      suggestionsHtml.push(...weakTopicsArray.map(t => `<div class="p-2.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-500/30 text-rose-700 dark:text-rose-300 font-bold flex items-center justify-between">
        <span>⚠️ <strong>${escapeHtml(t)}</strong>: You made ${weakTopicsMap[t]} mistake(s). Review core formulas & derivations!</span>
      </div>`));
    }

    if (skippedCount > 0) {
      suggestionsHtml.push(`<div class="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-500/30 text-amber-800 dark:text-amber-300 font-bold">
        ⏰ <strong>Skipped Questions (${skippedCount})</strong>: You left ${skippedCount} question(s) unattempted. Practice speed drills to improve exam pace.
      </div>`);
    }

    if (suggestionsHtml.length === 0) {
      suggestionsHtml.push(`<div class="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-extrabold text-sm text-center">
        🎉 Perfect Performance! 100% Accuracy with Zero Mistakes!
      </div>`);
    }

    weakListEl.innerHTML = suggestionsHtml.join('');
  }

  const breakdownEl = document.getElementById('scorecard-questions-breakdown');
  if (breakdownEl) {
    breakdownEl.innerHTML = mockTestQuestionsList.map((q, idx) => {
      const attempt = mockTestUserAttempts[q.id];
      let statusBadge = `<span class="bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black">⏰ Skipped</span>`;
      let userAnsText = `<span class="text-amber-600 font-extrabold">Skipped (Not Attempted)</span>`;

      if (attempt && attempt.selectedIdx !== undefined) {
        const selectedLetter = String.fromCharCode(65 + attempt.selectedIdx);
        if (attempt.isCorrect) {
          statusBadge = `<span class="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black">✓ Correct</span>`;
          userAnsText = `<span class="text-emerald-600 dark:text-emerald-400 font-extrabold">Option ${selectedLetter}: ${escapeHtml(q.options[attempt.selectedIdx] || '')}</span>`;
        } else {
          statusBadge = `<span class="bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black">✗ Incorrect</span>`;
          userAnsText = `<span class="text-rose-600 dark:text-rose-400 font-extrabold">Option ${selectedLetter}: ${escapeHtml(q.options[attempt.selectedIdx] || '')}</span>`;
        }
      }

      const correctLetter = String.fromCharCode(65 + q.correctAnswerIndex);
      const correctAnsText = `<span class="text-emerald-600 dark:text-emerald-400 font-extrabold">Option ${correctLetter}: ${escapeHtml(q.options[q.correctAnswerIndex] || '')}</span>`;
      const cleanSol = cleanExplanationDisplay(q.explanation);

      return `
        <div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3 shadow-sm text-left">
          <div class="flex items-center justify-between text-xs font-bold border-b border-slate-100 dark:border-zinc-800 pb-2">
            <span class="text-indigo-600 dark:text-indigo-400 font-black">Question ${idx + 1}. [${escapeHtml(q.subject || 'General')} → ${escapeHtml(q.topic || 'General')}]</span>
            ${statusBadge}
          </div>

          <div class="text-sm font-extrabold text-slate-900 dark:text-white leading-relaxed">${renderFormattedQuestionHTML(q.questionText)}</div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold pt-1">
            <div class="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
              <span class="text-slate-500 block text-[10px] uppercase">Your Selection:</span>
              ${userAnsText}
            </div>
            <div class="p-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10">
              <span class="text-emerald-600 dark:text-emerald-400 block text-[10px] uppercase">Correct Answer:</span>
              ${correctAnsText}
            </div>
          </div>

          ${generateSmartHinglishFallback(q)}
        </div>
      `;
    }).join('');
  }

  document.getElementById('modal-test-scorecard')?.classList.remove('hidden');
}

function closeTestScorecard() {
  document.getElementById('modal-test-scorecard')?.classList.add('hidden');
}

// ==========================================
// 🔍 DEDICATED TEST REVIEW MODAL MODULE
// ==========================================
let currentReviewFilter = 'incorrect';

function openTestReviewModal(defaultFilter = 'incorrect') {
  document.getElementById('modal-test-scorecard')?.classList.add('hidden');
  document.getElementById('modal-test-review-solutions')?.classList.remove('hidden');

  let incorrectCount = 0;
  let skippedCount = 0;
  let allCount = mockTestQuestionsList.length;

  mockTestQuestionsList.forEach(q => {
    const attempt = mockTestUserAttempts[q.id];
    if (attempt && attempt.selectedIdx !== undefined) {
      if (!attempt.isCorrect) incorrectCount++;
    } else {
      skippedCount++;
    }
  });

  if (document.getElementById('count-review-incorrect')) document.getElementById('count-review-incorrect').innerText = incorrectCount;
  if (document.getElementById('count-review-skipped')) document.getElementById('count-review-skipped').innerText = skippedCount;
  if (document.getElementById('count-review-all')) document.getElementById('count-review-all').innerText = allCount;

  if (incorrectCount === 0 && defaultFilter === 'incorrect') {
    defaultFilter = skippedCount > 0 ? 'skipped' : 'all';
  }

  filterReviewModalQuestions(defaultFilter);
}

function closeTestReviewModal() {
  document.getElementById('modal-test-review-solutions')?.classList.add('hidden');
  document.getElementById('modal-test-scorecard')?.classList.remove('hidden');
}

function filterReviewModalQuestions(filterType) {
  currentReviewFilter = filterType;

  ['incorrect', 'skipped', 'all'].forEach(f => {
    const btn = document.getElementById(`btn-review-filter-${f}`);
    if (btn) {
      if (f === filterType) {
        btn.className = "flex-1 py-2.5 rounded-xl text-xs font-black transition shadow-sm flex items-center justify-center space-x-1.5 " +
          (f === 'incorrect' ? 'bg-rose-600 text-white' : (f === 'skipped' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-indigo-600 text-white'));
      } else {
        btn.className = "flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition flex items-center justify-center space-x-1.5 hover:bg-slate-200 dark:hover:bg-zinc-800";
      }
    }
  });

  const container = document.getElementById('test-review-modal-questions-list');
  if (!container) return;

  let filtered = mockTestQuestionsList.filter(q => {
    const attempt = mockTestUserAttempts[q.id];
    if (filterType === 'incorrect') {
      return attempt && attempt.selectedIdx !== undefined && !attempt.isCorrect;
    } else if (filterType === 'skipped') {
      return !attempt || attempt.selectedIdx === undefined;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
        <div class="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto text-xl">
          <i class="fa-solid fa-circle-check"></i>
        </div>
        <h4 class="font-extrabold text-slate-900 dark:text-white text-base">No ${filterType.toUpperCase()} Questions Found</h4>
        <p class="text-xs text-slate-500 font-semibold">Great job! There are no questions in this category.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map((q, idx) => {
    const attempt = mockTestUserAttempts[q.id];
    let statusBadge = `<span class="bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black">⏰ Skipped</span>`;

    if (attempt && attempt.selectedIdx !== undefined) {
      if (attempt.isCorrect) {
        statusBadge = `<span class="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black">✓ Correct</span>`;
      } else {
        statusBadge = `<span class="bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black">✗ Incorrect</span>`;
      }
    }

    const optionsHtml = q.options.map((opt, oIdx) => {
      const isSelected = attempt && attempt.selectedIdx === oIdx;
      const isCorrectOpt = oIdx === q.correctAnswerIndex;

      let btnStyle = "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-300";
      let badge = "";

      if (isCorrectOpt) {
        btnStyle = "border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-950 dark:text-emerald-200 font-extrabold shadow-md shadow-emerald-500/20";
        badge = `<span class="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded text-[10px]">✓ Correct Answer</span>`;
      } else if (isSelected && !isCorrectOpt) {
        btnStyle = "border-2 border-rose-500 bg-rose-50 dark:bg-rose-950/80 text-rose-950 dark:text-rose-200 font-extrabold shadow-md shadow-rose-500/20";
        badge = `<span class="bg-rose-600 text-white font-bold px-2 py-0.5 rounded text-[10px]">✗ Your Selection (Wrong)</span>`;
      }

      return `
        <div class="p-3.5 rounded-xl border ${btnStyle} flex items-center justify-between text-xs font-bold transition">
          <div class="flex items-center space-x-2.5">
            <span class="w-6 h-6 rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-slate-200 font-black flex items-center justify-center text-xs">
              ${String.fromCharCode(65 + oIdx)}
            </span>
            <span class="font-extrabold">${formatSubSupScripts(escapeHtml(opt))}</span>
          </div>
          ${badge}
        </div>
      `;
    }).join('');

    const cleanSol = cleanExplanationDisplay(q.explanation);

    return `
      <div class="p-5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm text-left">
        <div class="flex items-center justify-between text-xs font-bold border-b border-slate-200 dark:border-zinc-800 pb-2.5">
          <div class="flex items-center space-x-2">
            <button onclick="toggleQuestionNoteInput('${q.id}')" class="text-xs bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-lg border border-amber-500/30 transition font-extrabold flex items-center space-x-1" title="Write Mistake Comment / Note">
              <i class="fa-solid fa-comment-dots text-amber-500"></i>
              <span>${q.userNote ? '✏️ Mistake Note' : '💬 Add Note'}</span>
            </button>
            <span class="text-indigo-600 dark:text-indigo-400 font-black">Question ${idx + 1} of ${filtered.length} • [${escapeHtml(q.subject || 'General')} → ${escapeHtml(q.topic || 'General')}]</span>
          </div>
          ${statusBadge}
        </div>

        <div class="text-sm font-black text-slate-900 dark:text-white leading-relaxed whitespace-pre-wrap">${renderFormattedQuestionHTML(q.questionText)}</div>

          <div id="note-box-${q.id}" class="${q.userNote ? '' : 'hidden'} p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-500/30 space-y-2 shadow-inner">
            <div class="flex items-center justify-between text-xs font-black text-amber-800 dark:text-amber-300">
              <span class="flex items-center space-x-1.5"><i class="fa-solid fa-sticky-note text-amber-500"></i><span>Note / Reflection:</span></span>
              <button onclick="saveQuestionNote('${q.id}')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1 rounded-lg text-xs font-black shadow-sm transition">Save Note</button>
            </div>
          <textarea id="note-input-${q.id}" rows="2" placeholder="✍️ Write what mistake you made here (e.g., Silly calculation error, forgot formula)..." class="w-full p-2.5 bg-white dark:bg-zinc-950 border border-amber-500/40 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500">${escapeHtml(q.userNote || '')}</textarea>
        </div>

        <div class="space-y-2">
          ${optionsHtml}
        </div>

        ${generateSmartHinglishFallback(q)}
      </div>
    `;
  }).join('');
}

function toggleQuestionNoteInput(qId) {
  const box = document.getElementById(`note-box-${qId}`);
  if (box) {
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden')) {
      document.getElementById(`note-input-${qId}`)?.focus();
    }
  }
}

async function saveQuestionNote(qId) {
  const input = document.getElementById(`note-input-${qId}`);
  if (!input) return;

  const noteText = input.value.trim();
  await QB.updateQuestionNote(qId, noteText);

  const q = currentQuestionsList.find(item => item.id === qId);
  if (q) q.userNote = noteText;

  alert("✓ Personal Mistake Note Saved Successfully!");
}

function reviewAllTestQuestionsInArena() {
  closeTestScorecard();
  isMockTestActive = false;
  filteredPracticeQuestions = [...mockTestQuestionsList];
  currentPracticeIndex = 0;
  switchTab('practice');
  togglePracticeViewMode('vertical');
}

async function updateStatsNumbersOnly() {
  currentQuestionsList = await QB.fetchQuestions(false);
  const total = currentQuestionsList.length;
  const pending = currentQuestionsList.filter(q => q.status === 'pending').length;
  const solved = currentQuestionsList.filter(q => q.status === 'solved').length;
  const revision = currentQuestionsList.filter(q => q.status === 'needs_revision').length;

  const reports = QB.getDailyReports();
  const totalUserAttempts = reports.reduce((acc, r) => acc + (r.attemptedCount || 0), 0);
  const attemptedCount = Math.max(solved + revision, totalUserAttempts);
  const accuracyPct = attemptedCount > 0 ? Math.round((solved / attemptedCount) * 100) : 0;

  const dangerZoneCount = currentQuestionsList.filter(q => (q.wrongAttemptsCount || 0) >= 2 || q.status === 'needs_revision').length;

  if (document.getElementById('stat-total')) document.getElementById('stat-total').innerText = total;
  if (document.getElementById('stat-attempted-total')) document.getElementById('stat-attempted-total').innerText = attemptedCount;
  if (document.getElementById('stat-solved')) document.getElementById('stat-solved').innerText = solved;
  if (document.getElementById('stat-revision')) document.getElementById('stat-revision').innerText = revision;
  if (document.getElementById('stat-accuracy')) document.getElementById('stat-accuracy').innerText = `${accuracyPct}%`;
  if (document.getElementById('stat-attempted-sub')) document.getElementById('stat-attempted-sub').innerText = `${attemptedCount} Attempted`;
  if (document.getElementById('stat-danger-count')) document.getElementById('stat-danger-count').innerText = dangerZoneCount;

  const today = new Date().toISOString().split('T')[0];
  const todayReport = reports.find(r => r.date === today) || { attemptedCount: 0, correctCount: 0, wrongCount: 0 };

  if (document.getElementById('today-attempted')) document.getElementById('today-attempted').innerText = todayReport.attemptedCount;
  if (document.getElementById('today-correct')) document.getElementById('today-correct').innerText = todayReport.correctCount;
  if (document.getElementById('today-wrong')) document.getElementById('today-wrong').innerText = todayReport.wrongCount;

  // WEEKLY ACTIVITY & MASTERY CALCULATION (LAST 7 DAYS)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const weeklyQuestions = currentQuestionsList.filter(q => {
    if (!q.createdAt) return true;
    return new Date(q.createdAt) >= sevenDaysAgo;
  });

  const weeklyAddedCount = weeklyQuestions.length;
  const weeklyKnownCount = weeklyQuestions.filter(q => q.status === 'solved').length;
  const weeklyUnknownCount = weeklyQuestions.filter(q => q.status !== 'solved').length;
  const weeklyMasteryPct = weeklyAddedCount > 0 ? Math.round((weeklyKnownCount / weeklyAddedCount) * 100) : 0;

  if (document.getElementById('weekly-added-count')) document.getElementById('weekly-added-count').innerText = weeklyAddedCount;
  if (document.getElementById('weekly-known-count')) document.getElementById('weekly-known-count').innerText = weeklyKnownCount;
  if (document.getElementById('weekly-unknown-count')) document.getElementById('weekly-unknown-count').innerText = weeklyUnknownCount;
  if (document.getElementById('weekly-mastery-rate')) document.getElementById('weekly-mastery-rate').innerText = `${weeklyMasteryPct}%`;

  initDailyChart();
  checkRevisionAlerts();
}

async function updateQuestionStatus(qId, status) {
  await QB.updateQuestionStatus(qId, status);
  await loadDashboardData();

  if (practiceViewMode === 'cards') loadPracticeQuestions();
  else if (practiceViewMode === 'vertical') renderVerticalQuestions();
  else renderQuestionsTable();
}

async function handlePdfUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById('pdf-status');
  statusEl.innerText = "Extracting text from PDF...";

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items.map(item => item.str);
      fullText += pageStrings.join(" ") + "\n";
    }

    statusEl.innerText = `Extracted text from ${pdf.numPages} pages. Parsing MCQs...`;
    const customSubject = getPdfSelectedSubject();
    const customTopic = getPdfSelectedTopic();
    const customSubfolder = document.getElementById('pdf-subfolder-input')?.value.trim() || "";

    parsedPdfQuestions = QB.parseTextToMCQs(fullText, "pdf");
    parsedPdfQuestions.forEach(q => {
      q.subject = customSubject;
      q.topic = customTopic;
      q.subfolder = customSubfolder;
    });
    renderParsedPreview();
  } catch (err) {
    console.error("PDF Parsing error:", err);
    statusEl.innerText = "Error extracting PDF text: " + err.message;
  }
}

function handleImageUpload(event) {
  const file = event.target.files[0];
  if (file) {
    processImageOCR(file);
  }
}

async function extractTextWithGeminiVision(fileOrBlob) {
  const firebaseCfg = QB.getFirebaseConfig();
  let userGeminiKey = (localStorage.getItem("qb_gemini_api_key") || "").trim();
  const keysToTry = [userGeminiKey, firebaseCfg.apiKey, "AIzaSyCw_eug46aDoSnluYLqFJE7ub89105s6k0"].filter(Boolean);

  if (keysToTry.length === 0) return null;

  try {
    const base64Data = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result || "";
        const base64 = result.split(',')[1] || "";
        resolve(base64);
      };
      reader.readAsDataURL(fileOrBlob);
    });

    const promptText = `You are a high-precision exam question parser.
Analyze this screenshot and extract ONLY the genuine Multiple Choice Question (MCQ).

CRITICAL STRICT RULES:
1. IGNORE browser tabs, URL bar, web page navigation bars, website headers, footer buttons, speed indicators, sidebars, and palette grid numbers completely.
2. Extract ONLY:
   - Question Statement
   - Option A
   - Option B
   - Option C
   - Option D
   - Correct Answer (if shown)
   - Detailed Solution (if shown)

Format output strictly as:
Question 1: [Exact Question Statement]
A) [Option A text]
B) [Option B text]
C) [Option C text]
D) [Option D text]
Answer: Option [A/B/C/D]
Solution: [Solution text]`;

    for (const apiKey of keysToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: promptText },
                {
                  inline_data: {
                    mime_type: fileOrBlob.type || "image/jpeg",
                    data: base64Data
                  }
                }
              ]
            }]
          })
        });

        const data = await res.json();
        if (data.error) continue;

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } catch (e) {}
    }
  } catch (err) {}
  return null;
}

function createOptimizedImageForOCR(fileOrBlob) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(fileOrBlob);
    img.onload = () => {
      const maxDim = 1000;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        resolve(blob || fileOrBlob);
      }, "image/jpeg", 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(fileOrBlob);
    };
    img.src = url;
  });
}

async function processImageOCR(fileOrBlob) {
  const statusEl = document.getElementById('image-ocr-status');
  const previewImg = document.getElementById('image-preview-thumb');

  if (statusEl) statusEl.innerHTML = `<span class="text-indigo-600 dark:text-indigo-400 font-bold"><i class="fa-solid fa-bolt text-amber-500 animate-pulse"></i> Reading Image...</span>`;

  if (previewImg && fileOrBlob) {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewImg.classList.remove('hidden');
    };
    reader.readAsDataURL(fileOrBlob);
  }

  try {
    if (statusEl) statusEl.innerHTML = `<span class="text-indigo-600 dark:text-indigo-400 font-bold"><i class="fa-solid fa-bolt text-amber-500 animate-pulse"></i> Ultra-Fast AI Scanning Image OCR...</span>`;

    // 1. Ultra-Fast High-Precision Gemini Vision AI (0.8s)
    let ocrText = await extractTextWithGeminiVision(fileOrBlob);

    // 2. Fallback to Optimized Tesseract Canvas OCR
    if (!ocrText) {
      if (typeof Tesseract === 'undefined') {
        if (statusEl) statusEl.innerHTML = `<span class="text-rose-500 font-bold">⚠️ OCR Engine loading... Please try again.</span>`;
        return;
      }

      const optimizedBlob = await createOptimizedImageForOCR(fileOrBlob);
      const result = await Tesseract.recognize(optimizedBlob, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text' && statusEl) {
            const pct = Math.round((m.progress || 0) * 100);
            statusEl.innerHTML = `<span class="text-indigo-600 dark:text-indigo-400 font-bold"><i class="fa-solid fa-spinner animate-spin"></i> Scanning Image OCR: ${pct}%</span>`;
          }
        }
      });
      ocrText = result.data.text || "";
    }

    if (!ocrText || !ocrText.trim()) {
      if (statusEl) statusEl.innerHTML = `<span class="text-rose-500 font-bold">⚠️ No readable text found in image. Please try a clearer screenshot.</span>`;
      return;
    }

    if (statusEl) statusEl.innerHTML = `<span class="text-emerald-500 font-bold">⚡ Image Text Extracted Instantly! Parsing MCQs...</span>`;

    const customSubject = getPdfSelectedSubject();
    const customTopic = getPdfSelectedTopic();
    const customSubfolder = document.getElementById('pdf-subfolder-input')?.value.trim() || "";

    const newParsed = QB.parseTextToMCQs(ocrText, "ocr");
    newParsed.forEach(q => {
      q.subject = customSubject;
      q.topic = customTopic;
      q.subfolder = customSubfolder;
    });

    parsedPdfQuestions = [...parsedPdfQuestions, ...newParsed];
    renderParsedPreview();
  } catch (err) {
    console.error("OCR Processing error:", err);
    if (statusEl) statusEl.innerHTML = `<span class="text-rose-500 font-bold">⚠️ Error reading image text: ${escapeHtml(err.message)}</span>`;
  }
}

function parseRawText() {
  const rawText = document.getElementById('raw-text-input')?.value || '';
  if (!rawText.trim()) return;

  const customSubject = getPdfSelectedSubject();
  const customTopic = getPdfSelectedTopic();
  const customSubfolder = document.getElementById('pdf-subfolder-input')?.value.trim() || "";

  parsedPdfQuestions = QB.parseTextToMCQs(rawText, "manual");
  parsedPdfQuestions.forEach(q => {
    q.subject = customSubject;
    q.topic = customTopic;
    q.subfolder = customSubfolder;
  });
  renderParsedPreview();
}

function renderParsedPreview() {
  const container = document.getElementById('pdf-parsed-preview');
  const list = document.getElementById('parsed-questions-list');
  const countEl = document.getElementById('parsed-count');

  if (!container || !list) return;

  countEl.innerText = parsedPdfQuestions.length;
  container.classList.remove('hidden');

  list.innerHTML = parsedPdfQuestions.map((q, idx) => `
    <div class="bg-slate-100 dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2">
      <div class="flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 font-bold">
        <span>Question ${idx + 1} • Folder: [${escapeHtml(q.subject)} → ${escapeHtml(q.topic)}${q.subfolder ? ' → ' + escapeHtml(q.subfolder) : ''}]</span>
        <span>Correct Answer: Option ${String.fromCharCode(65 + q.correctAnswerIndex)}</span>
      </div>
      <p class="text-sm font-extrabold text-slate-900 dark:text-white">${renderFormattedQuestionHTML(q.questionText)}</p>
      <div class="grid grid-cols-2 gap-2 text-xs text-slate-900 dark:text-slate-300 font-bold pt-1">
        ${q.options.map((opt, oIdx) => `<div class="bg-white dark:bg-black p-2 rounded-lg border border-slate-200 dark:border-zinc-800">${String.fromCharCode(65 + oIdx)}) ${formatSubSupScripts(escapeHtml(opt))}</div>`).join('')}
      </div>
      <p class="text-xs text-slate-600 dark:text-slate-400 italic pt-1">Solution: ${formatSubSupScripts(escapeHtml(q.explanation))}</p>
    </div>
  `).join('');
}

async function saveAllParsedQuestions() {
  if (parsedPdfQuestions.length === 0) return;
  for (const q of parsedPdfQuestions) {
    await QB.saveQuestion(q);
  }
  alert(`Successfully saved ${parsedPdfQuestions.length} questions to database!`);
  parsedPdfQuestions = [];
  document.getElementById('pdf-parsed-preview').classList.add('hidden');
  await loadDashboardData();
  switchTab('dashboard');
}

function populatePdfExtractorDropdowns() {
  const subjSelect = document.getElementById('pdf-subject-select');
  const topicSelect = document.getElementById('pdf-topic-select');
  if (!subjSelect || !topicSelect) return;

  const subjects = Array.from(new Set(currentQuestionsList.map(q => q.subject || 'Mechanical Engineering')));
  if (!subjects.includes("Mechanical Engineering")) subjects.unshift("Mechanical Engineering");

  subjSelect.innerHTML = subjects.map(s => `<option value="${escapeHtml(s)}">📁 ${escapeHtml(s)}</option>`).join('') +
    `<option value="__NEW_SUBJECT__">➕ Create New Subject...</option>`;

  const activeSubj = subjSelect.value === '__NEW_SUBJECT__' ? 'Mechanical Engineering' : subjSelect.value;
  onPdfSubjectSelectChange(activeSubj);
}

function onPdfSubjectSelectChange(presetTopic = null) {
  const subjSelect = document.getElementById('pdf-subject-select');
  const customSubj = document.getElementById('pdf-subject-input');
  const topicSelect = document.getElementById('pdf-topic-select');
  const customTopic = document.getElementById('pdf-topic-input');

  if (!subjSelect || !topicSelect) return;

  const selectedSubj = subjSelect.value;

  if (selectedSubj === '__NEW_SUBJECT__') {
    if (customSubj) customSubj.classList.remove('hidden');
    topicSelect.innerHTML = `<option value="__NEW_TOPIC__">➕ Create New Topic...</option>`;
    onPdfTopicSelectChange();
    return;
  } else {
    if (customSubj) customSubj.classList.add('hidden');
  }

  const matching = currentQuestionsList.filter(q => (q.subject || 'Mechanical Engineering') === selectedSubj);
  const topics = Array.from(new Set(matching.map(q => q.topic || 'Fluid Mechanics')));
  if (!topics.includes("Fluid Mechanics")) topics.push("Fluid Mechanics");
  if (!topics.includes("Engineering Mechanics")) topics.push("Engineering Mechanics");

  topicSelect.innerHTML = topics.map(t => `<option value="${escapeHtml(t)}">📂 ${escapeHtml(t)}</option>`).join('') +
    `<option value="__NEW_TOPIC__">➕ Create New Topic...</option>`;

  if (presetTopic && topics.includes(presetTopic)) {
    topicSelect.value = presetTopic;
  } else if (topics.length > 0) {
    topicSelect.value = topics[0];
  }
  onPdfTopicSelectChange();
}

function onPdfTopicSelectChange() {
  const topicSelect = document.getElementById('pdf-topic-select');
  const customTopic = document.getElementById('pdf-topic-input');
  if (!topicSelect || !customTopic) return;

  if (topicSelect.value === '__NEW_TOPIC__') {
    customTopic.classList.remove('hidden');
  } else {
    customTopic.classList.add('hidden');
  }
}

function getPdfSelectedSubject() {
  const subjSelect = document.getElementById('pdf-subject-select');
  const customSubj = document.getElementById('pdf-subject-input');
  if (subjSelect && subjSelect.value === '__NEW_SUBJECT__') {
    return customSubj ? customSubj.value.trim() || 'Mechanical Engineering' : 'Mechanical Engineering';
  }
  return subjSelect ? subjSelect.value : 'Mechanical Engineering';
}

function getPdfSelectedTopic() {
  const topicSelect = document.getElementById('pdf-topic-select');
  const customTopic = document.getElementById('pdf-topic-input');
  if (topicSelect && topicSelect.value === '__NEW_TOPIC__') {
    return customTopic ? customTopic.value.trim() || 'Engineering Mechanics' : 'Engineering Mechanics';
  }
  return topicSelect ? topicSelect.value : 'Engineering Mechanics';
}

function renderDecks() {
  const grid = document.getElementById('decks-grid');
  if (!grid) return;

  const subjFilter = document.getElementById('deck-filter-subject')?.value || 'all';
  const topicFilter = document.getElementById('deck-filter-topic')?.value || 'all';
  const searchQuery = document.getElementById('deck-search-input')?.value.toLowerCase().trim() || "";

  let decks = QB.getDecks();

  if (subjFilter !== 'all') {
    decks = decks.filter(d => (d.subject || 'Mechanical Engineering') === subjFilter);
  }
  if (topicFilter !== 'all') {
    decks = decks.filter(d => (d.topic || 'Fluid Mechanics') === topicFilter);
  }
  if (searchQuery) {
    decks = decks.filter(d => 
      (d.title || '').toLowerCase().includes(searchQuery) ||
      (d.subject || '').toLowerCase().includes(searchQuery) ||
      (d.topic || '').toLowerCase().includes(searchQuery)
    );
  }

  if (decks.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full glass p-8 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center space-y-3 bg-white dark:bg-zinc-950">
        <i class="fa-solid fa-layer-group text-4xl text-violet-500"></i>
        <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">No Study Decks Found</h3>
        <p class="text-xs font-semibold text-slate-500 dark:text-slate-400">Click "Create Deck from Notes" above to add flashcards for this topic!</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = decks.map(d => `
    <div class="glass p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-4 flex flex-col justify-between bg-white dark:bg-zinc-900 shadow-sm hover:border-violet-500/50 transition">
      <div>
        <div class="flex items-center justify-between text-xs font-bold mb-2">
          <span class="text-amber-600 dark:text-amber-400">📁 ${escapeHtml(d.subject || 'General')}</span>
          <span class="bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300 font-mono text-[10px] px-2 py-0.5 rounded-full border border-violet-300 dark:border-violet-800/40">${d.cards ? d.cards.length : 0} Cards</span>
        </div>
        <div class="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">📂 ${escapeHtml(d.topic || 'General Topic')}</div>
        <h3 class="font-black text-base text-slate-900 dark:text-white leading-tight">${escapeHtml(d.title)}</h3>
      </div>

      <div class="card-flip cursor-pointer h-36 my-1" onclick="flipDeckCard(this)">
        <div class="card-inner w-full h-full relative rounded-xl border border-violet-500/30 bg-violet-50 dark:bg-violet-950/20 p-4 flex items-center justify-center text-center">
          <div class="card-front text-sm font-extrabold text-slate-900 dark:text-slate-200">
            ${formatSubSupScripts(escapeHtml(d.cards && d.cards[0] ? d.cards[0].front : 'Empty Flashcard'))}
            <div class="text-xs text-violet-600 dark:text-violet-400 font-semibold mt-2">Click to flip answer</div>
          </div>
          <div class="card-back absolute inset-0 rounded-xl bg-white dark:bg-zinc-900 p-4 flex items-center justify-center text-xs text-slate-900 dark:text-slate-300 font-bold leading-relaxed overflow-y-auto border border-slate-200 dark:border-zinc-800">
            ${formatSubSupScripts(escapeHtml(d.cards && d.cards[0] ? d.cards[0].back : 'No Answer'))}
          </div>
        </div>
      </div>

      <div class="space-y-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
        <div class="grid grid-cols-2 gap-2">
          <button onclick="openEditDeckModal('${d.id}')" class="py-1.5 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-900 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-300 dark:border-zinc-700 transition flex items-center justify-center space-x-1">
            <i class="fa-solid fa-pen-to-square"></i>
            <span>Edit</span>
          </button>
          <button onclick="deleteDeck('${d.id}')" class="py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white rounded-xl text-xs font-bold border border-rose-500/30 transition flex items-center justify-center space-x-1">
            <i class="fa-solid fa-trash-can"></i>
            <span>Delete</span>
          </button>
        </div>

        <button onclick="alert('Deck Review mode initiated for: ${escapeHtml(d.title)}')" class="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-extrabold transition shadow-sm">
          Review Full Deck (${d.cards ? d.cards.length : 0})
        </button>
      </div>
    </div>
  `).join('');
}

function flipDeckCard(el) {
  const inner = el.querySelector('.card-inner');
  if (inner) inner.classList.toggle('flipped');
}

function openCreateDeckModal() {
  const subjSelect = document.getElementById('create-deck-subject');
  const customSubj = document.getElementById('create-deck-subject-custom');
  if (!subjSelect) return;

  const subjects = Array.from(new Set(currentQuestionsList.map(q => q.subject || 'Mechanical Engineering')));

  subjSelect.innerHTML = subjects.map(s => `<option value="${escapeHtml(s)}">📁 ${escapeHtml(s)}</option>`).join('') +
    `<option value="__NEW_SUBJECT__">➕ Create New Subject...</option>`;

  if (subjects.length > 0) {
    subjSelect.value = subjects[0];
    customSubj.classList.add('hidden');
  } else {
    subjSelect.value = "__NEW_SUBJECT__";
    customSubj.classList.remove('hidden');
  }

  onCreateDeckSubjectChange();

  document.getElementById('create-deck-title').value = "";
  document.getElementById('create-deck-front').value = "";
  document.getElementById('create-deck-back').value = "";

  document.getElementById('modal-create-deck').classList.remove('hidden');
}

function onCreateDeckSubjectChange() {
  const subjSelect = document.getElementById('create-deck-subject');
  const customSubj = document.getElementById('create-deck-subject-custom');
  const topicSelect = document.getElementById('create-deck-topic');
  if (!subjSelect || !topicSelect) return;

  const selectedSubj = subjSelect.value;

  if (selectedSubj === '__NEW_SUBJECT__') {
    customSubj.classList.remove('hidden');
    topicSelect.innerHTML = `<option value="__NEW_TOPIC__">➕ Create New Topic...</option>`;
    onCreateDeckTopicChange();
    return;
  } else {
    customSubj.classList.add('hidden');
  }

  const matchingQuestions = currentQuestionsList.filter(item => (item.subject || 'Mechanical Engineering') === selectedSubj);
  const topics = Array.from(new Set(matchingQuestions.map(item => item.topic || 'Fluid Mechanics')));

  topicSelect.innerHTML = topics.map(t => `<option value="${escapeHtml(t)}">📂 ${escapeHtml(t)}</option>`).join('') +
    `<option value="__NEW_TOPIC__">➕ Create New Topic...</option>`;

  if (topics.length > 0) topicSelect.value = topics[0];
  else topicSelect.value = "__NEW_TOPIC__";

  onCreateDeckTopicChange();
}

function onCreateDeckTopicChange() {
  const topicSelect = document.getElementById('create-deck-topic');
  const customTopic = document.getElementById('create-deck-topic-custom');
  if (!topicSelect) return;

  if (topicSelect.value === '__NEW_TOPIC__') {
    customTopic.classList.remove('hidden');
  } else {
    customTopic.classList.add('hidden');
  }
}

function closeCreateDeckModal() {
  document.getElementById('modal-create-deck').classList.add('hidden');
}

function saveCreateDeckModal() {
  const subjSelect = document.getElementById('create-deck-subject');
  const customSubj = document.getElementById('create-deck-subject-custom');
  const topicSelect = document.getElementById('create-deck-topic');
  const customTopic = document.getElementById('create-deck-topic-custom');
  const title = document.getElementById('create-deck-title').value.trim();
  const front = document.getElementById('create-deck-front').value.trim();
  const back = document.getElementById('create-deck-back').value.trim();

  let finalSubj = subjSelect.value === '__NEW_SUBJECT__' ? customSubj.value.trim() : subjSelect.value;
  let finalTopic = topicSelect.value === '__NEW_TOPIC__' ? customTopic.value.trim() : topicSelect.value;

  if (!title || !front || !back) {
    alert("Please fill in Title, Flashcard Front, and Flashcard Back.");
    return;
  }

  const newDeck = {
    id: "deck_" + Date.now(),
    title: title,
    subject: finalSubj || "General Subject",
    topic: finalTopic || "General Topic",
    createdAt: new Date().toISOString(),
    cards: [{ front, back }]
  };

  QB.saveDeck(newDeck);
  closeCreateDeckModal();
  updateDeckDropdowns();
  renderDecks();
}

function openEditDeckModal(deckId) {
  const decks = QB.getDecks();
  const d = decks.find(item => item.id === deckId);
  if (!d) return;

  document.getElementById('edit-deck-id').value = d.id;
  document.getElementById('edit-deck-title').value = d.title || "";
  document.getElementById('edit-deck-front').value = d.cards && d.cards[0] ? d.cards[0].front : "";
  document.getElementById('edit-deck-back').value = d.cards && d.cards[0] ? d.cards[0].back : "";

  const subjSelect = document.getElementById('edit-deck-subject');
  const subjects = Array.from(new Set(currentQuestionsList.map(q => q.subject || 'Mechanical Engineering')));

  subjSelect.innerHTML = subjects.map(s => `<option value="${escapeHtml(s)}">📁 ${escapeHtml(s)}</option>`).join('') +
    `<option value="__NEW_SUBJECT__">➕ Create New Subject...</option>`;

  const currentSubj = d.subject || "Mechanical Engineering";
  if (subjects.includes(currentSubj)) subjSelect.value = currentSubj;
  else subjSelect.value = "__NEW_SUBJECT__";

  onEditDeckSubjectChange(d.topic);

  document.getElementById('modal-edit-deck').classList.remove('hidden');
}

function onEditDeckSubjectChange(targetTopic = null) {
  const subjSelect = document.getElementById('edit-deck-subject');
  const customSubj = document.getElementById('edit-deck-subject-custom');
  const topicSelect = document.getElementById('edit-deck-topic');
  if (!subjSelect || !topicSelect) return;

  const selectedSubj = subjSelect.value;

  if (selectedSubj === '__NEW_SUBJECT__') {
    customSubj.classList.remove('hidden');
    topicSelect.innerHTML = `<option value="__NEW_TOPIC__">➕ Create New Topic...</option>`;
    onEditDeckTopicChange();
    return;
  } else {
    customSubj.classList.add('hidden');
  }

  const matchingQuestions = currentQuestionsList.filter(item => (item.subject || 'Mechanical Engineering') === selectedSubj);
  const topics = Array.from(new Set(matchingQuestions.map(item => item.topic || 'Fluid Mechanics')));

  topicSelect.innerHTML = topics.map(t => `<option value="${escapeHtml(t)}">📂 ${escapeHtml(t)}</option>`).join('') +
    `<option value="__NEW_TOPIC__">➕ Create New Topic...</option>`;

  if (targetTopic && topics.includes(targetTopic)) {
    topicSelect.value = targetTopic;
  } else if (topics.length > 0) {
    topicSelect.value = topics[0];
  } else {
    topicSelect.value = "__NEW_TOPIC__";
  }

  onEditDeckTopicChange();
}

function onEditDeckTopicChange() {
  const topicSelect = document.getElementById('edit-deck-topic');
  const customTopic = document.getElementById('edit-deck-topic-custom');
  if (!topicSelect) return;

  if (topicSelect.value === '__NEW_TOPIC__') {
    customTopic.classList.remove('hidden');
  } else {
    customTopic.classList.add('hidden');
  }
}

function closeEditDeckModal() {
  document.getElementById('modal-edit-deck').classList.add('hidden');
}

function saveEditDeckModal() {
  const dId = document.getElementById('edit-deck-id').value;
  const subjSelect = document.getElementById('edit-deck-subject');
  const customSubj = document.getElementById('edit-deck-subject-custom');
  const topicSelect = document.getElementById('edit-deck-topic');
  const customTopic = document.getElementById('edit-deck-topic-custom');
  const title = document.getElementById('edit-deck-title').value.trim();
  const front = document.getElementById('edit-deck-front').value.trim();
  const back = document.getElementById('edit-deck-back').value.trim();

  let finalSubj = subjSelect.value === '__NEW_SUBJECT__' ? customSubj.value.trim() : subjSelect.value;
  let finalTopic = topicSelect.value === '__NEW_TOPIC__' ? customTopic.value.trim() : topicSelect.value;

  const decks = QB.getDecks();
  const d = decks.find(item => item.id === dId);
  if (d) {
    d.title = title || d.title;
    d.subject = finalSubj || d.subject;
    d.topic = finalTopic || d.topic;
    d.cards = [{ front, back }];
    QB.saveDeck(d);
  }

  closeEditDeckModal();
  updateDeckDropdowns();
  renderDecks();
}

function deleteDeck(deckId) {
  if (confirm("Permanently erase this Study Deck and its flashcards?")) {
    QB.deleteDeck(deckId);
    updateDeckDropdowns();
    renderDecks();
  }
}

let subjectChartInstance = null;
let donutChartInstance = null;

function initDailyChart() {
  initSubjectBreakdownChart();
  initOverallDonutChart();
}

function updateChartSubjectDropdown() {
  const select = document.getElementById('chart-subject-filter');
  if (!select) return;

  const currentVal = select.value || 'all';
  const subjects = Array.from(new Set(currentQuestionsList.map(q => q.subject || 'Mechanical Engineering').filter(Boolean)));

  select.innerHTML = `<option value="all">📁 All Subjects Overview</option>` +
    subjects.map(s => `<option value="${escapeHtml(s)}">📁 ${escapeHtml(s)}</option>`).join('');

  if (subjects.includes(currentVal)) {
    select.value = currentVal;
  } else {
    select.value = 'all';
  }
}

function initSubjectBreakdownChart() {
  const ctx = document.getElementById('subjectBreakdownChart')?.getContext('2d');
  if (!ctx) return;

  updateChartSubjectDropdown();

  const selectedSubject = document.getElementById('chart-subject-filter')?.value || 'all';
  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#ffffff' : '#0f172a';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';

  const titleEl = document.getElementById('chart-title-text');
  const subTitleEl = document.getElementById('chart-subtitle-text');

  let labels = [];
  let solvedData = [];
  let revisionData = [];
  let pendingData = [];

  const subjectsMap = {};
  currentQuestionsList.forEach(q => {
    const sName = q.subject || "Mechanical Engineering";
    if (!subjectsMap[sName]) subjectsMap[sName] = { solved: 0, revision: 0, pending: 0 };
    if (q.status === 'solved') subjectsMap[sName].solved++;
    else if (q.status === 'needs_revision') subjectsMap[sName].revision++;
    else subjectsMap[sName].pending++;
  });

  if (selectedSubject === 'all') {
    if (titleEl) titleEl.innerText = "All Subjects Breakdown & Mastery Progress";
    if (subTitleEl) subTitleEl.innerText = "Comparing solved, revision, and pending questions across all subjects";

    labels = Object.keys(subjectsMap);
    solvedData = labels.map(s => subjectsMap[s].solved);
    revisionData = labels.map(s => subjectsMap[s].revision);
    pendingData = labels.map(s => subjectsMap[s].pending);
  } else {
    if (titleEl) titleEl.innerText = `${selectedSubject} - Topic Breakdown`;
    if (subTitleEl) subTitleEl.innerText = `Topic-wise distribution of questions inside ${selectedSubject}`;

    const filtered = currentQuestionsList.filter(q => (q.subject || "Mechanical Engineering") === selectedSubject);
    const topicsMap = {};
    filtered.forEach(q => {
      const tName = q.topic || "General Topic";
      if (!topicsMap[tName]) topicsMap[tName] = { solved: 0, revision: 0, pending: 0 };
      if (q.status === 'solved') topicsMap[tName].solved++;
      else if (q.status === 'needs_revision') topicsMap[tName].revision++;
      else topicsMap[tName].pending++;
    });

    labels = Object.keys(topicsMap);
    solvedData = labels.map(t => topicsMap[t].solved);
    revisionData = labels.map(t => topicsMap[t].revision);
    pendingData = labels.map(t => topicsMap[t].pending);
  }

  if (subjectChartInstance) subjectChartInstance.destroy();

  subjectChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['No Questions'],
      datasets: [
        {
          label: '✓ Solved (Mastered)',
          data: solvedData.length ? solvedData : [0],
          backgroundColor: '#10b981',
          borderRadius: 6
        },
        {
          label: '✗ Needs Revision',
          data: revisionData.length ? revisionData : [0],
          backgroundColor: '#f43f5e',
          borderRadius: 6
        },
        {
          label: '⏰ Pending / Unattempted',
          data: pendingData.length ? pendingData : [0],
          backgroundColor: '#f59e0b',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font: { weight: 'bold', size: 11 } } }
      },
      scales: {
        x: { ticks: { color: textColor, font: { weight: 'bold' } }, grid: { color: gridColor } },
        y: { ticks: { color: textColor, font: { weight: 'bold' }, stepSize: 1 }, grid: { color: gridColor }, beginAtZero: true }
      }
    }
  });

  let strongestSubj = "N/A";
  let highestRatio = -1;
  let weakestSubj = "N/A";
  let highestRevision = -1;

  labels.forEach(sName => {
    const s = subjectsMap[sName];
    const total = s.solved + s.revision + s.pending;
    const ratio = total > 0 ? (s.solved / total) : 0;
    if (ratio > highestRatio && s.solved > 0) {
      highestRatio = ratio;
      strongestSubj = `${sName} (${Math.round(ratio * 100)}%)`;
    }
    if (s.revision > highestRevision) {
      highestRevision = s.revision;
      weakestSubj = `${sName} (${s.revision} Rev)`;
    }
  });

  if (document.getElementById('insight-strongest-subject')) {
    document.getElementById('insight-strongest-subject').innerText = strongestSubj !== "N/A" ? strongestSubj : "None Solved";
  }
  if (document.getElementById('insight-weakest-subject')) {
    document.getElementById('insight-weakest-subject').innerText = weakestSubj !== "N/A" ? weakestSubj : "None Due";
  }
}

function initOverallDonutChart() {
  const ctx = document.getElementById('overallDonutChart')?.getContext('2d');
  if (!ctx) return;

  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#ffffff' : '#0f172a';

  const solved = currentQuestionsList.filter(q => q.status === 'solved').length;
  const revision = currentQuestionsList.filter(q => q.status === 'needs_revision').length;
  const pending = currentQuestionsList.filter(q => q.status === 'pending').length;

  if (donutChartInstance) donutChartInstance.destroy();

  donutChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Solved', 'Revision', 'Pending'],
      datasets: [{
        data: [solved, revision, pending],
        backgroundColor: ['#10b981', '#f43f5e', '#f59e0b'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: textColor, font: { weight: 'bold', size: 10 } }
        }
      },
      cutout: '70%'
    }
  });
}

function openConfigModal() {
  const cfg = QB.getFirebaseConfig();
  document.getElementById('cfg-project-id').value = cfg.projectId || '';
  document.getElementById('cfg-api-key').value = cfg.apiKey || '';
  document.getElementById('cfg-gemini-key').value = localStorage.getItem('qb_gemini_api_key') || '';

  const savedDDay = localStorage.getItem("qb_dday_config");
  let ddayCfg = { title: "RRB ALP CBT-1", date: "" };
  if (savedDDay) {
    try { ddayCfg = JSON.parse(savedDDay); } catch(e){}
  }
  if (document.getElementById('cfg-dday-title')) {
    document.getElementById('cfg-dday-title').value = ddayCfg.title || "RRB ALP CBT-1";
  }
  if (document.getElementById('cfg-dday-date') && ddayCfg.date) {
    const d = new Date(ddayCfg.date);
    const isoLocal = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    document.getElementById('cfg-dday-date').value = isoLocal;
  }

  document.getElementById('modal-config').classList.remove('hidden');
}

function closeConfigModal() {
  document.getElementById('modal-config').classList.add('hidden');
}

function saveConfigFromModal() {
  const projectId = document.getElementById('cfg-project-id').value.trim();
  const apiKey = document.getElementById('cfg-api-key').value.trim();
  const geminiKey = document.getElementById('cfg-gemini-key').value.trim();

  QB.saveFirebaseConfig({ projectId, apiKey });
  if (geminiKey) {
    localStorage.setItem('qb_gemini_api_key', geminiKey);
  }

  const ddayTitle = document.getElementById('cfg-dday-title')?.value.trim() || "RRB ALP CBT-1";
  const ddayDateVal = document.getElementById('cfg-dday-date')?.value;
  if (ddayDateVal) {
    const ddayDateIso = new Date(ddayDateVal).toISOString();
    localStorage.setItem("qb_dday_config", JSON.stringify({ title: ddayTitle, date: ddayDateIso }));
    initDDayTimer();
  }

  closeConfigModal();
  alert("Settings, D-Day & API Configurations Saved Successfully! ✨");
  loadDashboardData();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, match => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[match];
  });
}

// D-DAY EXAM COUNTDOWN TIMER ENGINE
let ddayInterval = null;

function initDDayTimer() {
  const saved = localStorage.getItem("qb_dday_config");
  let cfg = { title: "RRB ALP CBT-1", date: null };

  if (saved) {
    try { cfg = JSON.parse(saved); } catch(e){}
  }

  if (!cfg.date) {
    // Default: Target date set to 75 Days from today!
    const targetMs = Date.now() + (75 * 24 * 60 * 60 * 1000);
    cfg.date = new Date(targetMs).toISOString();
    localStorage.setItem("qb_dday_config", JSON.stringify(cfg));
  }

  updateDDayTimerDisplay(cfg);

  if (ddayInterval) clearInterval(ddayInterval);
  ddayInterval = setInterval(() => {
    updateDDayTimerDisplay(cfg);
  }, 1000);
}

function updateDDayTimerDisplay(cfg) {
  const labelEl = document.getElementById("dday-exam-label");
  const displayEl = document.getElementById("dday-timer-display");
  if (!displayEl) return;

  if (labelEl) {
    labelEl.innerHTML = `<span>🎯 ${escapeHtml(cfg.title || 'D-Day Exam')}</span> <i class="fa-solid fa-pen text-[9px] opacity-70 group-hover:opacity-100"></i>`;
  }

  const targetTime = new Date(cfg.date).getTime();
  const now = Date.now();
  const diff = targetTime - now;

  if (diff <= 0) {
    displayEl.innerHTML = `🎉 <span class="text-emerald-500 font-extrabold animate-pulse">D-Day is Today! Best of luck!</span>`;
    return;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  const secs = Math.floor((diff / 1000) % 60);

  const pad = n => String(n).padStart(2, '0');
  displayEl.innerHTML = `⏳ <span class="text-amber-500 font-mono font-black">${days}d</span> ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;
}

function openDDaySetupModal() {
  const saved = localStorage.getItem("qb_dday_config");
  let cfg = { title: "RRB ALP CBT-1", date: "" };
  if (saved) {
    try { cfg = JSON.parse(saved); } catch(e){}
  }

  document.getElementById("dday-inp-title").value = cfg.title || "RRB ALP CBT-1";

  if (cfg.date) {
    const d = new Date(cfg.date);
    const isoLocal = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    document.getElementById("dday-inp-date").value = isoLocal;
  }

  document.getElementById("modal-dday-setup")?.classList.remove("hidden");
}

function closeDDaySetupModal() {
  document.getElementById("modal-dday-setup")?.classList.add("hidden");
}

function saveDDayConfigModal() {
  const title = document.getElementById("dday-inp-title").value.trim() || "D-Day Exam";
  const dateVal = document.getElementById("dday-inp-date").value;

  if (!dateVal) {
    alert("Please choose a valid D-Day Target Date.");
    return;
  }

  const dateIso = new Date(dateVal).toISOString();
  const cfg = { title, date: dateIso };
  localStorage.setItem("qb_dday_config", JSON.stringify(cfg));

  initDDayTimer();
  closeDDaySetupModal();
}

// LECTURE SCREENSHOTS & PDF EXPORTER ENGINE
window.renderScreenshotNotes = renderScreenshotNotes;
window.onNotesSubjectFilterChange = onNotesSubjectFilterChange;
window.onNotesTopicFilterChange = onNotesTopicFilterChange;
window.handleScreenshotUpload = handleScreenshotUpload;
window.deleteScreenshotNote = deleteScreenshotNote;
window.exportLectureNotesPDF = exportLectureNotesPDF;

function renderScreenshotNotes() {
  const grid = document.getElementById('notes-screenshots-grid');
  const subjSelect = document.getElementById('notes-filter-subject');
  const topicSelect = document.getElementById('notes-filter-topic');
  if (!grid || !subjSelect || !topicSelect) return;

  const snaps = QB.getScreenshots();
  const subjects = Array.from(new Set([...currentQuestionsList.map(q => q.subject || 'Mechanical Engineering'), ...snaps.map(s => s.subject)]));
  if (!subjects.includes("Mechanical Engineering")) subjects.unshift("Mechanical Engineering");

  const currentSubj = subjSelect.value || 'all';
  subjSelect.innerHTML = `<option value="all">📁 All Subjects (${snaps.length})</option>` +
    subjects.map(s => `<option value="${escapeHtml(s)}">📁 ${escapeHtml(s)}</option>`).join('') +
    `<option value="__CREATE_NEW_SUBJECT__">➕ Create New Subject...</option>`;

  if (subjects.includes(currentSubj)) subjSelect.value = currentSubj;
  else subjSelect.value = "all";

  const matchingSnaps = currentSubj === 'all' ? snaps : snaps.filter(s => s.subject === currentSubj);
  const matchingQs = currentSubj === 'all' ? currentQuestionsList : currentQuestionsList.filter(q => q.subject === currentSubj);
  const topics = Array.from(new Set([...matchingSnaps.map(s => s.topic || 'Engineering Mechanics'), ...matchingQs.map(q => q.topic || 'Engineering Mechanics')]));

  const currentTopic = topicSelect.value || 'all';
  topicSelect.innerHTML = `<option value="all">📂 All Topics (${matchingSnaps.length})</option>` +
    topics.map(t => `<option value="${escapeHtml(t)}">📂 ${escapeHtml(t)}</option>`).join('') +
    `<option value="__CREATE_NEW_TOPIC__">➕ Add New Topic...</option>`;

  if (topics.includes(currentTopic)) topicSelect.value = currentTopic;
  else topicSelect.value = "all";

  let filtered = matchingSnaps;
  if (currentTopic !== 'all' && currentTopic !== '__CREATE_NEW_TOPIC__') {
    filtered = filtered.filter(s => s.topic === currentTopic);
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full glass p-10 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center space-y-3 bg-white dark:bg-zinc-950">
        <i class="fa-solid fa-camera-retro text-4xl text-indigo-500"></i>
        <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">No Lecture Screenshots Found</h3>
        <p class="text-xs font-semibold text-slate-500 dark:text-slate-400">Click "Add Screenshot" or press <kbd class="px-1 bg-slate-200 dark:bg-zinc-800 font-mono rounded">Ctrl + V</kbd> to save lecture notes!</p>
        <button onclick="openCreateTopicModal()" class="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-md inline-flex items-center space-x-1.5">
          <i class="fa-solid fa-folder-plus"></i> <span>➕ Create New Topic / Folder</span>
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(s => `
    <div class="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3 shadow-sm hover:shadow-md transition">
      <div class="flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 border-b border-slate-100 dark:border-zinc-900 pb-2">
        <span class="truncate">📁 ${escapeHtml(s.subject)} → ${escapeHtml(s.topic)}</span>
        <button onclick="deleteScreenshotNote('${s.id}')" class="text-rose-500 hover:text-rose-400 p-1"><i class="fa-solid fa-trash"></i></button>
      </div>

      <h4 class="font-black text-sm text-slate-900 dark:text-white truncate">${escapeHtml(s.title || 'Lecture Screenshot Note')}</h4>

      ${s.imageUrl ? `
        <div class="overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-800 bg-black/5 dark:bg-black/40 text-center cursor-pointer group" onclick="window.open('${s.imageUrl}', '_blank')">
          <img src="${s.imageUrl}" class="max-h-56 w-full object-contain mx-auto group-hover:scale-105 transition duration-300" />
        </div>
      ` : ''}

      ${s.notes ? `<p class="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800/60">${formatSubSupScripts(escapeHtml(s.notes))}</p>` : ''}

      <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 font-bold">
        <span>🕒 ${new Date(s.createdAt).toLocaleDateString()}</span>
        <button onclick="exportLectureNotesPDF()" class="text-indigo-600 dark:text-indigo-400 hover:underline">📄 Export PDF</button>
      </div>
    </div>
  `).join('');
}

function onNotesSubjectFilterChange() {
  const subjSelect = document.getElementById('notes-filter-subject');
  const topicSelect = document.getElementById('notes-filter-topic');
  if (subjSelect && subjSelect.value === '__CREATE_NEW_SUBJECT__') {
    openCreateTopicModal();
    subjSelect.value = 'all';
    return;
  }
  if (topicSelect) topicSelect.value = 'all';
  renderScreenshotNotes();
}

function onNotesTopicFilterChange() {
  const topicSelect = document.getElementById('notes-filter-topic');
  if (topicSelect && topicSelect.value === '__CREATE_NEW_TOPIC__') {
    openCreateTopicModal();
    topicSelect.value = 'all';
    return;
  }
  renderScreenshotNotes();
}

function handleScreenshotUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    openAddScreenshotModal(e.target.result);
  };
  reader.readAsDataURL(file);
  event.target.value = "";
}

function deleteScreenshotNote(snapId) {
  if (confirm("Are you sure you want to delete this lecture screenshot note?")) {
    QB.deleteScreenshot(snapId);
    renderScreenshotNotes();
  }
}

function exportLectureNotesPDF() {
  const subjFilter = document.getElementById('notes-filter-subject')?.value || 'all';
  const topicFilter = document.getElementById('notes-filter-topic')?.value || 'all';
  
  let snaps = QB.getScreenshots();
  if (subjFilter !== 'all') snaps = snaps.filter(s => s.subject === subjFilter);
  if (topicFilter !== 'all') snaps = snaps.filter(s => s.topic === topicFilter);

  if (snaps.length === 0) {
    alert("No screenshot notes found for selected Subject & Topic to export!");
    return;
  }

  const printWin = window.open('', '_blank');
  if (!printWin) {
    alert("Please allow popups to open the PDF preview window!");
    return;
  }

  const htmlStr = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Lecture Notes PDF Export - QuestionBank</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
      <style>
        @media print {
          .page-break { page-break-after: always; }
        }
      </style>
    </head>
    <body class="bg-white text-slate-900 p-8 font-sans">
      <div class="max-w-4xl mx-auto space-y-6">
        <div class="border-b-2 border-indigo-600 pb-4 flex justify-between items-center">
          <div>
            <h1 class="text-2xl font-black text-indigo-900">📚 Lecture Notes & Screenshots PDF Export</h1>
            <p class="text-xs text-slate-500 font-bold mt-1">Subject: ${subjFilter} • Topic: ${topicFilter} • Total Notes: ${snaps.length}</p>
          </div>
          <button onclick="window.print()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-5 py-2.5 rounded-xl text-xs shadow-lg">🖨️ Print / Save as PDF</button>
        </div>

        <div class="space-y-8">
          ${snaps.map((s, idx) => `
            <div class="p-6 border border-slate-300 rounded-2xl space-y-4 page-break bg-slate-50/50">
              <div class="flex justify-between items-center text-xs font-bold text-indigo-700 border-b pb-2">
                <span>Note #${idx + 1} • [${s.subject} → ${s.topic}]</span>
                <span>Date: ${new Date(s.createdAt).toLocaleDateString()}</span>
              </div>
              <h3 class="font-extrabold text-base text-slate-900">${s.title}</h3>
              ${s.imageUrl ? `<div class="text-center"><img src="${s.imageUrl}" class="max-h-96 max-w-full rounded-xl border p-1 inline-block shadow-sm" /></div>` : ''}
              ${s.notes ? `<div class="p-4 bg-white rounded-xl border text-sm font-medium leading-relaxed whitespace-pre-wrap">${s.notes}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    </body>
    </html>
  `;
  printWin.document.write(htmlStr);
  printWin.document.close();
}

// ADD LECTURE SCREENSHOT MODAL ENGINE
window.openAddScreenshotModal = openAddScreenshotModal;
window.closeAddScreenshotModal = closeAddScreenshotModal;
window.onSnapSubjectSelectChange = onSnapSubjectSelectChange;
window.onSnapTopicSelectChange = onSnapTopicSelectChange;
window.saveAddScreenshotModal = saveAddScreenshotModal;

let currentPendingSnapDataUrl = "";

function openAddScreenshotModal(dataUrl) {
  currentPendingSnapDataUrl = dataUrl || "";
  const imgEl = document.getElementById('snap-modal-preview-img');
  if (imgEl) imgEl.src = currentPendingSnapDataUrl;

  const subjSelect = document.getElementById('snap-subject-select');

  const snaps = QB.getScreenshots();
  const notesTopics = QB.getNotesTopics();
  const subjects = Array.from(new Set([...snaps.map(s => s.subject), ...notesTopics.map(t => t.subject)]));
  if (!subjects.includes("General Knowledge")) subjects.unshift("General Knowledge");

  if (subjSelect) {
    subjSelect.innerHTML = subjects.map(s => `<option value="${escapeHtml(s)}">📁 ${escapeHtml(s)}</option>`).join('') +
      `<option value="__NEW_SUBJECT__">➕ Create New Subject...</option>`;
  }

  onSnapSubjectSelectChange();
  document.getElementById('modal-add-screenshot')?.classList.remove('hidden');
}

function closeAddScreenshotModal() {
  document.getElementById('modal-add-screenshot')?.classList.add('hidden');
  currentPendingSnapDataUrl = "";
}

function onSnapSubjectSelectChange() {
  const subjSelect = document.getElementById('snap-subject-select');
  const customSubj = document.getElementById('snap-subject-input');
  const topicSelect = document.getElementById('snap-topic-select');
  const customTopic = document.getElementById('snap-topic-input');
  if (!subjSelect || !topicSelect) return;

  const selectedSubj = subjSelect.value;
  if (selectedSubj === '__NEW_SUBJECT__') {
    if (customSubj) customSubj.classList.remove('hidden');
    topicSelect.innerHTML = `<option value="__NEW_TOPIC__">➕ Create New Topic...</option>`;
    onSnapTopicSelectChange();
    return;
  } else {
    if (customSubj) customSubj.classList.add('hidden');
  }

  const snaps = QB.getScreenshots().filter(s => s.subject === selectedSubj);
  const notesTopics = QB.getNotesTopics().filter(t => t.subject === selectedSubj);
  const topics = Array.from(new Set([...snaps.map(s => s.topic), ...notesTopics.map(t => t.topic)]));
  if (topics.length === 0) topics.push("VLC Lecture Snaps");

  topicSelect.innerHTML = topics.map(t => `<option value="${escapeHtml(t)}">📂 ${escapeHtml(t)}</option>`).join('') +
    `<option value="__NEW_TOPIC__">➕ Create New Topic...</option>`;

  onSnapTopicSelectChange();
}

function onSnapTopicSelectChange() {
  const topicSelect = document.getElementById('snap-topic-select');
  const customTopic = document.getElementById('snap-topic-input');
  if (!topicSelect || !customTopic) return;

  if (topicSelect.value === '__NEW_TOPIC__') {
    customTopic.classList.remove('hidden');
  } else {
    customTopic.classList.add('hidden');
  }
}

function compressImageForStorage(dataUrl, callback) {
  if (!dataUrl || !dataUrl.startsWith("data:image")) {
    callback(dataUrl);
    return;
  }
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement('canvas');
    let width = img.width;
    let height = img.height;
    const maxDim = 1280;

    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    const compressed = canvas.toDataURL('image/jpeg', 0.75);
    callback(compressed);
  };
  img.onerror = function() {
    callback(dataUrl);
  };
  img.src = dataUrl;
}

function saveAddScreenshotModal() {
  const subjSelect = document.getElementById('snap-subject-select');
  const customSubj = document.getElementById('snap-subject-input');
  const topicSelect = document.getElementById('snap-topic-select');
  const customTopic = document.getElementById('snap-topic-input');
  const title = document.getElementById('snap-title-input')?.value.trim() || "";
  const notes = document.getElementById('snap-notes-input')?.value.trim() || "";

  let finalSubj = subjSelect?.value === '__NEW_SUBJECT__' ? customSubj?.value.trim() : subjSelect?.value;
  let finalTopic = topicSelect?.value === '__NEW_TOPIC__' ? customTopic?.value.trim() : topicSelect?.value;

  finalSubj = finalSubj || "General Knowledge";
  finalTopic = finalTopic || "VLC Lecture Snaps";

  QB.saveNotesTopic(finalSubj, finalTopic);

  compressImageForStorage(currentPendingSnapDataUrl, function(compressedUrl) {
    const snapObj = {
      id: "snap_" + Date.now(),
      imageUrl: compressedUrl,
      subject: finalSubj,
      topic: finalTopic,
      title: title || ("Lecture Screenshot Note (" + new Date().toLocaleTimeString() + ")"),
      notes: notes || "Saved lecture screenshot for revision.",
      createdAt: new Date().toISOString()
    };

    try {
      QB.saveScreenshot(snapObj);
      closeAddScreenshotModal();
      switchTab('notes');
      renderScreenshotNotes();
      alert("📸 Screenshot successfully saved under " + finalSubj + " → " + finalTopic + "!");
    } catch(err) {
      alert("Storage full! Deleted old files or storage quota reached.");
    }
  });
}

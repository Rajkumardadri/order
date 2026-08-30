// PDF & Raw Text Question Extraction Engine
window.QB = window.QB || {};

function stripBrowserUiClutter(rawText) {
  if (!rawText) return "";

  let cleaned = rawText
    .replace(/(?:https?:\/\/|www\.)[^\s]+/gi, '')
    .replace(/(?:Crush|75 DAYS|Extensions|QuestionBank|API keys|Ask Gemini|testbook\.com|attemptNo=\d+|#\/lt-solutions)[^\r\n]*/gi, '')
    .replace(/(?:SPEED INDICATORS|SECTION :|Question Palette|Re-attempt Questions|Next|Previous|View in|Report|Saved|Save|Marks\s*[-+\d.]+)[^\r\n]*/gi, '')
    .replace(/^[v€©®X#|@\[\]()<>=~`]{3,}.*$/gm, '');

  return cleaned;
}

QB.parseTextToMCQs = function(rawText, sourceTag = "pdf") {
  if (!rawText || !rawText.trim()) return [];

  const cleanedText = stripBrowserUiClutter(rawText);
  const lines = cleanedText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const questions = [];
  let currentQuestion = null;

  const questionRegex = /^(?:Q(?:uestion)?[\s.#:-]*\d+|\d+[\s.:)-]+)(.+)/i;
  const optionRegex = /^(?:[A-Da-d1-4][\s.):|-]+|\([A-Da-d1-4]\)\s*)(.+)/;
  const answerRegex = /(?:Ans(?:wer)?|Correct\s*Option)[\s.#:-]*\(?\s*([A-Da-d1-4])\s*\)?/i;
  const explanationRegex = /^(?:Exp(?:lanation)?|Solution)[\s.#:-]*(.+)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const qMatch = line.match(questionRegex);
    const isNewQuestion = qMatch && !line.match(optionRegex) && !line.match(answerRegex);

    if (isNewQuestion) {
      if (currentQuestion && currentQuestion.questionText) {
        questions.push(finalizeQuestion(currentQuestion, sourceTag));
      }
      currentQuestion = {
        title: line.substring(0, 50) + "...",
        questionText: line.replace(questionRegex, '$1').trim() || line,
        options: [],
        correctAnswerIndex: 0,
        explanation: "",
        subject: "Extracted PDF"
      };
      continue;
    }

    if (!currentQuestion) {
      currentQuestion = {
        title: "Extracted Question 1",
        questionText: line,
        options: [],
        correctAnswerIndex: 0,
        explanation: "",
        subject: "Extracted PDF"
      };
      continue;
    }

    const optMatch = line.match(optionRegex);
    if (optMatch && currentQuestion.options.length < 4) {
      const optionText = line.replace(/^(?:[A-Da-d1-4][\s.):|-]+|\([A-Da-d1-4]\)\s*)/, '').trim();
      if (optionText) {
        currentQuestion.options.push(optionText);
      }
      continue;
    }

    const ansMatch = line.match(answerRegex);
    if (ansMatch) {
      const ansChar = ansMatch[1] ? ansMatch[1].toUpperCase() : null;
      if (ansChar) {
        if (['A', '1'].includes(ansChar)) currentQuestion.correctAnswerIndex = 0;
        else if (['B', '2'].includes(ansChar)) currentQuestion.correctAnswerIndex = 1;
        else if (['C', '3'].includes(ansChar)) currentQuestion.correctAnswerIndex = 2;
        else if (['D', '4'].includes(ansChar)) currentQuestion.correctAnswerIndex = 3;
      }
      continue;
    }

    const expMatch = line.match(explanationRegex);
    if (expMatch) {
      currentQuestion.explanation = expMatch[1] || "";
      continue;
    }

    if (currentQuestion.options.length === 0) {
      currentQuestion.questionText += " " + line;
    } else {
      if (!currentQuestion.explanation) {
        currentQuestion.explanation = line;
      } else {
        currentQuestion.explanation += " " + line;
      }
    }
  }

  if (currentQuestion && currentQuestion.questionText) {
    questions.push(finalizeQuestion(currentQuestion, sourceTag));
  }

  return questions;
};

function finalizeQuestion(q, sourceTag) {
  while (q.options.length < 4) {
    q.options.push(`Option ${String.fromCharCode(65 + q.options.length)}`);
  }

  // Automatic Answer Safety Guard: Inspect explanation text for explicit answer letter (e.g., Ans. (b))
  let verifiedCorrectIndex = q.correctAnswerIndex;
  const combinedText = (q.explanation + " " + q.questionText).toLowerCase();
  const explicitAnsMatch = combinedText.match(/(?:ans(?:wer)?|correct\s*option)[\s.#:-]*\(?\s*([a-d1-4])\s*\)?/i);
  if (explicitAnsMatch) {
    const char = explicitAnsMatch[1].toUpperCase();
    if (['A', '1'].includes(char)) verifiedCorrectIndex = 0;
    else if (['B', '2'].includes(char)) verifiedCorrectIndex = 1;
    else if (['C', '3'].includes(char)) verifiedCorrectIndex = 2;
    else if (['D', '4'].includes(char)) verifiedCorrectIndex = 3;
  }

  return {
    id: "q_pdf_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
    title: q.questionText.substring(0, 45) + "...",
    questionText: q.questionText,
    options: q.options.slice(0, 4),
    correctAnswerIndex: verifiedCorrectIndex,
    explanation: q.explanation || "Extracted from PDF question paper.",
    source: sourceTag,
    status: "pending",
    subject: q.subject || "General",
    tags: ["PDF-Import"],
    createdAt: new Date().toISOString()
  };
}

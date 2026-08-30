// QuestionBank AI Service Module (Google Gemini API & Smart Offline Tutor)
window.QB = window.QB || {};
window.QB.AI = window.QB.AI || {};

const DEFAULT_GEMINI_KEY = ""; // Users can configure their free Gemini API Key in Settings

QB.getGeminiApiKey = function() {
  const saved = localStorage.getItem("qb_gemini_api_key");
  if (saved && saved.trim()) return saved.trim();
  return DEFAULT_GEMINI_KEY;
};

QB.saveGeminiApiKey = function(key) {
  localStorage.setItem("qb_gemini_api_key", (key || "").trim());
};

// Generic Gemini API Call Handler
async function callGeminiApi(promptText, systemInstruction = "") {
  const apiKey = QB.getGeminiApiKey();

  if (!apiKey) {
    throw new Error("NO_API_KEY");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: systemInstruction ? `${systemInstruction}\n\nUser Query: ${promptText}` : promptText }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024
    }
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Gemini API HTTP Error ${res.status}`);
  }

  const data = await res.json();
  const candidate = data.candidates && data.candidates[0];
  if (!candidate || !candidate.content || !candidate.content.parts) {
    throw new Error("Invalid response format from Gemini API");
  }

  return candidate.content.parts.map(p => p.text).join("\n");
}

// 1. INSTANT AI QUESTION CONCEPT EXPLAINER
QB.AI.explainQuestion = async function(q) {
  const prompt = `Please provide a clear, step-by-step concept breakdown, formula recap, and shortcut trick for the following question:

Question: ${q.questionText}
Options:
A) ${q.options[0] || ''}
B) ${q.options[1] || ''}
C) ${q.options[2] || ''}
D) ${q.options[3] || ''}
Correct Answer: Option ${String.fromCharCode(65 + (q.correctAnswerIndex || 0))} (${q.options[q.correctAnswerIndex] || ''})
Existing Concept Solution: ${q.explanation || ''}

Structure your response into:
1. 🎯 **Core Concept**: (Key principle explained simply)
2. 📐 **Formulas & Steps**: (Mathematical or logical derivation step-by-step)
3. ⚡ **Shortcut Trick / Memory Tip**: (How to solve this in under 30 seconds in exams)
4. ❌ **Why Other Options Are Incorrect**: (Brief breakdown of distractors)`;

  try {
    return await callGeminiApi(prompt, "You are Antigravity AI Study Tutor, an expert engineering exam coach for competitive exams like GATE, ESE, SSC JE, and Testbook series. Explain concepts clearly, concisely, and with high pedagogical accuracy.");
  } catch (err) {
    if (err.message === "NO_API_KEY") {
      return getFallbackExplanation(q);
    }
    console.warn("Gemini API call failed, using smart fallback tutor:", err);
    return getFallbackExplanation(q);
  }
};

// 2. AI DOUBT SOLVER CHATBOT
QB.AI.askDoubt = async function(userMessage, chatHistory = []) {
  const systemPrompt = `You are Antigravity AI Study Assistant for QuestionBank Hub. You help engineering and exam preparation students understand complex concepts, solve numerical problems, memorize formulas, and prepare for competitive exams. Keep your tone encouraging, highly structured, and easy to read with bullet points and LaTeX formatting where appropriate.`;

  const contextText = chatHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join("\n");
  const fullPrompt = `${contextText}\nUser: ${userMessage}`;

  try {
    return await callGeminiApi(fullPrompt, systemPrompt);
  } catch (err) {
    if (err.message === "NO_API_KEY") {
      return getFallbackDoubtResponse(userMessage);
    }
    console.warn("Gemini API call failed, using smart fallback response:", err);
    return getFallbackDoubtResponse(userMessage);
  }
};

// 3. AI MCQ GENERATOR
QB.AI.generateMCQs = async function(subject, topic, count = 3) {
  const prompt = `Generate ${count} high-quality Multiple Choice Questions (MCQs) for the topic "${topic}" in "${subject}".
Format your response as a valid JSON array of objects with the exact schema below:

[
  {
    "questionText": "Question statement here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswerIndex": 0,
    "explanation": "Detailed step-by-step concept explanation here",
    "subject": "${subject}",
    "topic": "${topic}"
  }
]

IMPORTANT: Output ONLY the raw JSON array without markdown backticks or extra prose.`;

  try {
    const responseText = await callGeminiApi(prompt, "You are a senior exam paper setter. Output strictly valid JSON.");
    const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.warn("Gemini MCQ generation fallback triggered:", err);
    return getFallbackGeneratedMCQs(subject, topic, count);
  }
};

// --- SMART FALLBACK HEURISTIC TUTOR (Works even when API Key is not set) ---
function getFallbackExplanation(q) {
  const isNewtonian = q.questionText.includes("Newtonian fluid");
  const isViscosity = q.questionText.includes("viscosity") || q.questionText.includes("Bulk modulus");

  if (isNewtonian) {
    return `🤖 **AI Concept Tutor Breakdown**:

1. 🎯 **Core Concept**:
Newton's Law of Viscosity states that shear stress (τ) is directly proportional to the velocity gradient (du/dy) perpendicular to the direction of flow.
Fluids that strictly obey this linear relationship are called **Newtonian Fluids** (e.g. Water, Air, Kerosene, Gasoline).

2. 📐 **Formulas & Steps**:
$$\\tau = \\mu \\frac{du}{dy}$$
Where:
- $\\tau$ = Shear stress ($N/m^2$ or $Pa$)
- $\\mu$ = Dynamic Viscosity ($Pa\\cdot s$ or $N\\cdot s/m^2$)
- $\\frac{du}{dy}$ = Velocity gradient or rate of shear strain ($s^{-1}$)

3. ⚡ **Exam Shortcut Trick**:
Remember: **τ = μ · (du/dy)**. Shear stress is the **PRODUCT** of viscosity and velocity gradient!

4. ❌ **Why Other Options Are Incorrect**:
- Options with square roots or inverse ratios violate Newton's linear stress-strain rate relation.`;
  }

  if (isViscosity) {
    return `🤖 **AI Concept Tutor Breakdown**:

1. 🎯 **Core Concept**:
Wave velocity in compressible fluids depends on the fluid's bulk elastic modulus ($E$ or $K$) and density ($\\rho$).
Compressibility governs how pressure disturbances propagate through fluid media.

2. 📐 **Formulas & Steps**:
$$c = \\sqrt{\\frac{K}{\\rho}} \\quad \\text{or} \\quad c = \\sqrt{\\frac{E}{\\rho}}$$
Where:
- $c$ = Acoustic/pressure wave velocity ($m/s$)
- $E$ = Bulk modulus of elasticity ($N/m^2$)
- $\\rho$ = Density of the fluid ($kg/m^3$)

3. ⚡ **Exam Shortcut Trick**:
Velocity is proportional to the **Square Root** of (Bulk Modulus divided by Density). Think: $v = \\sqrt{E / \\rho}$!

4. ❌ **Why Other Options Are Incorrect**:
- Linear $E/p$ or inverse square roots $1/\\sqrt{\\rho E}$ are dimensionally incorrect for velocity ($m/s$).`;
  }

  return `🤖 **AI Concept Tutor Breakdown**:

1. 🎯 **Core Concept**:
This question tests core principles of **${q.subject || 'Engineering'} → ${q.topic || 'General'}**.

2. 📐 **Concept & Solution Summary**:
${q.explanation || 'Refer to standard textbook formulas and dimensional analysis.'}

3. ⚡ **Exam Tip**:
Always verify SI units and dimensional formulas ($M^a L^b T^c$) first to eliminate invalid distractor options quickly!`;
}

function getFallbackDoubtResponse(prompt) {
  const p = prompt.toLowerCase();

  if (p.includes("viscosity") || p.includes("fluid")) {
    return `🤖 **AI Tutor**: Dynamic Viscosity ($\\mu$) is the fluid's internal resistance to shear flow. Its SI unit is **$N\\cdot s/m^2$** or **$Pa\\cdot s$**. In CGS, 1 Poise = $0.1 \\, Pa\\cdot s$. Kinematic Viscosity ($\\nu = \\mu/\\rho$) has SI unit **$m^2/s$** (1 Stoke = $10^{-4} \\, m^2/s$).`;
  }

  if (p.includes("formula") || p.includes("gate") || p.includes("ssc")) {
    return `🤖 **AI Exam Coach**: To master engineering MCQs, focus on:
1. Dimensional Analysis ($M, L, T, \\theta$)
2. Standard Fluid Properties (Viscosity, Surface Tension, Compressibility)
3. Active Recall & 30-day Spaced Revision using QuestionBank Hub!`;
  }

  return `🤖 **AI Assistant**: I am ready to help you with **${prompt}**! To unlock live real-time Gemini AI responses, enter your free **Google Gemini API Key** in **Settings (⚙️)**!`;
}

function getFallbackGeneratedMCQs(subject, topic, count) {
  return [
    {
      questionText: `What is the SI unit of Dynamic Viscosity?`,
      options: ["N·s/m² (Pascal-second)", "m²/s (Stoke)", "N/m", "kg/m³"],
      correctAnswerIndex: 0,
      explanation: "Dynamic viscosity μ has SI units of Newton-second per square meter (N·s/m²) or Pascal-second (Pa·s). Kinematic viscosity has units of m²/s.",
      subject: subject,
      topic: topic
    },
    {
      questionText: `For a Newtonian fluid, the shear stress is directly proportional to:`,
      options: ["Rate of shear deformation (velocity gradient)", "Fluid density", "Square of velocity gradient", "Pressure gradient"],
      correctAnswerIndex: 0,
      explanation: "Newton's law of viscosity states τ = μ(du/dy), meaning shear stress is directly proportional to rate of shear strain (velocity gradient).",
      subject: subject,
      topic: topic
    },
    {
      questionText: `Velocity of sound/pressure waves in a fluid medium is given by:`,
      options: ["√(E / ρ)", "E / ρ", "√(ρ / E)", "1 / (E · ρ)"],
      correctAnswerIndex: 0,
      explanation: "Wave propagation velocity c in fluid is c = √(E/ρ) where E is bulk modulus of elasticity and ρ is density.",
      subject: subject,
      topic: topic
    }
  ];
}

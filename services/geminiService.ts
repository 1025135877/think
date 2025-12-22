
import { GoogleGenAI } from "@google/genai";
import { MysteryData, JudgeResponse, AnswerType, EndingEvaluation } from "../types";

// 2025 Models: Using gemini-2.5-flash as requested.
const MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-3-flash-latest',
  'gemini-2.0-flash',
  'gemini-pro'
];

let runtimeApiKey = "";
export const setApiKey = (key: string) => { runtimeApiKey = key; };
const getApiKey = () => runtimeApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY || "";

/**
 * Generic API Wrapper with automatic model fallback for 404/Not Found/Quota issues.
 */
async function callGemini(prompt: string, temperature = 0.5) {
  const apiKey = getApiKey();
  // Using explicit apiKey in config object as it's the safest for browser environments
  const ai = new GoogleGenAI({ apiKey });

  let lastError = null;
  for (const modelName of MODEL_FALLBACKS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature }
      });
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (e: any) {
      lastError = e;
      const msg = e.message?.toLowerCase() || "";
      if (msg.includes("not found") || msg.includes("not supported") || msg.includes("quota") || msg.includes("exhausted") || msg.includes("429")) {
        console.warn(`Model ${modelName} unavailable or rate limited, trying next...`);
        continue;
      }
      if (isKeyError(e)) throw new Error("KEY_RESELECT_REQUIRED");
      throw e;
    }
  }
  throw lastError || new Error("All models failed.");
}

const isKeyError = (error: any): boolean => {
  const msg = error?.message?.toLowerCase() || "";
  return msg.includes("permission") || msg.includes("403") || msg.includes("401") || msg.includes("key");
};

const cleanJson = (text: string) => text.replace(/```json|```/g, '').trim();

/**
 * Generates all NPC portraits in a single batch call using gemini-2.5-flash-image.
 * Limits image size/resolution for speed.
 */
/**
 * Generates all NPC portraits instantly using the Dicebear API.
 * This is zero-quota (avoids 429) and high performance.
 */
const generateBatchPortraits = (npcs: any[]): void => {
  for (const npc of npcs) {
    // We use the character name or ID as seed for consistency
    const seed = npc.name || npc.id || Math.random().toString();
    // Styling: avataaars style with a dark background to match the game aesthetic
    // backgroundColor: '020617' matches the site's background
    npc.avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=020617,1e1b4b&mood=serious,neutral`;
  }
};

const validateMysteryData = (data: any): MysteryData => {
  return {
    title: data.title || "未知案件",
    situation: data.situation || "案件背景正在模糊...",
    solution: data.solution || "真相尚未明朗。",
    difficulty: data.difficulty || "普通",
    npcs: Array.isArray(data.npcs) ? data.npcs.map((n: any) => ({
      id: String(n.id || Math.random()),
      name: n.name || "无名氏",
      role: n.role || "目击者",
      description: n.description || "",
      personality: n.personality || "谨慎冷静",
      status: n.status || 'alive',
      visualSummary: n.visualSummary || n.description || ""
    })) : [],
    clues: Array.isArray(data.clues) ? data.clues.map((c: any) => ({
      id: String(c.id || Math.random()),
      title: c.title || "新内容",
      description: c.description || "一条模糊的线索",
      isLocked: true
    })) : [],
    endings: Array.isArray(data.endings) ? data.endings.map((e: any) => ({
      type: e.type || "BAD",
      title: e.title || "结束",
      description: e.description || e.narrative || "",
      condition: e.condition || ""
    })) : []
  } as MysteryData;
};

export const generateMystery = async (): Promise<MysteryData> => {
  const prompt = `Generate a 'Lateral Thinking' detective mystery in Simplified Chinese.
    Return ONLY a JSON object with this exact structure:
    {
      "title": "Case Name",
      "situation": "Case Background (Chinese)",
      "solution": "The Full Truth (Chinese)",
      "difficulty": "Easy/Medium/Hard",
      "npcs": [
        {"id": "n1", "name": "Victim Name", "role": "Victim", "description": "...", "personality": "...", "visualSummary": "...", "status": "deceased"},
        {"id": "n2", "name": "Witness A", "role": "Suspect/Witness", "description": "...", "personality": "...", "visualSummary": "...", "status": "alive"},
        {"id": "n3", "name": "Witness B", "role": "Suspect/Witness", "description": "...", "personality": "...", "visualSummary": "...", "status": "alive"}
      ],
      "clues": [
        {"id": "c1", "title": "Clue Title", "description": "Specific Fact"}
      ],
      "endings": [
        {"type": "GOOD/NEUTRAL/BAD", "title": "Ending Title", "description": "Narrative"}
      ]
    }
    CRITICAL: You MUST generate exactly 1 'deceased' NPC (the victim) and at least 2 'alive' NPCs (witnesses/suspects) to interrogate. 
    All content must be in Simplified Chinese except 'visualSummary'. Do not include any commentary outside the JSON.`;

  try {
    const text = await callGemini(prompt, 0.9);
    const rawData = JSON.parse(cleanJson(text));
    const data = validateMysteryData(rawData);

    // Single batch call for all portraits as requested
    await generateBatchPortraits(data.npcs);

    return data;
  } catch (e) {
    if (isKeyError(e)) throw new Error("KEY_RESELECT_REQUIRED");
    throw e;
  }
};

export const judgeInput = async (mystery: MysteryData, userInput: string, targetId: string, history: string[]): Promise<JudgeResponse> => {
  const isGM = targetId === 'GM';
  const targetNPC = mystery.npcs.find(n => n.id === targetId);

  const prompt = `Mystery: "${mystery.title}". Solution: ${mystery.solution}. 
    History: ${JSON.stringify(history)}. Input: "${userInput}". 
    Target: ${isGM ? 'GM' : targetNPC?.name}. Personality: ${targetNPC?.personality}.
    Task: Respond as target and check if any clue ID from ${JSON.stringify(mystery.clues.map(c => c.id))} is revealed.
    Output JSON: { "answerType": "...", "reply": "...", "unlockedClueId": "..." }`;

  try {
    const text = await callGemini(prompt, isGM ? 0.1 : 0.8);
    return JSON.parse(cleanJson(text)) as JudgeResponse;
  } catch (e) {
    if (isKeyError(e)) throw new Error("KEY_RESELECT_REQUIRED");
    return { answerType: AnswerType.CLARIFICATION, reply: "信号闪烁...", unlockedClueId: null };
  }
};

export const evaluateSolution = async (mystery: MysteryData, playerTheory: string): Promise<EndingEvaluation> => {
  const prompt = `Solution: ${mystery.solution}. Theory: "${playerTheory}". 
    Evaluate and pick an ending from ${JSON.stringify(mystery.endings)}.
    Output JSON: { "type": "...", "narrative": "...", "title": "..." }`;

  try {
    const text = await callGemini(prompt, 0.3);
    return JSON.parse(cleanJson(text)) as EndingEvaluation;
  } catch (e) {
    if (isKeyError(e)) throw new Error("KEY_RESELECT_REQUIRED");
    return { type: 'BAD', title: '思维断裂', narrative: '推理失败。' };
  }
};

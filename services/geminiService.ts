import { GoogleGenAI, Type, Schema } from "@google/genai";
import { MysteryData, JudgeResponse, AnswerType, EndingEvaluation } from "../types";

const MODEL_NAME = 'gemini-1.5-flash';
const IMAGE_MODEL_NAME = 'imagen-3.0-generate-001';

/**
 * Helper to get the API Key.
 * Prioritizes LocalStorage (user input) -> Process Env (build time)
 */
const getApiKey = (): string => {
  const localKey = localStorage.getItem("gemini_api_key");
  if (localKey) return localKey;
  return process.env.API_KEY || "";
};

/**
 * Generates a single image using Imagen based on a prompt.
 */
const generateImage = async (prompt: string): Promise<string | undefined> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) return undefined;

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateImages({
      model: IMAGE_MODEL_NAME,
      prompt: `A dark, atmospheric, moody portrait of a character for a mystery detective game. ${prompt} High quality, digital art style.`,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });

    const base64String = response.generatedImages?.[0]?.image?.imageBytes;
    if (base64String) {
      return `data:image/jpeg;base64,${base64String}`;
    }
    return undefined;
  } catch (error) {
    console.error("Image generation failed:", error);
    return undefined;
  }
};

/**
 * Generates a new Detective Mystery with NPCs, Clues, and Endings in Chinese.
 */
export const generateMystery = async (): Promise<MysteryData> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      situation: { type: Type.STRING, description: "The initial known scenario (Chinese)." },
      solution: { type: Type.STRING, description: "The complete hidden truth (Chinese)." },
      difficulty: { type: Type.STRING },
      npcs: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            role: { type: Type.STRING },
            description: { type: Type.STRING },
            personality: { type: Type.STRING, description: "How this NPC speaks and acts." },
            visualSummary: { type: Type.STRING, description: "A detailed visual description of the character's face and clothing in English. Used for generating a portrait." }
          }
        }
      },
      clues: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            isLocked: { type: Type.BOOLEAN, description: "Always true initially." }
          }
        }
      },
      endings: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ['BAD', 'NEUTRAL', 'GOOD'] },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            condition: { type: Type.STRING }
          }
        }
      }
    },
    required: ["title", "situation", "solution", "difficulty", "npcs", "clues", "endings"],
  };

  const prompt = `
    Generate a 'Lateral Thinking' style detective mystery game in Simplified Chinese (简体中文).
    
    1. **Situation**: A mysterious, dark, or suspenseful scenario.
    2. **NPCs**: Create exactly 3 NPCs involved in the case (e.g., Witness, Suspect, Expert). 
       - They should have distinct personalities.
       - One might be lying or hiding something.
       - Provide a 'visualSummary' in English for each NPC to generate an image.
    3. **Clues**: Create 4-5 specific facts/clues that players can discover by asking the right questions.
    4. **Endings**:
       - BAD: Player accuses the wrong person or misses the point entirely.
       - NEUTRAL: Player finds the culprit but misses the motive/method.
       - GOOD: Player uncovers the complete truth (The 'Solution').
       
    The output must be in JSON. All text fields (title, situation, dialogue, descriptions) must be in Chinese, EXCEPT 'visualSummary' which must be in English.
  `;

  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.8,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No text returned from Gemini");

    const data = JSON.parse(text) as MysteryData;

    // Ensure all clues start locked
    data.clues = data.clues.map(c => ({ ...c, isLocked: true }));

    // Generate Images for NPCs
    await Promise.all(data.npcs.map(async (npc) => {
      if (npc.visualSummary) {
        npc.avatarUrl = await generateImage(npc.visualSummary);
      }
    }));

    return data;

  } catch (error) {
    console.error("Failed to generate mystery:", error);
    throw error;
  }
};

/**
 * Evaluates the user's input against the mystery context.
 * Can be directed at the 'GM' (Yes/No) or an 'NPC' (Dialogue).
 */
export const judgeInput = async (
  mystery: MysteryData,
  userInput: string,
  targetId: string, // 'GM' or NPC ID
  history: string[]
): Promise<JudgeResponse> => {

  const isGM = targetId === 'GM';
  const targetNPC = mystery.npcs.find(n => n.id === targetId);

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      answerType: {
        type: Type.STRING,
        enum: [
          AnswerType.YES, AnswerType.NO, AnswerType.IRRELEVANT,
          AnswerType.HINT, AnswerType.CLARIFICATION, AnswerType.NPC_DIALOGUE
        ]
      },
      reply: { type: Type.STRING, description: "The response text in Chinese." },
      unlockedClueId: { type: Type.STRING, description: "The ID of a clue found, or null." },
    },
    required: ["answerType", "reply"],
  };

  const prompt = `
    Current Mystery: "${mystery.title}"
    Situation: ${mystery.situation}
    Truth: ${mystery.solution}
    
    Available Clues (IDs): ${JSON.stringify(mystery.clues.map(c => ({ id: c.id, desc: c.description })))}

    User Input: "${userInput}"
    
    TARGET: ${isGM ? 'The Game Master (Spirit)' : `NPC: ${targetNPC?.name} (${targetNPC?.role})`}
    ${!isGM ? `NPC Personality: ${targetNPC?.personality}. NPC Knowledge: Respond based only on what this character knows.` : ''}

    Language: Simplified Chinese (简体中文).

    Task:
    1. If Target is GM: Answer Yes, No, Irrelevant, or Hint based on Lateral Thinking rules (海龟汤规则).
    2. If Target is NPC: Roleplay the response in Chinese. Use AnswerType "NPC_DIALOGUE".
    3. **CRITICAL**: Check if the user's question or the resulting answer reveals one of the "Available Clues".
       - If a SPECIFIC clue is revealed clearly, return its ID in 'unlockedClueId'.
       - Do not unlock a clue if the user is just guessing vaguely.
  `;

  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: isGM ? 0.2 : 0.7, // Higher temp for NPCs
      },
    });

    const text = response.text;
    if (!text) throw new Error("No judge response");

    return JSON.parse(text) as JudgeResponse;
  } catch (error) {
    console.error("Judgment error:", error);
    return {
      answerType: AnswerType.CLARIFICATION,
      reply: "信号连接中断...",
      unlockedClueId: null
    };
  }
};

/**
 * Evaluates the player's final theory.
 */
export const evaluateSolution = async (
  mystery: MysteryData,
  playerTheory: string
): Promise<EndingEvaluation> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      type: { type: Type.STRING, enum: ['BAD', 'NEUTRAL', 'GOOD'] },
      narrative: { type: Type.STRING, description: "The ending story in Chinese." },
      title: { type: Type.STRING, description: "Ending title in Chinese." }
    },
    required: ["type", "narrative", "title"],
  };

  const prompt = `
    The player is submitting their final theory for the mystery "${mystery.title}".
    
    Real Solution: ${mystery.solution}
    
    Possible Endings:
    1. GOOD: ${mystery.endings.find(e => e.type === 'GOOD')?.condition}
    2. NEUTRAL: ${mystery.endings.find(e => e.type === 'NEUTRAL')?.condition}
    3. BAD: ${mystery.endings.find(e => e.type === 'BAD')?.condition}

    Player's Theory: "${playerTheory}"

    Language: Simplified Chinese (简体中文).

    Task:
    1. Compare the theory to the Solution and the Ending conditions.
    2. Select the most appropriate Ending Type.
    3. Write a short narrative conclusion (max 100 words) based on the selected ending's description.
  `;

  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.5,
      },
    });
    return JSON.parse(response.text!) as EndingEvaluation;
  } catch (e) {
    return {
      type: 'BAD',
      title: '混沌',
      narrative: '你的思绪太混乱了，无法得出结论。'
    };
  }
};
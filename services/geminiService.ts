
import { GoogleGenAI, Type } from "@google/genai";
import { MysteryData, JudgeResponse, AnswerType, EndingEvaluation } from "../types";

// Complex Text Tasks (e.g., advanced reasoning) should use 'gemini-3-pro-preview' as per guidelines.
const TEXT_MODEL = 'gemini-3-pro-preview';
const IMAGE_MODEL = 'gemini-2.5-flash-image';

/**
 * Checks if an error is related to API key permissions or validity.
 */
const isKeyError = (error: any): boolean => {
  const msg = error?.message?.toLowerCase() || "";
  return (
    msg.includes("permission") ||
    msg.includes("403") ||
    msg.includes("not found") ||
    msg.includes("not authorized") ||
    msg.includes("401") ||
    msg.includes("requested entity was not found")
  );
};

/**
 * Generates a single image using gemini-2.5-flash-image based on a prompt.
 */
const generateImage = async (prompt: string): Promise<string | undefined> => {
  try {
    // Create instance right before call for most up-to-date API key
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: {
        parts: [{ text: `A dark, atmospheric, moody portrait of a character for a mystery detective game. ${prompt} Digital art style, professional lighting.` }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
          // Note: imageSize is NOT supported for gemini-2.5-flash-image
        }
      },
    });
    
    // Find image part as recommended by guidelines
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return undefined;
  } catch (error: any) {
    if (isKeyError(error)) {
      throw new Error("KEY_RESELECT_REQUIRED");
    }
    console.error("Image generation failed:", error);
    return undefined;
  }
};

/**
 * Generates a new Detective Mystery with NPCs, Clues, and Endings in Chinese.
 */
export const generateMystery = async (): Promise<MysteryData> => {
  const schema = {
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
            visualSummary: { type: Type.STRING, description: "A detailed visual description of the character's face and clothing in English." }
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
            isLocked: { type: Type.BOOLEAN }
          }
        }
      },
      endings: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, description: "One of 'BAD', 'NEUTRAL', 'GOOD'" },
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
    Generate a 'Lateral Thinking' style detective mystery game in Simplified Chinese.
    
    1. **Situation**: A mysterious, dark, or suspenseful scenario.
    2. **NPCs**: Create exactly 3 NPCs involved in the case. 
       - One might be lying.
       - Provide a 'visualSummary' in English for each.
    3. **Clues**: Create 4-5 specific facts that players find by asking questions.
    4. **Endings**: BAD (wrong accusation), NEUTRAL (partial truth), GOOD (complete truth).
       
    Output JSON. All Chinese except 'visualSummary'.
  `;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.9,
      },
    });

    // Use .text property as recommended by guidelines
    const data = JSON.parse(response.text.trim()) as MysteryData;
    data.clues = data.clues.map(c => ({ ...c, isLocked: true }));

    // Portraits generation
    const portraitPromises = data.npcs.map(async (npc) => {
      if (npc.visualSummary) {
        npc.avatarUrl = await generateImage(npc.visualSummary);
      }
    });
    
    await Promise.all(portraitPromises);
    return data;
  } catch (error: any) {
    if (isKeyError(error) || error.message === "KEY_RESELECT_REQUIRED") {
      throw new Error("KEY_RESELECT_REQUIRED");
    }
    throw error;
  }
};

export const judgeInput = async (
  mystery: MysteryData,
  userInput: string,
  targetId: string,
  history: string[]
): Promise<JudgeResponse> => {
  
  const isGM = targetId === 'GM';
  const targetNPC = mystery.npcs.find(n => n.id === targetId);

  const schema = {
    type: Type.OBJECT,
    properties: {
      answerType: { 
        type: Type.STRING, 
        description: "One of YES, NO, IRRELEVANT, HINT, CLARIFICATION, NPC_DIALOGUE"
      },
      reply: { type: Type.STRING },
      unlockedClueId: { type: Type.STRING, nullable: true },
    },
    required: ["answerType", "reply"],
  };

  const prompt = `
    Mystery: "${mystery.title}"
    Solution: ${mystery.solution}
    Clues: ${JSON.stringify(mystery.clues.map(c => ({ id: c.id, desc: c.description })))}
    User Input: "${userInput}"
    Target: ${isGM ? 'Game Master' : `NPC: ${targetNPC?.name}`}
    ${!isGM ? `Personality: ${targetNPC?.personality}` : ''}
    
    If GM: Answer Yes/No/Irrelevant/Hint.
    If NPC: Roleplay response. 
    Unlock clue ID if specifically revealed.
  `;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: isGM ? 0.1 : 0.8,
      },
    });

    // Use .text property and trim it
    return JSON.parse(response.text.trim()) as JudgeResponse;
  } catch (error: any) {
    if (isKeyError(error)) {
      throw new Error("KEY_RESELECT_REQUIRED");
    }
    return {
      answerType: AnswerType.CLARIFICATION,
      reply: "信号闪烁... 请尝试重述您的问题。",
      unlockedClueId: null
    };
  }
};

export const evaluateSolution = async (
  mystery: MysteryData,
  playerTheory: string
): Promise<EndingEvaluation> => {
  const schema = {
    type: Type.OBJECT,
    properties: {
      type: { type: Type.STRING, description: "One of 'BAD', 'NEUTRAL', 'GOOD'" },
      narrative: { type: Type.STRING },
      title: { type: Type.STRING }
    },
    required: ["type", "narrative", "title"],
  };

  const prompt = `
    Real Solution: ${mystery.solution}
    Endings: ${JSON.stringify(mystery.endings)}
    Player's Theory: "${playerTheory}"
    Evaluate and select ending type + narrative conclusion.
  `;

  try {
     const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
     const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.3,
      },
    });
    // Use .text property and trim it
    return JSON.parse(response.text.trim()) as EndingEvaluation;
  } catch (e: any) {
    if (isKeyError(e)) {
      throw new Error("KEY_RESELECT_REQUIRED");
    }
    return { type: 'BAD', title: '思维断裂', narrative: '你的推理无法与现实接轨。' };
  }
};

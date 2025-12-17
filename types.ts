
export enum GamePhase {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  SOLVING = 'SOLVING', // User is typing final answer
  ENDED = 'ENDED',     // Game finished with a specific ending
  FAILED = 'FAILED'
}

export interface NPC {
  id: string;
  name: string;
  role: string; // e.g., "Witness", "Suspect"
  description: string;
  personality: string; // Instructions for AI roleplay
  avatarUrl?: string;
  visualSummary?: string;
}

export interface Clue {
  id: string;
  title: string;
  description: string;
  isLocked: boolean;
}

export interface Ending {
  type: 'BAD' | 'NEUTRAL' | 'GOOD';
  title: string;
  description: string; // The narrative text for this ending
  condition: string; // Logic for when this ending triggers
}

export interface MysteryData {
  title: string;
  situation: string;
  solution: string; // The full truth
  difficulty: string;
  npcs: NPC[];
  clues: Clue[];
  endings: Ending[];
}

export type MessageType = 'user' | 'ai_response' | 'system' | 'clue_alert';

export enum AnswerType {
  YES = 'YES',
  NO = 'NO',
  IRRELEVANT = 'IRRELEVANT',
  HINT = 'HINT',
  CORRECT = 'CORRECT', 
  CLARIFICATION = 'CLARIFICATION',
  NPC_DIALOGUE = 'NPC_DIALOGUE' // New type for NPC responses
}

export interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  answerType?: AnswerType;
  speakerName?: string; // Who is speaking (GM or NPC Name)
  avatarUrl?: string;
}

export interface JudgeResponse {
  answerType: AnswerType;
  reply: string;
  unlockedClueId?: string | null; // ID of the clue found, if any
}

export interface EndingEvaluation {
  type: 'BAD' | 'NEUTRAL' | 'GOOD';
  narrative: string;
  title: string;
}
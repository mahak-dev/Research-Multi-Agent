

export enum AgentStep {
  UPLOAD = 'UPLOAD',
  FINDING = 'FINDING',
  SUMMARIZING = 'SUMMARIZING',
  INTERVIEW = 'INTERVIEW',
  HINTS = 'HINTS',
}

export interface ResearchPaper {
  title: string;
  uri: string;
}

export interface PaperSummary {
  title: string;
  summary: string;
  rating: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  audioData?: string; // Base64 audio string for model messages
}

export interface Conference {
  name: string;
  dates: string;
  location: string;
  url: string;
}

export interface IdeationResult {
  researchIdeas: string;
  conferences: Conference[];
}

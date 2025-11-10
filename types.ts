
export enum AgentStep {
  UPLOAD = 'UPLOAD',
  FINDING = 'FINDING',
  SUMMARIZING = 'SUMMARIZING',
  EXPLAINING = 'EXPLAINING',
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

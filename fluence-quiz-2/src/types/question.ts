export type QuestionType = 'mcq' | 'fill-in-blank' | 'true-false' | 'voice' | 'image-based' | 'listening' | 'speaking';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface SRSMetadata {
  lastReviewed?: Date;
  nextReviewDate?: Date;
  repetitionCount: number;
  easeFactor: number;  // Used in spaced repetition algorithm
  interval: number;    // Days until next review
}

export interface MediaContent {
  type: 'audio' | 'image';
  url: string;
  transcription?: string;  // For audio content
  altText?: string;       // For image content
}

export interface PerformanceMetrics {
  totalAttempts: number;
  correctAttempts: number;
  averageResponseTime: number;  // in seconds
  lastAttemptDate?: Date;
  masteryLevel: number;        // 0-100 score
}

export interface Question {
  id: string;
  question: string;
  correct: string;  // Always a string, even for MCQ (selected option text)
  options?: string[];  // For MCQ questions
  explanation?: string;
  topic?: string;
  difficulty?: Difficulty;
  questionType: QuestionType;
  language?: string;  // Language code (e.g., 'en-US', 'hi-IN')
  hints?: string[];
  mediaContent?: MediaContent[];
  srsData?: SRSMetadata;
  performanceData?: PerformanceMetrics;
  aiGeneratedFeedback?: string[];
  commonMistakes?: string[];
  relatedConcepts?: string[];
} 
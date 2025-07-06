import { Question, SRSMetadata } from '../types/question';

// Constants for the SM-2 algorithm
const MIN_EASE_FACTOR = 1.3;
const INITIAL_EASE_FACTOR = 2.5;
const EASE_BONUS = 0.1;
const EASE_PENALTY = 0.2;

// Quality ratings for answers (0-5)
export enum AnswerQuality {
  Complete_Blackout = 0,  // Complete blackout, wrong answer
  Wrong_Answer = 1,       // Wrong answer, but upon seeing the correct answer, it felt familiar
  Wrong_Easy = 2,        // Wrong answer, but the correct answer was easy to remember
  Correct_Difficult = 3, // Correct answer, but required significant effort
  Correct_Hesitation = 4,// Correct answer after some hesitation
  Perfect_Answer = 5     // Perfect answer
}

export interface ReviewResult {
  nextReviewDate: Date;
  interval: number;
  easeFactor: number;
  repetitionCount: number;
}

export class SRSService {
  /**
   * Calculate the next review date and update SRS metadata based on answer quality
   */
  static calculateNextReview(
    quality: AnswerQuality,
    currentSRS: SRSMetadata
  ): ReviewResult {
    const { repetitionCount, easeFactor } = currentSRS;

    // Calculate new ease factor
    let newEaseFactor = easeFactor;
    if (quality >= AnswerQuality.Correct_Difficult) {
      // Correct answer - increase ease
      newEaseFactor = easeFactor + (EASE_BONUS - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    } else {
      // Wrong answer - decrease ease
      newEaseFactor = easeFactor - EASE_PENALTY;
    }
    
    // Ensure ease factor doesn't go below minimum
    newEaseFactor = Math.max(MIN_EASE_FACTOR, newEaseFactor);

    // Calculate new interval
    let newInterval: number;
    let newRepetitionCount: number;

    if (quality < AnswerQuality.Correct_Difficult) {
      // Reset interval on wrong answers
      newInterval = 1;
      newRepetitionCount = 0;
    } else {
      newRepetitionCount = repetitionCount + 1;
      if (newRepetitionCount === 1) {
        newInterval = 1;
      } else if (newRepetitionCount === 2) {
        newInterval = 6;
      } else {
        const oldInterval = currentSRS.interval || 1;
        newInterval = Math.round(oldInterval * newEaseFactor);
      }
    }

    // Calculate next review date
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

    return {
      nextReviewDate,
      interval: newInterval,
      easeFactor: newEaseFactor,
      repetitionCount: newRepetitionCount
    };
  }

  /**
   * Convert answer correctness and response time to quality rating
   */
  static getAnswerQuality(isCorrect: boolean, responseTimeSeconds: number): AnswerQuality {
    if (!isCorrect) {
      return responseTimeSeconds > 30 
        ? AnswerQuality.Complete_Blackout 
        : AnswerQuality.Wrong_Answer;
    }

    // For correct answers, factor in response time
    if (responseTimeSeconds <= 3) {
      return AnswerQuality.Perfect_Answer;
    } else if (responseTimeSeconds <= 10) {
      return AnswerQuality.Correct_Hesitation;
    } else {
      return AnswerQuality.Correct_Difficult;
    }
  }

  /**
   * Get questions due for review
   */
  static getDueQuestions(questions: Question[]): Question[] {
    const now = new Date();
    return questions.filter(q => {
      if (!q.srsData?.nextReviewDate) return true;
      const nextReview = new Date(q.srsData.nextReviewDate);
      return nextReview <= now;
    });
  }

  /**
   * Initialize SRS data for a new question
   */
  static initializeSRSData(): SRSMetadata {
    return {
      repetitionCount: 0,
      easeFactor: INITIAL_EASE_FACTOR,
      interval: 1,
      lastReviewed: undefined,
      nextReviewDate: undefined
    };
  }

  /**
   * Get the mastery level of a question based on SRS data
   */
  static calculateMasteryLevel(srsData: SRSMetadata): number {
    if (!srsData) return 0;

    const { repetitionCount, easeFactor } = srsData;
    
    // Calculate mastery based on repetition count and ease factor
    const repetitionScore = Math.min(repetitionCount * 20, 60); // Max 60 points from repetitions
    const easeScore = Math.max(((easeFactor - MIN_EASE_FACTOR) / (INITIAL_EASE_FACTOR - MIN_EASE_FACTOR)) * 40, 0); // Max 40 points from ease

    return Math.round(repetitionScore + easeScore);
  }
} 
import { useState } from 'react';
import { Question } from '../types/question';
import { aiReviewService } from '../services/aiReviewService';

interface UseAIReviewReturn {
  generateFeedback: (question: Question, userAnswer: string) => Promise<void>;
  generatePerformanceReview: (questions: Question[], answers: Record<string, string>) => Promise<void>;
  feedback: string;
  hints: string[];
  confidenceScore: number;
  performanceReview: string;
  isLoading: boolean;
  error: string | null;
}

export function useAIReview(): UseAIReviewReturn {
  const [feedback, setFeedback] = useState<string>('');
  const [hints, setHints] = useState<string[]>([]);
  const [confidenceScore, setConfidenceScore] = useState<number>(0);
  const [performanceReview, setPerformanceReview] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const generateFeedback = async (question: Question, userAnswer: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await aiReviewService.reviewAnswer(question, userAnswer);
      setFeedback(response.feedback);
      setHints(response.hints);
      setConfidenceScore(response.confidenceScore);
    } catch (err) {
      setError('Failed to generate feedback. Please try again.');
      console.error('Error in generateFeedback:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePerformanceReview = async (questions: Question[], answers: Record<string, string>) => {
    setIsLoading(true);
    setError(null);
    try {
      const review = await aiReviewService.generatePerformanceReport(questions, answers);
      setPerformanceReview(review);
    } catch (err) {
      setError('Failed to generate performance review. Please try again.');
      console.error('Error in generatePerformanceReview:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    generateFeedback,
    generatePerformanceReview,
    feedback,
    hints,
    confidenceScore,
    performanceReview,
    isLoading,
    error
  };
} 
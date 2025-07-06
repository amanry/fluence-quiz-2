import { useState, useEffect } from 'react';
import { Question } from '../types/question';
import { SRSService, AnswerQuality } from '../services/srsService';

interface UseSRSProps {
  questions: Question[];
  onQuestionsUpdate: (updatedQuestions: Question[]) => void;
}

interface UseSRSReturn {
  dueQuestions: Question[];
  updateQuestionSRS: (
    questionId: string,
    isCorrect: boolean,
    responseTimeSeconds: number
  ) => void;
  getMasteryLevel: (questionId: string) => number;
  getNextReviewDate: (questionId: string) => Date | undefined;
  getDueQuestionsCount: () => number;
}

export function useSRS({ questions, onQuestionsUpdate }: UseSRSProps): UseSRSReturn {
  const [dueQuestions, setDueQuestions] = useState<Question[]>([]);

  // Update due questions whenever questions change
  useEffect(() => {
    const due = SRSService.getDueQuestions(questions);
    setDueQuestions(due);
  }, [questions]);

  const updateQuestionSRS = (
    questionId: string,
    isCorrect: boolean,
    responseTimeSeconds: number
  ) => {
    const updatedQuestions = [...questions];
    const questionIndex = updatedQuestions.findIndex(q => q.id === questionId);
    
    if (questionIndex === -1) return;

    const question = updatedQuestions[questionIndex];
    
    // Initialize SRS data if not present
    if (!question.srsData) {
      question.srsData = SRSService.initializeSRSData();
    }

    // Calculate answer quality based on correctness and response time
    const quality = SRSService.getAnswerQuality(isCorrect, responseTimeSeconds);
    
    // Calculate next review based on quality
    const reviewResult = SRSService.calculateNextReview(quality, question.srsData);
    
    // Update question's SRS data
    question.srsData = {
      ...question.srsData,
      ...reviewResult,
      lastReviewed: new Date()
    };

    // Update questions and notify parent
    onQuestionsUpdate(updatedQuestions);
    
    // Update due questions
    const due = SRSService.getDueQuestions(updatedQuestions);
    setDueQuestions(due);
  };

  const getMasteryLevel = (questionId: string): number => {
    const question = questions.find(q => q.id === questionId);
    if (!question || !question.srsData) return 0;
    return SRSService.calculateMasteryLevel(question.srsData);
  };

  const getNextReviewDate = (questionId: string): Date | undefined => {
    const question = questions.find(q => q.id === questionId);
    return question?.srsData?.nextReviewDate;
  };

  const getDueQuestionsCount = (): number => {
    return dueQuestions.length;
  };

  return {
    dueQuestions,
    updateQuestionSRS,
    getMasteryLevel,
    getNextReviewDate,
    getDueQuestionsCount
  };
} 
import React from 'react';
import { Question, QuestionType } from '../../types/question';
import { MCQQuestion } from './MCQQuestion';
import { VoiceQuestion } from './VoiceQuestion';
import { BaseQuestion } from './BaseQuestion';

interface QuestionFactoryProps {
  question: Question;
  onAnswer: (answer: string | string[]) => void;
  showFeedback?: boolean;
  showHints?: boolean;
}

export const QuestionFactory: React.FC<QuestionFactoryProps> = ({
  question,
  onAnswer,
  showFeedback = false,
  showHints = false,
}) => {
  const renderQuestion = () => {
    switch (question.questionType) {
      case 'mcq':
        return (
          <MCQQuestion
            question={question}
            onAnswer={onAnswer}
            showFeedback={showFeedback}
            showHints={showHints}
          />
        );
      case 'voice':
      case 'speaking':
      case 'listening':
        return (
          <VoiceQuestion
            question={question}
            onAnswer={onAnswer}
            showFeedback={showFeedback}
            showHints={showHints}
          />
        );
      case 'fill-in-blank':
      case 'true-false':
      case 'image-based':
      default:
        return (
          <BaseQuestion
            question={question}
            onAnswer={onAnswer}
            showFeedback={showFeedback}
            showHints={showHints}
          />
        );
    }
  };

  return (
    <div className="w-full">
      {renderQuestion()}
    </div>
  );
}; 
import React from 'react';
import { Question } from '../../types/question';
import { BaseQuestion } from './BaseQuestion';

interface MCQQuestionProps {
  question: Question;
  onAnswer: (answer: string) => void;
  showFeedback?: boolean;
  showHints?: boolean;
}

export const MCQQuestion: React.FC<MCQQuestionProps> = ({
  question,
  onAnswer,
  showFeedback = false,
  showHints = false,
}) => {
  const [selectedOption, setSelectedOption] = React.useState<string>('');

  const handleOptionSelect = (option: string) => {
    setSelectedOption(option);
  };

  const handleSubmit = () => {
    if (selectedOption) {
      onAnswer(selectedOption);
    }
  };

  if (!question.options) {
    console.error('MCQ question must have options');
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <BaseQuestion
        question={question}
        onAnswer={handleSubmit}
        showFeedback={showFeedback}
        showHints={showHints}
      />
      
      <div className="mt-6 space-y-4">
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleOptionSelect(option)}
            className={`w-full p-4 text-left rounded-lg border transition-all ${
              selectedOption === option
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center">
              <div className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center ${
                selectedOption === option
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-gray-300'
              }`}>
                {selectedOption === option && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <span className="flex-1">{option}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}; 
import React from 'react';
import { Question } from '../../types/question';

interface BaseQuestionProps {
  question: Question;
  onAnswer: (answer: string | string[]) => void;
  showFeedback?: boolean;
  showHints?: boolean;
}

export const BaseQuestion: React.FC<BaseQuestionProps> = ({
  question,
  onAnswer,
  showFeedback = false,
  showHints = false,
}) => {
  const [selectedAnswer, setSelectedAnswer] = React.useState<string | string[]>('');
  const [currentHintIndex, setCurrentHintIndex] = React.useState(0);

  const handleAnswerSubmit = () => {
    onAnswer(selectedAnswer);
  };

  const showNextHint = () => {
    if (question.hints && currentHintIndex < question.hints.length - 1) {
      setCurrentHintIndex(prev => prev + 1);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">{question.question}</h3>
        {question.mediaContent?.map((media, index) => (
          <div key={index} className="mb-4">
            {media.type === 'image' && (
              <img 
                src={media.url} 
                alt={media.altText || 'Question image'} 
                className="max-w-full h-auto rounded"
              />
            )}
            {media.type === 'audio' && (
              <audio controls className="w-full">
                <source src={media.url} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            )}
          </div>
        ))}
      </div>

      {/* Hints Section */}
      {showHints && question.hints && question.hints.length > 0 && (
        <div className="mb-4 p-4 bg-blue-50 rounded">
          <h4 className="font-semibold mb-2">Hints:</h4>
          {question.hints.slice(0, currentHintIndex + 1).map((hint, index) => (
            <p key={index} className="text-sm text-gray-600 mb-1">{hint}</p>
          ))}
          {currentHintIndex < question.hints.length - 1 && (
            <button
              onClick={showNextHint}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Show Next Hint
            </button>
          )}
        </div>
      )}

      {/* Feedback Section */}
      {showFeedback && (
        <div className="mt-4">
          {question.explanation && (
            <div className="p-4 bg-gray-50 rounded mb-4">
              <h4 className="font-semibold mb-2">Explanation:</h4>
              <p className="text-sm text-gray-600">{question.explanation}</p>
            </div>
          )}
          {question.aiGeneratedFeedback && question.aiGeneratedFeedback.length > 0 && (
            <div className="p-4 bg-purple-50 rounded">
              <h4 className="font-semibold mb-2">AI Feedback:</h4>
              {question.aiGeneratedFeedback.map((feedback, index) => (
                <p key={index} className="text-sm text-gray-600 mb-1">{feedback}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        <button
          onClick={handleAnswerSubmit}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
        >
          Submit Answer
        </button>
      </div>
    </div>
  );
}; 
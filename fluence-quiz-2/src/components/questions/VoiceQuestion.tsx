import React, { useState, useEffect } from 'react';
import { Question } from '../../types/question';
import { useVoice } from '../../hooks/useVoice';
import { VoiceService } from '../../services/voiceService';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

interface VoiceQuestionProps {
  question: Question;
  onAnswer: (answer: string) => void;
  showFeedback?: boolean;
  showHints?: boolean;
}

export const VoiceQuestion: React.FC<VoiceQuestionProps> = ({
  question,
  onAnswer,
  showFeedback = false,
  showHints = false,
}) => {
  const [transcription, setTranscription] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isReadingQuestion, setIsReadingQuestion] = useState(false);

  const {
    isListening,
    isSpeaking,
    startListening,
    stopListening,
    speak,
    isSupported
  } = useVoice({
    language: question.language || 'en-US',
    onSpeechStart: () => setIsReadingQuestion(true),
    onSpeechEnd: () => setIsReadingQuestion(false),
    onError: (err) => setError(err)
  });

  useEffect(() => {
    // Reset state when question changes
    setTranscription('');
    setError(null);
  }, [question]);

  const handleStartRecording = async () => {
    try {
      setError(null);
      const text = await startListening();
      setTranscription(text);
      
      // Compare answer with correct text
      const result = VoiceService.compareSpokenAnswer(
        text,
        question.correct,
        {
          threshold: 0.8,
          language: question.language
        }
      );

      onAnswer(text);
    } catch (err) {
      setError('Failed to record answer. Please try again.');
    }
  };

  const handleStopRecording = () => {
    stopListening();
  };

  const handleReadQuestion = () => {
    if (isSpeaking) {
      // Stop current speech
      window.speechSynthesis.cancel();
      setIsReadingQuestion(false);
    } else {
      speak(question.question);
    }
  };

  if (!isSupported) {
    return (
      <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg">
        <p>Voice features are not supported in your browser. Please use a modern browser like Chrome or Edge.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h3 className="text-xl font-semibold">{question.question}</h3>
        <button
          onClick={handleReadQuestion}
          className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
          title={isReadingQuestion ? 'Stop reading' : 'Read question'}
        >
          {isReadingQuestion ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
        </button>
      </div>

      {question.mediaContent?.map((media, index) => (
        <div key={index} className="mt-2">
          {media.type === 'audio' && (
            <audio controls src={media.url} className="w-full">
              Your browser does not support the audio element.
            </audio>
          )}
        </div>
      ))}

      <div className="mt-4 space-y-4">
        <div className="flex justify-center">
          <button
            onClick={isListening ? handleStopRecording : handleStartRecording}
            className={`p-4 rounded-full transition-colors ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
            disabled={isReadingQuestion}
          >
            {isListening ? (
              <MicOff className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>
        </div>

        {transcription && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="font-medium">Your answer:</p>
            <p className="mt-1 text-gray-700">{transcription}</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-800 rounded-lg">
            <p>{error}</p>
          </div>
        )}

        {showHints && question.hints && question.hints.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium mb-2">Hints:</h4>
            <ul className="list-disc list-inside space-y-1">
              {question.hints.map((hint, index) => (
                <li key={index} className="text-gray-700">{hint}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}; 
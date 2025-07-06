import { useState, useEffect, useCallback } from 'react';
import { VoiceService } from '../services/voiceService';

interface UseVoiceProps {
  language?: string;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onError?: (error: string) => void;
}

interface UseVoiceReturn {
  isListening: boolean;
  isSpeaking: boolean;
  startListening: () => Promise<string>;
  stopListening: () => void;
  speak: (text: string) => void;
  isSupported: boolean;
}

export function useVoice({
  language = 'en-US',
  onSpeechStart,
  onSpeechEnd,
  onError
}: UseVoiceProps = {}): UseVoiceReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  // Initialize voice service
  useEffect(() => {
    const init = async () => {
      try {
        await VoiceService.initialize();
        setIsSupported(
          VoiceService.isRecognitionSupported() && VoiceService.isSynthesisSupported()
        );
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize voice service:', error);
        setIsSupported(false);
        if (onError) {
          onError('Failed to initialize voice service');
        }
      }
    };

    init();
  }, [onError]);

  const startListening = useCallback(async (): Promise<string> => {
    if (!isInitialized || !isSupported) {
      throw new Error('Voice service is not initialized or not supported');
    }

    return new Promise((resolve, reject) => {
      setIsListening(true);
      
      VoiceService.startListening(
        (text) => {
          setIsListening(false);
          resolve(text);
        },
        (error) => {
          setIsListening(false);
          if (onError) {
            onError(error);
          }
          reject(error);
        },
        { lang: language }
      );
    });
  }, [isInitialized, isSupported, language, onError]);

  const stopListening = useCallback(() => {
    if (isListening) {
      VoiceService.stopListening();
      setIsListening(false);
    }
  }, [isListening]);

  const speak = useCallback((text: string) => {
    if (!isInitialized || !isSupported) {
      if (onError) {
        onError('Voice service is not initialized or not supported');
      }
      return;
    }

    VoiceService.speak(
      text,
      { lang: language },
      () => {
        setIsSpeaking(true);
        if (onSpeechStart) {
          onSpeechStart();
        }
      },
      () => {
        setIsSpeaking(false);
        if (onSpeechEnd) {
          onSpeechEnd();
        }
      }
    );
  }, [isInitialized, isSupported, language, onSpeechStart, onSpeechEnd, onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isListening) {
        VoiceService.stopListening();
      }
    };
  }, [isListening]);

  return {
    isListening,
    isSpeaking,
    startListening,
    stopListening,
    speak,
    isSupported
  };
} 
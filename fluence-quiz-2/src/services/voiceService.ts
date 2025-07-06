interface VoiceOptions {
  lang?: string;
  pitch?: number;
  rate?: number;
  volume?: number;
}

export class VoiceService {
  private static recognition: SpeechRecognition | null = null;
  private static synthesis: SpeechSynthesis = window.speechSynthesis;
  private static voices: SpeechSynthesisVoice[] = [];

  static async initialize() {
    // Initialize Web Speech API
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
    }

    // Load voices
    this.voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
      const voices = this.synthesis.getVoices();
      if (voices.length > 0) {
        resolve(voices);
      } else {
        this.synthesis.onvoiceschanged = () => {
          resolve(this.synthesis.getVoices());
        };
      }
    });
  }

  static async startListening(
    onResult: (text: string) => void,
    onError: (error: string) => void,
    options: VoiceOptions = {}
  ): Promise<void> {
    if (!this.recognition) {
      onError('Speech recognition is not supported in this browser');
      return;
    }

    this.recognition.lang = options.lang || 'en-US';
    
    this.recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      onResult(text);
    };

    this.recognition.onerror = (event) => {
      onError(event.error);
    };

    this.recognition.start();
  }

  static stopListening(): void {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  static speak(
    text: string,
    options: VoiceOptions = {},
    onStart?: () => void,
    onEnd?: () => void
  ): void {
    // Cancel any ongoing speech
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set voice based on language
    if (options.lang) {
      const voice = this.voices.find(v => v.lang.startsWith(options.lang!));
      if (voice) {
        utterance.voice = voice;
      }
    }

    // Set other options
    utterance.pitch = options.pitch || 1;
    utterance.rate = options.rate || 1;
    utterance.volume = options.volume || 1;

    // Set callbacks
    if (onStart) utterance.onstart = onStart;
    if (onEnd) utterance.onend = onEnd;

    this.synthesis.speak(utterance);
  }

  static getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  static isRecognitionSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  static isSynthesisSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  /**
   * Compare spoken answer with correct answer
   * Uses fuzzy matching to account for speech recognition errors
   */
  static compareSpokenAnswer(
    spokenText: string,
    correctText: string,
    options: { threshold?: number; language?: string } = {}
  ): { isCorrect: boolean; similarity: number } {
    const { threshold = 0.8, language = 'en' } = options;

    // Normalize both texts
    const normalize = (text: string): string => {
      return text
        .toLowerCase()
        .trim()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '') // Remove punctuation
        .replace(/\s+/g, ' '); // Normalize whitespace
    };

    const normalizedSpoken = normalize(spokenText);
    const normalizedCorrect = normalize(correctText);

    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(normalizedSpoken, normalizedCorrect);
    const maxLength = Math.max(normalizedSpoken.length, normalizedCorrect.length);
    const similarity = 1 - distance / maxLength;

    return {
      isCorrect: similarity >= threshold,
      similarity
    };
  }

  private static levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }

    return matrix[b.length][a.length];
  }
} 
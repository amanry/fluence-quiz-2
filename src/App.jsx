import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Star, Trophy, Target, Share2, Calendar } from 'lucide-react';

const HindiEnglishQuiz = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [highestScore, setHighestScore] = useState(0);
  const [highestStreak, setHighestStreak] = useState(0);
  const [gameState, setGameState] = useState('menu'); // menu, playing, results
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isCorrect, setIsCorrect] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [lives, setLives] = useState(3);
  const [powerUps, setPowerUps] = useState({ skipQuestion: 2, extraTime: 2, fiftyFifty: 2 });
  const [showPowerUpEffect, setShowPowerUpEffect] = useState('');
  
  // Text-to-Speech states
  const [voice, setVoice] = useState(null);
  const [voices, setVoices] = useState([]);
  const [_pitch, _setPitch] = useState(1);
  const [_rate, _setRate] = useState(1);
  const [_volume, _setVolume] = useState(1);
  const [_isPaused, setIsPaused] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // New states for the requested features
  const [quizUpdateDate, setQuizUpdateDate] = useState(null);
  const [showShareSuccess, setShowShareSuccess] = useState(false);
  
  // Track if this is a student-specific quiz link
  const [isStudentQuiz, setIsStudentQuiz] = useState(false);
  // Track if we're in student quiz mode (after entering student name)
  const [_studentQuizMode, setStudentQuizMode] = useState(false);
  
  // Analytics tracking for AI-driven learning
  const [userPerformance, setUserPerformance] = useState({
    totalQuestions: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    questionHistory: [], // Track each question and user's answer
    weakAreas: {}, // Track which idioms/phrases user struggles with
    strongAreas: {}, // Track which idioms/phrases user excels at
    difficultyProgression: [], // Track difficulty changes
    currentDifficulty: 'easy', // Current difficulty level
    difficultyStats: {
      easy: { correct: 0, total: 0 },
      medium: { correct: 0, total: 0 },
      hard: { correct: 0, total: 0 }
    },
    sessionStats: {
      currentSession: 0,
      totalSessions: 0,
      averageAccuracy: 0,
      bestStreak: 0
    }
  });
  
  const timerRef = useRef(null);
  // ref reserved for potential future background music feature (prefixed for ESLint)
  const _backgroundMusicRef = useRef(null);
  const utteranceRef = useRef(null);

  // Add error state for question loading
  const [questionLoadError, setQuestionLoadError] = useState(null);

  const [questions, setQuestions] = useState([]);
  const [currentOptions, setCurrentOptions] = useState([]);

  // Prefixed with _ to indicate intentional unused state variables (for future enhancements) and satisfy ESLint
  const [_musicEnabled, _setMusicEnabled] = useState(true);
  const [_sfxEnabled, _setSfxEnabled] = useState(true);

  // Load highest scores and user performance from localStorage on component mount
  useEffect(() => {
    const savedHighestScore = localStorage.getItem('highestScore');
    const savedHighestStreak = localStorage.getItem('highestStreak');
    const savedUserPerformance = localStorage.getItem('userPerformance');
    
    if (savedHighestScore) setHighestScore(parseInt(savedHighestScore));
    if (savedHighestStreak) setHighestStreak(parseInt(savedHighestStreak));
    if (savedUserPerformance) {
      try {
        setUserPerformance(JSON.parse(savedUserPerformance));
      } catch (e) {
        console.error('Error parsing saved user performance:', e);
      }
    }
  }, []);

  // Simplify question loading - always load 20 questions
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const student = urlParams.get('student');
    
    // Check if we should auto-detect student based on name
    let detectedStudent = null;
    if (playerName) {
      const nameLower = playerName.toLowerCase().trim();
      if (nameLower === 'anaya') {
        detectedStudent = '1';
      } else if (nameLower === 'kavya') {
        detectedStudent = '2';
      } else if (nameLower === 'mamta') {
        detectedStudent = '3';
      }
    }
    
    // Use detected student or URL parameter
    const finalStudent = detectedStudent || student;
    
    if (finalStudent) {
      setIsStudentQuiz(true);
      setStudentQuizMode(true);
      
      // Update URL if we detected a student by name
      if (detectedStudent && !student) {
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('student', detectedStudent);
        window.history.replaceState({}, '', newUrl);
      }
    }
    
    const questionFile = finalStudent ? `questions-student${finalStudent}.json` : 'questions.json';
    
    // Add a flag to prevent multiple simultaneous requests
    let isMounted = true;
    
    fetch(questionFile)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const lastModified = response.headers.get('last-modified');
        if (lastModified) {
          setQuizUpdateDate(new Date(lastModified));
        }
        return response.json();
      })
      .then(data => {
        if (!isMounted) return;
        
        // Always process and shuffle 20 questions
        const processedQuestions = data.map((question, index) => ({
          ...question,
          id: question.id || index,
        }));
        const shuffledQuestions = [...processedQuestions].sort(() => Math.random() - 0.5).slice(0, 20);
        setQuestions(shuffledQuestions);
        setQuestionLoadError(null);
      })
      .catch(error => {
        if (!isMounted) return;
        console.error('Error loading questions:', error);
        setQuestionLoadError('Could not load quiz questions. Please check your link or try again later.');
        setQuestions([]);
      });
      
    return () => {
      isMounted = false;
    };
  }, [playerName]); // Add playerName as dependency to re-run when name changes

  // Fix options useEffect to only shuffle when currentQuestion changes
  useEffect(() => {
    if (questions.length > 0 && currentQuestion < questions.length) {
      const options = [...questions[currentQuestion].options];
      setCurrentOptions(options.sort(() => Math.random() - 0.5));
    }
  }, [questions, currentQuestion]); // Depend on questions and currentQuestion

  // Update speak function to accept rate and auto-select voice - wrapped in useCallback
  const speak = useCallback((text, customRate = 1) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new window.SpeechSynthesisUtterance(text);
      const selectedVoice = getVoiceForText(text, voices);
      utter.voice = selectedVoice;
      utter.pitch = 1;
      utter.rate = customRate;
      utter.volume = 1;
      utter.lang = selectedVoice?.lang || 'en-US';
      utter.onstart = () => setIsSpeaking(true);
      utter.onend = () => setIsSpeaking(false);
      utter.onpause = () => setIsPaused(true);
      utter.onresume = () => setIsPaused(false);
      utteranceRef.current = utter;
      window.speechSynthesis.speak(utter);
    }
  }, [voices]);

  // Auto-speak when question changes - use ref to avoid infinite loops
  const speakRef = useRef(speak);
  speakRef.current = speak;

  // Fix speak useEffect to only speak when currentQuestion changes
  useEffect(() => {
    if (questions.length > 0 && currentQuestion < questions.length && gameState === 'playing') {
      speakRef.current(questions[currentQuestion].question, 1);
    }
  }, [currentQuestion, gameState]); // Only depend on currentQuestion and gameState

  // Timer effect
  useEffect(() => {
    if (gameState === 'playing' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(time => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleTimeUp();
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gameState, timeLeft]);

  const handleTimeUp = () => {
    if (gameState === 'playing' && !showResult) {
      setSelectedAnswer('');
      setIsCorrect(false);
      setShowResult(true);
      setLives(prev => prev - 1);
      
      // Update user performance tracking
      const currentQ = questions[currentQuestion];
      setUserPerformance(prev => ({
        ...prev,
        totalQuestions: prev.totalQuestions + 1,
        incorrectAnswers: prev.incorrectAnswers + 1,
        questionHistory: [...prev.questionHistory, {
          question: currentQ.question,
          userAnswer: 'Time Up',
          correctAnswer: currentQ.correct,
          isCorrect: false,
          timeTaken: 60 - timeLeft,
          difficulty: currentQ.difficulty || 'medium'
        }],
        weakAreas: {
          ...prev.weakAreas,
          [currentQ.topic || 'general']: (prev.weakAreas[currentQ.topic || 'general'] || 0) + 1
        }
      }));
      
      setTimeout(() => {
        if (lives - 1 <= 0) {
          endGame();
        } else {
          nextQuestion();
        }
      }, 2000);
    }
  };

  const handleAnswerSelect = (option) => {
    if (showResult) return;
    
    setSelectedAnswer(option);
    const currentQ = questions[currentQuestion];
    const correct = option === currentQ.correct;
    setIsCorrect(correct);
    setShowResult(true);
    
    // Clear the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Update user performance tracking
    const timeTaken = 60 - timeLeft;
    setUserPerformance(prev => ({
      ...prev,
      totalQuestions: prev.totalQuestions + 1,
      correctAnswers: correct ? prev.correctAnswers + 1 : prev.correctAnswers,
      incorrectAnswers: correct ? prev.incorrectAnswers : prev.incorrectAnswers + 1,
      questionHistory: [...prev.questionHistory, {
        question: currentQ.question,
        userAnswer: option,
        correctAnswer: currentQ.correct,
        isCorrect: correct,
        timeTaken: timeTaken,
        difficulty: currentQ.difficulty || 'medium'
      }],
      weakAreas: correct ? prev.weakAreas : {
        ...prev.weakAreas,
        [currentQ.topic || 'general']: (prev.weakAreas[currentQ.topic || 'general'] || 0) + 1
      },
      strongAreas: correct ? {
        ...prev.strongAreas,
        [currentQ.topic || 'general']: (prev.strongAreas[currentQ.topic || 'general'] || 0) + 1
      } : prev.strongAreas
    }));
    
    if (correct) {
      setScore(prev => prev + 1);
      setStreak(prev => prev + 1);
      setMaxStreak(prev => Math.max(prev, streak + 1));
    } else {
      setStreak(0);
      setLives(prev => prev - 1);
    }
    
    setTimeout(() => {
      if (!correct && lives - 1 <= 0) {
        endGame();
      } else {
        nextQuestion();
      }
    }, 2000);
  };

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setSelectedAnswer('');
      setShowResult(false);
      setTimeLeft(60);
    } else {
      endGame();
    }
  };

  const generateInsights = () => {
    const totalQuestions = userPerformance.totalQuestions;
    const accuracy = totalQuestions > 0 ? (userPerformance.correctAnswers / totalQuestions * 100).toFixed(1) : 0;
    
    const insights = [];
    
    // Accuracy insights
    if (accuracy >= 80) {
      insights.push("🎯 Excellent accuracy! You're mastering the material.");
    } else if (accuracy >= 60) {
      insights.push("📈 Good progress! Focus on your weak areas to improve further.");
    } else {
      insights.push("💪 Keep practicing! Review the topics you're struggling with.");
    }
    
    // Weak areas insights
    const weakAreas = Object.entries(userPerformance.weakAreas)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);
    
    if (weakAreas.length > 0) {
      insights.push(`🔍 Focus on: ${weakAreas.map(([topic]) => topic).join(', ')}`);
    }
    
    // Strong areas insights
    const strongAreas = Object.entries(userPerformance.strongAreas)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);
    
    if (strongAreas.length > 0) {
      insights.push(`⭐ You excel at: ${strongAreas.map(([topic]) => topic).join(', ')}`);
    }
    
    // Streak insights
    if (maxStreak >= 5) {
      insights.push(`🔥 Amazing streak of ${maxStreak}! You're on fire!`);
    }
    
    return insights;
  };

  // Reserved for future: detailed analytics export
  const _generateAnalyticsReport = () => {
    const totalQuestions = userPerformance.totalQuestions;
    const accuracy = totalQuestions > 0 ? (userPerformance.correctAnswers / totalQuestions * 100).toFixed(1) : 0;
    
    const report = {
      overview: {
        totalQuestions,
        accuracy: `${accuracy}%`,
        bestStreak: maxStreak,
        currentScore: score
      },
      strengths: Object.entries(userPerformance.strongAreas)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([topic, count]) => ({ topic, count })),
      improvements: Object.entries(userPerformance.weakAreas)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([topic, count]) => ({ topic, count })),
      difficultyBreakdown: userPerformance.difficultyStats,
      recentPerformance: userPerformance.questionHistory.slice(-10)
    };
    
    return report;
  };

  const endGame = () => {
    setGameState('results');
    
    // Update localStorage with new high scores
    if (score > highestScore) {
      setHighestScore(score);
      localStorage.setItem('highestScore', score.toString());
    }
    if (maxStreak > highestStreak) {
      setHighestStreak(maxStreak);
      localStorage.setItem('highestStreak', maxStreak.toString());
    }
    
    // Save user performance
    localStorage.setItem('userPerformance', JSON.stringify(userPerformance));
    
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const startGame = () => {
    if (playerName.trim()) {
      setGameState('playing');
      setCurrentQuestion(0);
      setScore(0);
      setStreak(0);
      setMaxStreak(0);
      setLives(3);
      setTimeLeft(60);
      setSelectedAnswer('');
      setShowResult(false);
      setPowerUps({ skipQuestion: 2, extraTime: 2, fiftyFifty: 2 });
    }
  };

  const restartGame = () => {
    setGameState('menu');
    setCurrentQuestion(0);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setLives(3);
    setTimeLeft(60);
    setSelectedAnswer('');
    setShowResult(false);
    setPowerUps({ skipQuestion: 2, extraTime: 2, fiftyFifty: 2 });
    setStudentQuizMode(false);
    setIsStudentQuiz(false);
    
    // Clear URL parameters
    const newUrl = new URL(window.location);
    newUrl.searchParams.delete('student');
    window.history.replaceState({}, '', newUrl);
  };

  const startStudentQuiz = () => {
    if (playerName.trim()) {
      setStudentQuizMode(true);
      startGame();
    }
  };

  const powerUp = (type) => {
    if (powerUps[type] > 0) {
      setPowerUps(prev => ({ ...prev, [type]: prev[type] - 1 }));
      setShowPowerUpEffect(type);
      
      switch (type) {
        case 'skipQuestion':
          setTimeout(() => {
            nextQuestion();
          }, 1000);
          break;
        case 'extraTime':
          setTimeLeft(prev => Math.min(prev + 30, 60));
          break;
        case 'fiftyFifty': {
          // Remove two incorrect options
          const currentQ = questions[currentQuestion];
          const incorrectOptions = currentOptions.filter(opt => opt !== currentQ.correct);
          const optionsToRemove = incorrectOptions.slice(0, 2);
          setCurrentOptions(prev => prev.filter(opt => !optionsToRemove.includes(opt)));
          break;
        }
      }
      
      setTimeout(() => setShowPowerUpEffect(''), 2000);
    }
  };

  const getScoreRating = () => {
    const percentage = (score / questions.length) * 100;
    if (percentage >= 90) return { rating: 'Perfect!', color: 'text-yellow-400', emoji: '🏆' };
    if (percentage >= 80) return { rating: 'Excellent!', color: 'text-green-400', emoji: '🌟' };
    if (percentage >= 70) return { rating: 'Very Good!', color: 'text-blue-400', emoji: '👏' };
    if (percentage >= 60) return { rating: 'Good!', color: 'text-purple-400', emoji: '👍' };
    if (percentage >= 50) return { rating: 'Fair', color: 'text-yellow-400', emoji: '😊' };
    return { rating: 'Keep Practicing!', color: 'text-red-400', emoji: '💪' };
  };

  const shareScore = async () => {
    const { rating } = getScoreRating();
    const shareText = `🎯 I scored ${score}/${questions.length} (${rating}) in the Fluence Quiz! 🚀\n\nMy best streak: ${maxStreak} 🔥\nCan you beat my score? 💪`;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Fluence Quiz Results',
          text: shareText,
          url: window.location.href
        });
      } else {
        await navigator.clipboard.writeText(shareText + '\n\n' + window.location.href);
        setShowShareSuccess(true);
        setTimeout(() => setShowShareSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // Speech synthesis effects
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
        
        // Set default voice
        if (availableVoices.length > 0 && !voice) {
          const englishVoice = availableVoices.find(v => v.lang.startsWith('en')) || availableVoices[0];
          setVoice(englishVoice);
        }
      };
      
      loadVoices();
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
      
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      };
    }
  }, [voice]);

  function getVoiceForText(text, voices) {
    // Simple heuristic to choose voice based on text content
    const hasHindi = /[\u0900-\u097F]/.test(text);
    
    if (hasHindi) {
      return voices.find(v => v.lang.includes('hi')) || voices.find(v => v.lang.includes('en')) || voices[0];
    } else {
      return voices.find(v => v.lang.includes('en')) || voices[0];
    }
  }

  if (questionLoadError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-800 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold text-white mb-4">Oops! Something went wrong</h2>
          <p className="text-white/80 mb-6">{questionLoadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-800 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md w-full text-center">
          <div className="animate-spin w-16 h-16 border-4 border-white/20 border-t-white rounded-full mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-white mb-2">Loading Quiz...</h2>
          <p className="text-white/60">Please wait while we prepare your questions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-800 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-4xl w-full">
        
        {/* Menu Screen */}
        {gameState === 'menu' && (
          <div className="text-center">
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-white mb-2">🎯 Fluence Quiz</h1>
              <p className="text-white/80">Test your knowledge with our interactive quiz!</p>
              {quizUpdateDate && (
                <div className="flex items-center justify-center gap-2 mt-2 text-white/60 text-sm">
                  <Calendar className="w-4 h-4" />
                  <span>Updated: {quizUpdateDate.toLocaleDateString()}</span>
                </div>
              )}
            </div>
            
            <div className="mb-6 space-y-4">
              <input
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full p-3 rounded-xl bg-white/20 text-white placeholder-white/60 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                onKeyPress={(e) => e.key === 'Enter' && (isStudentQuiz ? startStudentQuiz() : startGame())}
              />
              
              {/* Show which student quiz is being taken */}
              {isStudentQuiz && (
                <div className="mt-2 flex items-center justify-center gap-2 text-white/80 text-sm">
                  <Star className="w-4 h-4" />
                  <span>Student Quiz Mode</span>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white/10 rounded-2xl p-4 text-center">
                <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                <p className="text-white/80 text-sm">Highest Score</p>
                <p className="text-2xl font-bold text-white">{highestScore}</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-4 text-center">
                <Target className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-white/80 text-sm">Best Streak</p>
                <p className="text-2xl font-bold text-white">{highestStreak}</p>
              </div>
            </div>
            
            <div className="flex justify-center gap-4 mt-6">
              <button
                onClick={isStudentQuiz ? startStudentQuiz : startGame}
                disabled={!playerName.trim()}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-3 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                START QUIZ
              </button>
            </div>
          </div>
        )}

        {/* Game Screen */}
        {gameState === 'playing' && (
          <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <div className="text-white">
                  <span className="text-lg font-semibold">Question {currentQuestion + 1}/20</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-white">
                    <span className="text-lg font-semibold">Score: {score}</span>
                  </div>
                  <div className="text-white">
                    <span className="text-lg font-semibold">Streak: {streak}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-white font-semibold">
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </div>
                <div className="flex gap-1">
                  {Array.from({length: 3}).map((_, i) => (
                    <div key={i} className={`w-3 h-3 rounded-full ${i < lives ? 'bg-red-500' : 'bg-white/20'}`}></div>
                  ))}
                </div>
              </div>
            </div>

            {/* Power-ups */}
            <div className="flex justify-center gap-2 mb-6">
              <button
                onClick={() => powerUp('skipQuestion')}
                disabled={powerUps.skipQuestion === 0}
                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Skip ({powerUps.skipQuestion})
              </button>
              <button
                onClick={() => powerUp('extraTime')}
                disabled={powerUps.extraTime === 0}
                className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                +30s ({powerUps.extraTime})
              </button>
              <button
                onClick={() => powerUp('fiftyFifty')}
                disabled={powerUps.fiftyFifty === 0}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                50/50 ({powerUps.fiftyFifty})
              </button>
            </div>

            {/* Power-up Effect */}
            {showPowerUpEffect && (
              <div className="text-center mb-4">
                <div className="text-2xl font-bold text-yellow-400 animate-bounce">
                  {showPowerUpEffect === 'skipQuestion' && '⏭️ Question Skipped!'}
                  {showPowerUpEffect === 'extraTime' && '⏰ +30 Seconds!'}
                  {showPowerUpEffect === 'fiftyFifty' && '✂️ 50/50 Used!'}
                </div>
              </div>
            )}

            {/* Question */}
            <div className="mb-8">
              <div className="bg-white/10 rounded-2xl p-6 mb-6">
                <h2 className="text-2xl font-semibold text-white mb-4 leading-relaxed">
                  {questions[currentQuestion]?.question}
                </h2>
                <div className="flex items-center gap-2 text-white/60 text-sm">
                  <button
                    onClick={() => speak(questions[currentQuestion]?.question)}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    <span>Read Question</span>
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 gap-3">
                {currentOptions.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(option)}
                    disabled={showResult}
                    className={`p-4 rounded-xl text-left transition-all transform hover:scale-105 ${
                      showResult
                        ? option === questions[currentQuestion]?.correct
                          ? 'bg-green-500/20 border-green-400/30 text-green-300'
                          : option === selectedAnswer
                          ? 'bg-red-500/20 border-red-400/30 text-red-300'
                          : 'bg-white/10 border-white/20 text-white/60'
                        : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
                    } border`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Result */}
            {showResult && (
              <div className="text-center">
                <div className={`text-2xl font-bold mb-2 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                  {isCorrect ? '✅ Correct!' : '❌ Incorrect!'}
                </div>
                {!isCorrect && (
                  <div className="text-white/80 mb-4">
                    The correct answer was: <span className="font-semibold text-green-400">{questions[currentQuestion]?.correct}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Results Screen */}
        {gameState === 'results' && (
          <div className="text-center">
            <div className="mb-8">
              <div className="text-6xl mb-4">{getScoreRating().emoji}</div>
              <h2 className="text-4xl font-bold text-white mb-2">{getScoreRating().rating}</h2>
              <p className="text-xl text-white/80">Quiz Complete!</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-white/10 rounded-2xl p-6">
                <div className="text-3xl font-bold text-white">{score}/20</div>
                <div className="text-white/60">Final Score</div>
              </div>
              <div className="bg-white/10 rounded-2xl p-6">
                <div className="text-3xl font-bold text-white">{maxStreak}</div>
                <div className="text-white/60">Best Streak</div>
              </div>
            </div>

            {/* AI Insights */}
            <div className="bg-white/10 rounded-2xl p-6 mb-6">
              <h3 className="text-xl font-semibold text-white mb-4">📊 Your Performance Insights</h3>
              <div className="space-y-2 text-left">
                {generateInsights().map((insight, index) => (
                  <div key={index} className="text-white/80 text-sm">
                    {insight}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={restartGame}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-3 rounded-xl font-semibold transition-all transform hover:scale-105"
              >
                PLAY AGAIN
              </button>
              <button
                onClick={shareScore}
                className="bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600 text-white px-8 py-3 rounded-xl font-semibold transition-all transform hover:scale-105 flex items-center gap-2"
              >
                <Share2 className="w-5 h-5" />
                SHARE
              </button>
            </div>

            {showShareSuccess && (
              <div className="mt-4 p-3 bg-green-500/20 border border-green-400/30 rounded-xl text-green-300 text-sm">
                Score copied to clipboard! 📋
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HindiEnglishQuiz;

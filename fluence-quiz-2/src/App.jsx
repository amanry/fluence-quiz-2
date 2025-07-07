import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Star, Trophy, Target, Share2, Calendar } from 'lucide-react';
import './App.css';
import { QuestionFactory } from './components/questions/QuestionFactory';
import { useSRS } from './hooks/useSRS';
import { useAIReview } from './hooks/useAIReview';

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
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [playerName, setPlayerName] = useState('');
  const [lives, setLives] = useState(3);
  const [powerUps, setPowerUps] = useState({ skipQuestion: 2, extraTime: 2, fiftyFifty: 2 });
  const [showPowerUpEffect, setShowPowerUpEffect] = useState('');
  
  // Text-to-Speech states
  const [voice, setVoice] = useState(null);
  const [voices, setVoices] = useState([]);
  const [pitch, setPitch] = useState(1);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // New states for the requested features
  const [quizUpdateDate, setQuizUpdateDate] = useState(null);
  const [showShareSuccess, setShowShareSuccess] = useState(false);
  
  // Track if this is a student-specific quiz link
  const [isStudentQuiz, setIsStudentQuiz] = useState(false);
  // Track if we're in student quiz mode (after entering student name)
  const [studentQuizMode, setStudentQuizMode] = useState(false);
  
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
    },
    questionTypeStats: {
      mcq: { correct: 0, total: 0 },
      'fill-in-blank': { correct: 0, total: 0 },
      'true-false': { correct: 0, total: 0 },
      voice: { correct: 0, total: 0 },
      'image-based': { correct: 0, total: 0 },
      listening: { correct: 0, total: 0 },
      speaking: { correct: 0, total: 0 }
    }
  });
  
  const timerRef = useRef(null);
  const backgroundMusicRef = useRef(null);
  const utteranceRef = useRef(null);

  // Add error state for question loading
  const [questionLoadError, setQuestionLoadError] = useState(null);

  const [questions, setQuestions] = useState([]);
  const [currentOptions, setCurrentOptions] = useState([]);

  // Add SRS hook
  const {
    dueQuestions,
    updateQuestionSRS,
    getMasteryLevel,
    getNextReviewDate,
    getDueQuestionsCount
  } = useSRS({
    questions,
    onQuestionsUpdate: (updatedQuestions) => {
      setQuestions(updatedQuestions);
      // Save to localStorage
      localStorage.setItem('questions', JSON.stringify(updatedQuestions));
    }
  });

  // Add AI review hook
  const {
    generateFeedback,
    generateHints,
    reviewPerformance,
    isLoading: isAILoading,
    error: aiError
  } = useAIReview({
    apiKey: process.env.REACT_APP_OPENAI_API_KEY,
    onError: (error) => {
      console.error('AI Review Error:', error);
      // You might want to show this error to the user
    }
  });

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

  // Update question loading to load from localStorage first
  useEffect(() => {
    const savedQuestions = localStorage.getItem('questions');
    if (savedQuestions) {
      try {
        const parsed = JSON.parse(savedQuestions);
        setQuestions(parsed);
        return;
      } catch (e) {
        console.error('Error parsing saved questions:', e);
      }
    }

    // If no saved questions, load from file
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
        
        // Process questions with enhanced features
        const processedQuestions = data.map((question, index) => ({
          ...question,
          id: question.id || `q${index}`,
          // Add SRS data if not present
          srsData: question.srsData || {
            repetitionCount: 0,
            easeFactor: 2.5,
            interval: 1,
            lastReviewed: null,
            nextReviewDate: null
          },
          // Add performance tracking if not present
          performanceData: question.performanceData || {
            totalAttempts: 0,
            correctAttempts: 0,
            averageResponseTime: 0,
            lastAttemptDate: null,
            masteryLevel: 0
          },
          // Ensure question type is set
          questionType: question.questionType || 'mcq',
          // Add media content array if not present
          mediaContent: question.mediaContent || [],
          // Add hints array if not present
          hints: question.hints || [],
          // Add AI feedback if not present
          aiGeneratedFeedback: question.aiGeneratedFeedback || [],
          // Add common mistakes if not present
          commonMistakes: question.commonMistakes || [],
          // Add related concepts if not present
          relatedConcepts: question.relatedConcepts || []
        }));

        // Filter questions based on SRS if available
        const now = new Date();
        const dueQuestions = processedQuestions.filter(q => {
          if (!q.srsData.nextReviewDate) return true;
          const nextReview = new Date(q.srsData.nextReviewDate);
          return nextReview <= now;
        });

        // Sort by SRS interval and shuffle within same intervals
        const sortedQuestions = dueQuestions.sort((a, b) => {
          const intervalDiff = (a.srsData.interval || 0) - (b.srsData.interval || 0);
          return intervalDiff || Math.random() - 0.5;
        });

        // Take top 20 questions
        const selectedQuestions = sortedQuestions.slice(0, 20);
        
        setQuestions(selectedQuestions);
        setQuestionLoadError(null);

        // Initialize analytics for new question types
        setUserPerformance(prev => ({
          ...prev,
          questionTypeStats: {
            ...prev.questionTypeStats,
            mcq: { correct: 0, total: 0 },
            'fill-in-blank': { correct: 0, total: 0 },
            'true-false': { correct: 0, total: 0 },
            voice: { correct: 0, total: 0 },
            'image-based': { correct: 0, total: 0 },
            listening: { correct: 0, total: 0 },
            speaking: { correct: 0, total: 0 }
          }
        }));
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
  }, [playerName]);

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

  // Update handleAnswerSelect to use AI feedback
  const handleAnswerSelect = async (option) => {
    if (showResult || !questions[currentQuestion]) return;
    
    const currentQ = questions[currentQuestion];
    const timeTaken = 60 - timeLeft;
    let isAnswerCorrect = false;

    // Check correctness based on question type
    switch (currentQ.questionType) {
      case 'mcq':
        isAnswerCorrect = option === currentQ.correct;
        break;
      case 'true-false':
        isAnswerCorrect = option === currentQ.correct;
        break;
      case 'fill-in-blank':
        isAnswerCorrect = option.toLowerCase().trim() === currentQ.correct.toLowerCase().trim();
        break;
      case 'voice':
      case 'speaking':
      case 'listening':
        isAnswerCorrect = handleVoiceAnswer(option, currentQ);
        break;
      default:
        isAnswerCorrect = option === currentQ.correct;
    }

    setSelectedAnswer(option);
    setIsCorrect(isAnswerCorrect);
    setShowResult(true);

    // Update SRS data
    updateQuestionSRS(currentQ.id, isAnswerCorrect, timeTaken);

    // Generate AI feedback
    try {
      const feedback = await generateFeedback(currentQ, option, timeTaken);
      const updatedQuestions = [...questions];
      updatedQuestions[currentQuestion] = {
        ...currentQ,
        aiGeneratedFeedback: feedback
      };
      setQuestions(updatedQuestions);
    } catch (error) {
      console.error('Failed to generate AI feedback:', error);
    }

    // Update streak and score
    if (isAnswerCorrect) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setScore(score + 1);
      if (newStreak > maxStreak) {
        setMaxStreak(newStreak);
      }
      playCorrectSound();
    } else {
      setStreak(0);
      setLives(prev => prev - 1);
      playIncorrectSound();
    }

    // Update user performance tracking
    setUserPerformance(prev => {
      const questionType = currentQ.questionType || 'mcq';
      return {
        ...prev,
        totalQuestions: prev.totalQuestions + 1,
        correctAnswers: prev.correctAnswers + (isAnswerCorrect ? 1 : 0),
        incorrectAnswers: prev.incorrectAnswers + (isAnswerCorrect ? 0 : 1),
        questionHistory: [...prev.questionHistory, {
          question: currentQ.question,
          userAnswer: option,
          correctAnswer: currentQ.correct,
          isCorrect: isAnswerCorrect,
          timeTaken,
          difficulty: currentQ.difficulty || 'medium',
          questionType,
          masteryLevel: getMasteryLevel(currentQ.id),
          nextReview: getNextReviewDate(currentQ.id)
        }],
        questionTypeStats: {
          ...prev.questionTypeStats,
          [questionType]: {
            correct: (prev.questionTypeStats[questionType]?.correct || 0) + (isAnswerCorrect ? 1 : 0),
            total: (prev.questionTypeStats[questionType]?.total || 0) + 1
          }
        },
        [isAnswerCorrect ? 'strongAreas' : 'weakAreas']: {
          ...prev[isAnswerCorrect ? 'strongAreas' : 'weakAreas'],
          [currentQ.topic || 'general']: (prev[isAnswerCorrect ? 'strongAreas' : 'weakAreas'][currentQ.topic || 'general'] || 0) + 1
        }
      };
    });

    // Save progress
    saveProgress();
  };

  const handleVoiceAnswer = (audioData, question) => {
    // This is a placeholder for voice answer processing
    // In a real implementation, this would:
    // 1. Convert the audio to text using speech recognition
    // 2. Compare the text with the correct answer using fuzzy matching
    // 3. Return true/false based on the comparison
    return false;
  };

  const calculateNewAverage = (oldAverage, oldCount, newValue) => {
    return ((oldAverage * oldCount) + newValue) / (oldCount + 1);
  };

  const calculateMasteryLevel = (performanceData, isCorrect) => {
    const { totalAttempts, correctAttempts } = performanceData || { totalAttempts: 0, correctAttempts: 0 };
    const newCorrectAttempts = correctAttempts + (isCorrect ? 1 : 0);
    const newTotalAttempts = totalAttempts + 1;
    return Math.round((newCorrectAttempts / newTotalAttempts) * 100);
  };

  const updateSRSData = (srsData, isCorrect) => {
    const { repetitionCount, easeFactor, interval } = srsData || {
      repetitionCount: 0,
      easeFactor: 2.5,
      interval: 1
    };

    if (isCorrect) {
      // SM-2 algorithm implementation
      const newInterval = repetitionCount === 0 ? 1 :
        repetitionCount === 1 ? 6 :
        Math.round(interval * easeFactor);

      return {
        repetitionCount: repetitionCount + 1,
        easeFactor: Math.max(1.3, easeFactor + (0.1 - (5 - 5) * (0.08 + (5 - 5) * 0.02))),
        interval: newInterval,
        lastReviewed: new Date(),
        nextReviewDate: new Date(Date.now() + newInterval * 24 * 60 * 60 * 1000)
      };
    } else {
      // Reset on incorrect answer
      return {
        repetitionCount: 0,
        easeFactor: Math.max(1.3, easeFactor - 0.2),
        interval: 1,
        lastReviewed: new Date(),
        nextReviewDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
    }
  };

  const saveProgress = () => {
    // Save highest scores
    localStorage.setItem('highestScore', Math.max(score, highestScore).toString());
    localStorage.setItem('highestStreak', Math.max(maxStreak, highestStreak).toString());
    
    // Save user performance
    localStorage.setItem('userPerformance', JSON.stringify(userPerformance));
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

  // Update endGame to include AI performance review
  const endGame = async () => {
    try {
      const review = await reviewPerformance(
        questions,
        userPerformance.questionHistory.map(h => ({
          questionId: questions[h.questionIndex].id,
          answer: h.userAnswer,
          isCorrect: h.isCorrect,
          responseTime: h.timeTaken
        }))
      );

      setUserPerformance(prev => ({
        ...prev,
        aiReview: review
      }));
    } catch (error) {
      console.error('Failed to generate performance review:', error);
    }

    setGameState('results');
  };

  // Update generateInsights to include AI insights
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
    
    // Add SRS insights
    const dueCount = getDueQuestionsCount();
    if (dueCount > 0) {
      insights.push(`You have ${dueCount} questions due for review.`);
    }

    const masteryLevels = questions.map(q => ({
      topic: q.topic,
      mastery: getMasteryLevel(q.id)
    }));

    const avgMastery = masteryLevels.reduce((sum, q) => sum + q.mastery, 0) / masteryLevels.length;
    insights.push(`Your average mastery level is ${Math.round(avgMastery)}%.`);

    const topicMastery = masteryLevels.reduce((acc, q) => {
      if (!acc[q.topic]) {
        acc[q.topic] = { total: 0, count: 0 };
      }
      acc[q.topic].total += q.mastery;
      acc[q.topic].count += 1;
      return acc;
    }, {});

    Object.entries(topicMastery).forEach(([topic, data]) => {
      const avgTopicMastery = Math.round(data.total / data.count);
      insights.push(`${topic}: ${avgTopicMastery}% mastery`);
    });

    // Add AI-generated insights
    if (userPerformance.aiReview) {
      insights.push(...userPerformance.aiReview.feedback);
      
      if (userPerformance.aiReview.suggestedTopics.length > 0) {
        insights.push('📚 Suggested topics to review:');
        insights.push(...userPerformance.aiReview.suggestedTopics.map(topic => `  • ${topic}`));
      }

      if (userPerformance.aiReview.commonMistakes.length > 0) {
        insights.push('⚠️ Common mistakes to watch out for:');
        insights.push(...userPerformance.aiReview.commonMistakes.map(mistake => `  • ${mistake}`));
      }

      if (userPerformance.aiReview.nextSteps.length > 0) {
        insights.push('🎯 Next steps for improvement:');
        insights.push(...userPerformance.aiReview.nextSteps.map(step => `  • ${step}`));
      }

      insights.push(`🎓 AI Confidence Score: ${userPerformance.aiReview.confidenceScore}%`);
    }

    return insights;
  };

  const generateAnalyticsReport = () => {
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
        case 'fiftyFifty':
          // Remove two incorrect options
          const currentQ = questions[currentQuestion];
          const incorrectOptions = currentOptions.filter(opt => opt !== currentQ.correct);
          const optionsToRemove = incorrectOptions.slice(0, 2);
          setCurrentOptions(prev => prev.filter(opt => !optionsToRemove.includes(opt)));
          break;
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

  // --- Audio helpers -----------------------------------------------------------
  // Simple stubs so the app doesn\'t crash if the audio asset is missing.
  // Replace the `src` values with real sound files placed in /public/audio if desired.
  function playSound(src) {
    if (typeof Audio === 'undefined') return; // SSR / unsupported
    try {
      const audio = new Audio(src);
      // Play in a fire-and-forget way; ignore promise rejection (autoplay blocks etc.)
      audio.play().catch(() => {});
    } catch {
      /* no-op */
    }
  }

  function playCorrectSound() {
    // tiny base64-encoded beep (~0.05 s) as a default fallback
    playSound('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAAAgAAAA');
  }

  function playIncorrectSound() {
    playSound('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAAAgAAAA');
  }
  // ---------------------------------------------------------------------------

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
    <div className="min-h-screen bg-gray-100">
      {gameState === 'menu' && (
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold text-center mb-8">Hindi-English Quiz</h1>
          {!isStudentQuiz && (
            <div className="max-w-md mx-auto">
              <input
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full p-3 rounded-lg border mb-4"
              />
              <button
                onClick={startGame}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Start Quiz
              </button>
            </div>
          )}
          {isStudentQuiz && !studentQuizMode && (
            <div className="max-w-md mx-auto">
              <button
                onClick={startStudentQuiz}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors"
              >
                Start Student Quiz
              </button>
            </div>
          )}
        </div>
      )}

      {gameState === 'playing' && questions[currentQuestion] && (
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-4">
              <div className="text-lg font-semibold">Lives: {lives}</div>
              <div className="text-lg font-semibold">Score: {score}</div>
              <div className="text-lg font-semibold">Streak: {streak}</div>
            </div>
            <div className="text-lg font-semibold">Time: {timeLeft}s</div>
          </div>

          <div className="mb-6">
            <div className="h-2 bg-gray-200 rounded-full">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
            <QuestionFactory
              question={questions[currentQuestion]}
              onAnswer={handleAnswerSelect}
              showFeedback={showResult}
              showHints={true}
            />

            {showResult && (
              <div className={`mt-6 p-4 rounded-lg ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
                <p className={`text-lg font-semibold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                  {isCorrect ? 'Correct!' : 'Incorrect!'}
                </p>
                {!isCorrect && (
                  <p className="mt-2 text-gray-600">
                    The correct answer was: {questions[currentQuestion].correct}
                  </p>
                )}
                {questions[currentQuestion].explanation && (
                  <p className="mt-2 text-gray-600">
                    {questions[currentQuestion].explanation}
                  </p>
                )}

                {/* Show AI feedback */}
                {questions[currentQuestion].aiGeneratedFeedback && (
                  <div className="mt-4 space-y-2">
                    <h4 className="font-medium text-gray-700">AI Feedback:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {questions[currentQuestion].aiGeneratedFeedback.map((feedback, index) => (
                        <li key={index} className="text-gray-600">{feedback}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {isAILoading && (
                  <div className="mt-4 text-gray-600">
                    Generating AI feedback...
                  </div>
                )}

                <button
                  onClick={nextQuestion}
                  className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Next Question
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-center space-x-4">
            {Object.entries(powerUps).map(([type, count]) => (
              count > 0 && (
                <button
                  key={type}
                  onClick={() => powerUp(type)}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  {type} ({count})
                </button>
              )
            ))}
          </div>
        </div>
      )}

      {gameState === 'results' && (
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-bold text-center mb-6">Quiz Complete!</h2>
            <div className="text-center mb-8">
              <p className="text-xl mb-2">Final Score: {score}</p>
              <p className="text-lg mb-2">Highest Streak: {maxStreak}</p>
              <div className="flex justify-center items-center space-x-2">
                <Trophy className="w-6 h-6 text-yellow-500" />
                <p className="text-lg">Rating: {getScoreRating()}</p>
              </div>
            </div>

            <div className="space-y-6">
              {generateInsights()}
              {generateAnalyticsReport()}
            </div>

            <div className="mt-8 flex justify-center space-x-4">
              <button
                onClick={restartGame}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Play Again
              </button>
              <button
                onClick={shareScore}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center"
              >
                <Share2 className="w-5 h-5 mr-2" />
                Share Score
              </button>
            </div>
          </div>
        </div>
      )}

      {showShareSuccess && (
        <div className="fixed bottom-4 right-4 bg-green-100 text-green-700 px-4 py-2 rounded-lg shadow">
          Score copied to clipboard!
        </div>
      )}

      {showPowerUpEffect && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="text-4xl text-white font-bold animate-bounce">
            {showPowerUpEffect}
          </div>
        </div>
      )}
    </div>
  );
};

export default HindiEnglishQuiz;

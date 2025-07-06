import { Question } from '../types/question';
import Anthropic from '@anthropic-ai/sdk';

interface AIReviewResponse {
  feedback: string;
  hints: string[];
  confidenceScore: number;
}

class AIReviewService {
  private anthropic: Anthropic;
  private model: string;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY
    });
    // Using claude-3-haiku-20240307 as it's the most cost-effective model
    this.model = 'claude-3-haiku-20240307';
  }

  private async generatePrompt(question: Question, userAnswer: string): string {
    return `Review this Hindi language learning question and answer:
Question: ${question.question}
Correct Answer: ${question.correct}
User's Answer: ${userAnswer}
Difficulty: ${question.difficulty}
Topic: ${question.topic}

Provide a concise review in this JSON format:
{
  "feedback": "brief 1-2 sentence feedback",
  "hints": ["1-2 short, helpful hints"],
  "confidenceScore": number between 0-1
}`;
  }

  async reviewAnswer(question: Question, userAnswer: string): Promise<AIReviewResponse> {
    try {
      const prompt = await this.generatePrompt(question, userAnswer);
      
      const message = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 150, // Limiting tokens to reduce costs
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3, // Lower temperature for more consistent outputs
      });

      const response = JSON.parse(message.content[0].text);
      return {
        feedback: response.feedback,
        hints: response.hints,
        confidenceScore: response.confidenceScore
      };
    } catch (error) {
      console.error('AI Review error:', error);
      return {
        feedback: 'Unable to generate feedback at this time.',
        hints: [],
        confidenceScore: 0
      };
    }
  }

  async generatePerformanceReport(questions: Question[], answers: Record<string, string>): Promise<string> {
    try {
      const questionsAndAnswers = questions.map(q => ({
        question: q.question,
        correct: q.correct,
        userAnswer: answers[q.id] || 'No answer',
        topic: q.topic
      }));

      const message = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Analyze these question-answer pairs and provide a brief performance report:
${JSON.stringify(questionsAndAnswers, null, 2)}

Focus on:
1. Overall performance
2. Areas for improvement
3. One specific study tip

Keep the response under 150 words.`
          }
        ],
        temperature: 0.3,
      });

      return message.content[0].text;
    } catch (error) {
      console.error('Performance report error:', error);
      return 'Unable to generate performance report at this time.';
    }
  }
}

export const aiReviewService = new AIReviewService(); 
"use client"

import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/store/hooks';
import React, { useEffect, useState } from 'react';
import { useCompletion } from "@ai-sdk/react";
import { BotMessageSquare, X, Send, Bot, Loader, User } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { cleanText, cleanTextAR, cleanTextDE, parseMCQQuestions, parseMCQQuestionsAR, parseMCQQuestionsDE } from '@/lib/utils/quiz-parser';

// Accept lessonContent as a prop
interface TestMyKnowledgeProps {
  lessonContent: string;
}

const TestMyKnowledge: React.FC<TestMyKnowledgeProps> = ({ lessonContent }) => {
  const t = useTranslations()
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // Remove useAppSelector for currentLessonContent
  // const currentLessonContent = useAppSelector((state) => state.course.currentLessonContent);
  const currentLessonTitle = useAppSelector((state) => state.course.currentLessonTitle);
  const [questions, setQuestions] = useState<Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
  }>>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // const [hasGenerated, setHasGenerated] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [allQuestionsAnswered, setAllQuestionsAnswered] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [stableQuestionCount, setStableQuestionCount] = useState(0);
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const lang = useLocale();

  useEffect(() => {
    setShowSuggestions(false);
  }, [currentQuestionIndex]);

  const processCompletionText = (text: string) => {
    const cleanedText = lang === 'ar' ? cleanTextAR(text) :
      lang === 'de' ? cleanTextDE(text) :
        cleanText(text);

    return lang === 'ar' ? parseMCQQuestionsAR(cleanedText) :
      lang === 'de' ? parseMCQQuestionsDE(cleanedText) :
        parseMCQQuestions(cleanedText);
  };

  const {
    completion,
    complete,
  } = useCompletion({
    api: '/api/generate-quiz',
    body: {
      content: lessonContent,
      type: 'mcq',
      lang
    },
    onFinish: (prompt, completion) => {
      try {
        const parsedQuestions = processCompletionText(completion);

        if (parsedQuestions.length > 0) {
          setQuestions(parsedQuestions);
          setAnswers(Array(parsedQuestions.length).fill(null));
          setIsLoading(false);
        } else {
          setError('Failed to parse quiz questions');
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        setError('Failed to generate quiz');
      }
    },
    onError: (error) => {
      setError(error.message);
      setIsLoading(false);
    }
  });
// useEffect(() => {
//   if (!lessonContent || lessonContent.trim() === "") return;

//   if (!hasGenerated) {
//     setHasGenerated(true);
//     setIsLoading(true);
//     complete('');
//   }
// }, [hasGenerated, complete, lessonContent]);
useEffect(() => {
  if (!lessonContent || lessonContent.trim() === "") return;

  // Reset state
  setQuestions([]);
  setAnswers([]);
  setError(null);
  setIsLoading(true);
  setQuizComplete(false);
  setScore(null);
  setReviewMode(false);
  setShowSuggestions(false);

  // Generate quiz
  const timeout = setTimeout(() => {
    complete('', {
      body: {
        content: lessonContent,
        type: 'mcq',
        lang,
      },
    });
  }, 100);

  return () => clearTimeout(timeout);
}, [lessonContent, lang]);



  useEffect(() => {
    if (answers.length > 0 && questions.length > 0) {
      const allAnswered = answers.every((answer) => answer !== null);
      setAllQuestionsAnswered(allAnswered);
    }
  }, [answers, questions.length]);


  const handleOptionSelect = (optionIndex: number) => {
    if (quizComplete) return;
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else if (currentQuestionIndex === questions.length - 1 && allQuestionsAnswered) {
      calculateScore();
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const calculateScore = () => {
    if (questions.length === 0) return;

    let correctCount = 0;
    answers.forEach((answer, index) => {
      if (typeof answer === 'number' && index < questions.length && answer === questions[index].correctAnswer) {
        correctCount++;
      }
    });

    const percentageScore = (correctCount / questions.length) * 100;
    setScore(percentageScore);
    setQuizComplete(true);
    setReviewMode(true);
    setCurrentQuestionIndex(0);
  };

  const restartQuiz = () => {
    setCurrentQuestionIndex(0);
    setAnswers(Array(questions.length).fill(null));
    setQuizComplete(false);
    setScore(null);
    setReviewMode(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey && userPrompt.trim()) {
      e.preventDefault();
      handleAssistanceQuerry();
    }
  };

  // Assistant states
  const [assistantResponse, setAssistantResponse] = useState<{ chat_id: string, query_status: boolean, response: string } | null>(null);
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [lastPrompt, setLastPrompt] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleAssistance = async () => {
    try {
      setUserPrompt("");
      setAssistantResponse(null);
      setShowSuggestions(true);
      setIsTyping(true);

      const assignment = questions[currentQuestionIndex].question;
      setLastPrompt(assignment);
      const query = `Can you explain, ${currentQuestion.question} in the context of ${currentLessonTitle}, tell in one line only, to the point and short.`;

      const response = await fetch('https://lesson-assistant.onrender.com/start-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ assignment, query })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      setAssistantResponse(data);
      setIsTyping(false);

    } catch (error) {
      console.error('Error fetching assistance:', error);
    }
  };

  const handleAssistanceQuerry = async () => {
    try {
      const chat_id = assistantResponse?.chat_id;
      const query = userPrompt + ", tell in one line only, to the point and short.";
      setLastPrompt(userPrompt);
      setUserPrompt('');
      setIsTyping(true);

      const response = await fetch('https://lesson-assistant.onrender.com/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ chat_id, query })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      setAssistantResponse(data);
      setIsTyping(false);

    } catch (error) {
      console.error('Error fetching assistance:', error);
    }
  };

  if (isLoading || questions.length === 0) {
    return (
      <div className="p-6 bg-white rounded-lg shadow flex flex-col items-center justify-center min-h-60">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mb-4"></div>
        <p className="text-gray-700 font-medium">{t('TestMyKnowledge.generatingQuiz')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="text-red-500 text-center">
          <p className="font-medium">Failed to generate quiz</p>
          <p className="mt-2">{error}</p>
          <Button
            className="mt-4 bg-purple-500 text-white px-4 py-2 rounded-lg"
            onClick={() => {
              setError(null);
              // setHasGenerated(false);
            }}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (quizComplete && score !== null && !reviewMode) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <h2 className="text-2xl font-bold text-center mb-6">{t('TestMyKnowledge.quizResults')}</h2>

        <div className="text-center mb-8">
          <div className="text-6xl font-bold text-purple-600 mb-2">{Math.round(score)}%</div>
          <p className="text-gray-700">
            {t('TestMyKnowledge.youGot')} {answers.filter((answer, index) =>
              typeof answer === 'number' && index < questions.length && answer === questions[index].correctAnswer
            ).length} {t('TestMyKnowledge.outOf')} {questions.length} {t('TestMyKnowledge.questionsCorrect')}
          </p>
        </div>

        <div className="flex justify-center">
          <Button
            className="px-6 py-2 bg-purple-500 text-white rounded-lg mr-4"
            onClick={() => {
              setReviewMode(true);
              setCurrentQuestionIndex(0);
            }}
          >
            {t('TestMyKnowledge.reviewQuestions')}
          </Button>
          <Button
            onClick={restartQuiz}
          >
            {t('TestMyKnowledge.retakeQuiz')}
          </Button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progressPercentage = ((currentQuestionIndex + 1) / questions.length) * 100;

  const isPlaceholder = currentQuestionIndex >= questions.length;

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">
          {quizComplete ? t('TestMyKnowledge.quizResults') : t('TestMyKnowledge.multipleChoiceQuiz')}
        </h2>
        {quizComplete && (
          <div className="text-purple-600 font-medium">
            {t('TestMyKnowledge.score')} {Math.round(score || 0)}%
          </div>
        )}
        {!quizComplete && (
          <div className="flex items-center gap-3">
            <span
              onClick={showSuggestions ? () => setShowSuggestions(false) : handleAssistance}
              className="flex items-center justify-center p-3 overflow-hidden font-semibold text-white transition-all duration-300 bg-primary rounded-full shadow-lg hover:bg-purple-700 hover:shadow-xl active:scale-95"
            >
              {showSuggestions ? <X /> : <BotMessageSquare />}
            </span>
          </div>
        )}
      </div>

      <div className="pb-4 border-b border-gray-200">
        <div className="flex items-center mb-2">
          <span className="text-gray-700 font-medium">{t('TestMyKnowledge.question')} {currentQuestionIndex + 1} of {questions.length}</span>
          <div className="ml-2 flex-grow h-2 bg-gray-200 rounded-full">
            <div
              className="h-full bg-purple-500 rounded-full"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className='flex flex-row justify-between gap-8'>
        <div className="py-6">
          <h2 className="text-xl font-bold text-gray-800 mb-8">{currentQuestion?.question}</h2>

          <div className="space-y-4">
            {currentQuestion?.options.map((option, index) => {
              const isCorrect = currentQuestion?.correctAnswer === index;
              const isSelected = answers[currentQuestionIndex] === index;
              const showResultInline = quizComplete || isSelected;

              return (
                <div
                  key={index}
                  className={`flex items-center p-2 rounded transition-all duration-200 ${showResultInline ? (
                    isCorrect ? 'bg-green-50' :
                      isSelected ? 'bg-red-50' : ''
                  ) : (isSelected ? 'bg-purple-50' : '')
                    } ${isPlaceholder ? 'opacity-50' : ''}`}
                  role="button"
                  onClick={() => !isPlaceholder && !quizComplete && handleOptionSelect(index)}
                >
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 ${isSelected
                    ? (showResultInline && !isCorrect ? 'border-red-500' : 'border-purple-500')
                    : 'border-gray-400'
                    }`}>
                    {showResultInline ? (
                      isCorrect ? (
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                      ) : isSelected ? (
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                      ) : null
                    ) : (
                      isSelected && <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                    )}
                  </div>
                  <span className={`text-gray-800 ${(showResultInline && isCorrect) ? 'font-medium' : ''
                    }`}>{option}</span>

                  {/* Immediate feedback message */}
                  {isSelected && showResultInline && !quizComplete && (
                    <span className={`ml-auto text-end text-sm font-medium ${isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                      {isCorrect ? t('TestMyKnowledge.correct_answer') : t('TestMyKnowledge.incorrect_answer')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {showSuggestions && (
          <div className="relative bg-gray-100 text-gray-800 rounded-2xl shadow-md my-2 w-1/3 flex flex-col max-h-[350px] overflow-scroll">
            <div className="bg-purple-500 text-white px-4 py-3 flex items-center gap-2">
              <Bot size={20} />
              <span className="font-medium">{t('TestMyKnowledge.quizAssistant')}</span>
              <div className="ml-auto flex items-center">
                <span className="text-xs animate-[spin_8s_linear_infinite] px-2 py-1 rounded-full">
                  <Loader />
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {lastPrompt && (
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-2 bg-white rounded-xl p-1 w-fit">
                    <div className="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center">
                      <User size={18} className="text-purple-600" />
                    </div>
                    <span className="text-sm font-medium text-purple-700">{t('TestMyKnowledge.yourQuery')}</span>
                  </div>

                  <div
                    className={`ml-8 px-4 py-3 rounded-lg bg-purple-400 text-white shadow-md`}
                  >
                    {lastPrompt}
                  </div>
                </div>
              )}

              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2 bg-white rounded-xl p-1 w-fit">
                  <div className="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center">
                    <Bot size={18} className="text-purple-600" />
                  </div>
                  <span className="text-sm font-medium text-purple-700">{t('TestMyKnowledge.response')}</span>
                </div>

                {isTyping ? (
                  <div className="ml-8 px-4 py-3 rounded-lg bg-white shadow-md border-l-4 border-purple-500">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`ml-8 px-4 py-3 rounded-lg bg-white shadow-md border-l-4 border-purple-500`}
                  >
                    {assistantResponse?.response}
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 px-4 py-2 bg-gray-100 border-t border-gray-300 flex items-center gap-2">
              <input
                type="text"
                value={userPrompt}
                onKeyDown={handleKeyDown}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder={t('chatbot.placeholder')}
                className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button onClick={handleAssistanceQuerry} disabled={!userPrompt.trim()} className="p-2.5 bg-primary rounded-full text-white hover:bg-purple-700">
                <Send />
              </Button>
            </div>
          </div>
        )}

      </div>

      <div className="pt-4 border-t border-gray-200 flex justify-between">
        <div className="text-purple-600 font-medium">
       {!quizComplete && !allQuestionsAnswered && currentQuestionIndex === questions.length - 1 &&
  t('TestMyKnowledge.answer_all_to_submit')}

          {quizComplete && (
            <>
              <p className={answers[currentQuestionIndex] === currentQuestion?.correctAnswer ? 'text-green-500' : 'text-red-500'}>
                {answers[currentQuestionIndex] === currentQuestion?.correctAnswer ? t('TestMyKnowledge.correct_answer') : t('TestMyKnowledge.incorrect_answer')}
              </p>
              <p className='text-gray-500'>{questions[currentQuestionIndex].explanation}</p>
            </>
          )}
        </div>
        <div className="flex space-x-2">
          <Button
            className={`px-4 py-2 flex items-center border border-gray-300 rounded-lg ${currentQuestionIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={goToPreviousQuestion}
            disabled={currentQuestionIndex === 0}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('TestMyKnowledge.previous')}
          </Button>

          {quizComplete && reviewMode ? (
            <Button
              className="px-4 py-2 bg-purple-500 text-white rounded-lg"
              onClick={() => {
                setReviewMode(false); // Going to summary mode
              }}
            >
              {t('TestMyKnowledge.showSummary')}
            </Button>
          ) : (
            <Button
              className={`px-4 py-2 flex items-center ${currentQuestionIndex === questions.length - 1
                  ? (allQuestionsAnswered ? 'bg-green-500' : 'bg-gray-400')
                  : 'bg-purple-500'
                } text-white rounded-lg`}
              onClick={goToNextQuestion}
              disabled={currentQuestionIndex === questions.length - 1 && !allQuestionsAnswered}
            >
              {currentQuestionIndex === questions.length - 1
                ? (allQuestionsAnswered ? t('TestMyKnowledge.submit') : t('TestMyKnowledge.next'))
                : t('TestMyKnowledge.next')}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          )}



        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {answers.slice(0, questions.length).map((answer, index) => (
          <div
            key={index}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
              ${answer !== null
                ? (quizComplete && questions[index] && answer === questions[index].correctAnswer
                  ? 'bg-green-500 text-white'
                  : quizComplete
                    ? 'bg-red-500 text-white'
                    : 'bg-purple-500 text-white')
                : 'bg-gray-200 text-gray-600'}
              ${currentQuestionIndex === index ? 'ring-2 ring-purple-300' : ''}
            `}
            onClick={() => setCurrentQuestionIndex(index)}
            role="button"
          >
            {index + 1}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TestMyKnowledge;
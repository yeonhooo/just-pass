import { useState, useEffect } from 'react';
import type { Question } from '../types/quiz';
import { fetchAuthSession } from 'aws-amplify/auth';

interface Props {
  questions: Question[];
  startIndex?: number;
  initialAnswers?: Map<number, string[]>;
  wrongOnlyMode?: boolean;
  knownQuestions?: number[];
  startedAt?: number;
  onFinish: (answers: Map<number, string[]>, elapsedTime: number) => void;
  onReset: () => void;
  onProgressUpdate?: (index: number, answers: Map<number, string[]>) => void;
  onToggleKnown?: (questionNumber: number) => void;
}

const AI_API_URL = import.meta.env.VITE_AI_API_URL;

// Bedrock을 통한 번역 및 해설 생성
const callBedrockAPI = async (action: 'translate' | 'explain', text: string, answer?: string): Promise<string> => {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    
    const response = await fetch(`${AI_API_URL}/ai/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token || '',
      },
      body: JSON.stringify({ text, answer }),
    });
    
    if (!response.ok) throw new Error('API 호출 실패');
    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('Bedrock API 오류:', error);
    return action === 'translate' ? '번역 실패' : '해설 생성 실패';
  }
}

export function QuizView({ 
  questions, 
  startIndex = 0,
  initialAnswers,
  wrongOnlyMode = false,
  knownQuestions = [],
  startedAt,
  onFinish, 
  onReset,
  onProgressUpdate,
  onToggleKnown
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [userAnswers, setUserAnswers] = useState<Map<number, string[]>>(
    initialAnswers || new Map()
  );
  const [showAnswer, setShowAnswer] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showTranslation, setShowTranslation] = useState(true);
  const [showExplanationPanel, setShowExplanationPanel] = useState(true);
  const [translation, setTranslation] = useState<string>('');
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [loadingTranslation, setLoadingTranslation] = useState(false);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  
  // startedAt이 있으면 사용, 없으면 현재 시간
  const actualStartTime = startedAt || Date.now();

  // 타이머
  useEffect(() => {
    // 초기 경과 시간 계산
    setElapsedTime(Math.floor((Date.now() - actualStartTime) / 1000));
    
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - actualStartTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [actualStartTime]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentIndex];
  const selectedAnswers = userAnswers.get(currentQuestion.number) || [];
  const isMultipleChoice = currentQuestion.answer.length > 1;
  const isKnown = knownQuestions.includes(currentQuestion.number);

  // 문제 변경 시 번역 로드
  useEffect(() => {
    const loadTranslation = async () => {
      if (!showTranslation) return;
      setLoadingTranslation(true);
      setTranslation('');
      const translated = await callBedrockAPI('translate', currentQuestion.text);
      setTranslation(translated);
      setLoadingTranslation(false);
    };
    loadTranslation();
  }, [currentQuestion.number, showTranslation]);

  // 정답 확인 시 AI 해설 생성
  useEffect(() => {
    const loadExplanation = async () => {
      if (!showAnswer || !showExplanationPanel) return;
      setLoadingExplanation(true);
      setAiExplanation('');
      const correctAnswer = currentQuestion.answer.join(', ');
      const explanation = await callBedrockAPI('explain', currentQuestion.text, correctAnswer);
      setAiExplanation(explanation);
      setLoadingExplanation(false);
    };
    loadExplanation();
  }, [showAnswer, currentQuestion.number, showExplanationPanel]);

  useEffect(() => {
    onProgressUpdate?.(currentIndex, userAnswers);
  }, [currentIndex, userAnswers]);

  const handleSelect = (letter: string) => {
    if (showAnswer) return;
    
    setUserAnswers(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(currentQuestion.number) || [];
      
      if (isMultipleChoice) {
        if (current.includes(letter)) {
          newMap.set(currentQuestion.number, current.filter(l => l !== letter));
        } else {
          newMap.set(currentQuestion.number, [...current, letter]);
        }
      } else {
        newMap.set(currentQuestion.number, [letter]);
      }
      
      return newMap;
    });
  };

  const handleNext = () => {
    setShowAnswer(false);
    setAiExplanation('');
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onFinish(userAnswers, elapsedTime);
    }
  };

  const handlePrev = () => {
    setShowAnswer(false);
    setAiExplanation('');
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const isCorrect = (letter: string) => currentQuestion.answer.includes(letter);
  const isSelected = (letter: string) => selectedAnswers.includes(letter);

  return (
    <div className="quiz-layout">
      {/* 왼쪽: 문제 */}
      <div className="quiz-container">
        <div className="quiz-header">
          <button onClick={onReset} className="btn-reset">← 목록으로</button>
          <div className="progress-info">
            {wrongOnlyMode && <span className="wrong-only-badge">오답 모드</span>}
            <span className="timer">⏱ {formatTime(elapsedTime)}</span>
            <span className="progress">
              {currentIndex + 1} / {questions.length}
            </span>
          </div>
        </div>

        <div className="question-card">
          <div className="question-top">
            <div>
              <h2 className="question-number">문제 {currentQuestion.number}</h2>
              {isMultipleChoice && <span className="multi-badge">복수 정답</span>}
            </div>
            <div className="question-actions">
              {(!showTranslation || !showExplanationPanel) && (
                <button 
                  onClick={() => {
                    setShowTranslation(true);
                    setShowExplanationPanel(true);
                  }} 
                  className="btn-toggle-panel"
                >
                  💡 번역/해설 보기
                </button>
              )}
              {onToggleKnown && (
                <button 
                  className={`btn-known ${isKnown ? 'active' : ''}`}
                  onClick={() => onToggleKnown(currentQuestion.number)}
                  title={isKnown ? '아는 문제 해제' : '아는 문제로 표시'}
                >
                  {isKnown ? '✓ 알아요' : '아는 문제'}
                </button>
              )}
            </div>
          </div>
          
          <p className="question-text">{currentQuestion.text}</p>

          <div className="choices">
            {currentQuestion.choices.map((choice) => (
              <button
                key={choice.letter}
                onClick={() => handleSelect(choice.letter)}
                className={`choice ${isSelected(choice.letter) ? 'selected' : ''} 
                  ${showAnswer && isCorrect(choice.letter) ? 'correct' : ''}
                  ${showAnswer && isSelected(choice.letter) && !isCorrect(choice.letter) ? 'wrong' : ''}`}
              >
                <span className="choice-letter">{choice.letter}</span>
                <span className="choice-text">{choice.text}</span>
              </button>
            ))}
          </div>

          {showAnswer && currentQuestion.explanation && (
            <div className="explanation">
              <h3>해설</h3>
              <p>{currentQuestion.explanation}</p>
            </div>
          )}
        </div>

        <div className="quiz-footer">
          <button onClick={handlePrev} disabled={currentIndex === 0} className="btn-nav">
            ← 이전
          </button>
          
          {!showAnswer && (
            <button 
              onClick={() => setShowAnswer(true)} 
              disabled={selectedAnswers.length === 0}
              className="btn-check"
            >
              정답 확인
            </button>
          )}
          
          <button 
            onClick={handleNext} 
            className="btn-next"
          >
            {currentIndex === questions.length - 1 ? '결과 보기' : '다음 →'}
          </button>
        </div>
      </div>

      {/* 오른쪽: 번역 + 해설 패널 */}
      {(showTranslation || showExplanationPanel) && (
        <div className="side-panels">
          {/* 번역 패널 (상단) */}
          {showTranslation && (
            <div className="translation-panel">
              <div className="panel-header">
                <h3>🌐 한글 번역</h3>
                <button onClick={() => setShowTranslation(false)} className="btn-close-panel">✕</button>
              </div>
              <div className="panel-content">
                {loadingTranslation ? (
                  <div className="panel-loading">번역 중...</div>
                ) : (
                  <p className="translation-text">{translation}</p>
                )}
              </div>
            </div>
          )}

          {/* AI 해설 패널 (하단) */}
          {showExplanationPanel && (
            <div className="explanation-panel">
              <div className="panel-header">
                <h3>💡 AI 해설</h3>
                <button onClick={() => setShowExplanationPanel(false)} className="btn-close-panel">✕</button>
              </div>
              <div className="panel-content">
                {!showAnswer ? (
                  <div className="panel-placeholder">
                    정답을 확인하면 AI가 생성한 상세 해설을 볼 수 있습니다.
                  </div>
                ) : loadingExplanation ? (
                  <div className="panel-loading">해설 생성 중...</div>
                ) : (
                  <div className="ai-explanation">{aiExplanation}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

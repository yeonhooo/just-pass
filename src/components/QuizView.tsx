import { useState, useEffect } from 'react';
import type { Question } from '../types/quiz';
import { fetchAuthSession } from 'aws-amplify/auth';
import { saveTranslationToCloud, saveAiExplanationToCloud, saveProgressToCloud } from '../utils/cloudStorage';
import { marked } from 'marked';

// marked 설정
marked.setOptions({
  breaks: true,
  gfm: true,
});

interface Props {
  questions: Question[];
  quizId: string;
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

// 마크다운을 HTML로 변환
const renderMarkdown = (text: string): string => {
  return marked.parse(text) as string;
};

// Bedrock을 통한 번역 및 해설 생성
const callBedrockAPI = async (action: 'translate' | 'explain', text: string, answer?: string, explanation?: string): Promise<string> => {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    
    if (!token) {
      console.error('인증 토큰이 없습니다');
      return action === 'translate' ? '로그인이 필요합니다' : '로그인이 필요합니다';
    }
    
    console.log(`Calling ${action} API...`, { text: text.substring(0, 50) });
    
    const response = await fetch(`${AI_API_URL}/ai/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
      body: JSON.stringify({ text, answer, explanation }),
    });
    
    console.log(`${action} response status:`, response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${action} API 오류:`, response.status, errorText);
      throw new Error(`API 호출 실패: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 해설 생성은 비동기 처리 (202 Accepted)
    if (action === 'explain' && response.status === 202) {
      const jobId = data.jobId;
      console.log('Explanation job started:', jobId);
      
      // 폴링으로 결과 확인
      return await pollJobStatus(jobId, token);
    }
    
    console.log(`${action} result:`, data.result?.substring(0, 100));
    return data.result;
  } catch (error) {
    console.error('Bedrock API 오류:', error);
    return action === 'translate' ? '번역 실패 (네트워크 오류)' : '해설 생성 실패 (네트워크 오류)';
  }
}

// Job 상태 폴링
const pollJobStatus = async (jobId: string, token: string, maxAttempts = 60): Promise<string> => {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
    
    try {
      const response = await fetch(`${AI_API_URL}/ai/status/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': token,
        },
      });
      
      if (!response.ok) {
        console.error('Status check failed:', response.status);
        continue;
      }
      
      const data = await response.json();
      console.log(`Job ${jobId} status:`, data.status);
      
      if (data.status === 'completed') {
        return data.result;
      }
      
      if (data.status === 'failed') {
        return `해설 생성 실패: ${data.error || '알 수 없는 오류'}`;
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }
  
  return '해설 생성 시간 초과 (2분)';
};

export function QuizView({ 
  questions,
  quizId,
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
  const [sidebarWidth, setSidebarWidth] = useState(() => window.innerWidth / 2);
  const [isResizing, setIsResizing] = useState(false);
  const [localStartTime, setLocalStartTime] = useState<number | null>(null);
  
  // 타이머
  useEffect(() => {
    // 로컬 시작 시간이 있으면 우선 사용
    if (localStartTime) {
      setElapsedTime(0);
      const timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - localStartTime) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    }
    
    // startedAt이 없으면 현재 시간 사용
    if (!startedAt) {
      const now = Date.now();
      setElapsedTime(0);
      const timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - now) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    }
    
    // startedAt이 초 단위인지 밀리초 단위인지 확인
    // Unix timestamp는 1970년 이후 초 단위로 10자리 숫자 (예: 1710000000)
    // 밀리초는 13자리 숫자 (예: 1710000000000)
    const startTime = startedAt < 10000000000 
      ? startedAt * 1000  // 초 단위면 밀리초로 변환
      : startedAt;
    
    // 초기 경과 시간 계산
    setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt, localStartTime]);

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

  // 문제 변경 시 번역과 해설 동시 로드
  useEffect(() => {
    const loadContent = async () => {
      // 번역 로드
      if (showTranslation) {
        if (currentQuestion.translation) {
          setTranslation(currentQuestion.translation);
        } else {
          setLoadingTranslation(true);
          setTranslation('');
          
          try {
            const fullText = `${currentQuestion.text}\n\n${currentQuestion.choices.map(c => `${c.letter}. ${c.text}`).join('\n')}`;
            const translated = await callBedrockAPI('translate', fullText);
            const cleanedTranslation = renderMarkdown(translated);
            
            setTranslation(cleanedTranslation);
            saveTranslationToCloud(quizId, currentQuestion.number, cleanedTranslation).catch(err => {
              console.error('번역 저장 실패:', err);
            });
          } catch (err) {
            console.error('번역 실패:', err);
            setTranslation('번역을 불러올 수 없습니다.');
          }
          setLoadingTranslation(false);
        }
      }
      
      // 해설 미리 로드 (캐시에 없을 때만)
      if (!currentQuestion.aiExplanation) {
        setLoadingExplanation(true);
        try {
          const correctAnswer = currentQuestion.answer.join(', ');
          const explanation = await callBedrockAPI('explain', currentQuestion.text, correctAnswer, currentQuestion.explanation);
          const cleanedExplanation = renderMarkdown(explanation);
          
          setAiExplanation(cleanedExplanation);
          saveAiExplanationToCloud(quizId, currentQuestion.number, cleanedExplanation).catch(err => {
            console.error('해설 저장 실패:', err);
          });
        } catch (err) {
          console.error('해설 로딩 실패:', err);
          setAiExplanation('해설을 불러올 수 없습니다. 정답 확인 후 다시 시도해주세요.');
        }
        setLoadingExplanation(false);
      } else {
        setAiExplanation(currentQuestion.aiExplanation);
      }
    };
    
    loadContent();
  }, [currentQuestion.number, showTranslation, quizId]);

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

  // 리사이저 핸들러
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= 800) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  return (
    <div className="quiz-layout">
      {/* 왼쪽: 문제 */}
      <div className="quiz-container" style={{ marginRight: (showTranslation || showExplanationPanel) ? `${sidebarWidth + 8}px` : '0' }}>
        <div className="quiz-header">
          <button onClick={onReset} className="btn-reset">← 목록으로</button>
          
          <div className="progress-jump">
            <input
              type="number"
              min="1"
              max={questions.length}
              placeholder={`${currentIndex + 1} / ${questions.length}`}
              className="jump-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const num = parseInt(e.currentTarget.value);
                  if (num >= 1 && num <= questions.length) {
                    setCurrentIndex(num - 1);
                    setShowAnswer(false);
                    setAiExplanation('');
                    e.currentTarget.value = '';
                  }
                }
              }}
            />
          </div>
          
          <div className="progress-info">
            {wrongOnlyMode && <span className="wrong-only-badge">오답 모드</span>}
            <span className="timer">
              ⏱ {formatTime(elapsedTime)}
              <button 
                onClick={async () => {
                  const now = Date.now();
                  setLocalStartTime(now);
                  if (quizId) {
                    try {
                      await saveProgressToCloud(quizId, {
                        currentIndex,
                        userAnswers: Object.fromEntries(userAnswers),
                        knownQuestions,
                        startedAt: now,
                      });
                    } catch (err) {
                      console.error('타이머 초기화 실패:', err);
                    }
                  }
                }}
                className="btn-timer-reset"
                title="타이머 초기화"
              >
                🔄
              </button>
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
        <>
          <div 
            className="resizer" 
            onMouseDown={handleMouseDown}
            style={{ 
              right: `${sidebarWidth}px`,
              cursor: 'col-resize'
            }}
          />
          <div className="side-panels" style={{ width: `${sidebarWidth}px` }}>
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
                  <div className="translation-text" dangerouslySetInnerHTML={{ __html: translation }} />
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
                  loadingExplanation ? (
                    <div className="panel-loading">해설 준비 중...</div>
                  ) : (
                    <div className="panel-placeholder">
                      정답을 확인하면 AI가 생성한 상세 해설을 볼 수 있습니다.
                    </div>
                  )
                ) : loadingExplanation ? (
                  <div className="panel-loading">해설 생성 중... 잠시만 기다려주세요.</div>
                ) : (
                  <div className="ai-explanation" dangerouslySetInnerHTML={{ __html: aiExplanation }} />
                )}
              </div>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}

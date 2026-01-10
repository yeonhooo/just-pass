import { useState, useEffect } from 'react';
import type { Question } from '../types/quiz';

interface Props {
  questions: Question[];
  startIndex?: number;
  initialAnswers?: Map<number, string[]>;
  wrongOnlyMode?: boolean;
  knownQuestions?: number[];
  onFinish: (answers: Map<number, string[]>) => void;
  onReset: () => void;
  onProgressUpdate?: (index: number, answers: Map<number, string[]>) => void;
  onToggleKnown?: (questionNumber: number) => void;
}

export function QuizView({ 
  questions, 
  startIndex = 0,
  initialAnswers,
  wrongOnlyMode = false,
  knownQuestions = [],
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

  const currentQuestion = questions[currentIndex];
  const selectedAnswers = userAnswers.get(currentQuestion.number) || [];
  const isMultipleChoice = currentQuestion.answer.length > 1;
  const isKnown = knownQuestions.includes(currentQuestion.number);

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
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onFinish(userAnswers);
    }
  };

  const handlePrev = () => {
    setShowAnswer(false);
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const isCorrect = (letter: string) => currentQuestion.answer.includes(letter);
  const isSelected = (letter: string) => selectedAnswers.includes(letter);

  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <button onClick={onReset} className="btn-reset">← 목록으로</button>
        <div className="progress-info">
          {wrongOnlyMode && <span className="wrong-only-badge">오답 모드</span>}
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
        
        {!showAnswer ? (
          <button 
            onClick={() => setShowAnswer(true)} 
            disabled={selectedAnswers.length === 0}
            className="btn-check"
          >
            정답 확인
          </button>
        ) : (
          <button onClick={handleNext} className="btn-next">
            {currentIndex === questions.length - 1 ? '결과 보기' : '다음 →'}
          </button>
        )}
      </div>
    </div>
  );
}

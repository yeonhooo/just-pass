import type { Question } from '../types/quiz';

interface Props {
  questions: Question[];
  userAnswers: Map<number, string[]>;
  onRetry: () => void;
  onRetryWrongOnly: () => void;
  onReset: () => void;
}

export function ResultView({ questions, userAnswers, onRetry, onRetryWrongOnly, onReset }: Props) {
  const results = questions.map(q => {
    const userAnswer = userAnswers.get(q.number) || [];
    const isCorrect = 
      userAnswer.length === q.answer.length &&
      userAnswer.every(a => q.answer.includes(a));
    return { question: q, userAnswer, isCorrect };
  });

  const correctCount = results.filter(r => r.isCorrect).length;
  const wrongCount = results.length - correctCount;
  const score = Math.round((correctCount / questions.length) * 100);

  return (
    <div className="result-container">
      <div className="result-header">
        <h1>퀴즈 결과</h1>
        <div className="score-circle">
          <span className="score-number">{score}</span>
          <span className="score-unit">점</span>
        </div>
        <p className="score-detail">
          {questions.length}문제 중 {correctCount}문제 정답
        </p>
      </div>

      <div className="result-actions">
        <button onClick={onRetry} className="btn-retry">전체 다시 풀기</button>
        {wrongCount > 0 && (
          <button onClick={onRetryWrongOnly} className="btn-wrong-only">
            오답만 다시 풀기 ({wrongCount}문제)
          </button>
        )}
        <button onClick={onReset} className="btn-new">목록으로</button>
      </div>

      <div className="result-list">
        <h2>오답 노트</h2>
        {results.filter(r => !r.isCorrect).map(({ question, userAnswer }) => (
          <div key={question.number} className="wrong-item">
            <h3>문제 {question.number}</h3>
            <p className="wrong-question">{question.text}</p>
            <p className="wrong-answer">
              내 답: <span className="user-ans">{userAnswer.join(', ') || '미응답'}</span>
              {' / '}
              정답: <span className="correct-ans">{question.answer.join(', ')}</span>
            </p>
            {question.explanation && (
              <p className="wrong-explanation">{question.explanation}</p>
            )}
          </div>
        ))}
        {results.every(r => r.isCorrect) && (
          <p className="perfect">🎉 모든 문제를 맞혔습니다!</p>
        )}
      </div>
    </div>
  );
}

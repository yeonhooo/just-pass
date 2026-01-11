interface QuizItem {
  id: string;
  name: string;
  questionCount: number;
  createdAt: number;
}

interface ProgressInfo {
  quizId: string;
  currentIndex: number;
  completedAt?: number;
  score?: number;
}

interface Props {
  quizzes: QuizItem[];
  progressMap: Map<string, ProgressInfo>;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onUploadNew: () => void;
}

export function QuizList({ quizzes, progressMap, onSelect, onDelete, onUploadNew }: Props) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('이 퀴즈를 삭제하시겠습니까?')) {
      onDelete(id);
    }
  };

  const getProgressText = (quiz: QuizItem) => {
    const progress = progressMap.get(quiz.id);
    if (!progress) return null;
    
    if (progress.completedAt) {
      return `완료 (${progress.score}점)`;
    }
    
    const percent = Math.round((progress.currentIndex / quiz.questionCount) * 100);
    return `진행 중 ${percent}%`;
  };

  return (
    <div className="quiz-list">
      <div className="quiz-list-header">
        <h2>저장된 퀴즈</h2>
        <button onClick={onUploadNew} className="btn-upload-new">
          + 새 PDF 업로드
        </button>
      </div>

      {quizzes.length === 0 ? (
        <div className="empty-list">
          <p>저장된 퀴즈가 없습니다.</p>
          <p>PDF를 업로드하여 퀴즈를 시작하세요.</p>
        </div>
      ) : (
        <div className="quiz-items">
          {quizzes.map((quiz) => {
            const progressText = getProgressText(quiz);
            return (
              <div 
                key={quiz.id} 
                className="quiz-item"
                onClick={() => onSelect(quiz.id)}
              >
                <div className="quiz-item-info">
                  <h3>{quiz.name}</h3>
                  <p>
                    {quiz.questionCount}문제 · {formatDate(quiz.createdAt)}
                    {progressText && <span className="progress-badge">{progressText}</span>}
                  </p>
                </div>
                <button 
                  className="btn-delete"
                  onClick={(e) => handleDelete(e, quiz.id)}
                >
                  🗑️
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

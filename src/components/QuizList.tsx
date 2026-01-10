interface QuizItem {
  id: string;
  name: string;
  questionCount: number;
  createdAt: number;
}

interface Props {
  quizzes: QuizItem[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onUploadNew: () => void;
}

export function QuizList({ quizzes, onSelect, onDelete, onUploadNew }: Props) {
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
          {quizzes.map((quiz) => (
            <div 
              key={quiz.id} 
              className="quiz-item"
              onClick={() => onSelect(quiz.id)}
            >
              <div className="quiz-item-info">
                <h3>{quiz.name}</h3>
                <p>
                  {quiz.questionCount}문제 · {formatDate(quiz.createdAt)}
                </p>
              </div>
              <button 
                className="btn-delete"
                onClick={(e) => handleDelete(e, quiz.id)}
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

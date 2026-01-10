interface Props {
  questionCount: number;
  knownCount: number;
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
  excludeKnown: boolean;
  onShuffleQuestionsChange: (value: boolean) => void;
  onShuffleChoicesChange: (value: boolean) => void;
  onExcludeKnownChange: (value: boolean) => void;
  onStart: () => void;
  onBack: () => void;
}

export function QuizSettings({
  questionCount,
  knownCount,
  shuffleQuestions,
  shuffleChoices,
  excludeKnown,
  onShuffleQuestionsChange,
  onShuffleChoicesChange,
  onExcludeKnownChange,
  onStart,
  onBack
}: Props) {
  const activeCount = excludeKnown ? questionCount - knownCount : questionCount;

  return (
    <div className="settings-container">
      <div className="settings-header">
        <button onClick={onBack} className="btn-back">← 뒤로</button>
        <h2>퀴즈 설정</h2>
      </div>

      <div className="settings-info">
        <p>총 {questionCount}문제</p>
        {knownCount > 0 && <p className="known-info">아는 문제: {knownCount}개</p>}
      </div>

      <div className="settings-options">
        <label className="setting-option">
          <input
            type="checkbox"
            checked={shuffleQuestions}
            onChange={(e) => onShuffleQuestionsChange(e.target.checked)}
          />
          <span className="option-text">
            <strong>문제 순서 랜덤</strong>
            <small>문제 출제 순서를 섞습니다</small>
          </span>
        </label>

        <label className="setting-option">
          <input
            type="checkbox"
            checked={shuffleChoices}
            onChange={(e) => onShuffleChoicesChange(e.target.checked)}
          />
          <span className="option-text">
            <strong>보기 순서 랜덤</strong>
            <small>A, B, C, D 보기 순서를 섞습니다</small>
          </span>
        </label>

        <label className="setting-option">
          <input
            type="checkbox"
            checked={excludeKnown}
            onChange={(e) => onExcludeKnownChange(e.target.checked)}
            disabled={knownCount === 0}
          />
          <span className="option-text">
            <strong>아는 문제 제외</strong>
            <small>체크한 문제를 제외하고 풀이합니다</small>
          </span>
        </label>
      </div>

      <div className="settings-footer">
        <button 
          onClick={onStart} 
          className="btn-start"
          disabled={activeCount === 0}
        >
          {activeCount}문제 시작하기
        </button>
      </div>
    </div>
  );
}

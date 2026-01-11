import { useState, useEffect, useCallback } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { PdfUploader } from './components/PdfUploader';
import { QuizList } from './components/QuizList';
import { QuizSettings } from './components/QuizSettings';
import { QuizView } from './components/QuizView';
import { ResultView } from './components/ResultView';
import { AuthWrapper, SignOutButton } from './components/AuthWrapper';
import { extractTextFromPdf, parseQuestions } from './utils/pdfParser';
import { shuffleQuestions, shuffleAllChoices } from './utils/shuffle';
import {
  saveQuizToCloud,
  getQuizzesFromCloud,
  getQuizFromCloud,
  deleteQuizFromCloud,
  saveProgressToCloud,
  getProgressFromCloud,
  clearProgressFromCloud,
  uploadPdfToS3,
  type CloudProgress,
} from './utils/cloudStorage';
import type { Question } from './types/quiz';
import './App.css';

type View = 'home' | 'upload' | 'settings' | 'quiz' | 'result';

// 퀴즈 목록용 간소화된 타입
interface QuizListItem {
  quizId: string;
  name: string;
  questionCount: number;
  createdAt: number;
}

function App() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);
  const [view, setView] = useState<View>('home');
  const [savedQuizzes, setSavedQuizzes] = useState<QuizListItem[]>([]);
  const [progressMap, setProgressMap] = useState<Map<string, { quizId: string; currentIndex: number; completedAt?: number; score?: number }>>(new Map());
  const [currentQuizId, setCurrentQuizId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<Map<number, string[]>>(new Map());
  const [startIndex, setStartIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wrongOnlyMode, setWrongOnlyMode] = useState(false);
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [knownQuestions, setKnownQuestions] = useState<number[]>([]);
  const [, setCurrentProgress] = useState<CloudProgress | null>(null);
  
  // 설정
  const [settingShuffleQ, setSettingShuffleQ] = useState(false);
  const [settingShuffleC, setSettingShuffleC] = useState(false);
  const [settingExcludeKnown, setSettingExcludeKnown] = useState(false);

  // 퀴즈 목록 로드
  const loadQuizzes = useCallback(async () => {
    try {
      setIsLoading(true);
      const quizzes = await getQuizzesFromCloud();
      const sortedQuizzes = quizzes.map(q => ({
        quizId: q.quizId,
        name: q.name,
        questionCount: q.questionCount,
        createdAt: q.createdAt,
      })).sort((a, b) => b.createdAt - a.createdAt);
      
      setSavedQuizzes(sortedQuizzes);
      
      // 각 퀴즈의 진행 상황 로드
      const progressEntries: [string, { quizId: string; currentIndex: number; completedAt?: number; score?: number }][] = [];
      for (const quiz of sortedQuizzes) {
        try {
          const progress = await getProgressFromCloud(quiz.quizId);
          if (progress) {
            progressEntries.push([quiz.quizId, {
              quizId: quiz.quizId,
              currentIndex: progress.currentIndex,
              completedAt: progress.completedAt,
              score: progress.score,
            }]);
          }
        } catch {
          // 진행 상황 없으면 무시
        }
      }
      setProgressMap(new Map(progressEntries));
    } catch (err) {
      console.error('퀴즈 목록 로드 실패:', err);
      setError('퀴즈 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      loadQuizzes();
    }
  }, [loadQuizzes, authStatus]);

  const handleFileSelect = async (file: File) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const text = await extractTextFromPdf(file);
      const parsed = parseQuestions(text);
      
      if (parsed.length === 0) {
        setError('문제를 찾을 수 없습니다. PDF 형식을 확인해주세요.');
        return;
      }
      
      const name = file.name.replace('.pdf', '');
      const quizId = await saveQuizToCloud(name, parsed);
      
      // S3에 원본 PDF 업로드 (백그라운드, 실패해도 무시)
      uploadPdfToS3(file, quizId).catch(err => {
        console.warn('PDF S3 업로드 실패 (무시됨):', err);
      });
      
      await loadQuizzes();
      setCurrentQuizId(quizId);
      setQuestions(parsed);
      setKnownQuestions([]);
      setView('settings');
    } catch (err) {
      setError('PDF 파싱 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectQuiz = async (quizId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getQuizFromCloud(quizId);
      if (!result) {
        setError('퀴즈를 찾을 수 없습니다.');
        return;
      }
      
      setCurrentQuizId(quizId);
      setQuestions(result.questions);
      
      // 진행 상황 로드
      const progress = await getProgressFromCloud(quizId);
      setCurrentProgress(progress);
      setKnownQuestions(progress?.knownQuestions || []);
      
      if (progress && !progress.completedAt) {
        // 진행 중인 퀴즈 이어서
        const answersMap = new Map(
          Object.entries(progress.userAnswers).map(([k, v]) => [Number(k), v])
        );
        setUserAnswers(answersMap);
        setStartIndex(progress.currentIndex);
        setFilteredQuestions(result.questions);
        setWrongOnlyMode(false);
        setView('quiz');
      } else {
        setView('settings');
      }
    } catch (err) {
      setError('퀴즈를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartQuiz = () => {
    let targetQuestions = [...questions];
    
    if (settingExcludeKnown && knownQuestions.length > 0) {
      targetQuestions = targetQuestions.filter(q => !knownQuestions.includes(q.number));
    }
    
    if (settingShuffleQ) {
      targetQuestions = shuffleQuestions(targetQuestions);
    }
    
    if (settingShuffleC) {
      targetQuestions = shuffleAllChoices(targetQuestions);
    }
    
    setFilteredQuestions(targetQuestions);
    setUserAnswers(new Map());
    setStartIndex(0);
    setWrongOnlyMode(false);
    setView('quiz');
  };

  const handleDeleteQuiz = async (quizId: string) => {
    try {
      await deleteQuizFromCloud(quizId);
      await loadQuizzes();
    } catch (err) {
      console.error('퀴즈 삭제 실패:', err);
      setError('퀴즈 삭제에 실패했습니다.');
    }
  };

  const handleProgressUpdate = async (index: number, answers: Map<number, string[]>) => {
    if (!currentQuizId) return;
    
    try {
      await saveProgressToCloud(currentQuizId, {
        currentIndex: index,
        userAnswers: Object.fromEntries(answers),
        knownQuestions,
      });
    } catch (err) {
      console.error('진행 상황 저장 실패:', err);
    }
  };

  const handleToggleKnown = async (questionNumber: number) => {
    if (!currentQuizId) return;
    
    const updated = knownQuestions.includes(questionNumber)
      ? knownQuestions.filter(n => n !== questionNumber)
      : [...knownQuestions, questionNumber];
    
    setKnownQuestions(updated);
    
    try {
      await saveProgressToCloud(currentQuizId, {
        currentIndex: startIndex,
        userAnswers: Object.fromEntries(userAnswers),
        knownQuestions: updated,
      });
    } catch (err) {
      console.error('아는 문제 저장 실패:', err);
    }
  };

  const handleFinish = async (answers: Map<number, string[]>) => {
    setUserAnswers(answers);
    
    if (currentQuizId) {
      const targetQuestions = filteredQuestions;
      const correctCount = targetQuestions.filter(q => {
        const userAnswer = answers.get(q.number) || [];
        return userAnswer.length === q.answer.length &&
          userAnswer.every(a => q.answer.includes(a));
      }).length;
      const score = Math.round((correctCount / targetQuestions.length) * 100);
      
      try {
        await saveProgressToCloud(currentQuizId, {
          currentIndex: 0,
          userAnswers: Object.fromEntries(answers),
          knownQuestions,
          completedAt: Date.now(),
          score,
        });
      } catch (err) {
        console.error('결과 저장 실패:', err);
      }
    }
    
    setView('result');
  };

  const handleRetry = async () => {
    setUserAnswers(new Map());
    setStartIndex(0);
    setWrongOnlyMode(false);
    if (currentQuizId) {
      try {
        await clearProgressFromCloud(currentQuizId);
      } catch (err) {
        console.error('진행 상황 초기화 실패:', err);
      }
    }
    setView('settings');
  };

  const handleRetryWrongOnly = () => {
    const wrongQuestions = filteredQuestions.filter(q => {
      const userAnswer = userAnswers.get(q.number) || [];
      const isCorrect = userAnswer.length === q.answer.length &&
        userAnswer.every(a => q.answer.includes(a));
      return !isCorrect;
    });
    
    if (wrongQuestions.length === 0) {
      alert('틀린 문제가 없습니다!');
      return;
    }
    
    setFilteredQuestions(wrongQuestions);
    setUserAnswers(new Map());
    setStartIndex(0);
    setWrongOnlyMode(true);
    setView('quiz');
  };

  const handleReset = () => {
    setQuestions([]);
    setFilteredQuestions([]);
    setUserAnswers(new Map());
    setCurrentQuizId(null);
    setStartIndex(0);
    setWrongOnlyMode(false);
    setKnownQuestions([]);
    setCurrentProgress(null);
    loadQuizzes();
    setView('home');
  };

  return (
    <AuthWrapper>
      <div className="app">
        <header className="app-header">
          <h1 onClick={handleReset} style={{ cursor: 'pointer' }}>Just Pass</h1>
          <SignOutButton />
        </header>
        
        <main className="app-main">
          {error && <div className="error-message">{error}</div>}
          
          {view === 'home' && (
            isLoading ? (
              <div className="loading-container">
                <div className="spinner"></div>
                <p>로딩 중...</p>
              </div>
            ) : savedQuizzes.length > 0 ? (
              <QuizList 
                quizzes={savedQuizzes.map(q => ({
                  id: q.quizId,
                  name: q.name,
                  questionCount: q.questionCount,
                  createdAt: q.createdAt,
                }))}
                progressMap={progressMap}
                onSelect={handleSelectQuiz}
                onDelete={handleDeleteQuiz}
                onUploadNew={() => setView('upload')}
              />
            ) : (
              <PdfUploader onFileSelect={handleFileSelect} isLoading={isLoading} />
            )
          )}
          
          {view === 'upload' && (
            <PdfUploader onFileSelect={handleFileSelect} isLoading={isLoading} />
          )}
          
          {view === 'settings' && (
            <QuizSettings
              questionCount={questions.length}
              knownCount={knownQuestions.length}
              shuffleQuestions={settingShuffleQ}
              shuffleChoices={settingShuffleC}
              excludeKnown={settingExcludeKnown}
              onShuffleQuestionsChange={setSettingShuffleQ}
              onShuffleChoicesChange={setSettingShuffleC}
              onExcludeKnownChange={setSettingExcludeKnown}
              onStart={handleStartQuiz}
              onBack={handleReset}
            />
          )}
          
          {view === 'quiz' && (
            <QuizView 
              questions={filteredQuestions}
              startIndex={startIndex}
              initialAnswers={userAnswers}
              wrongOnlyMode={wrongOnlyMode}
              knownQuestions={knownQuestions}
              onFinish={handleFinish}
              onReset={handleReset}
              onProgressUpdate={handleProgressUpdate}
              onToggleKnown={handleToggleKnown}
            />
          )}
          
          {view === 'result' && (
            <ResultView 
              questions={filteredQuestions}
              userAnswers={userAnswers}
              onRetry={handleRetry}
              onRetryWrongOnly={handleRetryWrongOnly}
              onReset={handleReset}
            />
          )}
        </main>
      </div>
    </AuthWrapper>
  );
}

export default App;

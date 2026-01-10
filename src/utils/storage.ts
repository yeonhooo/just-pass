import type { Question } from '../types/quiz';

const QUIZ_PREFIX = 'quiz_';
const PROGRESS_PREFIX = 'progress_';
const KNOWN_PREFIX = 'known_';

export interface SavedQuiz {
  id: string;
  name: string;
  questionCount: number;
  createdAt: number;
}

export interface QuizProgress {
  quizId: string;
  currentIndex: number;
  userAnswers: Record<number, string[]>;
  completedAt?: number;
  score?: number;
}

// 퀴즈 저장
export function saveQuiz(name: string, questions: Question[]): string {
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const key = QUIZ_PREFIX + id;
  
  const meta: SavedQuiz = {
    id,
    name,
    questionCount: questions.length,
    createdAt: Date.now()
  };
  
  localStorage.setItem(key, JSON.stringify({ meta, questions }));
  return id;
}

// 저장된 퀴즈 목록
export function getSavedQuizzes(): SavedQuiz[] {
  const quizzes: SavedQuiz[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(QUIZ_PREFIX)) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '');
        if (data.meta) {
          quizzes.push(data.meta);
        }
      } catch {}
    }
  }
  
  return quizzes.sort((a, b) => b.createdAt - a.createdAt);
}

// 퀴즈 불러오기
export function loadQuiz(id: string): { meta: SavedQuiz; questions: Question[] } | null {
  const key = QUIZ_PREFIX + id;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

// 퀴즈 삭제
export function deleteQuiz(id: string): void {
  localStorage.removeItem(QUIZ_PREFIX + id);
  localStorage.removeItem(PROGRESS_PREFIX + id);
}

// 진행 상황 저장
export function saveProgress(progress: QuizProgress): void {
  const key = PROGRESS_PREFIX + progress.quizId;
  localStorage.setItem(key, JSON.stringify(progress));
}

// 진행 상황 불러오기
export function loadProgress(quizId: string): QuizProgress | null {
  const key = PROGRESS_PREFIX + quizId;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

// 진행 상황 삭제
export function clearProgress(quizId: string): void {
  localStorage.removeItem(PROGRESS_PREFIX + quizId);
}


// 아는 문제 저장
export function saveKnownQuestions(quizId: string, questionNumbers: number[]): void {
  const key = KNOWN_PREFIX + quizId;
  localStorage.setItem(key, JSON.stringify(questionNumbers));
}

// 아는 문제 불러오기
export function loadKnownQuestions(quizId: string): number[] {
  const key = KNOWN_PREFIX + quizId;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// 아는 문제 토글
export function toggleKnownQuestion(quizId: string, questionNumber: number): number[] {
  const known = loadKnownQuestions(quizId);
  const index = known.indexOf(questionNumber);
  
  if (index === -1) {
    known.push(questionNumber);
  } else {
    known.splice(index, 1);
  }
  
  saveKnownQuestions(quizId, known);
  return known;
}

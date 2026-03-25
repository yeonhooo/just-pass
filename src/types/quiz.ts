export interface Choice {
  letter: string;
  text: string;
}

export interface Question {
  number: number;
  text: string;
  choices: Choice[];
  answer: string[];
  explanation: string;
  translation?: string; // AI 번역 캐시
  aiExplanation?: string; // AI 해설 캐시
}

export interface QuizState {
  questions: Question[];
  currentIndex: number;
  userAnswers: Map<number, string[]>;
  showResult: boolean;
}

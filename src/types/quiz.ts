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
}

export interface QuizState {
  questions: Question[];
  currentIndex: number;
  userAnswers: Map<number, string[]>;
  showResult: boolean;
}

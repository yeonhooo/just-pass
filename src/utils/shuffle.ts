import type { Question, Choice } from '../types/quiz';

// Fisher-Yates 셔플
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 문제 순서 셔플
export function shuffleQuestions(questions: Question[]): Question[] {
  return shuffleArray(questions);
}

// 보기 순서 셔플 (정답 매핑도 함께 업데이트)
export function shuffleChoices(question: Question): Question {
  const shuffledChoices = shuffleArray(question.choices);
  
  // 새로운 letter 할당 (A, B, C, D...)
  const letterMap = new Map<string, string>();
  const newChoices: Choice[] = shuffledChoices.map((choice, index) => {
    const newLetter = String.fromCharCode(65 + index); // A=65
    letterMap.set(choice.letter, newLetter);
    return {
      letter: newLetter,
      text: choice.text
    };
  });
  
  // 정답도 새 letter로 매핑
  const newAnswer = question.answer.map(a => letterMap.get(a) || a);
  
  return {
    ...question,
    choices: newChoices,
    answer: newAnswer
  };
}

// 모든 문제의 보기 셔플
export function shuffleAllChoices(questions: Question[]): Question[] {
  return questions.map(shuffleChoices);
}

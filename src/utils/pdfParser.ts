import * as pdfjsLib from 'pdfjs-dist';
import type { Question, Choice } from '../types/quiz';

// PDF.js 워커 설정 (Vite 환경)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    let pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    
    // PDF 헤더 제거 (페이지마다 반복되는 텍스트)
    pageText = pageText.replace(/IT Certification Guaranteed,?\s*The Easy Way!?/gi, '');
    
    // 페이지 번호 제거 (페이지 끝에 있는 단독 숫자)
    pageText = pageText.replace(/\s+\d+\s*$/, ' ');
    
    fullText += pageText + '\n';
  }
  
  return fullText;
}

export function parseQuestions(text: string): Question[] {
  const questions: Question[] = [];
  
  // NO.숫자 패턴으로 문제 분리
  const questionBlocks = text.split(/(?=NO\.\d+\s)/);
  
  for (const block of questionBlocks) {
    const numMatch = block.match(/^NO\.(\d+)\s/);
    if (!numMatch) continue;
    
    const questionNumber = parseInt(numMatch[1]);
    
    // Answer 추출: "Answer:" 뒤 ~ "Explanation" 또는 줄 끝 전까지
    const answerMatch = block.match(/Answer:\s*([A-F](?:\s+[A-F])*)\s*(?:Explanation|$)/i);
    const answers = answerMatch 
      ? answerMatch[1].trim().split(/\s+/).filter(a => /^[A-F]$/i.test(a)).map(a => a.toUpperCase())
      : [];
    
    // Explanation 추출
    const explanationMatch = block.match(/Explanation:\s*([\s\S]*?)(?=NO\.\d+|$)/i);
    const explanation = explanationMatch 
      ? explanationMatch[1].trim()
      : '';
    
    // 보기 추출 (A. ~ F.)
    const choices: Choice[] = [];
    const choicePattern = /\b([A-F])\.\s+([\s\S]*?)(?=\b[A-F]\.\s|Answer:|Explanation:|$)/g;
    let choiceMatch;
    
    // Answer 이전 텍스트에서만 보기 추출
    const beforeAnswer = block.split(/Answer:/i)[0];
    
    while ((choiceMatch = choicePattern.exec(beforeAnswer)) !== null) {
      choices.push({
        letter: choiceMatch[1],
        text: choiceMatch[2].trim().replace(/\s+/g, ' ')
      });
    }
    
    // 문제 텍스트 추출 (NO.숫자 이후 ~ 첫 번째 보기 이전)
    const questionTextMatch = beforeAnswer.match(/^NO\.\d+\s+([\s\S]*?)(?=\b[A-F]\.\s)/);
    const questionText = questionTextMatch 
      ? questionTextMatch[1].trim().replace(/\s+/g, ' ')
      : '';
    
    if (questionText && choices.length >= 2 && answers.length > 0) {
      questions.push({
        number: questionNumber,
        text: questionText,
        choices,
        answer: answers,
        explanation
      });
    }
  }
  
  return questions.sort((a, b) => a.number - b.number);
}

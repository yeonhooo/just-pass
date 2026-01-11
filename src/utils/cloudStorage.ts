import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { fetchAuthSession } from 'aws-amplify/auth';
import { AWS_REGION, DYNAMODB_QUIZZES_TABLE, DYNAMODB_PROGRESS_TABLE, S3_PDF_BUCKET } from '../aws-config';
import type { Question } from '../types/quiz';

// 청크 크기 (DynamoDB 400KB 제한 고려, 약 50문제씩)
const CHUNK_SIZE = 50;

// DynamoDB 클라이언트 생성 (인증된 자격 증명 사용)
async function getDocClient() {
  const session = await fetchAuthSession();
  const credentials = session.credentials;
  
  if (!credentials) {
    throw new Error('인증이 필요합니다.');
  }
  
  const client = new DynamoDBClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });
  
  return DynamoDBDocumentClient.from(client);
}

// S3 클라이언트 생성
async function getS3Client() {
  const session = await fetchAuthSession();
  const credentials = session.credentials;
  
  if (!credentials) {
    throw new Error('인증이 필요합니다.');
  }
  
  return new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });
}

// 현재 사용자 ID 가져오기
async function getUserId(): Promise<string> {
  const session = await fetchAuthSession();
  const identityId = session.identityId;
  
  if (!identityId) {
    throw new Error('사용자 ID를 가져올 수 없습니다.');
  }
  
  return identityId;
}

// 퀴즈 메타데이터 타입
export interface CloudQuizMeta {
  userId: string;
  quizId: string;
  name: string;
  questionCount: number;
  chunkCount: number;
  createdAt: number;
  updatedAt: number;
}

// 퀴즈 청크 타입
interface QuizChunk {
  userId: string;
  quizId: string; // quizId#chunk#0, quizId#chunk#1, ...
  questions: Question[];
}

// 진행 상황 타입
export interface CloudProgress {
  userId: string;
  quizId: string;
  currentIndex: number;
  userAnswers: Record<number, string[]>;
  knownQuestions: number[];
  startedAt?: number;
  completedAt?: number;
  score?: number;
}

// 배열을 청크로 분할
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// 퀴즈 저장 (청크 분할)
export async function saveQuizToCloud(name: string, questions: Question[]): Promise<string> {
  const docClient = await getDocClient();
  const userId = await getUserId();
  const quizId = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '-' + Date.now();
  
  const chunks = chunkArray(questions, CHUNK_SIZE);
  
  // 메타데이터 저장
  const meta: CloudQuizMeta = {
    userId,
    quizId,
    name,
    questionCount: questions.length,
    chunkCount: chunks.length,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  await docClient.send(new PutCommand({
    TableName: DYNAMODB_QUIZZES_TABLE,
    Item: meta,
  }));
  
  // 청크별로 저장
  for (let i = 0; i < chunks.length; i++) {
    const chunk: QuizChunk = {
      userId,
      quizId: `${quizId}#chunk#${i}`,
      questions: chunks[i],
    };
    
    await docClient.send(new PutCommand({
      TableName: DYNAMODB_QUIZZES_TABLE,
      Item: chunk,
    }));
  }
  
  return quizId;
}

// 퀴즈 목록 조회 (메타데이터만)
export async function getQuizzesFromCloud(): Promise<CloudQuizMeta[]> {
  const docClient = await getDocClient();
  const userId = await getUserId();
  
  const result = await docClient.send(new QueryCommand({
    TableName: DYNAMODB_QUIZZES_TABLE,
    KeyConditionExpression: 'userId = :userId',
    FilterExpression: 'attribute_exists(#n)',
    ExpressionAttributeValues: {
      ':userId': userId,
    },
    ExpressionAttributeNames: {
      '#n': 'name',
    },
  }));
  
  return (result.Items || []) as CloudQuizMeta[];
}

// 퀴즈 상세 조회 (모든 청크 병합)
export async function getQuizFromCloud(quizId: string): Promise<{ meta: CloudQuizMeta; questions: Question[] } | null> {
  const docClient = await getDocClient();
  const userId = await getUserId();
  
  // 메타데이터 조회
  const metaResult = await docClient.send(new GetCommand({
    TableName: DYNAMODB_QUIZZES_TABLE,
    Key: { userId, quizId },
  }));
  
  if (!metaResult.Item) {
    return null;
  }
  
  const meta = metaResult.Item as CloudQuizMeta;
  
  // 모든 청크 조회
  const questions: Question[] = [];
  for (let i = 0; i < meta.chunkCount; i++) {
    const chunkResult = await docClient.send(new GetCommand({
      TableName: DYNAMODB_QUIZZES_TABLE,
      Key: { userId, quizId: `${quizId}#chunk#${i}` },
    }));
    
    if (chunkResult.Item) {
      const chunk = chunkResult.Item as QuizChunk;
      questions.push(...chunk.questions);
    }
  }
  
  return { meta, questions };
}

// 퀴즈 삭제 (메타데이터 + 모든 청크)
export async function deleteQuizFromCloud(quizId: string): Promise<void> {
  const docClient = await getDocClient();
  const userId = await getUserId();
  
  // 메타데이터 조회 (청크 수 확인)
  const metaResult = await docClient.send(new GetCommand({
    TableName: DYNAMODB_QUIZZES_TABLE,
    Key: { userId, quizId },
  }));
  
  if (metaResult.Item) {
    const meta = metaResult.Item as CloudQuizMeta;
    
    // 청크 삭제
    for (let i = 0; i < meta.chunkCount; i++) {
      await docClient.send(new DeleteCommand({
        TableName: DYNAMODB_QUIZZES_TABLE,
        Key: { userId, quizId: `${quizId}#chunk#${i}` },
      }));
    }
  }
  
  // 메타데이터 삭제
  await docClient.send(new DeleteCommand({
    TableName: DYNAMODB_QUIZZES_TABLE,
    Key: { userId, quizId },
  }));
  
  // 진행 상황도 삭제
  await docClient.send(new DeleteCommand({
    TableName: DYNAMODB_PROGRESS_TABLE,
    Key: { userId, quizId },
  }));
}

// 진행 상황 저장
export async function saveProgressToCloud(quizId: string, progress: Omit<CloudProgress, 'userId' | 'quizId'>): Promise<void> {
  const docClient = await getDocClient();
  const userId = await getUserId();
  
  await docClient.send(new PutCommand({
    TableName: DYNAMODB_PROGRESS_TABLE,
    Item: {
      userId,
      quizId,
      ...progress,
    },
  }));
}

// 진행 상황 조회
export async function getProgressFromCloud(quizId: string): Promise<CloudProgress | null> {
  const docClient = await getDocClient();
  const userId = await getUserId();
  
  const result = await docClient.send(new GetCommand({
    TableName: DYNAMODB_PROGRESS_TABLE,
    Key: { userId, quizId },
  }));
  
  return (result.Item as CloudProgress) || null;
}

// 진행 상황 삭제
export async function clearProgressFromCloud(quizId: string): Promise<void> {
  const docClient = await getDocClient();
  const userId = await getUserId();
  
  await docClient.send(new DeleteCommand({
    TableName: DYNAMODB_PROGRESS_TABLE,
    Key: { userId, quizId },
  }));
}


// PDF 파일 S3에 업로드
export async function uploadPdfToS3(file: File, userEmail: string): Promise<string> {
  const s3Client = await getS3Client();
  
  // 이메일에서 @ 앞부분만 추출
  const emailPrefix = userEmail.split('@')[0];
  const key = `${emailPrefix}/${file.name}`;
  
  const arrayBuffer = await file.arrayBuffer();
  
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_PDF_BUCKET,
    Key: key,
    Body: new Uint8Array(arrayBuffer),
    ContentType: 'application/pdf',
  }));
  
  return key;
}

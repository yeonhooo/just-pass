import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-2' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const AI_JOBS_TABLE = process.env.AI_JOBS_TABLE || 'just-pass-ai-jobs';

// Global Claude Sonnet 4.6
const CLAUDE_MODEL_ID = 'global.anthropic.claude-sonnet-4-6';

// CORS 헤더
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Content-Type': 'application/json',
};

// 응답 헬퍼
const response = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

// Bedrock Claude 호출
const callClaude = async (prompt) => {
  console.log('Using model ID:', CLAUDE_MODEL_ID);
  
  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  const command = new InvokeModelCommand({
    modelId: CLAUDE_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  });

  console.log('Invoking Bedrock with model ID:', CLAUDE_MODEL_ID);
  const result = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(result.body));
  return responseBody.content[0].text;
};

// POST /ai/translate - 영문을 한글로 번역
const translateText = async (text) => {
  const prompt = `다음 영문 시험 문제를 자연스러운 한글로 번역해주세요. 기술 용어는 적절히 한글과 영문을 병기하세요.

${text}

번역 결과만 출력하고, "문제 번역", "번역:" 등의 레이블은 포함하지 마세요.`;

  const translation = await callClaude(prompt);
  return response(200, { result: translation });
};

// POST /ai/explain - 문제 해설 생성 (비동기)
const explainQuestion = async (text, answer) => {
  const jobId = randomUUID();
  const ttl = Math.floor(Date.now() / 1000) + 86400; // 24시간 후
  
  // Job 상태를 DynamoDB에 저장
  await docClient.send(new PutCommand({
    TableName: AI_JOBS_TABLE,
    Item: {
      jobId,
      status: 'processing',
      createdAt: Date.now(),
      ttl,
    },
  }));
  
  // 백그라운드에서 해설 생성 (비동기)
  generateExplanation(jobId, text, answer).catch(err => {
    console.error('Background explanation generation failed:', err);
  });
  
  // 즉시 jobId 반환
  return response(202, { jobId, status: 'processing' });
};

// 백그라운드 해설 생성
const generateExplanation = async (jobId, text, answer) => {
  try {
    const prompt = `당신은 경험많은 시니어 AWS Solutions Architect 입니다. 다음은 AWS 자격증 시험 문제입니다. 정답은 "${answer}"입니다.

문제:
${text}

이 문제에 대해 다음 내용을 포함한 상세한 해설을 한글로 작성해주세요:
1. 정답이 왜 맞는지 설명
2. 관련 AWS 서비스나 개념 설명
3. 실무에서 어떻게 활용되는지
4. 주의할 점이나 모범 사례

해설:`;

    const explanation = await callClaude(prompt);
    
    // 완료 상태로 업데이트
    await docClient.send(new UpdateCommand({
      TableName: AI_JOBS_TABLE,
      Key: { jobId },
      UpdateExpression: 'SET #status = :status, #result = :result, #completedAt = :completedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#result': 'result',
        '#completedAt': 'completedAt',
      },
      ExpressionAttributeValues: {
        ':status': 'completed',
        ':result': explanation,
        ':completedAt': Date.now(),
      },
    }));
  } catch (error) {
    console.error('Explanation generation error:', error);
    
    // 실패 상태로 업데이트
    await docClient.send(new UpdateCommand({
      TableName: AI_JOBS_TABLE,
      Key: { jobId },
      UpdateExpression: 'SET #status = :status, #error = :error',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#error': 'error',
      },
      ExpressionAttributeValues: {
        ':status': 'failed',
        ':error': error.message,
      },
    }));
  }
};

// GET /ai/status/{jobId} - Job 상태 조회
const getJobStatus = async (jobId) => {
  const result = await docClient.send(new GetCommand({
    TableName: AI_JOBS_TABLE,
    Key: { jobId },
  }));
  
  if (!result.Item) {
    return response(404, { error: 'Job not found' });
  }
  
  return response(200, {
    jobId: result.Item.jobId,
    status: result.Item.status,
    result: result.Item.result,
    error: result.Item.error,
    createdAt: result.Item.createdAt,
    completedAt: result.Item.completedAt,
  });
};

export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const { httpMethod, path } = event;

  // OPTIONS 요청 (CORS preflight)
  if (httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  try {
    // GET /ai/status/{jobId}
    if (httpMethod === 'GET' && path.startsWith('/ai/status/')) {
      const jobId = path.split('/').pop();
      return await getJobStatus(jobId);
    }

    const body = JSON.parse(event.body || '{}');
    const { text, answer } = body;

    if (!text) {
      return response(400, { error: 'text is required' });
    }

    // 라우팅
    if (httpMethod === 'POST' && path === '/ai/translate') {
      return await translateText(text);
    }
    
    if (httpMethod === 'POST' && path === '/ai/explain') {
      if (!answer) {
        return response(400, { error: 'answer is required for explanation' });
      }
      return await explainQuestion(text, answer);
    }

    return response(404, { error: 'Not Found' });
  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: 'Internal Server Error', message: error.message });
  }
};

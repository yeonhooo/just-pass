import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({ region: 'ap-northeast-2' });

const CLAUDE_MODEL_ID = 'anthropic.claude-sonnet-4-6';

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

  const result = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(result.body));
  return responseBody.content[0].text;
};

// POST /ai/translate - 영문을 한글로 번역
const translateText = async (text) => {
  const prompt = `다음 영문 시험 문제를 자연스러운 한글로 번역해주세요. 기술 용어는 적절히 한글과 영문을 병기하세요.

${text}

번역:`;

  const translation = await callClaude(prompt);
  return response(200, { result: translation });
};

// POST /ai/explain - 문제 해설 생성
const explainQuestion = async (text, answer) => {
  const prompt = `다음은 AWS 자격증 시험 문제입니다. 정답은 "${answer}"입니다.

문제:
${text}

이 문제에 대해 다음 내용을 포함한 상세한 해설을 한글로 작성해주세요:
1. 정답이 왜 맞는지 설명
2. 관련 AWS 서비스나 개념 설명
3. 실무에서 어떻게 활용되는지
4. 주의할 점이나 모범 사례

해설:`;

  const explanation = await callClaude(prompt);
  return response(200, { result: explanation });
};

export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const { httpMethod, path } = event;

  // OPTIONS 요청 (CORS preflight)
  if (httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  try {
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

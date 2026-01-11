import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const cognitoClient = new CognitoIdentityProviderClient({});
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const DYNAMODB_QUIZZES_TABLE = process.env.DYNAMODB_QUIZZES_TABLE;
const DYNAMODB_PROGRESS_TABLE = process.env.DYNAMODB_PROGRESS_TABLE;

// CORS 헤더
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Content-Type': 'application/json',
};

// 응답 헬퍼
const response = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

// admin 그룹 체크
const isAdmin = (event) => {
  try {
    const claims = event.requestContext?.authorizer?.claims;
    const groups = claims?.['cognito:groups'] || '';
    return groups.includes('admin');
  } catch {
    return false;
  }
};

// GET /admin/users - 사용자 목록
const getUsers = async () => {
  const result = await cognitoClient.send(new ListUsersCommand({
    UserPoolId: COGNITO_USER_POOL_ID,
    Limit: 60,
  }));

  const users = result.Users.map(user => {
    const attrs = {};
    user.Attributes?.forEach(attr => {
      attrs[attr.Name] = attr.Value;
    });
    return {
      username: user.Username,
      email: attrs.email || '',
      status: user.UserStatus,
      enabled: user.Enabled,
      createdAt: user.UserCreateDate?.toISOString(),
      lastModified: user.UserLastModifiedDate?.toISOString(),
    };
  });

  return response(200, { users });
};

// GET /admin/users/{userId} - 사용자별 학습 현황
const getUserStats = async (userId) => {
  // Progress 테이블에서 해당 사용자 데이터 조회
  const progressResult = await dynamoClient.send(new QueryCommand({
    TableName: DYNAMODB_PROGRESS_TABLE,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId,
    },
  }));

  // Quizzes 테이블에서 해당 사용자 퀴즈 조회
  const quizzesResult = await dynamoClient.send(new QueryCommand({
    TableName: DYNAMODB_QUIZZES_TABLE,
    KeyConditionExpression: 'userId = :userId',
    FilterExpression: 'attribute_exists(#n)',
    ExpressionAttributeNames: {
      '#n': 'name',
    },
    ExpressionAttributeValues: {
      ':userId': userId,
    },
  }));

  return response(200, {
    userId,
    quizzes: quizzesResult.Items || [],
    progress: progressResult.Items || [],
  });
};

// GET /admin/stats - 전체 통계
const getStats = async () => {
  // 전체 사용자 수
  const usersResult = await cognitoClient.send(new ListUsersCommand({
    UserPoolId: COGNITO_USER_POOL_ID,
    Limit: 60,
  }));

  // 전체 퀴즈 수 (메타데이터만)
  const quizzesResult = await dynamoClient.send(new ScanCommand({
    TableName: DYNAMODB_QUIZZES_TABLE,
    FilterExpression: 'attribute_exists(#n)',
    ExpressionAttributeNames: {
      '#n': 'name',
    },
    ProjectionExpression: 'userId, quizId, #n, questionCount, createdAt',
  }));

  // 전체 진행 현황
  const progressResult = await dynamoClient.send(new ScanCommand({
    TableName: DYNAMODB_PROGRESS_TABLE,
    ProjectionExpression: 'userId, quizId, score, completedAt',
  }));

  const totalUsers = usersResult.Users?.length || 0;
  const totalQuizzes = quizzesResult.Items?.length || 0;
  const completedSessions = progressResult.Items?.filter(p => p.completedAt).length || 0;
  const avgScore = progressResult.Items?.filter(p => p.score !== undefined).reduce((sum, p, _, arr) => sum + p.score / arr.length, 0) || 0;

  return response(200, {
    totalUsers,
    totalQuizzes,
    completedSessions,
    avgScore: Math.round(avgScore),
    quizzes: quizzesResult.Items || [],
    recentProgress: progressResult.Items?.slice(0, 20) || [],
  });
};

export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  // Admin 권한 체크
  if (!isAdmin(event)) {
    return response(403, { error: 'Forbidden: Admin access required' });
  }

  const { httpMethod, path, pathParameters } = event;

  try {
    // 라우팅
    if (httpMethod === 'GET' && path === '/admin/users') {
      return await getUsers();
    }
    
    if (httpMethod === 'GET' && path.startsWith('/admin/users/') && pathParameters?.userId) {
      return await getUserStats(pathParameters.userId);
    }
    
    if (httpMethod === 'GET' && path === '/admin/stats') {
      return await getStats();
    }

    return response(404, { error: 'Not Found' });
  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: 'Internal Server Error' });
  }
};

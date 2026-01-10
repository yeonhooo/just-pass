import { Amplify } from 'aws-amplify';

// 환경변수에서 설정 로드
const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
      identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID,
      loginWith: {
        email: true,
      },
      signUpVerificationMethod: 'code' as const,
      userAttributes: {
        email: {
          required: true,
        },
      },
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: true,
      },
    },
  },
};

export const configureAmplify = () => {
  Amplify.configure(awsConfig);
};

export const AWS_REGION = import.meta.env.VITE_AWS_REGION;
export const DYNAMODB_QUIZZES_TABLE = import.meta.env.VITE_DYNAMODB_QUIZZES_TABLE;
export const DYNAMODB_PROGRESS_TABLE = import.meta.env.VITE_DYNAMODB_PROGRESS_TABLE;

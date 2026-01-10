import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

// 로그아웃 버튼 컴포넌트
export function SignOutButton() {
  const { signOut } = useAuthenticator();
  return (
    <button onClick={signOut} className="btn-signout">
      로그아웃
    </button>
  );
}

// 현재 사용자 정보
export function useCurrentUser() {
  const { user } = useAuthenticator((context) => [context.user]);
  return user;
}

// 인증 래퍼 컴포넌트
export function AuthWrapper({ children }: Props) {
  return (
    <Authenticator
      signUpAttributes={['email']}
      loginMechanisms={['email']}
      formFields={{
        signUp: {
          email: {
            label: '이메일',
            placeholder: '이메일을 입력하세요',
            isRequired: true,
            order: 1,
          },
          password: {
            label: '비밀번호',
            placeholder: '비밀번호를 입력하세요 (8자 이상, 대소문자, 숫자, 특수문자)',
            isRequired: true,
            order: 2,
          },
          confirm_password: {
            label: '비밀번호 확인',
            placeholder: '비밀번호를 다시 입력하세요',
            isRequired: true,
            order: 3,
          },
        },
        signIn: {
          username: {
            label: '이메일',
            placeholder: '이메일을 입력하세요',
            isRequired: true,
          },
          password: {
            label: '비밀번호',
            placeholder: '비밀번호를 입력하세요',
            isRequired: true,
          },
        },
        confirmSignUp: {
          confirmation_code: {
            label: '인증 코드',
            placeholder: '이메일로 받은 인증 코드를 입력하세요',
            isRequired: true,
          },
        },
      }}
    >
      {children}
    </Authenticator>
  );
}

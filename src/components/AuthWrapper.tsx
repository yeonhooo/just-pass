import { Authenticator, useAuthenticator, ThemeProvider } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

// Just Pass 테마
const theme = {
  name: 'just-pass-theme',
  tokens: {
    colors: {
      brand: {
        primary: {
          10: { value: '#f0f9ff' },
          20: { value: '#e0f2fe' },
          40: { value: '#7dd3fc' },
          60: { value: '#38bdf8' },
          80: { value: '#0ea5e9' },
          90: { value: '#0284c7' },
          100: { value: '#0369a1' },
        },
      },
    },
    components: {
      authenticator: {
        router: {
          borderWidth: { value: '0' },
          boxShadow: { value: '0 4px 20px rgba(0, 0, 0, 0.1)' },
        },
      },
      button: {
        primary: {
          backgroundColor: { value: '{colors.brand.primary.80}' },
          _hover: {
            backgroundColor: { value: '{colors.brand.primary.90}' },
          },
        },
      },
      tabs: {
        item: {
          _active: {
            color: { value: '{colors.brand.primary.80}' },
            borderColor: { value: '{colors.brand.primary.80}' },
          },
        },
      },
    },
  },
};

// 로그인 헤더 컴포넌트
const components = {
  Header() {
    return (
      <div style={{
        textAlign: 'center',
        padding: '2.5rem 1rem 1.5rem',
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: '800',
          color: '#0284c7',
          margin: 0,
          letterSpacing: '-0.03em',
          textShadow: '0 2px 4px rgba(2, 132, 199, 0.15)',
        }}>
          Just Pass
        </h1>
      </div>
    );
  },
  SignIn: {
    Header() {
      return null;
    },
  },
  SignUp: {
    Header() {
      return null;
    },
  },
};

// 로그아웃 버튼 컴포넌트 (이메일 표시 포함)
export function SignOutButton() {
  const { signOut, user } = useAuthenticator();
  const email = user?.signInDetails?.loginId || '';
  
  return (
    <div className="user-info">
      {email && <span className="user-email">{email}</span>}
      <button onClick={signOut} className="btn-signout">
        로그아웃
      </button>
    </div>
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
    <ThemeProvider theme={theme}>
      <Authenticator
        signUpAttributes={['email']}
        loginMechanisms={['email']}
        components={components}
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
              order: 1,
            },
            password: {
              label: '비밀번호',
              placeholder: '비밀번호를 입력하세요',
              isRequired: true,
              order: 2,
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
    </ThemeProvider>
  );
}

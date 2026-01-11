# 관리자 기능 설계 문서

## 보안 원칙
> "보안은 항상 최우선 고려 사항" - 항상 보안 모범 사례를 따릅니다. 불필요하거나 번거롭게 할 필요는 없습니다. 

## 현재 구조
```
브라우저 → Cognito 인증 → DynamoDB 직접 접근
```
- 프론트엔드에서 AWS SDK로 DynamoDB 직접 호출
- IAM 정책으로 `userId = 본인` 데이터만 접근 가능
- 백엔드 서버 없음

## 관리자 기능 요구사항
1. 전체 사용자 목록 조회
2. 사용자별 학습 현황 조회
3. 퀴즈별 통계 (평균 점수, 완료율)
4. 공지사항 관리 (추후)

## 구현 방안 비교

### 방법 1: 백엔드 없이 (IAM 정책만)
```
관리자 → Cognito admin 그룹 → 별도 IAM Role → 전체 DynamoDB 접근
```

**장점:**
- 추가 인프라 없음
- 빠른 구현

**단점:**
- 프론트엔드에 관리자 로직 노출
- 복잡한 쿼리/집계 어려움
- 보안상 민감한 작업 부적합
- 클라이언트에서 전체 데이터 접근 가능 (악용 가능성)

### 방법 2: Lambda + API Gateway (권장)
```
관리자 → API Gateway → Lambda → DynamoDB
```

**장점:**
- 보안 강화 (민감한 로직 서버에서 처리)
- 권한 검증을 백엔드에서 수행
- 복잡한 쿼리/집계 가능
- 확장성 좋음
- AWS 보안 모범 사례 준수

**단점:**
- 인프라 추가 (Lambda, API Gateway)
- 개발 시간 증가

## 결정: 방법 2 (Lambda + API Gateway)

보안 모범 사례를 따르기 위해 백엔드 추가 방식으로 진행.

## 구현 계획

### Phase 1: 인프라 구성
1. Cognito User Pool에 `admin` 그룹 생성
2. API Gateway 생성 (REST API)
3. Lambda 함수 생성
   - `admin-get-users`: 사용자 목록 조회
   - `admin-get-user-stats`: 사용자별 학습 현황
4. Lambda용 IAM Role (DynamoDB 전체 읽기 권한)
5. API Gateway에 Cognito Authorizer 연결

### Phase 2: Lambda 함수 구현
```
/admin/users          GET  → 전체 사용자 목록
/admin/users/{userId} GET  → 특정 사용자 학습 현황
/admin/stats          GET  → 전체 통계
```

Lambda에서 수행할 작업:
1. Cognito 토큰에서 그룹 정보 추출
2. `admin` 그룹 여부 검증
3. 검증 통과 시 DynamoDB 쿼리 실행
4. 결과 반환

### Phase 3: 프론트엔드
1. React Router 추가 (`/admin` 라우트)
2. 관리자 페이지 컴포넌트 생성
3. API Gateway 호출 로직
4. 사용자 목록 / 통계 UI

**관리자 URL:** `https://just-pass.leekit.app/admin`
- History API 방식 (Hash Router 아님)
- Amplify SPA 리다이렉트 설정 이미 적용됨
- URL 접근해도 백엔드에서 admin 그룹 검증

## Terraform 리소스 추가 예정
- `aws_api_gateway_rest_api`
- `aws_api_gateway_authorizer` (Cognito)
- `aws_lambda_function`
- `aws_iam_role` (Lambda 실행용)
- `aws_cognito_user_group` (admin)

## 보안 체크리스트
- [ ] Lambda에서 admin 그룹 검증 필수
- [ ] API Gateway에 Cognito Authorizer 적용
- [ ] Lambda IAM Role은 최소 권한 원칙
- [ ] 민감한 데이터 로깅 금지
- [ ] CORS 설정 (허용 도메인만)

## 참고
- AWS Well-Architected Framework - Security Pillar
- Cognito User Pool Groups: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-user-groups.html

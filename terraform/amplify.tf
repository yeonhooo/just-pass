# ============================================================================
# Amplify Hosting - AWS 콘솔에서 수동 관리
# ============================================================================
#
# Amplify 앱은 GitHub 연동을 위해 AWS 콘솔에서 직접 생성했습니다.
# Terraform으로 생성 시 GitHub OAuth 연동이 불가능하기 때문입니다.
#
# 현재 Amplify 앱 정보:
# - App ID: d3o0zqn8c8tein
# - App Name: just-pass
# - URL: https://main.d3o0zqn8c8tein.amplifyapp.com
# - GitHub Repo: https://github.com/yeonhooo/just-pass
# - Branch: main (자동 배포 활성화)
#
# 환경 변수 (Amplify 콘솔에서 설정됨):
# - VITE_AWS_REGION: ap-northeast-2
# - VITE_COGNITO_USER_POOL_ID: ap-northeast-2_YpFOZDRSn
# - VITE_COGNITO_CLIENT_ID: 2uguonkfttpkq3p150icq22qqv
# - VITE_COGNITO_IDENTITY_POOL_ID: ap-northeast-2:ee8011ca-56e8-4404-afb3-57d6c31796eb
# - VITE_DYNAMODB_QUIZZES_TABLE: auto-quiz-quizzes
# - VITE_DYNAMODB_PROGRESS_TABLE: auto-quiz-progress
#
# 빌드 설정:
# - Build command: npm run build
# - Output directory: dist
# - Node.js: 자동 감지
#
# 콘솔 접속:
# https://ap-northeast-2.console.aws.amazon.com/amplify/apps/d3o0zqn8c8tein
# ============================================================================

# Amplify Service Role (Amplify 앱에서 사용)
resource "aws_iam_role" "amplify_service" {
  name = "${var.project_name}-amplify-service"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "amplify.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-amplify-service"
  }
}

resource "aws_iam_role_policy_attachment" "amplify_service" {
  role       = aws_iam_role.amplify_service.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess-Amplify"
}

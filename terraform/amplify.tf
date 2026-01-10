# Amplify App
resource "aws_amplify_app" "main" {
  name       = var.project_name
  repository = var.github_repository != "" ? var.github_repository : null

  # GitHub 연동 시 사용
  access_token = var.github_access_token != "" ? var.github_access_token : null

  # 빌드 설정
  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: dist
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
  EOT

  # 환경 변수
  environment_variables = {
    VITE_AWS_REGION              = var.aws_region
    VITE_COGNITO_USER_POOL_ID    = aws_cognito_user_pool.main.id
    VITE_COGNITO_CLIENT_ID       = aws_cognito_user_pool_client.main.id
    VITE_COGNITO_IDENTITY_POOL_ID = aws_cognito_identity_pool.main.id
    VITE_DYNAMODB_QUIZZES_TABLE  = aws_dynamodb_table.quizzes.name
    VITE_DYNAMODB_PROGRESS_TABLE = aws_dynamodb_table.progress.name
  }

  # SPA 리다이렉트 규칙
  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>"
    status = "200"
    target = "/index.html"
  }

  # HTTPS 강제
  enable_auto_branch_creation = false
  enable_branch_auto_build    = var.github_repository != ""
  enable_branch_auto_deletion = false

  # IAM 서비스 역할
  iam_service_role_arn = aws_iam_role.amplify_service.arn

  tags = {
    Name = var.project_name
  }
}

# Amplify Branch (main)
resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.main.id
  branch_name = "main"

  # 프로덕션 브랜치 설정
  stage = "PRODUCTION"

  # 환경 변수 (브랜치별 오버라이드 가능)
  environment_variables = {
    VITE_ENVIRONMENT = "production"
  }

  tags = {
    Name = "${var.project_name}-main"
  }
}

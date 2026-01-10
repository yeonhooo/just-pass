# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-user-pool"

  # 사용자명 설정 - 이메일 기반 로그인
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # 비밀번호 정책 - 강력한 보안
  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  # 계정 복구 설정
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # 이메일 인증 설정
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Auto Quiz - 이메일 인증 코드"
    email_message        = "인증 코드: {####}"
  }

  # 스키마 설정
  schema {
    name                     = "email"
    attribute_data_type      = "String"
    required                 = true
    mutable                  = true
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  # MFA 설정 (선택적)
  mfa_configuration = "OFF"

  # 사용자 풀 추가 설정
  user_pool_add_ons {
    advanced_security_mode = "ENFORCED"
  }

  # 삭제 보호 (프로덕션에서는 true로 설정)
  deletion_protection = "INACTIVE"

  tags = {
    Name = "${var.project_name}-user-pool"
  }
}

# Cognito User Pool Client
resource "aws_cognito_user_pool_client" "main" {
  name         = "${var.project_name}-client"
  user_pool_id = aws_cognito_user_pool.main.id

  # 클라이언트 시크릿 생성 안 함 (SPA용)
  generate_secret = false

  # 토큰 유효 기간
  access_token_validity  = 1  # 1시간
  id_token_validity      = 1  # 1시간
  refresh_token_validity = 30 # 30일

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # 인증 플로우 설정
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]

  # OAuth 설정 (필요시)
  supported_identity_providers = ["COGNITO"]

  # 콜백 URL (Amplify 배포 후 업데이트 필요)
  callback_urls = ["http://localhost:5173/", "https://localhost:5173/"]
  logout_urls   = ["http://localhost:5173/", "https://localhost:5173/"]

  # 토큰 취소 활성화
  enable_token_revocation = true

  # 사용자 존재 오류 방지 (보안)
  prevent_user_existence_errors = "ENABLED"
}

# Cognito Identity Pool
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "${var.project_name}-identity-pool"
  allow_unauthenticated_identities = false # 비인증 사용자 접근 차단
  allow_classic_flow               = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.main.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = true
  }

  tags = {
    Name = "${var.project_name}-identity-pool"
  }
}

# Identity Pool Role Attachment
resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id

  roles = {
    "authenticated" = aws_iam_role.cognito_authenticated.arn
  }
}

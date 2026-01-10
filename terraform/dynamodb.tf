# DynamoDB Table - Quizzes
resource "aws_dynamodb_table" "quizzes" {
  name         = "${var.project_name}-quizzes"
  billing_mode = "PAY_PER_REQUEST" # On-demand 용량 모드

  # Primary Key
  hash_key  = "userId"
  range_key = "quizId"

  # 속성 정의
  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "quizId"
    type = "S"
  }

  # Point-in-time recovery (백업)
  point_in_time_recovery {
    enabled = true
  }

  # 서버 측 암호화
  server_side_encryption {
    enabled = true
  }

  # TTL 설정 (선택적 - 자동 삭제용)
  # ttl {
  #   attribute_name = "expiresAt"
  #   enabled        = true
  # }

  tags = {
    Name = "${var.project_name}-quizzes"
  }
}

# DynamoDB Table - Progress
resource "aws_dynamodb_table" "progress" {
  name         = "${var.project_name}-progress"
  billing_mode = "PAY_PER_REQUEST" # On-demand 용량 모드

  # Primary Key
  hash_key  = "userId"
  range_key = "quizId"

  # 속성 정의
  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "quizId"
    type = "S"
  }

  # Point-in-time recovery (백업)
  point_in_time_recovery {
    enabled = true
  }

  # 서버 측 암호화
  server_side_encryption {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-progress"
  }
}

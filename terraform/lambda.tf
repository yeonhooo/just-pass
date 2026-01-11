# Lambda IAM Role
resource "aws_iam_role" "admin_lambda" {
  name = "${var.project_name}-admin-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-admin-lambda"
  }
}

# Lambda 기본 실행 권한 (CloudWatch Logs)
resource "aws_iam_role_policy_attachment" "admin_lambda_basic" {
  role       = aws_iam_role.admin_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda DynamoDB 읽기 권한
resource "aws_iam_role_policy" "admin_lambda_dynamodb" {
  name = "${var.project_name}-admin-dynamodb-read"
  role = aws_iam_role.admin_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Scan",
          "dynamodb:Query",
          "dynamodb:GetItem"
        ]
        Resource = [
          aws_dynamodb_table.quizzes.arn,
          aws_dynamodb_table.progress.arn
        ]
      }
    ]
  })
}

# Lambda Cognito 읽기 권한 (사용자 목록 조회)
resource "aws_iam_role_policy" "admin_lambda_cognito" {
  name = "${var.project_name}-admin-cognito-read"
  role = aws_iam_role.admin_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:ListUsers",
          "cognito-idp:AdminGetUser"
        ]
        Resource = aws_cognito_user_pool.main.arn
      }
    ]
  })
}

# Lambda 함수 코드 (ZIP)
data "archive_file" "admin_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/admin"
  output_path = "${path.module}/lambda/admin.zip"
}

# Lambda 함수
resource "aws_lambda_function" "admin" {
  filename         = data.archive_file.admin_lambda.output_path
  function_name    = "${var.project_name}-admin"
  role             = aws_iam_role.admin_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.admin_lambda.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 10

  environment {
    variables = {
      COGNITO_USER_POOL_ID   = aws_cognito_user_pool.main.id
      DYNAMODB_QUIZZES_TABLE = aws_dynamodb_table.quizzes.name
      DYNAMODB_PROGRESS_TABLE = aws_dynamodb_table.progress.name
    }
  }

  tags = {
    Name = "${var.project_name}-admin"
  }
}

# Lambda 권한 (API Gateway에서 호출 허용)
resource "aws_lambda_permission" "admin_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.admin.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin.execution_arn}/*/*"
}

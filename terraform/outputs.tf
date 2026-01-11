output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.main.id
}

output "cognito_identity_pool_id" {
  description = "Cognito Identity Pool ID"
  value       = aws_cognito_identity_pool.main.id
}

output "dynamodb_quizzes_table" {
  description = "DynamoDB Quizzes Table Name"
  value       = aws_dynamodb_table.quizzes.name
}

output "dynamodb_progress_table" {
  description = "DynamoDB Progress Table Name"
  value       = aws_dynamodb_table.progress.name
}

# Amplify는 콘솔에서 관리하므로 output 제거
# App ID: d3o0zqn8c8tein
# URL: https://main.d3o0zqn8c8tein.amplifyapp.com

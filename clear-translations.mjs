import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { fromIni } from '@aws-sdk/credential-provider-ini';

const client = new DynamoDBClient({ 
  region: 'ap-northeast-2',
  credentials: fromIni({ profile: 'isen-yeonho' })
});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'just-pass-quizzes';

async function clearTranslations() {
  console.log('DynamoDB에서 번역 및 해설 캐시 삭제 중...');
  
  // 모든 청크 조회
  const scanResult = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
  }));
  
  let updatedCount = 0;
  
  for (const item of scanResult.Items || []) {
    // 청크 아이템만 처리 (questions 필드가 있는 경우)
    if (item.questions && Array.isArray(item.questions)) {
      let hasTranslation = false;
      
      // 각 문제에서 translation과 aiExplanation 제거
      const cleanedQuestions = item.questions.map(q => {
        if (q.translation || q.aiExplanation) {
          hasTranslation = true;
          const { translation, aiExplanation, ...rest } = q;
          return rest;
        }
        return q;
      });
      
      // 번역이나 해설이 있었던 경우에만 업데이트
      if (hasTranslation) {
        await docClient.send(new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            userId: item.userId,
            quizId: item.quizId,
          },
          UpdateExpression: 'SET questions = :questions',
          ExpressionAttributeValues: {
            ':questions': cleanedQuestions,
          },
        }));
        
        updatedCount++;
        console.log(`✓ ${item.quizId} 업데이트 완료`);
      }
    }
  }
  
  console.log(`\n완료! ${updatedCount}개 청크에서 번역/해설 캐시 삭제됨`);
}

clearTranslations().catch(console.error);

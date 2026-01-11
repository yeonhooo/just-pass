import { useState, useEffect } from 'react';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import { useNavigate } from 'react-router-dom';

const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL;

interface User {
  username: string;
  email: string;
  status: string;
  enabled: boolean;
  createdAt: string;
}

interface Stats {
  totalUsers: number;
  totalQuizzes: number;
  completedSessions: number;
  avgScore: number;
}

interface UserDetail {
  userId: string;
  quizzes: Array<{
    quizId: string;
    name: string;
    questionCount: number;
    createdAt: number;
  }>;
  progress: Array<{
    quizId: string;
    currentIndex: number;
    score?: number;
    completedAt?: number;
  }>;
}

export function AdminPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const getAuthToken = async () => {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString();
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAuthToken();
      
      if (!token) {
        setError('인증 토큰을 가져올 수 없습니다.');
        return;
      }

      const usersRes = await fetch(`${ADMIN_API_URL}/admin/users`, {
        headers: { Authorization: token },
      });
      
      if (usersRes.status === 403) {
        setError('관리자 권한이 없습니다.');
        return;
      }
      
      if (!usersRes.ok) throw new Error('사용자 목록 조회 실패');
      const usersData = await usersRes.json();
      setUsers(usersData.users || []);

      const statsRes = await fetch(`${ADMIN_API_URL}/admin/stats`, {
        headers: { Authorization: token },
      });
      
      if (!statsRes.ok) throw new Error('통계 조회 실패');
      const statsData = await statsRes.json();
      setStats(statsData);

    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const loadUserDetail = async (user: User) => {
    try {
      setDetailLoading(true);
      setSelectedUser(user);
      const token = await getAuthToken();
      
      // username이 Cognito sub (Identity Pool의 userId와 매핑됨)
      // 하지만 DynamoDB의 userId는 Identity Pool ID 형식
      // 여기서는 stats에서 가져온 quizzes를 필터링
      const statsRes = await fetch(`${ADMIN_API_URL}/admin/stats`, {
        headers: { Authorization: token! },
      });
      const statsData = await statsRes.json();
      
      // 해당 사용자의 퀴즈와 진행상황 필터링 (이메일 기반으로는 어려움)
      // 일단 전체 데이터 표시
      setUserDetail({
        userId: user.username,
        quizzes: statsData.quizzes || [],
        progress: statsData.recentProgress || [],
      });
    } catch (err) {
      console.error('사용자 상세 조회 실패:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading) {
    return <div className="admin-page"><p>로딩 중...</p></div>;
  }

  if (error) {
    return (
      <div className="admin-page">
        <div className="admin-error">
          <h2>⚠️ 오류</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/')}>홈으로</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1><span className="just">JUST</span> <span className="pass">PASS</span> 관리자</h1>
        <div className="admin-header-actions">
          <button onClick={() => navigate('/')} className="btn-home">홈으로</button>
          <button onClick={handleSignOut} className="btn-signout">로그아웃</button>
        </div>
      </header>

      <div className="admin-page">
        {stats && (
          <div className="admin-stats">
            <div className="stat-card">
              <span className="stat-value">{stats.totalUsers}</span>
              <span className="stat-label">전체 사용자</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.totalQuizzes}</span>
              <span className="stat-label">전체 퀴즈</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.completedSessions}</span>
              <span className="stat-label">완료된 세션</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.avgScore}점</span>
              <span className="stat-label">평균 점수</span>
            </div>
          </div>
        )}

        <div className="admin-content">
          <div className="admin-section">
            <h2>사용자 목록 ({users.length}명)</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>이메일</th>
                  <th>상태</th>
                  <th>가입일</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr 
                    key={user.username} 
                    onClick={() => loadUserDetail(user)}
                    className={selectedUser?.username === user.username ? 'selected' : ''}
                  >
                    <td>{user.email}</td>
                    <td>
                      <span className={`status-badge ${user.status === 'CONFIRMED' ? 'confirmed' : ''}`}>
                        {user.status}
                      </span>
                    </td>
                    <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedUser && (
            <div className="admin-section user-detail">
              <h2>{selectedUser.email} 학습 현황</h2>
              {detailLoading ? (
                <p>로딩 중...</p>
              ) : userDetail ? (
                <>
                  <h3>퀴즈 ({userDetail.quizzes.length}개)</h3>
                  {userDetail.quizzes.length > 0 ? (
                    <ul className="detail-list">
                      {userDetail.quizzes.map(q => (
                        <li key={q.quizId}>
                          <strong>{q.name}</strong> - {q.questionCount}문제
                          <span className="detail-date">
                            {new Date(q.createdAt).toLocaleDateString('ko-KR')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="no-data">퀴즈 없음</p>
                  )}

                  <h3>진행 현황</h3>
                  {userDetail.progress.length > 0 ? (
                    <ul className="detail-list">
                      {userDetail.progress.map((p, i) => (
                        <li key={i}>
                          {p.completedAt ? (
                            <span className="completed">✓ 완료 - {p.score}점</span>
                          ) : (
                            <span>진행 중 ({p.currentIndex + 1}번째)</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="no-data">진행 기록 없음</p>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

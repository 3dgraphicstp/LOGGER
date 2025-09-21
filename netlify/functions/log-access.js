import fetch from 'node-fetch';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = '3dgraphicstp';
const REPO_NAME = 'LOGGER';
const LOG_FILE_PATH = 'logs/test.log';

export async function handler(event) {
  try {
    let publicIp = 'unknown';
    let privateIp = 'unknown';

    // 1. C# 클라이언트에서 보낸 값 우선 사용
    if (event.body) {
      try {
        const bodyData = JSON.parse(event.body);
        if (bodyData.publicIp) publicIp = bodyData.publicIp;
        if (bodyData.privateIp) privateIp = bodyData.privateIp;
      } catch (e) {
        console.error('JSON parse error:', e.message);
      }
    }

    // 2. publicIp가 없으면 헤더에서 추출
    if (publicIp === 'unknown') {
      publicIp =
        event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        event.headers['client-ip'] ||
        event.headers['client_ip'] ||
        'unknown';
    }

    // 3. 접속 시간과 로그 라인 생성
    const accessTime = new Date().toISOString();
    const logLine = `${accessTime} - PublicIP: ${publicIp}, PrivateIP: ${privateIp}\n`;

    // 4. GitHub API URL
    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${LOG_FILE_PATH}`;

    // 5. 기존 로그 읽기
    let content = '';
    let sha = null;
    const res = await fetch(apiUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });

    if (res.ok) {
      const data = await res.json();
      content = Buffer.from(data.content, 'base64').toString('utf8');
      sha = data.sha;
    }

    // 6. 로그 추가
    const updatedContent = content + logLine;

    // 7. GitHub에 커밋
    await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Add access log',
        content: Buffer.from(updatedContent).toString('base64'),
        sha: sha
      })
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', logged: logLine })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}
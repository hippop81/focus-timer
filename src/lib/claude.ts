const API_KEY_KEY = 'focus_api_key';

export function getApiKey(): string {
  return localStorage.getItem(API_KEY_KEY) || '';
}

export function saveApiKey(key: string) {
  localStorage.setItem(API_KEY_KEY, key);
}

export interface ClaudeMessage {
  role: string;
  content: unknown;
}

export async function callClaude(system: string, messages: ClaudeMessage[]): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API_KEY_NOT_SET');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system,
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API_ERROR:${res.status}:${body}`);
  }

  const d = await res.json();
  return d.content?.find((b: { type: string }) => b.type === 'text')?.text || '';
}

export function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1]);
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(file);
  });
}

export const OCR_SYSTEM_PROMPT = `画像から試験問題を抽出し、JSONのみ返してください。
フォーマット：{"question":"問題文","choices":["選択肢1","選択肢2","選択肢3","選択肢4"],"answer":0,"explanation":"解説文"}
answerは0始まりのインデックス。選択肢にア．イ．等のプレフィックスは含めないこと。JSONのみ返し他のテキストは含めないこと。
解説は問題文・正解をもとに試験対策として有用な内容を200文字以内で生成してください。`;

export const EXPLAIN_SYSTEM_PROMPT = '資格試験の解説専門家です。200文字以内で簡潔に日本語で解説してください。';

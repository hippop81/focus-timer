import { useState, useEffect, useRef, useCallback } from 'react';
import { ReviewCard } from '../types';
import { useReview, getApiKey, saveApiKey } from '../hooks/useReview';

const LABELS = ['ア', 'イ', 'ウ', 'エ'];

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1]);
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(file);
  });
}

async function callClaude(apiKey: string, system: string, messages: unknown[]): Promise<string> {
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
  const d = await res.json();
  return d.content?.find((b: { type: string }) => b.type === 'text')?.text || '';
}

type SubTab = 'quiz' | 'register' | 'stats';

export function Review() {
  const { cards, getDueCards, answerCard, addCard } = useReview();
  const [subTab, setSubTab] = useState<SubTab>('quiz');

  // ── Quiz state ──
  const [quizCards, setQuizCards] = useState<ReviewCard[]>([]);
  const [quizIdx, setQuizIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [explainOpen, setExplainOpen] = useState(false);
  const [aiExplain, setAiExplain] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const quizInitRef = useRef(false);

  // ── Register state ──
  const [labelInput, setLabelInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<'loading' | 'ok' | 'error' | null>(null);
  const [ocrMsg, setOcrMsg] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [apiKey, setApiKeyState] = useState(getApiKey);
  const [showApiKey, setShowApiKey] = useState(false);

  // ── Stats state ──
  const [filterLabel, setFilterLabel] = useState('全て');

  // Initialize quiz once
  useEffect(() => {
    if (!quizInitRef.current) {
      setQuizCards(getDueCards());
      quizInitRef.current = true;
    }
  }, [getDueCards]);

  const resetQuiz = useCallback(() => {
    setQuizCards(getDueCards());
    setQuizIdx(0);
    setAnswered(false);
    setPicked(null);
    setCorrectCount(0);
    setExplainOpen(false);
    setAiExplain('');
    setAiLoading(false);
    quizInitRef.current = true;
  }, [getDueCards]);

  // ── Quiz handlers ──
  const handleAnswer = (pickedIdx: number) => {
    if (answered) return;
    const card = quizCards[quizIdx];
    const isCorrect = pickedIdx === card.answer;
    setAnswered(true);
    setPicked(pickedIdx);
    if (isCorrect) setCorrectCount(p => p + 1);
    answerCard(card.id, isCorrect);
  };

  const handleNext = () => {
    setQuizIdx(p => p + 1);
    setAnswered(false);
    setPicked(null);
    setExplainOpen(false);
    setAiExplain('');
    setAiLoading(false);
  };

  const handleAiExplain = async () => {
    if (!apiKey) { setAiExplain('APIキーを「登録」タブで設定してください。'); return; }
    const card = quizCards[quizIdx];
    setAiLoading(true); setAiExplain('');
    try {
      const text = await callClaude(
        apiKey,
        '資格試験の解説専門家です。200文字以内で簡潔に日本語で解説してください。',
        [{ role: 'user', content: `問題：${card.question}\n正解：${LABELS[card.answer]}（${card.choices[card.answer]}）\nこの問題を詳しく解説してください。` }],
      );
      setAiExplain(text || '解説を取得できませんでした');
    } catch {
      setAiExplain('AIへの接続に失敗しました。');
    }
    setAiLoading(false);
  };

  // ── Register handlers ──
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setOcrStatus(null); setOcrMsg('');
  };

  const handleSaveApiKey = (key: string) => {
    setApiKeyState(key);
    saveApiKey(key);
  };

  const handleRegister = async () => {
    if (!labelInput.trim()) { setOcrMsg('ラベルを入力してください'); setOcrStatus('error'); return; }
    if (!selectedFile) { setOcrMsg('スクショを選択してください'); setOcrStatus('error'); return; }
    if (!apiKey) { setOcrMsg('APIキーを設定してください'); setOcrStatus('error'); return; }

    setRegisterLoading(true);
    setOcrStatus('loading'); setOcrMsg('OCR処理中...');
    try {
      const b64 = await toBase64(selectedFile);
      const mt = selectedFile.type || 'image/jpeg';
      const text = await callClaude(
        apiKey,
        `画像から試験問題を抽出し、JSONのみ返してください。
フォーマット：{"question":"問題文","choices":["選択肢1","選択肢2","選択肢3","選択肢4"],"answer":0,"explanation":"解説文"}
answerは0始まりのインデックス。選択肢にア．イ．等のプレフィックスは含めないこと。JSONのみ返し他のテキストは含めないこと。
解説は問題文・正解をもとに試験対策として有用な内容を200文字以内で生成してください。`,
        [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mt, data: b64 } },
          { type: 'text', text: 'この試験問題をJSONで抽出・解説生成してください' },
        ]}],
      );
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      addCard({
        label: labelInput.trim(),
        question: parsed.question || '問題文を取得できませんでした',
        choices: parsed.choices || ['選択肢1', '選択肢2', '選択肢3', '選択肢4'],
        answer: typeof parsed.answer === 'number' ? parsed.answer : 0,
        explanation: parsed.explanation || '',
      });
      setOcrStatus('ok'); setOcrMsg(`登録完了！「${labelInput.trim()}」に追加しました`);
      setLabelInput(''); setSelectedFile(null); setPreviewUrl(null);
      quizInitRef.current = false;
    } catch {
      setOcrStatus('error'); setOcrMsg('読み取り失敗。もう一度試してください。');
    }
    setRegisterLoading(false);
  };

  // ── Stats data ──
  const labelMap: Record<string, { total: number; mastering: number; mastered: number }> = {};
  cards.forEach(c => {
    if (!labelMap[c.label]) labelMap[c.label] = { total: 0, mastering: 0, mastered: 0 };
    labelMap[c.label].total++;
    if (c.route === 'mastering') labelMap[c.label].mastering++;
    if (c.route === 'mastered') labelMap[c.label].mastered++;
  });
  const allLabels = Object.keys(labelMap);
  const filteredLabels = filterLabel === '全て' ? allLabels : allLabels.filter(l => l === filterLabel);

  // ── Derived quiz state ──
  const currentCard = quizCards[quizIdx];
  const isDone = quizIdx >= quizCards.length;
  const isEmpty = quizCards.length === 0;
  const accuracy = quizIdx > 0 ? Math.round(correctCount / quizIdx * 100) : null;
  const doneAccuracy = quizCards.length > 0 ? Math.round(correctCount / quizCards.length * 100) : 0;

  return (
    <div>
      {/* ── Sub-tab selector ── */}
      <div className="rv-tabs">
        {([
          { key: 'quiz' as SubTab, label: '今日やる' },
          { key: 'register' as SubTab, label: '登録' },
          { key: 'stats' as SubTab, label: '統計' },
        ]).map(t => (
          <button
            key={t.key}
            className={`rv-tab ${subTab === t.key ? 'active' : ''}`}
            onClick={() => {
              setSubTab(t.key);
              if (t.key === 'quiz') resetQuiz();
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── QUIZ ── */}
      {subTab === 'quiz' && (
        <div className="rv-section">
          <div className="rv-stat-grid">
            <div className="rv-stat-card">
              <div className="rv-stat-label">今日の残り</div>
              <div className="rv-stat-value lime">{Math.max(0, quizCards.length - quizIdx)}</div>
            </div>
            <div className="rv-stat-card">
              <div className="rv-stat-label">正解率</div>
              <div className="rv-stat-value">{accuracy !== null ? `${accuracy}%` : '—'}</div>
            </div>
          </div>

          {isEmpty && (
            <div className="rv-empty">
              <div className="rv-empty-icon">&#x1F4DA;</div>
              今日やる問題はありません
              <div className="rv-empty-sub">「登録」タブから問題を追加してください</div>
              <button className="rv-btn-secondary" onClick={() => setSubTab('register')}>問題を登録する</button>
            </div>
          )}

          {!isEmpty && isDone && (
            <div className="rv-empty">
              <div className="rv-empty-icon">&#x2705;</div>
              <div className="rv-done-title">今日の分、完了！</div>
              <div className="rv-empty-sub">
                正解率 {doneAccuracy}%（{correctCount}/{quizCards.length}）
              </div>
            </div>
          )}

          {!isEmpty && !isDone && currentCard && (
            <>
              <div className="rv-card">
                <div className="rv-card-meta">
                  <span className="rv-label-badge">
                    {currentCard.label}
                    {currentCard.route === 'mastered' && <span className="rv-route-badge mastered">習得済み</span>}
                    {currentCard.route === 'mastering' && <span className="rv-route-badge mastering">習得中 {currentCard.consecutiveCorrect}/3</span>}
                  </span>
                  <span className="rv-progress">{quizIdx + 1} / {quizCards.length}</span>
                </div>

                <div className="rv-question">{currentCard.question}</div>

                <div className="rv-choices">
                  {currentCard.choices.map((ch, i) => {
                    let cls = 'rv-choice';
                    if (answered) {
                      if (i === currentCard.answer) cls += ' correct';
                      else if (i === picked) cls += ' wrong';
                    }
                    return (
                      <button key={i} className={cls} disabled={answered} onClick={() => handleAnswer(i)}>
                        {LABELS[i]}．{ch}
                      </button>
                    );
                  })}
                </div>

                {answered && (
                  <div className="rv-explain-section">
                    <button className="rv-explain-toggle" onClick={() => setExplainOpen(p => !p)}>
                      <span>解説を見る</span>
                      <span className={`rv-chevron ${explainOpen ? 'open' : ''}`}>&#x25BE;</span>
                    </button>
                    {explainOpen && (
                      <div className="rv-explain-content">
                        <div className="rv-explain-answer">正解：{LABELS[currentCard.answer]}</div>
                        <div className="rv-explain-text">{aiExplain || currentCard.explanation || '解説が登録されていません'}</div>
                        {aiLoading && <div className="rv-explain-loading">AIが解説生成中...</div>}
                        {!aiLoading && (
                          <button className="rv-ai-btn" onClick={handleAiExplain}>
                            &#x2726; AIにもっと詳しく聞く
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {answered && (
                <button className="rv-next-btn" onClick={handleNext}>次の問題へ</button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── REGISTER ── */}
      {subTab === 'register' && (
        <div className="rv-section">
          {/* API Key */}
          <button className="rv-apikey-toggle" onClick={() => setShowApiKey(p => !p)}>
            <span>{apiKey ? '&#x1F511; APIキー設定済み' : '&#x1F511; APIキーを設定'}</span>
            <span className={`rv-chevron ${showApiKey ? 'open' : ''}`}>&#x25BE;</span>
          </button>
          {showApiKey && (
            <div className="rv-apikey-section">
              <input
                type="password"
                className="rv-input"
                placeholder="sk-ant-..."
                value={apiKey}
                onChange={e => handleSaveApiKey(e.target.value)}
              />
              <div className="rv-hint">Anthropic APIキーを入力してください。ブラウザのローカルストレージに保存されます。</div>
            </div>
          )}

          {/* Upload */}
          <label className="rv-upload-area">
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />
            <div className="rv-upload-icon">&#x1F4F7;</div>
            <div className="rv-upload-text">{selectedFile ? selectedFile.name : 'スクショを選択'}</div>
            <div className="rv-upload-hint">過去問道場 · 参考書 · 何でもOK</div>
          </label>

          {previewUrl && <img className="rv-preview" src={previewUrl} alt="preview" />}

          <div className="rv-field">
            <label className="rv-field-label">ラベル（自由記入）</label>
            <input
              type="text"
              className="rv-input"
              value={labelInput}
              onChange={e => setLabelInput(e.target.value)}
              placeholder="例: FE ネットワーク、宅建 権利関係"
            />
            <div className="rv-hint">科目・分野・何でもOK</div>
          </div>

          <div className="rv-schedule-info">
            <strong>スケジュール：大量記憶法</strong><br />
            1→2→4→7→11→15→19日後に復習<br />
            3回連続正解で習得ルートに昇格
          </div>

          {ocrStatus && (
            <div className={`rv-ocr-status ${ocrStatus}`}>{ocrMsg}</div>
          )}

          <button
            className="rv-register-btn"
            onClick={handleRegister}
            disabled={registerLoading}
          >
            {registerLoading ? '読み取り中...' : '&#x2726; AIで読み取って登録'}
          </button>
        </div>
      )}

      {/* ── STATS ── */}
      {subTab === 'stats' && (
        <div className="rv-section">
          <div className="rv-stats-summary">
            {[
              { num: cards.length, label: '登録問題数' },
              { num: cards.filter(c => c.route === 'mastering').length, label: '習得中' },
              { num: cards.filter(c => c.route === 'mastered').length, label: '習得済み' },
            ].map((s, i) => (
              <div key={i} className="rv-stats-num">
                <div className="rv-stats-num-value">{s.num}</div>
                <div className="rv-stats-num-label">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="rv-filter-chips">
            {['全て', ...allLabels].map(l => (
              <button
                key={l}
                className={`rv-chip ${filterLabel === l ? 'active' : ''}`}
                onClick={() => setFilterLabel(l)}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="rv-hint" style={{ marginBottom: 10 }}>
            {filteredLabels.length}分野 · {cards.length}問
          </div>

          <div className="rv-label-list">
            {filteredLabels.length === 0 && (
              <div className="rv-hint" style={{ padding: '16px 0' }}>問題がまだ登録されていません</div>
            )}
            {filteredLabels.map(l => {
              const g = labelMap[l];
              const pct = Math.round(g.mastered / g.total * 100);
              const barClass = pct >= 70 ? 'high' : pct >= 40 ? 'mid' : 'low';
              return (
                <div key={l} className="rv-label-card">
                  <div className="rv-label-card-header">
                    <span className="rv-label-card-name">{l}</span>
                    <span className="rv-label-card-count">{g.mastered}/{g.total} 習得済み</span>
                  </div>
                  <div className="rv-label-bar-track">
                    <div className={`rv-label-bar ${barClass}`} style={{ width: `${Math.max(pct, 3)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

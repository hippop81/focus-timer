import { useState, useEffect, useRef, useCallback } from 'react';
import { ReviewCard } from '../types';
import { useReview } from '../hooks/useReview';
import { getApiKey, saveApiKey, callClaude, toBase64, OCR_SYSTEM_PROMPT, EXPLAIN_SYSTEM_PROMPT } from '../lib/claude';

const LABELS = ['ア', 'イ', 'ウ', 'エ'];
const PREFIXED_EMPTY = ['ア．', 'イ．', 'ウ．', 'エ．'];

type SubTab = 'quiz' | 'register' | 'stats';
type RegisterPhase = 'input' | 'confirm';

interface DraftCard {
  label: string;
  question: string;
  choices: string[];
  answer: number | null;
  explanation: string;
}

function getValidationErrors(d: DraftCard): string[] {
  const errors: string[] = [];
  if (!d.label.trim()) errors.push('ラベルが未入力です');
  if (!d.question.trim()) errors.push('問題文が未入力です');
  d.choices.forEach((c, i) => {
    if (!c.trim()) errors.push(`選択肢${LABELS[i]}が未入力です`);
  });
  if (d.answer === null || d.answer < 0 || d.answer > 3) errors.push('正解を選択してください');
  return errors;
}

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
  const [registerPhase, setRegisterPhase] = useState<RegisterPhase>('input');
  const [labelInput, setLabelInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<'loading' | 'ok' | 'error' | null>(null);
  const [ocrMsg, setOcrMsg] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [apiKey, setApiKeyState] = useState(getApiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [draftCard, setDraftCard] = useState<DraftCard | null>(null);

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
        EXPLAIN_SYSTEM_PROMPT,
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

  const handleOcrToConfirm = async () => {
    if (!labelInput.trim()) { setOcrMsg('ラベルを入力してください'); setOcrStatus('error'); return; }
    if (!selectedFile) { setOcrMsg('スクショを選択してください'); setOcrStatus('error'); return; }

    setRegisterLoading(true);
    setOcrStatus('loading'); setOcrMsg('OCR処理中...');

    let parsed: Record<string, unknown> = {};
    let ocrFailed = false;

    try {
      const b64 = await toBase64(selectedFile);
      const mt = selectedFile.type || 'image/jpeg';
      const text = await callClaude(
        OCR_SYSTEM_PROMPT,
        [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mt, data: b64 } },
          { type: 'text', text: 'この試験問題をJSONで抽出・解説生成してください' },
        ]}],
      );
      try {
        parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      } catch {
        parsed = {};
        ocrFailed = true;
      }
    } catch {
      parsed = {};
      ocrFailed = true;
    }

    const choices = Array.isArray(parsed.choices) && parsed.choices.length === 4
      ? (parsed.choices as string[])
      : ['', '', '', ''];
    const answer = typeof parsed.answer === 'number' && parsed.answer >= 0 && parsed.answer <= 3
      ? parsed.answer
      : null;

    setDraftCard({
      label: labelInput.trim(),
      question: (parsed.question as string) ?? '',
      choices,
      answer,
      explanation: (parsed.explanation as string) ?? '',
    });
    setRegisterPhase('confirm');
    setRegisterLoading(false);

    if (ocrFailed) {
      setOcrStatus('error');
      setOcrMsg('OCR読み取りに失敗しました。手動で入力してください。');
    } else {
      setOcrStatus('ok');
      setOcrMsg('読み取り完了。内容を確認してください。');
    }
  };

  const handleManualToConfirm = () => {
    setDraftCard({
      label: labelInput.trim(),
      question: '',
      choices: [...PREFIXED_EMPTY],
      answer: null,
      explanation: '',
    });
    setRegisterPhase('confirm');
    setOcrStatus(null);
    setOcrMsg('');
  };

  const handleConfirmSave = () => {
    if (!draftCard) return;
    const errors = getValidationErrors(draftCard);
    if (errors.length > 0) return;

    addCard({
      label: draftCard.label,
      question: draftCard.question,
      choices: draftCard.choices,
      answer: draftCard.answer!,
      explanation: draftCard.explanation,
    });

    setRegisterPhase('input');
    setDraftCard(null);
    setLabelInput('');
    setSelectedFile(null);
    setPreviewUrl(null);
    setOcrStatus('ok');
    setOcrMsg(`登録完了！「${draftCard.label}」に追加しました`);
    quizInitRef.current = false;
  };

  const handleConfirmDiscard = () => {
    setRegisterPhase('input');
    setDraftCard(null);
    setOcrStatus(null);
    setOcrMsg('');
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

  // ── Derived state ──
  const currentCard = quizCards[quizIdx];
  const isDone = quizIdx >= quizCards.length;
  const isEmpty = quizCards.length === 0;
  const accuracy = quizIdx > 0 ? Math.round(correctCount / quizIdx * 100) : null;
  const doneAccuracy = quizCards.length > 0 ? Math.round(correctCount / quizCards.length * 100) : 0;
  const hasApiKey = apiKey.length > 0;
  const confirmErrors = draftCard ? getValidationErrors(draftCard) : [];

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
              if (t.key === 'register') { setRegisterPhase('input'); setDraftCard(null); }
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
              <div className="rv-empty-icon">📚</div>
              今日やる問題はありません
              <div className="rv-empty-sub">「登録」タブから問題を追加してください</div>
              <button className="rv-btn-secondary" onClick={() => setSubTab('register')}>問題を登録する</button>
            </div>
          )}

          {!isEmpty && isDone && (
            <div className="rv-empty">
              <div className="rv-empty-icon">✅</div>
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
                        {ch}
                      </button>
                    );
                  })}
                </div>

                {answered && (
                  <div className="rv-explain-section">
                    <button className="rv-explain-toggle" onClick={() => setExplainOpen(p => !p)}>
                      <span>解説を見る</span>
                      <span className={`rv-chevron ${explainOpen ? 'open' : ''}`}>▾</span>
                    </button>
                    {explainOpen && (
                      <div className="rv-explain-content">
                        <div className="rv-explain-answer">正解：{LABELS[currentCard.answer]}</div>
                        <div className="rv-explain-text">{aiExplain || currentCard.explanation || '解説が登録されていません'}</div>
                        {aiLoading && <div className="rv-explain-loading">AIが解説生成中...</div>}
                        {!aiLoading && (
                          <button className="rv-ai-btn" onClick={handleAiExplain}>
                            ✦ AIにもっと詳しく聞く
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

          {/* ── Input phase ── */}
          {registerPhase === 'input' && (
            <>
              {/* API Key */}
              <button className="rv-apikey-toggle" onClick={() => setShowApiKey(p => !p)}>
                <span>{hasApiKey ? '🔑 APIキー設定済み' : '🔑 APIキーを設定'}</span>
                <span className={`rv-chevron ${showApiKey ? 'open' : ''}`}>▾</span>
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
                  <div className="rv-warning">
                    ⚠️ APIキーはブラウザのローカルストレージに保存されます。自分専用の環境でのみ使用し、共有端末や公開サイトでの利用は避けてください。
                  </div>
                </div>
              )}

              {/* Label */}
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

              {/* Upload */}
              <label className="rv-upload-area">
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />
                <div className="rv-upload-icon">📷</div>
                <div className="rv-upload-text">{selectedFile ? selectedFile.name : 'スクショを選択'}</div>
                <div className="rv-upload-hint">過去問道場 · 参考書 · 何でもOK</div>
              </label>
              {previewUrl && <img className="rv-preview" src={previewUrl} alt="preview" />}

              {!hasApiKey && (
                <div className="rv-warning" style={{ marginBottom: 12 }}>
                  AI読取にはAPIキーが必要です。上の「APIキーを設定」から入力するか、手動入力をご利用ください。
                </div>
              )}

              {ocrStatus && (
                <div className={`rv-ocr-status ${ocrStatus}`}>{ocrMsg}</div>
              )}

              <button
                className="rv-register-btn"
                onClick={handleOcrToConfirm}
                disabled={registerLoading || !hasApiKey}
              >
                {registerLoading ? '読み取り中...' : '✦ AIで読み取って確認'}
              </button>

              <div className="rv-divider">
                <span>または</span>
              </div>

              <button className="rv-btn-secondary rv-btn-block" onClick={handleManualToConfirm}>
                ✏️ 手動で入力する
              </button>

              <div className="rv-schedule-info">
                <strong>スケジュール：大量記憶法</strong><br />
                1→2→4→7→11→15→19日後に復習<br />
                3回連続正解で習得ルートに昇格
              </div>
            </>
          )}

          {/* ── Confirm phase ── */}
          {registerPhase === 'confirm' && draftCard && (
            <>
              {ocrStatus && (
                <div className={`rv-ocr-status ${ocrStatus}`}>{ocrMsg}</div>
              )}

              <div className="rv-field">
                <label className="rv-field-label">ラベル</label>
                <input
                  className="rv-input"
                  value={draftCard.label}
                  onChange={e => setDraftCard({ ...draftCard, label: e.target.value })}
                  placeholder="例: FE ネットワーク"
                />
              </div>

              <div className="rv-field">
                <label className="rv-field-label">問題文</label>
                <textarea
                  className="rv-input rv-textarea"
                  rows={3}
                  value={draftCard.question}
                  onChange={e => setDraftCard({ ...draftCard, question: e.target.value })}
                  placeholder="問題文を入力..."
                />
              </div>

              <div className="rv-field">
                <label className="rv-field-label">選択肢（左のボタンで正解を指定）</label>
                {draftCard.choices.map((ch, i) => (
                  <div key={i} className="rv-manual-choice-row">
                    <button
                      className={`rv-manual-answer-btn ${draftCard.answer === i ? 'selected' : ''}`}
                      onClick={() => setDraftCard({ ...draftCard, answer: i })}
                      title="正解に設定"
                    >
                      {LABELS[i]}
                    </button>
                    <input
                      className="rv-input"
                      value={ch}
                      onChange={e => {
                        const next = [...draftCard.choices];
                        next[i] = e.target.value;
                        setDraftCard({ ...draftCard, choices: next });
                      }}
                      placeholder={`${LABELS[i]}．選択肢を入力`}
                    />
                  </div>
                ))}
                <div className="rv-hint">緑 = 正解。プレフィックス（ア．等）込みで編集可能です</div>
              </div>

              <div className="rv-field">
                <label className="rv-field-label">解説（任意）</label>
                <textarea
                  className="rv-input rv-textarea"
                  rows={2}
                  value={draftCard.explanation}
                  onChange={e => setDraftCard({ ...draftCard, explanation: e.target.value })}
                  placeholder="解説を入力..."
                />
              </div>

              {confirmErrors.length > 0 && (
                <div className="rv-validation-errors">
                  {confirmErrors.map((err, i) => <div key={i}>{err}</div>)}
                </div>
              )}

              <button
                className="rv-register-btn"
                onClick={handleConfirmSave}
                disabled={confirmErrors.length > 0}
              >
                保存
              </button>
              <button
                className="rv-btn-secondary rv-btn-block"
                onClick={handleConfirmDiscard}
                style={{ marginTop: 8 }}
              >
                破棄して登録に戻る
              </button>
            </>
          )}
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

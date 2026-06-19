import { useState, useCallback } from 'react';
import { ReviewCard } from '../types';

const INTERVALS_DEFAULT  = [1, 2, 4, 7, 11, 15, 19, 26, 35];
const INTERVALS_MASTERED = [7, 14, 30, 60, 90];
const STORAGE_KEY = 'focus_review_cards';

const SAMPLE_CARDS: ReviewCard[] = [
  {
    id: 1, label: 'FE ネットワーク',
    question: 'TCPとUDPの違いとして、正しいものはどれか。',
    choices: [
      'TCPはコネクションレス型で、UDPはコネクション型である',
      'TCPは信頼性の高いデータ転送を保証するが、UDPは保証しない',
      'UDPはフロー制御機能を持つが、TCPは持たない',
      'TCPはリアルタイム通信に適し、UDPは大容量転送に適する',
    ],
    answer: 1,
    explanation: 'TCPはコネクション型で順序保証・再送制御・フロー制御を行います。UDPはコネクションレスで高速ですが信頼性はありません。',
    consecutiveCorrect: 0, route: 'default', intervalIdx: 0, nextReview: 0,
  },
  {
    id: 2, label: 'FE セキュリティ',
    question: '公開鍵暗号方式の説明として、適切なものはどれか。',
    choices: [
      '暗号化と復号に同じ鍵を使用する',
      '送信者が受信者の公開鍵で暗号化し、受信者が秘密鍵で復号する',
      '鍵の配送問題が共通鍵暗号より深刻である',
      '処理速度が共通鍵暗号より速い',
    ],
    answer: 1,
    explanation: '公開鍵で暗号化・秘密鍵で復号します。鍵配送問題を解決しましたが処理速度は遅いためハイブリッド方式が実用的です。',
    consecutiveCorrect: 2, route: 'mastering', intervalIdx: 0, nextReview: 0,
  },
  {
    id: 3, label: 'FE アルゴリズム',
    question: 'バブルソートの平均計算量はどれか。',
    choices: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'],
    answer: 2,
    explanation: 'バブルソートは隣接要素の比較・交換を繰り返します。n個の要素でO(n²)です。',
    consecutiveCorrect: 0, route: 'default', intervalIdx: 0, nextReview: 0,
  },
];

function getIntervals(route: string) {
  return route === 'mastered' || route === 'mastering' ? INTERVALS_MASTERED : INTERVALS_DEFAULT;
}

function applySchedule(card: ReviewCard, isCorrect: boolean): ReviewCard {
  const c = { ...card };
  if (isCorrect) {
    c.consecutiveCorrect += 1;
    if (c.route === 'default' && c.consecutiveCorrect >= 3) {
      c.route = 'mastering'; c.consecutiveCorrect = 0; c.intervalIdx = 0;
    } else if (c.route === 'mastering' && c.consecutiveCorrect >= 3) {
      c.route = 'mastered'; c.consecutiveCorrect = 0; c.intervalIdx = 0;
    } else {
      const arr = getIntervals(c.route);
      c.intervalIdx = Math.min(c.intervalIdx + 1, arr.length - 1);
    }
  } else {
    c.consecutiveCorrect = 0;
    if (c.route === 'mastered' || c.route === 'mastering') {
      c.intervalIdx = 0;
    } else {
      c.intervalIdx = Math.max(0, c.intervalIdx - 1);
    }
  }
  const arr = getIntervals(c.route);
  const days = arr[Math.min(c.intervalIdx, arr.length - 1)];
  c.nextReview = Date.now() + days * 86400000;
  return c;
}

function loadCards(): ReviewCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : SAMPLE_CARDS;
  } catch { return SAMPLE_CARDS; }
}

function saveCards(cards: ReviewCard[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

export function useReview() {
  const [cards, setCards] = useState<ReviewCard[]>(loadCards);

  const getDueCards = useCallback(() => {
    const now = Date.now();
    return cards.filter(c => (c.nextReview || 0) <= now);
  }, [cards]);

  const answerCard = useCallback((cardId: number, isCorrect: boolean) => {
    setCards(prev => {
      const next = prev.map(c => c.id === cardId ? applySchedule(c, isCorrect) : c);
      saveCards(next);
      return next;
    });
  }, []);

  const addCard = useCallback((partial: Pick<ReviewCard, 'label' | 'question' | 'choices' | 'answer' | 'explanation'>) => {
    setCards(prev => {
      const newCard: ReviewCard = {
        ...partial,
        id: Date.now(),
        consecutiveCorrect: 0,
        route: 'default',
        intervalIdx: 0,
        nextReview: Date.now(),
      };
      const next = [...prev, newCard];
      saveCards(next);
      return next;
    });
  }, []);

  const deleteCard = useCallback((id: number) => {
    setCards(prev => {
      const next = prev.filter(c => c.id !== id);
      saveCards(next);
      return next;
    });
  }, []);

  return { cards, getDueCards, answerCard, addCard, deleteCard };
}

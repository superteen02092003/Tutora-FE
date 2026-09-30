import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  X,
  ArrowUp,
  PenSquare,
  GraduationCap,
  Languages,
  HelpCircle,
  ChevronRight,
} from 'lucide-react';
import {
  askAssistant,
  type AssistantMessage,
  type AssistantFilters,
  type TutorCard,
  type ShownTutor,
} from '../../services/assistant.service';
import TutorCardView from './TutorCardView';
import ActiveFilters from './ActiveFilters';
import styles from './ChatAssistant.module.css';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  cards?: TutorCard[];
}

const STORAGE_KEY = 'tutora_assistant_chat';

const QUICK_ACTIONS: { icon: React.ReactNode; label: string; message: string }[] = [
  { icon: <GraduationCap size={18} />, label: 'Tìm gia sư Toán', message: 'Mình cần tìm gia sư Toán' },
  { icon: <Languages size={18} />, label: 'Tìm gia sư Tiếng Anh', message: 'Mình cần tìm gia sư Tiếng Anh' },
  { icon: <HelpCircle size={18} />, label: 'Học phí ở TopTutor thế nào?', message: 'Học phí ở TopTutor thế nào?' },
];

interface PersistedChat {
  turns: ChatTurn[];
  filters: AssistantFilters | null;
  sessionId: string | null;
  shownTutors?: ShownTutor[];
}

const loadPersisted = (): PersistedChat | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedChat) : null;
  } catch {
    return null;
  }
};

const ChatAssistant: React.FC = () => {
  const persisted = loadPersisted();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>(persisted?.turns ?? []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  // Filter tích luỹ qua các lượt (AI stateless — FE giữ & gửi lại mỗi lượt).
  const filtersRef = useRef<AssistantFilters | null>(persisted?.filters ?? null);
  // Bản sao để RENDER chip. Vẫn giữ ref vì send() đọc filters trong closure — dùng mỗi
  // state thì lượt gửi ngay sau khi bấm ✕ có thể còn đọc giá trị cũ.
  const [filtersView, setFiltersView] = useState<AssistantFilters | null>(
    persisted?.filters ?? null,
  );
  // Phiên DB khi authed (.NET trả về) — null nếu anonymous.
  const sessionIdRef = useRef<string | null>(persisted?.sessionId ?? null);
  const shownTutorsRef = useRef<ShownTutor[]>(persisted?.shownTutors ?? []);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Chưa có lượt nào → hiện màn giới thiệu (intro) thay vì khung hội thoại.
  const started = turns.length > 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, loading]);

  // Lưu lại mỗi khi hội thoại đổi.
  useEffect(() => {
    if (turns.length === 0) return;
    try {
      const data: PersistedChat = {
        turns,
        filters: filtersRef.current,
        sessionId: sessionIdRef.current,
        shownTutors: shownTutorsRef.current,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* localStorage đầy/không khả dụng — bỏ qua, không chặn chat */
    }
  }, [turns]);

  // Bấm ✕ trên chip: bỏ tiêu chí NGAY, không cần nhắn thêm câu nào. Chỉ đổi state local
  // — lượt chat sau tự gửi filter đã gỡ, nên không tốn thêm 1 lượt gọi AI.
  const clearFilterFields = useCallback((fields: (keyof AssistantFilters)[]) => {
    const next: AssistantFilters = { ...(filtersRef.current ?? {}) };
    fields.forEach((f) => {
      delete next[f];
    });
    const empty = Object.values(next).every((v) => v == null || (Array.isArray(v) && !v.length));
    filtersRef.current = empty ? null : next;
    setFiltersView(filtersRef.current);
  }, []);

  // Xoá hội thoại + bắt đầu lại (cho cả authed lẫn guest): xoá cache local, reset state
  // + filters + sessionId → lần chat sau .NET tạo phiên mới. Quay về màn intro.
  const resetChat = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    filtersRef.current = null;
    setFiltersView(null);
    sessionIdRef.current = null;
    shownTutorsRef.current = [];
    setSuggestions([]);
    setInput('');
    setTurns([]);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || loading) return;

      setSuggestions([]);
      setInput('');
      const userTurn: ChatTurn = { role: 'user', content: message };
      // History gửi AI = toàn bộ hội thoại TRƯỚC lượt này (câu vừa gõ đi ở `message`).
      const history: AssistantMessage[] = turns.map((t) => ({ role: t.role, content: t.content }));
      setTurns((prev) => [...prev, userTurn]);
      setLoading(true);

      try {
        const res = await askAssistant({
          history,
          message,
          currentFilters: filtersRef.current,
          sessionId: sessionIdRef.current,
          shownTutors: shownTutorsRef.current,
        });
        filtersRef.current = res.filters;
        setFiltersView(res.filters);
        shownTutorsRef.current = res.shownTutors ?? [];
        if (res.sessionId) sessionIdRef.current = res.sessionId;
        setTurns((prev) => [...prev, { role: 'assistant', content: res.reply, cards: res.cards }]);
        setSuggestions(res.suggestions);
      } catch {
        setTurns((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Xin lỗi, mình đang gặp chút trục trặc. Bạn thử lại giúp mình nhé!',
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [turns, loading],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <>
      {/* Nút nổi mở chat */}
      <button
        className={`${styles.launcher} ${open ? styles.launcherHidden : ''}`}
        onClick={() => setOpen(true)}
        aria-label="Mở trợ lý TopTutor"
        title="Trợ lý TopTutor"
      >
        <MessageCircle size={26} />
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Trợ lý TopTutor">
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerTitle}>
              <span className={styles.headerLogo}>
                <MessageCircle size={18} />
              </span>
              Trợ lý TopTutor
            </div>
            <div className={styles.headerActions}>
              {started && (
                <button
                  className={styles.iconBtn}
                  onClick={resetChat}
                  title="Bắt đầu hội thoại mới"
                  aria-label="Bắt đầu hội thoại mới"
                >
                  <PenSquare size={18} />
                </button>
              )}
              <button className={styles.iconBtn} onClick={() => setOpen(false)} aria-label="Đóng">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Thân: màn intro (chưa bắt đầu) hoặc khung hội thoại */}
          {!started ? (
            <div className={styles.intro}>
              <span className={styles.introIcon}>
                <MessageCircle size={30} />
              </span>
              <h2 className={styles.introTitle}>Trợ lý TopTutor</h2>
              <p className={styles.introText}>
                Mình giúp bạn tìm gia sư phù hợp và giải đáp thắc mắc về TopTutor. Bạn cần gì hôm nay?
              </p>

              <div className={styles.divider}>gợi ý nhanh</div>

              <div className={styles.quickActions}>
                {QUICK_ACTIONS.map((qa) => (
                  <button key={qa.label} onClick={() => send(qa.message)} className={styles.quickAction}>
                    <span className={styles.quickActionIcon}>{qa.icon}</span>
                    {qa.label}
                    <ChevronRight size={18} className={styles.quickActionChevron} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.messages} ref={scrollRef}>
              {turns.map((t, i) => (
                <div
                  key={i}
                  className={`${styles.row} ${t.role === 'user' ? styles.rowUser : styles.rowAssistant}`}
                >
                  <div className={styles.bubbleWrap}>
                    <div
                      className={`${styles.bubble} ${
                        t.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant
                      }`}
                    >
                      {t.content}
                    </div>
                    {t.cards && t.cards.length > 0 && (
                      <div className={styles.cards}>
                        {t.cards.map((c) => (
                          <TutorCardView key={c.tutorId} card={c} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className={`${styles.row} ${styles.rowAssistant}`}>
                  <div className={styles.typing}>
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                  </div>
                </div>
              )}

              {!loading && suggestions.length > 0 && (
                <div className={styles.suggestions}>
                  {suggestions.map((s, i) => (
                    <button key={i} className={styles.suggestion} onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {started && <ActiveFilters filters={filtersView} onClear={clearFilterFields} />}

          {/* Ô nhập — pill: input + nút gửi tròn trong 1 khối */}
          <form className={styles.form} onSubmit={onSubmit}>
            <input
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhắn tin cho trợ lý…"
              disabled={loading}
            />
            <button
              className={styles.sendBtn}
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Gửi"
            >
              <ArrowUp size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatAssistant;

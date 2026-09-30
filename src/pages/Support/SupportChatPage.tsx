import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { getApiErrorMessage } from '../../utils/apiError';
import { PageContainer, SectionCard } from '../../components/shared';
import {
  getMySupportThread,
  sendMySupportMessage,
  sendMySupportImage,
  type SupportMessage,
  type SupportThread,
} from '../../services/supportChat.service';
import { signalRService } from '../../services/signalr.service';
import styles from './SupportChatPage.module.css';

interface SupportMessageBroadcast {
  userId: string;
  supportThreadId: number;
  message: SupportMessage;
}

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const formatMsgTime = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

const formatDayDivider = (iso: string) => {
  const date = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const dateStr = date.toLocaleDateString('vi-VN');
  if (isSameDay(date, now)) return `Hôm nay, ${dateStr}`;
  if (isSameDay(date, yesterday)) return `Hôm qua, ${dateStr}`;
  return dateStr;
};

interface SupportChatPageProps {
  /** Render inside the messages split view instead of as a standalone page. */
  embedded?: boolean;
  onBack?: () => void;
}

const SupportChatPage: React.FC<SupportChatPageProps> = ({ embedded = false, onBack }) => {
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [imageSending, setImageSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tin nhắn do API trả về và SignalR broadcast là cùng một bản ghi. Hai nguồn này
  // có thể về theo thứ tự bất kỳ, nên luôn gộp theo ID trước khi render.
  const appendMessage = useCallback((message: SupportMessage, threadId = 0, userId = '') => {
    setThread((prev) => {
      if (prev?.messages.some((item) => item.supportMessageId === message.supportMessageId)) return prev;
      if (prev) return { ...prev, messages: [...prev.messages, message] };
      return {
        supportThreadId: threadId,
        userId,
        userName: null,
        userAvatarUrl: null,
        userRole: null,
        userPhone: null,
        userEmail: null,
        messages: [message],
      };
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMySupportThread();
      setThread(data);
    } catch (err) {
      console.error('[SupportChat] load:', err);
      toast.error(getApiErrorMessage(err, 'Không tải được hội thoại hỗ trợ.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Real-time: layout đã mở kết nối SignalR (notification hub) từ trước (useLayoutData),
  // ở đây chỉ đăng ký lắng nghe reply của Admin/Staff.
  useEffect(() => {
    const unsubscribe = signalRService.subscribeToSupportMessages((raw: unknown) => {
      const broadcast = raw as SupportMessageBroadcast;
      appendMessage(broadcast.message, broadcast.supportThreadId, broadcast.userId);
    });

    return unsubscribe;
  }, [appendMessage]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread?.messages.length]);

  const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 110)}px`;
  };

  const handleSend = async () => {
    const message = draft.trim();
    if (!message || sending) return;

    setSending(true);
    try {
      const sent: SupportMessage = await sendMySupportMessage(message);
      appendMessage(sent);
      setDraft('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (err) {
      console.error('[SupportChat] send:', err);
      toast.error(getApiErrorMessage(err, 'Gửi tin nhắn thất bại. Vui lòng thử lại.'));
    } finally {
      setSending(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ chấp nhận file hình ảnh.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh vượt quá 5MB.');
      return;
    }

    setImageSending(true);
    try {
      const sent = await sendMySupportImage(file);
      appendMessage(sent);
    } catch (err) {
      console.error('[SupportChat] sendImage:', err);
      toast.error(getApiErrorMessage(err, 'Gửi hình ảnh thất bại. Vui lòng thử lại.'));
    } finally {
      setImageSending(false);
    }
  };

  let lastDividerKey = '';

  const conversation = (
      <SectionCard className={styles.card}>
        <div className={styles.thread} ref={scrollRef}>
          {loading ? (
            <div className={styles.loading}>Đang tải...</div>
          ) : !thread || thread.messages.length === 0 ? (
            <div className={styles.empty}>
              Chưa có tin nhắn nào. Gửi tin nhắn bên dưới nếu bạn cần đội ngũ quản trị hỗ trợ.
            </div>
          ) : (
            thread.messages.map((m) => {
              const dividerKey = new Date(m.createdAt).toDateString();
              const showDivider = dividerKey !== lastDividerKey;
              lastDividerKey = dividerKey;
              return (
                <div key={m.supportMessageId} style={{ display: 'contents' }}>
                  {showDivider && <span className={styles.dayDivider}>{formatDayDivider(m.createdAt)}</span>}
                  <div className={`${styles.msgRow} ${m.senderSide === 'user' ? styles.msgRowMine : styles.msgRowTheirs}`}>
                    <p className={styles.msgSender}>{m.senderSide === 'user' ? 'Bạn' : m.senderName || 'TopTutor'}</p>
                    {m.messageType === 'image' ? (
                      <a href={m.message} target="_blank" rel="noreferrer" className={styles.imageBubbleLink}>
                        <img src={m.message} alt="Hình ảnh đính kèm" className={styles.imageBubble} />
                      </a>
                    ) : (
                      <div className={styles.bubble}>{m.message}</div>
                    )}
                    <span className={styles.msgTime}>{formatMsgTime(m.createdAt)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className={styles.composer}>
          <div className={styles.composerRow}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => void handleImageSelect(e)}
            />
            <button
              className={styles.attachBtn}
              type="button"
              title="Đính kèm ảnh"
              aria-label="Đính kèm ảnh"
              disabled={imageSending}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Nhập tin nhắn cho đội ngũ quản trị..."
              value={draft}
              onChange={handleDraftChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <button className={styles.sendBtn} type="button" disabled={!draft.trim() || sending} onClick={() => void handleSend()}>
              {sending ? 'Đang gửi...' : 'Gửi'}
            </button>
          </div>
        </div>
      </SectionCard>
  );

  if (embedded) {
    return (
      <section className={styles.embedded} aria-label="Trò chuyện với Admin">
        <header className={styles.embeddedHeader}>
          {onBack && <button type="button" className={styles.backButton} onClick={onBack}>←</button>}
          <div>
            <span className={styles.embeddedEyebrow}>Hỗ trợ</span>
            <h2>Trò chuyện với Admin</h2>
          </div>
        </header>
        {conversation}
      </section>
    );
  }

  return (
    <PageContainer
      eyebrow="Hỗ trợ"
      eyebrowInfo="Nhắn tin trực tiếp cho đội ngũ hỗ trợ TopTutor."
      title="Hỗ trợ TopTutor"
      maxWidth="wide"
    >
      {conversation}
    </PageContainer>
  );
};

export default SupportChatPage;

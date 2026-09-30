import { useState } from 'react';
import {
  X,
  Loader2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import type { TopupResponse } from '../../services/wallet.service';
import type { TopupPhase } from '../../hooks/useBookingTopup';
import { formatCurrency } from '../../utils/formatters';
import styles from './TopupQR.module.css';

interface TopupQRViewProps {
  topup: TopupResponse | null;
  phase: TopupPhase;
  shortfall: number;
  topupAmount: number;
  secondsRemaining: number;
  error: string | null;
  onRegenerate: () => void;
  onRetryPay: () => void;
  onCancel: () => void;
}

const buildVietQrUrl = (t: TopupResponse): string => {
  if (t.bin && t.accountNumber) {
    const params = new URLSearchParams();
    if (t.amount) params.set('amount', String(t.amount));
    if (t.description) params.set('addInfo', t.description);
    if (t.accountName) params.set('accountName', t.accountName);
    return `https://img.vietqr.io/image/${t.bin}-${t.accountNumber}-compact2.png?${params.toString()}`;
  }
  return t.qrCode ?? '';
};

const formatCountdown = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const TopupQRView = ({
  topup,
  phase,
  shortfall,
  topupAmount,
  secondsRemaining,
  error,
  onRegenerate,
  onRetryPay,
  onCancel,
}: TopupQRViewProps) => {
  const [qrError, setQrError] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, field: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const renderBody = () => {
    if (phase === 'creating') {
      return (
        <div className={styles.centered}>
          <Loader2 size={40} className={styles.spin} color="#2563eb" />
          <h3>Đang tạo mã nạp tiền…</h3>
          <p>Vui lòng chờ trong giây lát.</p>
        </div>
      );
    }

    if (phase === 'paying') {
      return (
        <div className={styles.centered}>
          <Loader2 size={40} className={styles.spin} color="#2563eb" />
          <h3>Đã nhận tiền — đang hoàn tất thanh toán…</h3>
          <p>Hệ thống đang trừ ví và xác nhận booking cho bạn.</p>
        </div>
      );
    }

    if (phase === 'success') {
      return (
        <div className={styles.centered}>
          <span className={`${styles.iconCircle} ${styles.iconSuccess}`}>
            <CheckCircle2 size={36} />
          </span>
          <h3>Thanh toán thành công!</h3>
          <p>Đang cập nhật trạng thái booking…</p>
        </div>
      );
    }

    if (phase === 'pay_error') {
      return (
        <div className={styles.centered}>
          <span className={`${styles.iconCircle} ${styles.iconSuccess}`}>
            <Wallet size={34} />
          </span>
          <h3>Đã nạp tiền vào ví thành công</h3>
          <p>{error || 'Chỉ còn một bước cuối để hoàn tất thanh toán booking.'}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={onRetryPay}>
              Thử thanh toán lại
            </button>
            <button type="button" className={styles.ghostBtn} onClick={onCancel}>
              Đóng
            </button>
          </div>
        </div>
      );
    }

    if (phase === 'expired') {
      return (
        <div className={styles.centered}>
          <span className={`${styles.iconCircle} ${styles.iconWarn}`}>
            <AlertTriangle size={34} />
          </span>
          <h3>Mã nạp tiền đã hết hạn</h3>
          <p>Vui lòng tạo mã mới để tiếp tục nạp và thanh toán.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={onRegenerate}>
              <RefreshCw size={16} />
              Tạo mã mới
            </button>
            <button type="button" className={styles.ghostBtn} onClick={onCancel}>
              Đóng
            </button>
          </div>
        </div>
      );
    }

    if (phase === 'create_error') {
      return (
        <div className={styles.centered}>
          <span className={`${styles.iconCircle} ${styles.iconError}`}>
            <AlertTriangle size={34} />
          </span>
          <h3>Không tạo được mã nạp tiền</h3>
          <p>{error || 'Đã có lỗi xảy ra. Vui lòng thử lại.'}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={onRegenerate}>
              <RefreshCw size={16} />
              Thử lại
            </button>
            <button type="button" className={styles.ghostBtn} onClick={onCancel}>
              Đóng
            </button>
          </div>
        </div>
      );
    }

    // awaiting_topup
    if (!topup) return null;
    const qrUrl = buildVietQrUrl(topup);

    return (
      <>
        <div className={styles.banner}>
          Số dư còn thiếu <strong>{formatCurrency(shortfall)}</strong>. Quét mã để nạp{' '}
          <strong>{formatCurrency(topupAmount)}</strong> vào ví — phần dư (nếu có) được giữ lại trong ví của bạn.
        </div>

        <div className={styles.statusStrip}>
          {secondsRemaining > 0 && (
            <span className={styles.timerBadge}>
              <Clock size={14} />
              Còn {formatCountdown(secondsRemaining)}
            </span>
          )}
          <span className={styles.securityNote}>
            <ShieldCheck size={14} />
            Đối soát tự động
          </span>
        </div>

        <div className={styles.qrWrap}>
          {qrUrl && !qrError ? (
            <img
              src={qrUrl}
              alt="Mã QR nạp tiền"
              className={styles.qrImage}
              onError={() => setQrError(true)}
            />
          ) : (
            <span className={styles.qrFallback}>
              Không tải được mã QR. Vui lòng chuyển khoản theo thông tin bên dưới.
            </span>
          )}
          <p className={styles.qrCaption}>Mở app ngân hàng, quét mã và giữ nguyên nội dung chuyển khoản.</p>
        </div>

        <div className={styles.details}>
          {topup.accountName && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Chủ tài khoản</span>
              <span className={styles.rowValueWrap}>
                <span className={styles.rowValue}>{topup.accountName}</span>
              </span>
            </div>
          )}
          {topup.accountNumber && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Số tài khoản</span>
              <span className={styles.rowValueWrap}>
                <span className={styles.rowValue}>{topup.accountNumber}</span>
                <button type="button" className={styles.copyBtn} onClick={() => copy(topup.accountNumber, 'acc')}>
                  {copied === 'acc' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </span>
            </div>
          )}
          <div className={`${styles.row} ${styles.highlight}`}>
            <span className={styles.rowLabel}>Số tiền</span>
            <span className={styles.rowValueWrap}>
              <span className={`${styles.rowValue} ${styles.amount}`}>{formatCurrency(topup.amount)}</span>
              <button type="button" className={styles.copyBtn} onClick={() => copy(String(topup.amount), 'amt')}>
                {copied === 'amt' ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </span>
          </div>
          {topup.description && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Nội dung</span>
              <span className={styles.rowValueWrap}>
                <span className={styles.rowValue}>{topup.description}</span>
                <button type="button" className={styles.copyBtn} onClick={() => copy(topup.description, 'desc')}>
                  {copied === 'desc' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </span>
            </div>
          )}
        </div>

        <div className={styles.waiting}>
          <Loader2 size={15} className={styles.spin} />
          <span>Đang chờ xác nhận nạp tiền… Sẽ tự động thanh toán booking sau khi nạp xong.</span>
        </div>
      </>
    );
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <span className={styles.headerEyebrow}>TOPTUTOR</span>
            <h3>Nạp thêm &amp; thanh toán bằng ví</h3>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onCancel} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>
        <div className={styles.body}>{renderBody()}</div>
      </div>
    </div>
  );
};

export default TopupQRView;

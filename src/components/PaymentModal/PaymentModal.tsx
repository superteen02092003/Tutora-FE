import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    X,
    Wallet,
    CreditCard,
    Loader2,
    CheckCircle2,
    Clock,
    AlertTriangle,
    ArrowLeft,
    Copy,
    Check,
    Building2,
    UserRound,
    BadgeDollarSign,
    ReceiptText,
    ScanLine,
    ShieldCheck,
    RefreshCw,
} from 'lucide-react';
import { formatVNDNumber } from '../../utils/formatters';
import styles from './PaymentModal.module.css';
import {
    getPaymentSummary,
    getPaymentInfo,
    getPaymentStatus,
    payWithWallet,
    type PaymentInfoDTO,
    type PaymentSummaryDTO,
} from '../../services/payment.service';
import { toast } from 'react-toastify';
import { useBookingTopup } from '../../hooks/useBookingTopup';
import TopupQRView from '../TopupQR/TopupQRView';
import { useLargeTransactionOtp } from '../../hooks/useLargeTransactionOtp';
import { setBookingOtpResume } from '../../utils/bookingOtpResume';
import { setPendingRedirect } from '../../services/auth.service';
import PaymentOtpStep from '../PaymentOtpStep/PaymentOtpStep';
import { getApiErrorMessage } from '../../utils/apiError';

interface PaymentModalProps {
    bookingId: number;
    isOpen: boolean;
    onClose: () => void;
    onPaymentSuccess: () => void;
    /**
     * ID gia sư — cần để nếu phải điều hướng sang trang hồ sơ nhập SĐT phụ huynh (giao dịch lớn
     * chưa có SĐT), hệ thống biết đường quay lại đúng popup đặt lịch này. Không có thì fallback
     * sang trang thanh toán riêng /student-portal/booking/{id}/payment sau khi lưu SĐT.
     */
    tutorId?: string;
}

type PaymentApiError = {
    response?: {
        status?: number;
        data?: {
            errorCode?: string;
            message?: string;
        };
    };
};

// Map bin code to bank name
const BANK_MAP: Record<string, { name: string; logo?: string }> = {
    '970422': { name: 'MB Bank' },
    '970436': { name: 'Vietcombank' },
    '970418': { name: 'BIDV' },
    '970415': { name: 'VietinBank' },
    '970407': { name: 'Techcombank' },
    '970416': { name: 'ACB' },
    '970432': { name: 'VPBank' },
    '970423': { name: 'TPBank' },
    '970448': { name: 'OCB' },
    '970405': { name: 'Agribank' },
    '970441': { name: 'VIB' },
    '970443': { name: 'SHB' },
    '970437': { name: 'HDBank' },
    '970454': { name: 'Viet Capital Bank' },
    '970449': { name: 'LPBank' },
    '970426': { name: 'MSB' },
};

const PaymentModal = ({ bookingId, isOpen, onClose, onPaymentSuccess, tutorId }: PaymentModalProps) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState(false);
    // Màn chọn phương thức chỉ cần summary (KHÔNG tạo link PayOS).
    const [summary, setSummary] = useState<PaymentSummaryDTO | null>(null);
    // Thông tin PayOS đầy đủ (QR/checkout) — chỉ tải khi user chọn chuyển khoản.
    const [paymentInfo, setPaymentInfo] = useState<PaymentInfoDTO | null>(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showQRView, setShowQRView] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number>(0);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [qrImageError, setQrImageError] = useState(false);
    const [isExpired, setIsExpired] = useState(false);
    // Chặn tạo link PayOS trùng khi click dội (card + button cùng bắt sự kiện).
    const qrFetchingRef = useRef(false);

    // Build VietQR image URL from bank details
    const getQRCodeUrl = (info: PaymentInfoDTO): string => {
        if (info.bin && info.accountNumber) {
            const params = new URLSearchParams();
            if (info.amount) params.set('amount', String(info.amount));
            if (info.description) params.set('addInfo', info.description);
            if (info.accountName) params.set('accountName', info.accountName);
            return `https://img.vietqr.io/image/${info.bin}-${info.accountNumber}-compact2.png?${params.toString()}`;
        }
        // Fallback to original qrCode URL from PayOS
        return info.qrCode;
    };

    // Ánh xạ lỗi API sang trạng thái hiển thị. Dùng chung cho cả tải summary lẫn tạo link PayOS.
    const mapPaymentError = useCallback((err: unknown, fallback: string): void => {
        const apiError = err as PaymentApiError;
        console.warn('Payment request failed:', apiError.response?.status, apiError.response?.data);
        const errorCode = apiError.response?.data?.errorCode;

        if (errorCode === 'BOOKING_ALREADY_PAID') {
            setError('BOOKING_ALREADY_PAID');
            setTimeout(() => {
                onPaymentSuccess();
                onClose();
            }, 2000);
        } else if (errorCode === 'BOOKING_EXPIRED') {
            setError('BOOKING_EXPIRED');
        } else {
            setError(getApiErrorMessage(err, fallback));
        }
    }, [onClose, onPaymentSuccess]);

    // Tải summary (không tạo link PayOS) để hiển thị màn chọn phương thức.
    const fetchSummary = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const info = await getPaymentSummary(bookingId);
            setSummary(info);
        } catch (err: unknown) {
            mapPaymentError(err, 'Không thể tải thông tin thanh toán. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    }, [bookingId, mapPaymentError]);

    useEffect(() => {
        if (isOpen) {
            void fetchSummary();
            setShowQRView(false);
            setPaymentSuccess(false);
            setQrImageError(false);
            setIsExpired(false);
            setPaymentInfo(null);
        }
    }, [isOpen, bookingId, fetchSummary]);

    // Giao dịch lớn (≥ ngưỡng) của học sinh tự đăng ký → chặn bằng OTP qua Zalo ZNS tới SĐT
    // phụ huynh. Chạy TỰ ĐỘNG ngay khi summary vừa tải xong (= ngay khi màn thanh toán mở ra,
    // trước cả khi người dùng chọn phương thức) — không đợi bấm "Thanh toán ngay".
    const otpGate = useLargeTransactionOtp({
        bookingId,
        amount: summary?.amount ?? 0,
        phase: summary?.paymentPhase ?? null,
        ready: isOpen && !!summary,
        onNeedParentPhone: () => {
            if (tutorId) {
                setBookingOtpResume({ bookingId, tutorId });
            } else {
                // Không có tutorId (VD: mở PaymentModal từ khung chat) → không dựng lại được popup,
                // fallback về trang thanh toán riêng sau khi lưu SĐT.
                setPendingRedirect(`/student-portal/booking/${bookingId}/payment`);
            }
            navigate('/student-portal/profile?highlight=parent-phone');
        },
    });

    // Countdown timer for QR view. Khi hết giờ → đánh dấu isExpired để che QR + dừng poll.
    useEffect(() => {
        if (!showQRView || !paymentInfo?.expiredAt) return;

        const expiry = new Date(paymentInfo.expiredAt).getTime();
        const calcRemaining = () => Math.max(0, Math.floor((expiry - Date.now()) / 1000));

        // Cập nhật countdown + isExpired cùng lúc để tránh nháy "hết hạn" 1 frame lúc mở.
        const apply = () => {
            const remaining = calcRemaining();
            setCountdown(remaining);
            setIsExpired(remaining <= 0);
            return remaining;
        };

        if (apply() <= 0) return; // đã hết hạn ngay khi mở → không cần đếm tiếp

        const timer = setInterval(() => {
            if (apply() <= 0) clearInterval(timer);
        }, 1000);

        return () => clearInterval(timer);
    }, [showQRView, paymentInfo?.expiredAt]);

    // Poll payment status when QR view is active. Ngừng khi đã hết hạn — không nhận quét mới.
    useEffect(() => {
        if (!showQRView || paymentSuccess || isExpired) return;

        const interval = setInterval(async () => {
            try {
                const statusData = await getPaymentStatus(bookingId);
                const isPhaseComplete = paymentInfo?.paymentPhase === 'deposit'
                    ? statusData.isDepositPaid
                    : statusData.isRemainingPaid || statusData.isPaid;

                if (isPhaseComplete || statusData.status === 'PAID') {
                    clearInterval(interval);
                    setPaymentSuccess(true);
                    toast.success('Thanh toán thành công! Đang cập nhật...');
                    setTimeout(() => {
                        onPaymentSuccess();
                        onClose();
                    }, 2500);
                }
            } catch (err) {
                console.error('[PaymentModal] Status poll failed:', err);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [showQRView, bookingId, paymentInfo?.paymentPhase, paymentSuccess, isExpired, onClose, onPaymentSuccess]);

    // Luồng "nạp bù phần thiếu rồi tự động thanh toán bằng ví" (khi số dư không đủ).
    const topup = useBookingTopup({
        bookingId,
        amountDue: summary?.amount ?? 0,
        walletBalance: summary?.walletBalance ?? 0,
        onPaymentSuccess: () => {
            onPaymentSuccess();
            onClose();
        },
    });

    const handleWalletPayment = async () => {
        if (!summary?.canPayWithWallet) return;

        try {
            setPaying(true);
            await payWithWallet(bookingId);
            toast.success(
                summary.paymentPhase === 'deposit'
                    ? 'Đặt cọc thành công!'
                    : 'Thanh toán phần còn lại thành công!'
            );
            onPaymentSuccess();
            onClose();
        } catch (err: unknown) {
            const apiError = err as PaymentApiError;
            console.error('Wallet payment failed:', err);
            if (apiError.response?.data?.errorCode === 'OTP_REQUIRED') {
                // Lưới an toàn: hook đã cho qua trước đó nhưng BE vẫn từ chối (race condition) →
                // quay lại luồng OTP thay vì chỉ báo lỗi chung chung.
                otpGate.handlePaymentOtpRequired();
            } else {
                toast.error(getApiErrorMessage(apiError, 'Thanh toán thất bại.'));
            }
        } finally {
            setPaying(false);
        }
    };

    // Chuyển khoản ngân hàng: tạo link PayOS LÚC NÀY (lazy) rồi mở màn QR. Nhờ vậy nếu
    // user trả bằng ví thì không có bản ghi/ link PayOS nào được tạo ra.
    const handleOpenQRView = async () => {
        if (paymentInfo) {
            setIsExpired(false);
            setShowQRView(true);
            return;
        }

        // Guard đồng bộ: một cú click có thể kích hoạt cả card lẫn button → tránh tạo 2 link PayOS.
        if (qrFetchingRef.current) return;
        qrFetchingRef.current = true;

        try {
            setQrLoading(true);
            const info = await getPaymentInfo(bookingId);
            setPaymentInfo(info);
            setIsExpired(false);
            setShowQRView(true);
        } catch (err: unknown) {
            const apiError = err as PaymentApiError;
            const errorCode = apiError.response?.data?.errorCode;
            if (errorCode === 'BOOKING_ALREADY_PAID') {
                toast.info('Booking đã được thanh toán.');
                onPaymentSuccess();
                onClose();
            } else if (errorCode === 'BOOKING_EXPIRED') {
                setError('BOOKING_EXPIRED');
            } else if (errorCode === 'OTP_REQUIRED') {
                otpGate.handlePaymentOtpRequired();
            } else {
                toast.error(getApiErrorMessage(apiError, 'Không thể tạo liên kết thanh toán. Vui lòng thử lại.'));
            }
        } finally {
            setQrLoading(false);
            qrFetchingRef.current = false;
        }
    };

    // Hết hạn → quay về màn chọn phương thức và fetch lại; BE sẽ trả BOOKING_EXPIRED
    // (hoặc BOOKING_ALREADY_PAID nếu vừa kịp thanh toán) để hiển thị đúng trạng thái.
    const handleReloadAfterExpiry = () => {
        setShowQRView(false);
        setIsExpired(false);
        setPaymentInfo(null);
        void fetchSummary();
    };

    const handleCopy = useCallback((text: string, field: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedField(field);
            toast.success('Đã sao chép!');
            setTimeout(() => setCopiedField(null), 2000);
        });
    }, []);

    if (!isOpen) return null;

    if (topup.isActive) {
        return (
            <TopupQRView
                topup={topup.topup}
                phase={topup.phase}
                shortfall={topup.shortfall}
                topupAmount={topup.topupAmount}
                secondsRemaining={topup.secondsRemaining}
                error={topup.error}
                onRegenerate={topup.regenerate}
                onRetryPay={topup.retryPay}
                onCancel={topup.cancel}
            />
        );
    }

    const formatCurrency = (amount: number) => `${formatVNDNumber(amount)} ₫`;

    const formatCurrencyShort = (amount: number) => `${formatVNDNumber(amount)} VND`;

    const getPhaseTitle = () => {
        if (!summary) return 'Hoàn tất thanh toán';
        return summary.paymentPhase === 'remaining'
            ? 'Thanh toán các buổi còn lại'
            : 'Thanh toán buổi học đầu tiên';
    };

    const getPhaseDescription = () => {
        if (!summary) return 'Hoàn tất thanh toán để xác nhận lịch học của bạn.';
        return summary.paymentPhase === 'remaining'
            ? 'Hoàn tất phần học phí còn lại để tiếp tục lịch học đã đặt.'
            : 'Thanh toán buổi đầu để gửi yêu cầu đặt lịch tới gia sư.';
    };

    const formatCountdown = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const bankName = paymentInfo?.bin ? (BANK_MAP[paymentInfo.bin]?.name || `Ngân hàng (${paymentInfo.bin})`) : 'Ngân hàng';

    // ====== QR CODE PAYMENT VIEW ======
    if (showQRView && paymentInfo) {
        return (
            <div className={styles.overlay}>
                <div className={`${styles.modal} ${styles.qrModal}`}>
                    {/* Header */}
                    <div className={styles.qrHeader}>
                        <button onClick={() => setShowQRView(false)} className={styles.qrBackBtn} type="button">
                            <ArrowLeft size={18} />
                            Quay lại
                        </button>
                        <div className={styles.qrHeaderMain}>
                            <div className={styles.qrHeaderIcon}>
                                <ScanLine size={22} />
                            </div>
                            <div className={styles.qrHeaderTitle}>
                                <span className={styles.qrHeaderLabel}>Thanh toán QR</span>
                                <span className={styles.qrHeaderSub}>Quét mã hoặc chuyển khoản thủ công</span>
                            </div>
                        </div>
                        <div className={styles.qrHeaderAmount}>
                            <span>Số tiền</span>
                            <strong>{formatCurrencyShort(paymentInfo.amount)}</strong>
                        </div>
                    </div>

                    <div className={styles.qrBody}>
                        {/* Payment Success Overlay */}
                        {paymentSuccess && (
                            <div className={styles.qrSuccessOverlay}>
                                <div className={styles.qrSuccessContent}>
                                    <CheckCircle2 size={64} className={styles.qrSuccessIcon} />
                                    <h3>Thanh toán thành công!</h3>
                                    <p>Đang cập nhật trạng thái...</p>
                                </div>
                            </div>
                        )}

                        {/* Hết hạn → THAY THẾ hẳn nội dung QR (không overlay) để khi scroll
                            không còn lộ lớp QR cũ bên dưới. */}
                        {isExpired && !paymentSuccess && (
                            <div className={styles.qrExpiredState}>
                                <div className={styles.qrExpiredCard}>
                                    <span className={styles.qrExpiredIconWrap}>
                                        <AlertTriangle size={38} />
                                    </span>
                                    <h3>Mã thanh toán đã hết hạn</h3>
                                    <p>
                                        Vui lòng không quét mã cũ để tránh chuyển khoản nhầm. Hãy
                                        tải lại để kiểm tra trạng thái đặt lịch của bạn.
                                    </p>
                                    <button
                                        type="button"
                                        className={styles.qrReloadBtn}
                                        onClick={handleReloadAfterExpiry}
                                    >
                                        <RefreshCw size={16} />
                                        Tải lại
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Timer badge */}
                        {!paymentSuccess && !isExpired && (
                            <div className={styles.qrStatusStrip}>
                                {countdown > 0 ? (
                                    <div className={styles.qrTimerBadge}>
                                        <Clock size={15} />
                                        <span>Còn {formatCountdown(countdown)}</span>
                                    </div>
                                ) : isExpired ? (
                                    <div className={`${styles.qrTimerBadge} ${styles.qrTimerExpired}`}>
                                        <AlertTriangle size={15} />
                                        <span>Đã hết hạn thanh toán</span>
                                    </div>
                                ) : null}
                                <div className={styles.qrSecurityNote}>
                                    <ShieldCheck size={15} />
                                    <span>Giao dịch được đối soát tự động</span>
                                </div>
                            </div>
                        )}

                        {/* QR + Bank Info Layout */}
                        {!isExpired && (
                        <div className={styles.qrLayout}>
                            {/* QR Code Side */}
                            <div className={styles.qrCodeSection}>
                                <div className={styles.qrCodeCard}>
                                    <div className={styles.qrCodeTitleRow}>
                                        <div>
                                            <div className={styles.qrCodeTitle}>
                                                Quét mã để hoàn tất thanh toán
                                            </div>
                                            <p className={styles.qrCodeDesc}>
                                                Mở app ngân hàng, quét mã và giữ nguyên nội dung chuyển khoản.
                                            </p>
                                        </div>
                                        <span className={styles.qrCodeBadge}>VietQR</span>
                                    </div>
                                    <div className={styles.qrCodeImageWrapper}>
                                        {!qrImageError ? (
                                            <img
                                                src={getQRCodeUrl(paymentInfo)}
                                                alt="QR Code thanh toán"
                                                className={styles.qrCodeImage}
                                                onError={() => setQrImageError(true)}
                                            />
                                        ) : paymentInfo.qrCode && !qrImageError ? (
                                            <img
                                                src={paymentInfo.qrCode}
                                                alt="QR Code thanh toán"
                                                className={styles.qrCodeImage}
                                            />
                                        ) : (
                                            <div className={styles.qrCodePlaceholder}>
                                                <span style={{ fontSize: 48, marginBottom: 8 }}>📱</span>
                                                <span>Vui lòng chuyển khoản theo thông tin bên cạnh</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Bank Details Side */}
                            <div className={styles.qrDetailsSection}>
                                {/* Bank Name */}
                                <div className={styles.qrInfoCard}>
                                    <div className={styles.qrInfoIcon}><Building2 size={18} /></div>
                                    <div className={styles.qrInfoContent}>
                                        <span className={styles.qrInfoLabel}>Ngân hàng</span>
                                        <span className={styles.qrInfoValue}>{bankName}</span>
                                    </div>
                                </div>

                                {/* Account Name */}
                                <div className={styles.qrInfoCard}>
                                    <div className={styles.qrInfoIcon}><UserRound size={18} /></div>
                                    <div className={styles.qrInfoContent}>
                                        <span className={styles.qrInfoLabel}>Chủ tài khoản</span>
                                        <span className={styles.qrInfoValue}>{paymentInfo.accountName}</span>
                                    </div>
                                </div>

                                {/* Account Number */}
                                <div className={`${styles.qrInfoCard} ${styles.qrInfoCopyable}`} onClick={() => handleCopy(paymentInfo.accountNumber, 'account')}>
                                    <div className={styles.qrInfoIcon}><CreditCard size={18} /></div>
                                    <div className={styles.qrInfoContent}>
                                        <span className={styles.qrInfoLabel}>Số tài khoản</span>
                                        <span className={styles.qrInfoValue}>{paymentInfo.accountNumber}</span>
                                    </div>
                                    <div className={styles.qrCopyBtn}>
                                        {copiedField === 'account' ? <Check size={14} /> : <Copy size={14} />}
                                    </div>
                                </div>

                                {/* Amount */}
                                <div className={`${styles.qrInfoCard} ${styles.qrInfoHighlight}`}>
                                    <div className={styles.qrInfoIcon}><BadgeDollarSign size={18} /></div>
                                    <div className={styles.qrInfoContent}>
                                        <span className={styles.qrInfoLabel}>Số tiền</span>
                                        <span className={`${styles.qrInfoValue} ${styles.qrInfoAmount}`}>{formatCurrencyShort(paymentInfo.amount)}</span>
                                    </div>
                                </div>

                                {/* Description / Payment Code */}
                                <div className={`${styles.qrInfoCard} ${styles.qrInfoCopyable}`} onClick={() => handleCopy(paymentInfo.description || paymentInfo.paymentCode, 'desc')}>
                                    <div className={styles.qrInfoIcon}><ReceiptText size={18} /></div>
                                    <div className={styles.qrInfoContent}>
                                        <span className={styles.qrInfoLabel}>Nội dung</span>
                                        <span className={styles.qrInfoValue}>{paymentInfo.description || paymentInfo.paymentCode}</span>
                                    </div>
                                    <div className={styles.qrCopyBtn}>
                                        {copiedField === 'desc' ? <Check size={14} /> : <Copy size={14} />}
                                    </div>
                                </div>
                            </div>
                        </div>
                        )}

                        {/* Polling status indicator */}
                        {!paymentSuccess && !isExpired && (
                            <div className={styles.qrPollingStatus}>
                                <Loader2 size={14} className={styles.spinnerSlow} />
                                <span>Đang chờ xác nhận thanh toán...</span>
                            </div>
                        )}
                    </div>

                    <div className={styles.footer}>
                        <div className={styles.secureInfo}>
                            <CheckCircle2 size={14} />
                            <span>Thanh toán an toàn &amp; bảo mật bởi TopTutor</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ====== NORMAL PAYMENT MODAL ======
    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <div className={styles.headerTitleGroup}>
                        <div className={styles.headerIconWrap}>
                            <CreditCard size={22} />
                        </div>
                        <div>
                            <span className={styles.headerEyebrow}>TopTutor Secure Pay</span>
                            <h3>{getPhaseTitle()}</h3>
                            <p>{getPhaseDescription()}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.body}>
                    {loading ? (
                        <div className={styles.loaderContainer}>
                            <Loader2 className={styles.spinner} />
                            <p>Đang tải thông tin thanh toán...</p>
                        </div>
                    ) : error === 'BOOKING_EXPIRED' ? (
                        <div className={styles.errorContainer}>
                            <AlertTriangle className={styles.errorIcon} size={48} />
                            <h3>Booking đã hết hạn thanh toán</h3>
                            <p>
                                Buổi học chưa được thanh toán trong thời gian quy định nên booking đã
                                tự động bị hủy. Vui lòng đặt lịch lại nếu bạn vẫn muốn học với gia sư này.
                            </p>
                            <button onClick={onClose} className={styles.retryBtn}>Đóng</button>
                        </div>
                    ) : error === 'BOOKING_ALREADY_PAID' ? (
                        <div className={styles.successContainer}>
                            <CheckCircle2 className={styles.successIcon} size={48} />
                            <h3>Đã thanh toán thành công!</h3>
                            <p>Booking này đã được thanh toán trước đó.</p>
                        </div>
                    ) : error ? (
                        <div className={styles.errorContainer}>
                            <AlertTriangle className={styles.errorIcon} />
                            <p>{error}</p>
                            <button onClick={() => fetchSummary()} className={styles.retryBtn}>Thử lại</button>
                        </div>
                    ) : summary ? (
                        <>
                            <div className={styles.summaryBox}>
                                <div className={styles.summaryTop}>
                                    <div>
                                        <span className={styles.summaryKicker}>Cần thanh toán</span>
                                        <strong className={styles.summaryAmountLarge}>{formatCurrency(summary.amount)}</strong>
                                    </div>
                                </div>

                                <div className={styles.summaryDetails}>
                                    {summary.totalAmount != null && summary.totalAmount > 0 && (
                                        <div className={styles.summaryRow}>
                                            <span>Tổng học phí dự kiến</span>
                                            <strong>{formatCurrency(summary.totalAmount)}</strong>
                                        </div>
                                    )}
                                    {summary.paymentPhase === 'remaining' && summary.depositAmount != null && (
                                        <div className={styles.summaryRow}>
                                            <span>Đã thanh toán buổi đầu</span>
                                            <strong className={styles.paidAmount}>- {formatCurrency(summary.depositAmount)}</strong>
                                        </div>
                                    )}
                                    <div className={styles.summaryRow}>
                                        <span>
                                            {summary.paymentPhase === 'remaining'
                                                ? 'Các buổi còn lại'
                                                : 'Buổi học đầu tiên'}
                                        </span>
                                        <strong>{formatCurrency(summary.amount)}</strong>
                                    </div>
                                </div>

                                {summary.expiredAt && (
                                    <div className={styles.deadlineRow}>
                                        <Clock size={14} />
                                        <span>Hết hạn: {new Date(summary.expiredAt).toLocaleString('vi-VN')}</span>
                                    </div>
                                )}
                            </div>

                            {otpGate.status === 'checking' || otpGate.status === 'need_parent_phone' ? (
                                <div className={styles.loaderContainer}>
                                    <Loader2 className={styles.spinner} />
                                    <p>
                                        {otpGate.status === 'need_parent_phone'
                                            ? 'Đang chuyển sang trang hồ sơ để nhập số điện thoại phụ huynh...'
                                            : 'Đang kiểm tra bảo mật giao dịch...'}
                                    </p>
                                </div>
                            ) : otpGate.status === 'blocked' ? (
                                <div className={styles.errorContainer}>
                                    <AlertTriangle className={styles.errorIcon} />
                                    <p>{otpGate.errorMessage}</p>
                                </div>
                            ) : otpGate.status === 'awaiting_otp' ? (
                                <PaymentOtpStep
                                    amount={summary.amount}
                                    phase={summary.paymentPhase}
                                    verifying={otpGate.verifying}
                                    initialCooldownSeconds={otpGate.initialCooldownSeconds}
                                    onVerify={otpGate.verify}
                                    onResend={otpGate.resend}
                                    onVerified={() => {}}
                                />
                            ) : (
                            <>
                            <div className={styles.sectionTitle}>Chọn phương thức thanh toán</div>

                            <div className={styles.paymentOptions}>
                                {/* Option 1: Wallet */}
                                <div className={styles.optionCard}>
                                    <span className={`${styles.optionBadge} ${summary.canPayWithWallet ? styles.optionBadgeReady : styles.optionBadgeMuted}`}>
                                        {summary.canPayWithWallet ? 'Có thể dùng' : 'Cần nạp thêm'}
                                    </span>
                                    <div className={styles.optionHeader}>
                                        <div className={styles.optionIconWrap}>
                                            <Wallet size={24} />
                                        </div>
                                        <div className={styles.optionInfo}>
                                            <div className={styles.optionName}>Thanh toán bằng ví</div>
                                            <div className={styles.walletBalance}>Số dư: {formatCurrency(summary.walletBalance)}</div>
                                        </div>
                                    </div>
                                    {!summary.canPayWithWallet ? (
                                        <div className={styles.payAction}>
                                            <div className={styles.insufficientText}>
                                                Thiếu {formatCurrency(Math.max(0, summary.amount - summary.walletBalance))} — nạp thêm để thanh toán
                                            </div>
                                            <button
                                                type="button"
                                                className={styles.payBtn}
                                                onClick={() => topup.start()}
                                                disabled={topup.phase === 'creating'}
                                            >
                                                {topup.phase === 'creating' ? 'Đang tạo mã...' : 'Nạp thêm & thanh toán bằng ví'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className={styles.payAction}>
                                            <button
                                                type="button"
                                                className={styles.payBtn}
                                                onClick={handleWalletPayment}
                                                disabled={paying || qrLoading}
                                            >
                                                {paying ? 'Đang xử lý...' : 'Thanh toán ngay'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Option 2: Bank Transfer / QR Code — creates the PayOS link lazily */}
                                <div className={`${styles.optionCard} ${styles.recommendedOption}`} onClick={qrLoading ? undefined : handleOpenQRView}>
                                    <span className={`${styles.optionBadge} ${styles.optionBadgeRecommended}`}>Khuyên dùng</span>
                                    <div className={styles.optionHeader}>
                                        <div className={styles.optionIconWrap} style={{ background: '#eff6ff', color: '#2563eb' }}>
                                            <CreditCard size={24} />
                                        </div>
                                        <div className={styles.optionInfo}>
                                            <div className={styles.optionName}>Chuyển khoản ngân hàng</div>
                                            <div className={styles.payosSub}>Quét QR hoặc chuyển khoản thủ công</div>
                                        </div>
                                    </div>
                                    <div className={styles.payAction}>
                                        <button
                                            type="button"
                                            className={styles.payBtn}
                                            style={{ background: '#2563eb' }}
                                            disabled={qrLoading || paying}
                                        >
                                            {qrLoading ? 'Đang tạo liên kết...' : 'Thanh toán chuyển khoản'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            </>
                            )}
                        </>
                    ) : null}
                </div>

                <div className={styles.footer}>
                    <div className={styles.secureInfo}>
                        <CheckCircle2 size={14} />
                        <span>Thanh toán an toàn &amp; bảo mật bởi TopTutor</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;

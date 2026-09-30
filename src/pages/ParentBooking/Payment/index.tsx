import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import {
  getPaymentSummary,
  getPaymentInfo,
  payWithWallet,
  getBookingById,
  getPaymentStatus,
  isFirstLessonFinished,
  type PaymentInfoResponse,
  type PaymentSummaryResponse,
  type BookingResponseDTO,
} from '../../../services/booking.service';
import { isZaloMiniApp } from '../../../services/zalo-env';
import { useBookingTopup } from '../../../hooks/useBookingTopup';
import { useCurrentTime } from '../../../hooks/useCurrentTime';
import { getBookingResponseDeadlineState } from '../../../utils/bookingDeadline';
import TopupQRView from '../../../components/TopupQR/TopupQRView';
import { formatVNDNumber } from '../../../utils/formatters';
import styles from './styles.module.css';
import {
  CreditCard,
  Wallet,
  ShieldCheck,
  AlertCircle,
  ChevronLeft,
  Clock,
  MapPin,
  GraduationCap,
  CheckCircle2,
  Copy,
  ArrowRight,
  ListChecks,
} from 'lucide-react';
import { message as antMessage, Button, Radio } from 'antd';
import { useLargeTransactionOtp } from '../../../hooks/useLargeTransactionOtp';
import { setPendingRedirect, getCurrentUserRole } from '../../../services/auth.service';
import PaymentOtpStep from '../../../components/PaymentOtpStep/PaymentOtpStep';
import { getApiErrorMessage } from '../../../utils/apiError';

const PaymentPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<BookingResponseDTO | null>(null);
  // summary: dữ liệu nhẹ để hiển thị + chọn phương thức, KHÔNG tạo link PayOS.
  const [summary, setSummary] = useState<PaymentSummaryResponse | null>(null);
  // paymentInfo (QR/checkout PayOS) chỉ được tải khi user chọn chuyển khoản.
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfoResponse | null>(null);
  const [payosLoading, setPayosLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const inMiniApp = isZaloMiniApp();
  const [paymentMethod, setPaymentMethod] = useState<'payos' | 'wallet' | 'zalopay'>(inMiniApp ? 'zalopay' : 'payos');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [qrImageError, setQrImageError] = useState(false);
  // BE trả 409 BOOKING_EXPIRED nếu request lọt đúng lúc hết hạn (giữa 2 nhịp tick của đồng hồ
  // đếm ngược) — cờ này ép sang màn "hết hạn" ngay cả khi countdown phía dưới chưa kịp về 0.
  const [forceExpired, setForceExpired] = useState(false);

  const bookingId = Number(id);
  // Trang này dùng chung cho cả /parent-portal và /student-portal (App.tsx đăng ký 2 route trỏ
  // cùng component) — không được hard-code /parent-portal, học sinh tự đăng ký sẽ bị điều hướng
  // sang cổng không có quyền truy cập.
  const basePath = (getCurrentUserRole() || '').toLowerCase() === 'student' ? '/student-portal' : '/parent-portal';
  const currentTime = useCurrentTime();
  const deadlineState = summary?.expiredAt ? getBookingResponseDeadlineState(summary.expiredAt, currentTime) : null;
  const paymentExpired = forceExpired || (deadlineState?.isExpired ?? false);

  // Chặn thanh toán đợt 2 (các buổi còn lại) khi buổi học đầu tiên CHƯA kết thúc.
  // Bắt buộc gác ở đây vì BE vẫn chấp nhận trả phần còn lại ở trạng thái deposit_paid,
  // nên nếu chỉ ẩn nút ở danh sách/chi tiết thì vào thẳng URL này vẫn trả được.
  const remainingLocked =
    !!summary && summary.paymentPhase === 'remaining' && !!booking && !isFirstLessonFinished(booking);

  // Giao dịch lớn (≥ ngưỡng) của học sinh tự đăng ký → chặn bằng OTP qua Zalo ZNS tới SĐT phụ
  // huynh. Chạy TỰ ĐỘNG ngay khi trang load xong (không đợi bấm "Thanh toán"). Với vai trò Parent,
  // hook luôn trả về 'not_required' ngay lập tức — trang này KHÔNG BAO GIỜ hiện OTP cho phụ huynh.
  const otpGate = useLargeTransactionOtp({
    bookingId,
    amount: summary?.amount ?? 0,
    phase: summary?.paymentPhase ?? null,
    ready: !loading && !!summary && !remainingLocked,
    onNeedParentPhone: () => {
      setPendingRedirect(`/student-portal/booking/${bookingId}/payment`);
      navigate('/student-portal/profile?highlight=parent-phone');
    },
  });
  const otpSettled = otpGate.status === 'not_required' || otpGate.status === 'verified';

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [bookingRes, summaryRes] = await Promise.all([getBookingById(bookingId), getPaymentSummary(bookingId)]);
        if (!bookingRes?.content || !summaryRes?.content) {
          throw new Error('Dữ liệu không hợp lệ');
        }
        setBooking(bookingRes.content);
        setSummary(summaryRes.content);

        // Nếu đã thanh toán, redirect ngay để tránh tạo lại booking khi nhấn Back
        if (bookingRes.content.paymentStatus === 'paid') {
          navigate(`${basePath}/booking/${bookingId}`, { replace: true });
          return;
        }

        // Đủ số dư ví → mặc định chọn ví, để KHÔNG tạo link PayOS trừ khi user chủ động
        // chuyển sang chuyển khoản. Nhờ vậy trả bằng ví không sinh bản ghi PayOS nào.
        if (!inMiniApp && summaryRes.content.canPayWithWallet) {
          setPaymentMethod('wallet');
        }
      } catch (err) {
        // BE trả BOOKING_ALREADY_PAID khi booking đã thanh toán — gồm cả trường hợp self-heal:
        // link đã PAID tại PayOS nhưng webhook lỗi, BE tự xác nhận khi mở trang. Điều hướng tới chi tiết.
        if (isAxiosError(err) && err.response?.data?.errorCode === 'BOOKING_ALREADY_PAID') {
          antMessage.success('Thanh toán của bạn đã được ghi nhận!');
          navigate(`${basePath}/booking/${bookingId}`, { replace: true });
          return;
        }
        // Mở lại link thanh toán sau khi đã hết hạn cọc (không đang xem đồng hồ đếm chạy về 0) —
        // getPaymentSummary tự chặn ngay từ lúc tải trang, summary/booking sẽ không có dữ liệu.
        if (isAxiosError(err) && err.response?.data?.errorCode === 'BOOKING_EXPIRED') {
          setForceExpired(true);
          return;
        }
        antMessage.error('Không thể tải thông tin thanh toán.');
        navigate(`${basePath}/booking`);
      } finally {
        setLoading(false);
      }
    };

    if (bookingId) fetchData();
  }, [bookingId, navigate, inMiniApp, basePath]);

  // Tạo link PayOS (lazy) chỉ khi user thực sự chọn "chuyển khoản ngân hàng" — và (nếu là giao
  // dịch lớn của học sinh tự đăng ký) chỉ sau khi đã xác thực OTP xong, tránh tạo link trước khi
  // được phép trả.
  useEffect(() => {
    if (paymentMethod !== 'payos' || paymentInfo || loading || remainingLocked || !otpSettled) return;

    let cancelled = false;
    (async () => {
      try {
        setPayosLoading(true);
        const res = await getPaymentInfo(bookingId);
        if (cancelled) return;
        if (!res?.content) throw new Error('Dữ liệu không hợp lệ');
        setPaymentInfo(res.content);
      } catch (err) {
        if (cancelled) return;
        if (isAxiosError(err) && err.response?.data?.errorCode === 'BOOKING_ALREADY_PAID') {
          antMessage.success('Thanh toán của bạn đã được ghi nhận!');
          navigate(`${basePath}/booking/${bookingId}`, { replace: true });
          return;
        }
        if (isAxiosError(err) && err.response?.data?.errorCode === 'OTP_REQUIRED') {
          otpGate.handlePaymentOtpRequired();
          return;
        }
        if (isAxiosError(err) && err.response?.data?.errorCode === 'BOOKING_EXPIRED') {
          setForceExpired(true);
          return;
        }
        antMessage.error(getApiErrorMessage(err, 'Không thể tạo liên kết thanh toán.'));
      } finally {
        if (!cancelled) setPayosLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod, paymentInfo, loading, remainingLocked, otpSettled, bookingId, navigate]);

  // Polling payment status for PayOS
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (paymentMethod === 'payos' && !!paymentInfo && !paymentSuccess && !loading && !remainingLocked) {
      interval = setInterval(async () => {
        try {
          const res = await getPaymentStatus(bookingId);
          const data = res?.content;
          const phaseComplete = summary?.paymentPhase === 'remaining' ? data?.isRemainingPaid : data?.isDepositPaid;
          if (data?.isPaid || phaseComplete) {
            setPaymentSuccess(true);
            antMessage.success('Thanh toán thành công!');
            clearInterval(interval);
          }
        } catch (e) {
          console.error('Polling error', e);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [bookingId, paymentMethod, paymentSuccess, loading, paymentInfo, summary?.paymentPhase, remainingLocked]);

  // Luồng "nạp bù phần thiếu rồi tự động thanh toán bằng ví" (khi số dư không đủ).
  const topup = useBookingTopup({
    bookingId,
    amountDue: summary?.amount ?? 0,
    walletBalance: summary?.walletBalance ?? 0,
    onPaymentSuccess: () => setPaymentSuccess(true),
  });

  const handleWalletPay = async () => {
    if (!summary || summary.walletBalance < summary.amount) {
      antMessage.error('Số dư ví không đủ. Vui lòng nạp thêm tiền.');
      return;
    }

    try {
      setIsPaying(true);
      await payWithWallet(bookingId);
      setPaymentSuccess(true);
      antMessage.success('Thanh toán bằng ví thành công!');
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.data?.errorCode === 'OTP_REQUIRED') {
        otpGate.handlePaymentOtpRequired();
      } else if (isAxiosError(error) && error.response?.data?.errorCode === 'BOOKING_EXPIRED') {
        setForceExpired(true);
      } else {
        antMessage.error(getApiErrorMessage(error, 'Có lỗi xảy ra khi thanh toán.'));
      }
    } finally {
      setIsPaying(false);
    }
  };

  // ZaloPay — TODO: kích hoạt sau khi có ZaloPay Merchant account
  // const handleZaloPay = async () => {
  //     try {
  //         setIsPaying(true);
  //         const { payment } = await import('zmp-sdk/apis');
  //         const orderRes = await apiClient.post('/payment/zalopay/create-order', { bookingId });
  //         const { zpTransToken, amount } = orderRes.data.content;
  //         const result = await payment.createOrder({
  //             desc: `Tutora - Đặt lịch gia sư #${bookingId}`,
  //             item: [],
  //             amount,
  //         });
  //         if (result.code === 1) {
  //             await apiClient.post('/payment/zalopay/confirm', { bookingId, zpTransToken });
  //             setPaymentSuccess(true);
  //         }
  //     } catch (error: any) {
  //         antMessage.error(error.message || 'ZaloPay thất bại.');
  //     } finally {
  //         setIsPaying(false);
  //     }
  // };

  const formatPrice = (amount: number) => `${formatVNDNumber(amount)} ₫`;

  const copy = (value: string, label: string) => {
    navigator.clipboard?.writeText(value).then(
      () => antMessage.success(`Đã sao chép ${label}`),
      () => antMessage.error('Không sao chép được, vui lòng copy thủ công.'),
    );
  };

  // Dựng ảnh QR VietQR ngay trong app từ thông tin BE trả về (không cần mở trang PayOS).
  const getQrUrl = (info: PaymentInfoResponse): string => {
    if (info.bin && info.accountNumber) {
      const params = new URLSearchParams();
      if (info.amount) params.set('amount', String(info.amount));
      if (info.description) params.set('addInfo', info.description);
      if (info.accountName) params.set('accountName', info.accountName);
      return `https://img.vietqr.io/image/${info.bin}-${info.accountNumber}-compact2.png?${params.toString()}`;
    }
    return info.qrCode ?? ''; // fallback: QR do PayOS trả về
  };

  if (loading) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (paymentExpired) {
    const isRemainingPhase = summary?.paymentPhase === 'remaining';
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.successContainer}>
          <div className={styles.successCard}>
            <div className={styles.successIcon} style={{ background: '#fee2e2', color: '#b91c1c' }}>
              <AlertCircle size={52} strokeWidth={2.2} />
            </div>
            <span className={styles.successEyebrow}>Đã hết hạn thanh toán</span>
            <h1>{isRemainingPhase ? 'Đã quá hạn thanh toán các buổi còn lại' : 'Yêu cầu đặt lịch đã hết hạn'}</h1>
            <p className={styles.successMessage}>
              {isRemainingPhase
                ? 'Bạn chưa thanh toán các buổi học còn lại trong thời hạn 48 giờ cho phép, nên khóa học đã được kết thúc sớm với các buổi đã hoàn thành. Vui lòng liên hệ TopTutor nếu cần hỗ trợ thêm.'
                : 'Bạn chưa hoàn tất thanh toán tiền cọc trong thời hạn 10 phút cho phép, nên yêu cầu đặt lịch này đã tự động hết hạn. Vui lòng đặt lịch lại với gia sư để tiếp tục.'}
            </p>
            <div className={styles.successActions}>
              <Button
                type="primary"
                size="large"
                onClick={() => navigate(`${basePath}/booking`, { replace: true })}
              >
                <ListChecks size={17} />
                Danh sách đặt lịch
              </Button>
              {!isRemainingPhase && (
                <Button size="large" onClick={() => navigate('/tutor-search', { replace: true })}>
                  <span>Tìm gia sư khác</span>
                  <ArrowRight size={17} />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (remainingLocked) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.successContainer}>
          <div className={styles.successCard}>
            <div className={styles.successIcon} style={{ background: '#fff7ed', color: '#ea580c' }}>
              <Clock size={52} strokeWidth={2.2} />
            </div>
            <span className={styles.successEyebrow}>Chưa thể thanh toán</span>
            <h1>Chờ buổi học đầu tiên kết thúc</h1>
            <p className={styles.successMessage}>
              Bạn chỉ có thể thanh toán các buổi học còn lại sau khi buổi học đầu tiên diễn ra và kết thúc. Vui lòng quay
              lại sau buổi học đầu tiên.
            </p>
            <div className={styles.successActions}>
              <Button
                type="primary"
                size="large"
                onClick={() => navigate(`${basePath}/booking/${bookingId}`, { replace: true })}
              >
                <span>Xem chi tiết booking</span>
                <ArrowRight size={17} />
              </Button>
              <Button size="large" onClick={() => navigate(`${basePath}/booking`, { replace: true })}>
                <ListChecks size={17} />
                Danh sách đặt lịch
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (paymentSuccess) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.successContainer}>
          <div className={styles.successCard}>
            <div className={styles.successIcon}>
              <CheckCircle2 size={52} strokeWidth={2.2} />
            </div>
            <span className={styles.successEyebrow}>Giao dịch đã được xác nhận</span>
            <h1>Thanh toán hoàn tất!</h1>
            <p className={styles.successMessage}>
              Cảm ơn bạn đã tin tưởng TopTutor. Lịch học đã được giữ chỗ và sẵn sàng để bạn theo dõi.
            </p>

            <div className={styles.successReceipt}>
              <div>
                <span>Mã đặt lịch</span>
                <strong>BK-{bookingId}</strong>
              </div>
              <div>
                <span>Khoản thanh toán</span>
                <strong>
                  {summary?.paymentPhase === 'remaining' ? 'Đợt 2 · Các buổi còn lại' : 'Đợt 1 · Buổi học đầu tiên'}
                </strong>
              </div>
              <div>
                <span>Số tiền</span>
                <strong>{formatPrice(summary?.amount ?? 0)}</strong>
              </div>
            </div>

            <div className={styles.successActions}>
              <Button
                type="primary"
                size="large"
                onClick={() => navigate(`${basePath}/booking/${bookingId}`, { replace: true })}
              >
                <span>Xem lịch học</span>
                <ArrowRight size={17} />
              </Button>
              <Button size="large" onClick={() => navigate(`${basePath}/booking`, { replace: true })}>
                <ListChecks size={17} />
                Danh sách đặt lịch
              </Button>
            </div>
            <p className={styles.successFootnote}>Thông tin thanh toán đã được cập nhật tự động.</p>
          </div>
        </div>
      </div>
    );
  }

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

  return (
    <div className={styles.container}>
      <div className={styles.topNav}>
        <button onClick={() => navigate(`${basePath}/booking`, { replace: true })} className={styles.backBtn}>
          <ChevronLeft size={20} /> Quay lại
        </button>
        <div className={styles.titleGroup}>
          <h1>Thanh toán khóa học</h1>
          <span className={styles.phaseBadge}>
            {summary?.paymentPhase === 'remaining' ? 'Đợt 2 · Các buổi còn lại' : 'Đợt 1 · Buổi học đầu tiên'}
          </span>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Left Column: Summary */}
        <div className={styles.sidebar}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Tóm tắt đơn hàng</h2>
            <div className={styles.tutorBrief}>
              <img src={booking?.tutor?.avatarUrl} alt="" className={styles.avatar} />
              <div>
                <h3>{booking?.tutor?.fullName || 'N/A'}</h3>
                <p>
                  <GraduationCap size={14} /> Gia sư {booking?.subject?.subjectName || 'N/A'}
                </p>
              </div>
            </div>

            <div className={styles.bookingDetails}>
              <div className={styles.detailItem}>
                <Clock size={16} />
                <span>Gói {booking?.sessionCount} buổi học</span>
              </div>
              <div className={styles.detailItem}>
                <MapPin size={16} />
                <span>Học {booking?.packageType === 'online' ? 'Trực tuyến' : 'Trực tiếp'}</span>
              </div>
            </div>

            <div className={styles.priceBreakdown}>
              <p className={styles.breakdownSectionLabel}>Chi phí toàn khóa học ({booking?.sessionCount ?? 0} buổi)</p>
              <div className={styles.priceRow}>
                <span>Học phí ({booking?.sessionCount ?? 0} buổi):</span>
                <span>{formatPrice(booking?.price || 0)}</span>
              </div>
              {booking?.discountApplied && booking.discountApplied > 0 ? (
                <div className={styles.priceRow}>
                  <span>Giảm giá:</span>
                  <span className={styles.discount}>-{formatPrice(booking.discountApplied)}</span>
                </div>
              ) : null}
              {(() => {
                const parentFee =
                  (booking?.finalPrice || 0) - ((booking?.price || 0) - (booking?.discountApplied || 0));
                return parentFee > 0 ? (
                  <div className={styles.priceRow}>
                    <span className={styles.feeLabelStack}>
                      Phí dịch vụ TopTutor (5%)
                      <small>Phí duy trì &amp; bảo vệ giao dịch trên nền tảng</small>
                    </span>
                    <span>+{formatPrice(parentFee)}</span>
                  </div>
                ) : null;
              })()}
              <div className={`${styles.priceRow} ${styles.grandTotalRow}`}>
                <span>Tổng học phí toàn khóa:</span>
                <span>{formatPrice(booking?.finalPrice || 0)}</span>
              </div>

              {(() => {
                const totalSessions = booking?.sessionCount ?? 0;
                const remainingSessions = Math.max(totalSessions - 1, 0);
                const isRemaining = summary?.paymentPhase === 'remaining';
                return (
                  <div className={styles.dueNowBox}>
                    <span className={styles.dueNowLabel}>
                      {isRemaining
                        ? `Cần thanh toán hôm nay — Đợt 2 (${remainingSessions}/${totalSessions} buổi còn lại)`
                        : `Cần thanh toán hôm nay — Đợt 1 (1/${totalSessions} buổi đầu tiên)`}
                    </span>
                    <span className={styles.totalPrice}>{formatPrice(summary?.amount || 0)}</span>
                    <p className={styles.dueNowCaption}>
                      {isRemaining
                        ? 'Buổi học đầu tiên (Đợt 1) đã được thanh toán trước đó — số tiền trên chỉ là phần còn lại.'
                        : `Đây là số tiền cho buổi học đầu tiên, KHÔNG phải tổng học phí toàn khóa ở trên. ${remainingSessions} buổi còn lại sẽ thanh toán riêng ở Đợt 2, sau khi buổi học đầu tiên kết thúc.`}
                    </p>
                    {deadlineState && !deadlineState.isExpired && (
                      <span
                        className={`${styles.countdownBadge} ${styles[`countdownBadge_${deadlineState.urgency}`]}`}
                      >
                        <Clock size={13} aria-hidden="true" />
                        Còn {deadlineState.remainingLabel} để thanh toán
                        {isRemaining ? '' : ' — quá hạn yêu cầu sẽ tự hủy'}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className={styles.securityNote}>
              <ShieldCheck size={16} />
              <p>TopTutor đảm bảo thanh toán an toàn. Tiền chỉ được chuyển cho gia sư sau khi buổi học hoàn thành.</p>
            </div>
          </div>
        </div>

        {/* Right Column: Payment Methods */}
        <main className={styles.main}>
          <div className={styles.card}>
            {!otpSettled ? (
              <>
                <h2 className={styles.cardTitle}>Xác thực giao dịch</h2>
                <div className={styles.checkoutSection}>
                  {otpGate.status === 'checking' || otpGate.status === 'need_parent_phone' ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 12,
                        padding: '32px 0',
                      }}
                    >
                      <div className={styles.spinner} aria-hidden="true" />
                      <p style={{ color: '#6b7280', textAlign: 'center', margin: 0 }}>
                        {otpGate.status === 'need_parent_phone'
                          ? 'Đang chuyển sang trang hồ sơ để nhập số điện thoại phụ huynh...'
                          : 'Đang kiểm tra bảo mật giao dịch...'}
                      </p>
                    </div>
                  ) : otpGate.status === 'blocked' ? (
                    <div className={styles.insufficientFunds}>
                      <AlertCircle size={20} />
                      <p>{otpGate.errorMessage}</p>
                    </div>
                  ) : otpGate.status === 'awaiting_otp' && summary ? (
                    <PaymentOtpStep
                      amount={summary.amount}
                      phase={summary.paymentPhase}
                      verifying={otpGate.verifying}
                      initialCooldownSeconds={otpGate.initialCooldownSeconds}
                      onVerify={otpGate.verify}
                      onResend={otpGate.resend}
                      onVerified={() => {}}
                    />
                  ) : null}
                </div>
              </>
            ) : (
            <>
            <h2 className={styles.cardTitle}>Chọn phương thức thanh toán</h2>

            <div className={styles.checkoutSection}>
              <Radio.Group
                onChange={(e) => setPaymentMethod(e.target.value)}
                value={paymentMethod}
                className={styles.methodGroup}
              >
                {/* ZaloPay — chỉ hiển thị trong Zalo Mini App */}
                {inMiniApp && (
                  <label className={`${styles.methodItem} ${paymentMethod === 'zalopay' ? styles.methodActive : ''}`}>
                    <Radio value="zalopay" />
                    <div className={styles.methodContent}>
                      <div className={styles.methodIcon}>
                        <CreditCard size={24} />
                      </div>
                      <div className={styles.methodInfo}>
                        <h3>ZaloPay</h3>
                        <p>Thanh toán nhanh qua ZaloPay trong Zalo</p>
                      </div>
                    </div>
                  </label>
                )}

                {/* PayOS — ẩn trong Mini App (dùng ZaloPay thay thế) */}
                {!inMiniApp && (
                  <label className={`${styles.methodItem} ${paymentMethod === 'payos' ? styles.methodActive : ''}`}>
                    <Radio value="payos" />
                    <div className={styles.methodContent}>
                      <div className={styles.methodIcon}>
                        <CreditCard size={24} />
                      </div>
                      <div className={styles.methodInfo}>
                        <h3>Quét mã QR Ngân hàng</h3>
                        <p>Hỗ trợ tất cả ứng dụng Mobile Banking</p>
                      </div>
                    </div>
                  </label>
                )}

                <label className={`${styles.methodItem} ${paymentMethod === 'wallet' ? styles.methodActive : ''}`}>
                  <Radio value="wallet" />
                  <div className={styles.methodContent}>
                    <div className={styles.methodIcon}>
                      <Wallet size={24} />
                    </div>
                    <div className={styles.methodInfo}>
                      <h3>Số dư ví TopTutor</h3>
                      <p>
                        Số dư hiện tại: <strong>{formatPrice(summary?.walletBalance || 0)}</strong>
                      </p>
                    </div>
                  </div>
                </label>
              </Radio.Group>

              <div className={styles.paymentActionArea}>
                {paymentMethod === 'zalopay' ? (
                  <div className={styles.walletArea}>
                    <p className={styles.walletHint}>
                      Thanh toán <strong>{formatPrice(summary?.amount || 0)}</strong> qua ZaloPay.
                    </p>
                    <Button
                      type="primary"
                      size="large"
                      block
                      disabled
                      className={styles.payBtn}
                      style={{ marginTop: '16px' }}
                    >
                      ZaloPay (sắp ra mắt)
                    </Button>
                    <p style={{ fontSize: 12, color: '#888', marginTop: 8, textAlign: 'center' }}>
                      Tạm thời dùng Ví TopTutor để thanh toán
                    </p>
                  </div>
                ) : paymentMethod === 'payos' ? (
                  <div className={styles.payosArea}>
                    {!paymentInfo && (
                      <div className={styles.walletHint} style={{ textAlign: 'center', padding: '16px 0' }}>
                        {payosLoading ? 'Đang tạo liên kết thanh toán...' : 'Đang chuẩn bị thông tin chuyển khoản...'}
                      </div>
                    )}
                    {paymentInfo && (
                      <div className={styles.payosContent}>
                        {/* QR ngay trong app */}
                        <div className={styles.qrSide}>
                          <div className={styles.qrPreview}>
                            {!qrImageError ? (
                              <img
                                src={getQrUrl(paymentInfo)}
                                alt="Mã QR thanh toán"
                                className={styles.qrImage}
                                onError={() => setQrImageError(true)}
                              />
                            ) : (
                              <span className={styles.qrFallback}>
                                Không tải được mã QR. Vui lòng chuyển khoản theo thông tin bên dưới.
                              </span>
                            )}
                          </div>
                          <p className={styles.qrCaption}>Mở app ngân hàng và quét mã QR để thanh toán</p>
                        </div>

                        {/* Thông tin chuyển khoản */}
                        <div className={styles.payosMeta}>
                          <p className={styles.transferLabel}>Hoặc chuyển khoản thủ công</p>
                          <div className={styles.transferMeta}>
                            <div className={styles.priceRow}>
                              <span>Số tài khoản</span>
                              <span className={styles.copyCell}>
                                <strong>{paymentInfo.accountNumber}</strong>
                                <button
                                  type="button"
                                  className={styles.copyBtn}
                                  onClick={() => copy(paymentInfo.accountNumber ?? '', 'số tài khoản')}
                                  aria-label="Sao chép số tài khoản"
                                >
                                  <Copy size={15} />
                                </button>
                              </span>
                            </div>
                            <div className={styles.priceRow}>
                              <span>Chủ tài khoản</span>
                              <span className={styles.copyCell}>
                                <strong>{paymentInfo.accountName}</strong>
                              </span>
                            </div>
                            <div className={styles.priceRow}>
                              <span>Số tiền</span>
                              <span className={styles.copyCell}>
                                <strong>{formatPrice(paymentInfo.amount)}</strong>
                                <button
                                  type="button"
                                  className={styles.copyBtn}
                                  onClick={() => copy(String(paymentInfo.amount), 'số tiền')}
                                  aria-label="Sao chép số tiền"
                                >
                                  <Copy size={15} />
                                </button>
                              </span>
                            </div>
                            <div className={styles.priceRow}>
                              <span>Nội dung</span>
                              <span className={styles.copyCell}>
                                <strong>{paymentInfo.description || paymentInfo.paymentCode}</strong>
                                <button
                                  type="button"
                                  className={styles.copyBtn}
                                  onClick={() =>
                                    copy(paymentInfo.description || paymentInfo.paymentCode || '', 'nội dung')
                                  }
                                  aria-label="Sao chép nội dung"
                                >
                                  <Copy size={15} />
                                </button>
                              </span>
                            </div>
                          </div>

                          <div className={styles.waitingStatus}>
                            <span className={styles.waitingSpinner} aria-hidden="true">
                              <span />
                              <span />
                              <span />
                            </span>
                            <span>Đang chờ xác nhận thanh toán... Hệ thống sẽ tự động cập nhật.</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={styles.walletArea}>
                    {summary && summary.walletBalance < summary.amount ? (
                      <>
                        <div className={styles.insufficientFunds}>
                          <AlertCircle size={20} />
                          <p>
                            Số dư thiếu{' '}
                            <strong>
                              {formatPrice(Math.max(0, (summary.amount || 0) - (summary.walletBalance || 0)))}
                            </strong>
                            . Nạp thêm để thanh toán ngay bằng ví.
                          </p>
                        </div>
                        <Button
                          type="primary"
                          size="large"
                          block
                          loading={topup.phase === 'creating'}
                          onClick={() => topup.start()}
                          className={styles.payBtn}
                          style={{ marginTop: '16px' }}
                        >
                          Nạp thêm &amp; thanh toán bằng ví
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className={styles.walletHint}>
                          Hệ thống sẽ khấu trừ trực tiếp <strong>{formatPrice(summary?.amount || 0)}</strong> từ ví
                          của bạn.
                        </p>
                        <Button
                          type="primary"
                          size="large"
                          block
                          disabled={!summary || isPaying}
                          loading={isPaying}
                          onClick={handleWalletPay}
                          className={styles.payBtn}
                        >
                          Xác nhận thanh toán bằng ví
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default PaymentPage;

import { useCallback, useContext, useEffect, useState, type ElementType } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Input, Modal, Spin, message as antMessage } from 'antd';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Copy,
  CreditCard,
  GraduationCap,
  MessageSquare,
  ReceiptText,
  Star,
  Tag,
  Timer,
  UserRound,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { formatVNDNumber } from '../../../utils/formatters';
import BookingMonthCalendar from '../../../components/BookingMonthCalendar/BookingMonthCalendar';
import { useCurrentTime } from '../../../hooks/useCurrentTime';
import {
  cancelBooking,
  finalizeBookingEarly,
  getBookingById,
  isFirstLessonFinished,
  type BookingResponseDTO,
} from '../../../services/booking.service';
import { getBookingResponseDeadlineState } from '../../../utils/bookingDeadline';
import { canLeaveBookingFeedback, getBookingFeedback, type FeedbackDto } from '../../../services/feedback.service';
import { getPaymentBadge } from '../../../utils/paymentBadge';
import { StudentProfileContext } from '../../../contexts/StudentProfileContext';
import CreateFeedbackModal from '../../ParentLessons/components/CreateFeedbackModal';
import styles from './styles.module.css';
import { getApiErrorMessage } from '../../../utils/apiError';

type Lesson = NonNullable<BookingResponseDTO['lessons']>[number];

interface StatusConfig {
  label: string;
  className: string;
  icon: ElementType;
}

interface ProgressStep {
  key: string;
  label: string;
  description: string;
  date?: string | null;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  pending_tutor: { label: 'Chờ gia sư xác nhận', className: 'statusPending', icon: Clock3 },
  accepted: { label: 'Chờ thanh toán buổi đầu', className: 'statusWarning', icon: CreditCard },
  pending_payment: { label: 'Chờ thanh toán buổi đầu', className: 'statusWarning', icon: CreditCard },
  deposit_paid: { label: 'Gia sư đã xác nhận', className: 'statusActive', icon: CheckCircle2 },
  pending_remaining_payment: { label: 'Chờ thanh toán còn lại', className: 'statusWarning', icon: WalletCards },
  paid: { label: 'Đang hoàn tất khóa học', className: 'statusActive', icon: CheckCircle2 },
  active: { label: 'Đang học', className: 'statusActive', icon: BookOpen },
  ongoing: { label: 'Đang học', className: 'statusActive', icon: BookOpen },
  completed: { label: 'Đã hoàn thành', className: 'statusCompleted', icon: CheckCircle2 },
  cancelled: { label: 'Đã hủy', className: 'statusCancelled', icon: XCircle },
  cancelled_noshow: { label: 'Đã hủy do vắng mặt', className: 'statusCancelled', icon: XCircle },
  payment_timeout: { label: 'Hết hạn thanh toán', className: 'statusCancelled', icon: XCircle },
  // Hai trạng thái kết thúc do CMS/khiếu nại tạo ra. Thiếu chúng ở đây thì booking rơi vào fallback
  // `pending_tutor` bên dưới và trang hiện "Chờ gia sư xác nhận" cho một booking đã hủy hẳn.
  cancelled_by_staff: { label: 'Đã hủy bởi quản trị viên', className: 'statusCancelled', icon: XCircle },
  cancelled_by_dispute: { label: 'Đã hủy theo khiếu nại', className: 'statusCancelled', icon: XCircle },
};

const LESSON_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  scheduled: { label: 'Đã lên lịch', className: 'lessonScheduled' },
  reserved: { label: 'Đã giữ chỗ', className: 'lessonScheduled' },
  in_progress: { label: 'Đang diễn ra', className: 'lessonCurrent' },
  pending_confirmation: { label: 'Chờ xác nhận', className: 'lessonPending' },
  completed: { label: 'Hoàn thành', className: 'lessonCompleted' },
  cancelled: { label: 'Đã hủy', className: 'lessonCancelled' },
  cancelled_noshow: { label: 'Hủy do vắng mặt', className: 'lessonCancelled' },
  disputed: { label: 'Đang khiếu nại', className: 'lessonPending' },
  no_show: { label: 'Vắng mặt', className: 'lessonCancelled' },
  interrupted: { label: 'Bị ngắt giữa buổi', className: 'lessonPending' },
};

/**
 * Ghi chú liên kết chuỗi (buổi gốc bị ngắt/dispute ↔ buổi phụ/buổi học lại của nó) cho từng dòng
 * trong "Danh sách buổi học" — nếu không có dòng này, buổi gốc bị Cancelled (khi Admin hoà giải
 * chọn "học lại") trông như huỷ thật, và buổi phụ/học lại trông như 1 buổi độc lập không liên quan.
 */
const getLessonLinkNote = (lesson: Lesson, allLessons: Lesson[]): string | null => {
  if (lesson.isContinuation || lesson.isDisputeRelearn) {
    const kind = lesson.isContinuation ? 'Buổi phụ' : 'Buổi học lại';
    return lesson.originalClassSessionId ? `${kind} của buổi #${lesson.originalClassSessionId}` : kind;
  }
  const successor = allLessons.find((other) => other.originalClassSessionId === lesson.lessonId);
  if (successor) {
    const kind = successor.isContinuation ? 'buổi phụ' : 'buổi học lại';
    return `Đã thay bằng ${kind} #${successor.lessonId}`;
  }
  return null;
};

const DAY_NAMES = ['', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const formatPrice = (amount?: number | null) => `${formatVNDNumber(amount ?? 0)} ₫`;

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value?: string | null) => {
  const date = parseDate(value);
  if (!date) return 'Chưa cập nhật';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateOnly = (value?: string | null) => {
  const date = parseDate(value);
  if (!date) return 'Chưa xác định';
  return date.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatTimeRange = (start?: string | null, end?: string | null) => {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) return 'Chưa xác định';
  const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  return `${startDate.toLocaleTimeString('vi-VN', options)} - ${endDate.toLocaleTimeString('vi-VN', options)}`;
};

const formatGrade = (booking: BookingResponseDTO) => {
  const value = booking.gradeLevel?.gradeName ?? booking.student?.gradeLevelName ?? booking.student?.gradeLevel;
  if (!value) return 'Chưa cập nhật';
  return /^\d+$/.test(value) ? `Lớp ${value}` : value;
};

const formatPackage = (booking: BookingResponseDTO) => {
  if (booking.package?.name) return booking.package.name;
  const type = Number(booking.packageType);
  if (type === 1) return 'Gói lịch linh hoạt';
  if (type === 2) return 'Gói lịch cố định';
  return booking.packageType ? `Gói ${booking.packageType}` : 'Chưa cập nhật';
};

const formatDuration = (minutes?: number) => {
  if (!minutes) return 'Chưa cập nhật';
  if (minutes % 60 === 0) return `${minutes / 60} giờ/buổi`;
  return `${minutes} phút/buổi`;
};

type ProgressStepKey =
  | 'created'
  | 'deposit_paid'
  | 'tutor_confirmed'
  | 'first_lesson'
  | 'remaining_paid'
  | 'ongoing'
  | 'completed';

// Luồng BE hiện tại:
// tạo → thanh toán buổi đầu → gia sư xác nhận → học buổi đầu →
// thanh toán phần còn lại → tiếp tục khóa học → hoàn thành.
const getCurrentProgressStep = (status: string, isSingleSession: boolean): ProgressStepKey => {
  if (status === 'pending_payment' || status === 'accepted') return 'deposit_paid';
  if (status === 'pending_tutor') return 'tutor_confirmed';
  if (status === 'deposit_paid') return 'first_lesson';
  if (status === 'pending_remaining_payment') return isSingleSession ? 'completed' : 'remaining_paid';
  if (status === 'active' || status === 'ongoing') return isSingleSession ? 'first_lesson' : 'ongoing';
  if (status === 'paid' || status === 'completed') return 'completed';
  return 'created';
};

const getProgressSteps = (booking: BookingResponseDTO, lessons: Lesson[]): ProgressStep[] => {
  const firstLesson = lessons[0];
  const lastLesson = lessons.at(-1);
  const sessionCount = booking.totalSessions ?? booking.sessionCount;
  const isSingleSession = sessionCount <= 1;
  const tutorConfirmed = [
    'deposit_paid',
    'pending_remaining_payment',
    'active',
    'ongoing',
    'paid',
    'completed',
  ].includes(booking.status);
  const depositPaid =
    Boolean(booking.depositPaidAt) || ['DepositEscrowed', 'Escrowed', 'paid'].includes(booking.paymentStatus);
  const remainingPaid = Boolean(booking.remainingPaidAt) || ['Escrowed', 'paid'].includes(booking.paymentStatus);
  const firstLessonReached = ['pending_remaining_payment', 'active', 'ongoing', 'paid', 'completed'].includes(
    booking.status,
  );

  const steps: ProgressStep[] = [
    {
      key: 'created',
      label: 'Yêu cầu đặt lịch đã được tạo',
      description: 'Yêu cầu học đã được hệ thống ghi nhận',
      date: booking.createdAt,
    },
    {
      key: 'deposit_paid',
      label: 'Thanh toán buổi học đầu tiên',
      description: depositPaid
        ? 'Đã thanh toán buổi học đầu tiên'
        : 'Hoàn tất thanh toán buổi đầu để gửi yêu cầu tới gia sư',
      date: booking.depositPaidAt,
    },
    {
      key: 'tutor_confirmed',
      label: 'Gia sư xác nhận',
      description: tutorConfirmed ? 'Gia sư đã đồng ý nhận lớp' : 'Đang chờ gia sư phản hồi yêu cầu',
    },
    {
      key: 'first_lesson',
      label: firstLessonReached ? 'Đã học buổi đầu tiên' : 'Học buổi đầu tiên',
      description: firstLessonReached
        ? 'Buổi học đầu tiên đã diễn ra'
        : 'Bắt đầu buổi học đầu tiên theo lịch đã xác nhận',
      date: firstLesson?.scheduledStart ?? booking.startDate,
    },
  ];

  if (!isSingleSession) {
    steps.push({
      key: 'remaining_paid',
      label: 'Thanh toán các buổi còn lại',
      description: remainingPaid
        ? 'Học phí các buổi còn lại đã được thanh toán'
        : booking.status === 'pending_remaining_payment'
          ? 'Buổi đầu đã kết thúc, vui lòng thanh toán phần còn lại'
          : 'Mở sau khi buổi học đầu tiên kết thúc',
      date: booking.remainingPaidAt,
    });
    steps.push({
      key: 'ongoing',
      label: booking.status === 'ongoing' || booking.status === 'active' ? 'Đang học' : 'Tiếp tục khóa học',
      description:
        booking.status === 'ongoing' || booking.status === 'active'
          ? 'Các buổi học còn lại đang diễn ra'
          : 'Các buổi còn lại bắt đầu sau khi hoàn tất thanh toán',
      date: booking.remainingPaidAt,
    });
  }

  steps.push({
    key: 'completed',
    label: booking.status === 'paid' ? 'Đang hoàn tất khóa học' : 'Hoàn thành khóa học',
    description:
      booking.status === 'paid'
        ? 'Các buổi học đã kết thúc, hệ thống đang hoàn tất khóa học'
        : 'Tất cả buổi học đã hoàn tất',
    date: booking.status === 'completed' ? lastLesson?.scheduledEnd : null,
  });

  return steps;
};

const BookingDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const basePath = pathname.startsWith('/student-portal') ? '/student-portal' : '/parent-portal';
  const bookingId = Number(id);
  const isValidBookingId = Boolean(id) && Number.isInteger(bookingId) && bookingId > 0;
  // Trang dùng chung Parent/Student — ở /parent-portal không có StudentProfileProvider bọc
  // ngoài nên đọc thẳng context (không dùng useStudentProfile(), nó throw khi ctx undefined).
  // Tài khoản do phụ huynh quản lý chỉ được xem, không thanh toán được (xem StudentBooking).
  const isParentManaged = useContext(StudentProfileContext)?.isParentManaged ?? false;

  const [booking, setBooking] = useState<BookingResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [canReview, setCanReview] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackDto | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const currentTime = useCurrentTime();

  // Chỉ khóa học đã hoàn thành mới có đánh giá — khớp với điều kiện ở BE.
  const refreshFeedbackState = useCallback(async (status: string) => {
    if (status !== 'completed') {
      setCanReview(false);
      setFeedback(null);
      return;
    }

    const [eligibility, existing] = await Promise.all([
      canLeaveBookingFeedback(bookingId),
      getBookingFeedback(bookingId),
    ]);
    setCanReview(eligibility.content);
    setFeedback(existing.content);
  }, [bookingId]);

  useEffect(() => {
    if (!isValidBookingId) return;

    const fetchBooking = async () => {
      try {
        setLoading(true);
        const response = await getBookingById(bookingId);
        setBooking(response.content);
        await refreshFeedbackState(response.content.status);
      } catch (error) {
        antMessage.error(getApiErrorMessage(error, 'Không thể tải chi tiết đặt lịch.'));
      } finally {
        setLoading(false);
      }
    };

    void fetchBooking();
  }, [bookingId, isValidBookingId, refreshFeedbackState]);

  if (!isValidBookingId) return <Navigate to="/404" replace />;

  if (loading) {
    return (
      <div className={styles.loadingOverlay}>
        <Spin size="large" tip="Đang tải chi tiết..." />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className={styles.page}>
        <div className={styles.notFound}>
          <AlertCircle size={48} />
          <h2>Không tìm thấy lịch đặt</h2>
          <p>Yêu cầu đặt lịch #{id} không tồn tại hoặc bạn không có quyền xem.</p>
          <button className={styles.backBtnPrimary} onClick={() => navigate(-1)} type="button">
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  // Fallback KHÔNG được là một trạng thái cụ thể: status lạ (BE thêm mới, dữ liệu cũ) sẽ bị mô tả
  // sai hoàn toàn thay vì chỉ mơ hồ — đúng lỗi đã xảy ra với cancelled_by_dispute, hiện thành
  // "Chờ gia sư xác nhận" trên một booking đã hủy.
  const statusConfig: StatusConfig =
    STATUS_CONFIG[booking.status] ??
    (booking.status?.startsWith('cancelled')
      ? { label: 'Đã hủy', className: 'statusCancelled', icon: XCircle }
      : { label: booking.status || 'Không xác định', className: 'statusPending', icon: Clock3 });
  const StatusIcon = statusConfig.icon;
  const lessons = [...(booking.lessons ?? [])].sort(
    (first, second) => new Date(first.scheduledStart).getTime() - new Date(second.scheduledStart).getTime(),
  );
  const firstLesson = lessons[0];
  const lastLesson = lessons.at(-1);
  const completedLessons = lessons.filter((lesson) => lesson.status === 'completed').length;
  const weeklySchedule = Array.from(
    new Map(
      (booking.schedule ?? []).map((slot) => [`${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}`, slot]),
    ).values(),
  );
  const progressSteps = getProgressSteps(booking, lessons);
  const isSingleSession = (booking.totalSessions ?? booking.sessionCount) <= 1;
  const currentProgressStep = getCurrentProgressStep(booking.status, isSingleSession);
  const progressIndex = Math.max(
    0,
    progressSteps.findIndex((step) => step.key === currentProgressStep),
  );
  const isCourseCompleted = booking.status === 'completed';
  const completedProgressSteps = isCourseCompleted ? progressSteps.length : progressIndex;
  const progressValue = `${completedProgressSteps}/${progressSteps.length}`;
  const progressBarWidth = Math.round((completedProgressSteps / progressSteps.length) * 100);
  const isCancelled = [
    'cancelled',
    'cancelled_noshow',
    'payment_timeout',
    'cancelled_by_staff',
    'cancelled_by_dispute',
  ].includes(booking.status);

  // Số tiền ĐÃ TRẢ THẬT. Phải neo vào các mốc *PaidAt chứ không phải depositAmount: trường đó luôn
  // có giá trị (là số tiền cọc phải trả), kể cả khi phụ huynh chưa trả đồng nào — dùng nó trực tiếp
  // sẽ báo "đã thanh toán" cho một booking bị hủy vì quá hạn thanh toán.
  const paidSoFar = booking.remainingPaidAt
    ? booking.finalPrice
    : booking.depositPaidAt
      ? (booking.depositAmount ?? 0)
      : 0;
  const refundAmount = booking.refundAmount ?? 0;
  const REFUND_STATUS_LABELS: Record<string, string> = {
    pending: 'Đang xử lý',
    processing: 'Đang xử lý',
    completed: 'Đã hoàn',
    refunded: 'Đã hoàn',
    failed: 'Hoàn tiền thất bại',
  };
  const refundStatusLabel = booking.refundStatus
    ? (REFUND_STATUS_LABELS[booking.refundStatus.toLowerCase()] ?? booking.refundStatus)
    : null;
  const responseDeadline =
    booking.status === 'pending_tutor' ? getBookingResponseDeadlineState(booking.responseDeadline, currentTime) : null;
  const responseDeadlineTone = responseDeadline
    ? responseDeadline.urgency === 'critical'
      ? styles.responseDeadlineCritical
      : responseDeadline.urgency === 'warning'
        ? styles.responseDeadlineWarning
        : ''
    : '';
  const paymentBadge = getPaymentBadge(booking.status, booking.paymentStatus);
  const parentServiceFee = Math.max(0, booking.finalPrice - (booking.price - booking.discountApplied));
  const depositPaid =
    Boolean(booking.depositPaidAt) || ['DepositEscrowed', 'Escrowed', 'paid'].includes(booking.paymentStatus);
  const remainingPaid = Boolean(booking.remainingPaidAt) || ['Escrowed', 'paid'].includes(booking.paymentStatus);
  const hasStartedLesson = lessons.some((lesson) => {
    const status = lesson.status ?? '';
    if (['in_progress', 'pending_confirmation', 'completed', 'disputed', 'no_show', 'cancelled_noshow'].includes(status)) {
      return true;
    }
    const scheduledStart = parseDate(lesson.scheduledStart);
    return ['scheduled', 'reserved'].includes(status) && scheduledStart != null && scheduledStart.getTime() <= currentTime;
  });
  const canFinalizeEarly =
    booking.status === 'pending_remaining_payment' &&
    !remainingPaid &&
    completedLessons > 0 &&
    !lessons.some((lesson) =>
      ['in_progress', 'pending_confirmation', 'disputed', 'no_show', 'cancelled_noshow'].includes(
        lesson.status ?? '',
      ),
    );
  const canCancel =
    ['pending_tutor', 'accepted', 'pending_payment'].includes(booking.status) && !hasStartedLesson;
  // Khớp với TrialCancelWindowHours ở BookingService.cs (BE) — trong vòng 2h trước buổi học đầu
  // tiên, BE từ chối yêu cầu hủy tự do của phụ huynh/học sinh (dù nút vẫn hiện phía FE trước đây),
  // buộc phải chờ hoặc báo cáo gia sư không vào lớp qua luồng no-show có sẵn. Nếu BE đổi mốc này thì
  // sửa luôn hằng số dưới đây.
  const TRIAL_CANCEL_WINDOW_HOURS = 2;
  const nextUncancelledLesson = lessons.find((lesson) => lesson.status !== 'cancelled');
  const firstUpcomingLessonStart = parseDate(nextUncancelledLesson?.scheduledStart);
  const isWithinTrialCancelWindow =
    firstUpcomingLessonStart != null &&
    firstUpcomingLessonStart.getTime() - currentTime < TRIAL_CANCEL_WINDOW_HOURS * 60 * 60 * 1000;
  const cancelBlockedByTrialWindow = canCancel && (depositPaid || remainingPaid) && isWithinTrialCancelWindow;
  const lessonDetailPath = nextUncancelledLesson
    ? basePath === '/student-portal'
      ? `${basePath}/calendar/${nextUncancelledLesson.lessonId}`
      : `${basePath}/lessons/${nextUncancelledLesson.lessonId}`
    : null;
  const canPayDeposit = !isParentManaged && ['accepted', 'pending_payment'].includes(booking.status);
  // Chỉ cho thanh toán đợt 2 khi buổi học đầu tiên đã kết thúc.
  const isRemainingStage = ['deposit_paid', 'pending_remaining_payment'].includes(booking.status);
  const canPayRemaining = !isParentManaged && isRemainingStage && isFirstLessonFinished(booking);
  const remainingLocked = !isParentManaged && isRemainingStage && !isFirstLessonFinished(booking);
  const hasActions =
    canReview || canCancel || canFinalizeEarly || canPayDeposit || canPayRemaining || remainingLocked;

  const copyBookingCode = async () => {
    try {
      await navigator.clipboard.writeText(`BK-${booking.bookingId}`);
      antMessage.success('Đã sao chép mã đặt lịch');
    } catch {
      antMessage.warning('Không thể sao chép mã đặt lịch');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} type="button">
          <ArrowLeft size={18} />
          <span>Danh sách đặt lịch</span>
        </button>
        <div className={styles.topBarRight}>
          <button className={styles.bookingCode} onClick={copyBookingCode} type="button">
            <Copy size={13} />
            BK-{booking.bookingId}
          </button>
          <span className={`${styles.statusBadgeLg} ${styles[statusConfig.className]}`}>
            <StatusIcon size={15} />
            {statusConfig.label}
          </span>
        </div>
      </div>

      <main className={styles.pageContent}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Chi tiết khóa học</span>
            <h1>{booking.subject?.subjectName || 'Khóa học của bạn'}</h1>
          </div>
          <div className={styles.heroFacts}>
            <div>
              <BookOpen size={18} />
              <span>Môn học</span>
              <strong>{booking.subject?.subjectName || 'Chưa cập nhật'}</strong>
            </div>
            <div>
              <GraduationCap size={18} />
              <span>Cấp lớp</span>
              <strong>{formatGrade(booking)}</strong>
            </div>
            <div>
              <CalendarCheck2 size={18} />
              <span>Số buổi</span>
              <strong>{booking.totalSessions ?? booking.sessionCount} buổi</strong>
            </div>
            <div>
              <Timer size={18} />
              <span>Thời lượng</span>
              <strong>{formatDuration(booking.durationMinutesPerSession)}</strong>
            </div>
          </div>
        </header>

        <div className={styles.detailGrid}>
          <div className={styles.mainColumn}>
            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <div>
                  <span className={styles.sectionIcon}>
                    <UserRound size={18} />
                  </span>
                  <div>
                    <p>Thông tin chung</p>
                    <h2>Gia sư và học sinh</h2>
                  </div>
                </div>
              </div>

              <div className={styles.peopleGrid}>
                <article className={styles.personCard}>
                  <div className={styles.tutorAvatar}>
                    {booking.tutor?.avatarUrl ? (
                      <img src={booking.tutor.avatarUrl} alt={booking.tutor.fullName} />
                    ) : (
                      <span>{booking.tutor?.fullName?.charAt(0) || 'G'}</span>
                    )}
                  </div>
                  <div>
                    <span className={styles.personRole}>Gia sư phụ trách</span>
                    <h3>{booking.tutor?.fullName || 'Chưa cập nhật'}</h3>
                    <p>{formatPrice(booking.pricePerHour ?? booking.tutor?.hourlyRate)}/giờ</p>
                  </div>
                </article>
                <article className={styles.personCard}>
                  <div className={styles.studentAvatar}>
                    <span>{booking.student?.fullName?.charAt(0) || 'H'}</span>
                  </div>
                  <div>
                    <span className={styles.personRole}>Học sinh</span>
                    <h3>{booking.student?.fullName || 'Chưa cập nhật'}</h3>
                    <p>{formatGrade(booking)}</p>
                  </div>
                </article>
              </div>

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <ReceiptText size={17} />
                  <div>
                    <span>Gói học</span>
                    <strong>{formatPackage(booking)}</strong>
                  </div>
                </div>
                <div className={styles.infoItem}>
                  <CalendarDays size={17} />
                  <div>
                    <span>Ngày tạo yêu cầu</span>
                    <strong>{formatDateTime(booking.createdAt)}</strong>
                  </div>
                </div>
                <div className={styles.infoItem}>
                  <Banknote size={17} />
                  <div>
                    <span>Học phí theo giờ</span>
                    <strong>{formatPrice(booking.pricePerHour ?? booking.tutor?.hourlyRate)}</strong>
                  </div>
                </div>
                <div className={styles.infoItem}>
                  <Timer size={17} />
                  <div>
                    <span>Thời lượng mỗi buổi</span>
                    <strong>{formatDuration(booking.durationMinutesPerSession)}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <div>
                  <span className={styles.sectionIcon}>
                    <CalendarDays size={18} />
                  </span>
                  <div>
                    <p>Lịch học</p>
                    <h2>Lộ trình và các buổi học</h2>
                  </div>
                </div>
                <span className={styles.sessionProgress}>
                  {completedLessons}/{booking.sessionCount} buổi hoàn thành
                </span>
              </div>

              <div className={styles.scheduleOverview}>
                <div>
                  <span>Bắt đầu</span>
                  <strong>{formatDateOnly(firstLesson?.scheduledStart ?? booking.startDate)}</strong>
                </div>
                <ArrowRight size={18} />
                <div>
                  <span>Kết thúc dự kiến</span>
                  <strong>{formatDateOnly(lastLesson?.scheduledEnd)}</strong>
                </div>
              </div>

              {weeklySchedule.length > 0 && (
                <div className={styles.weeklySchedule}>
                  <span>Lịch học hằng tuần</span>
                  <div>
                    {weeklySchedule.map((slot) => (
                      <span key={`${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}`}>
                        <strong>{DAY_NAMES[slot.dayOfWeek] ?? `Thứ ${slot.dayOfWeek}`}</strong>
                        {slot.startTime} - {slot.endTime}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <BookingMonthCalendar
                lessons={booking.lessons}
                startDate={booking.startDate}
                schedule={booking.schedule}
                sessionCount={booking.sessionCount}
              />

              <div className={styles.lessonSection}>
                <div className={styles.lessonSectionTitle}>
                  <h3>Danh sách buổi học</h3>
                  <span>{lessons.length || booking.sessionCount} buổi</span>
                </div>
                {lessons.length > 0 ? (
                  <div className={styles.lessonList}>
                    {lessons.map((lesson, index) => {
                      const lessonStatus = LESSON_STATUS_CONFIG[lesson.status ?? 'scheduled'] ?? {
                        label: 'Chưa cập nhật',
                        className: 'lessonScheduled',
                      };
                      const linkNote = getLessonLinkNote(lesson, lessons);
                      return (
                        <article className={styles.lessonItem} key={lesson.lessonId}>
                          <span className={styles.lessonNumber}>{index + 1}</span>
                          <div className={styles.lessonDate}>
                            <strong>{formatDateOnly(lesson.scheduledStart)}</strong>
                            <span>{formatTimeRange(lesson.scheduledStart, lesson.scheduledEnd)}</span>
                            {linkNote && <span className={styles.lessonLinkNote}>{linkNote}</span>}
                          </div>
                          <span className={`${styles.lessonBadge} ${styles[lessonStatus.className]}`}>
                            {lessonStatus.label}
                          </span>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.emptyLessons}>
                    <CalendarDays size={22} />
                    <span>Danh sách buổi học cụ thể đang được cập nhật.</span>
                  </div>
                )}
              </div>
            </section>

            {booking.status === 'completed' && (canReview || feedback) && (
              <section className={styles.card}>
                <div className={styles.sectionHeader}>
                  <div>
                    <span className={styles.sectionIcon}>
                      <Star size={18} />
                    </span>
                    <div>
                      <p>Đánh giá</p>
                      <h2>{feedback ? 'Đánh giá của bạn' : 'Đánh giá khóa học'}</h2>
                    </div>
                  </div>
                  {feedback?.canEdit && (
                    <button
                      className={styles.reviewEditBtn}
                      type="button"
                      onClick={() => setShowReviewModal(true)}
                    >
                      Sửa đánh giá
                    </button>
                  )}
                </div>

                {feedback ? (
                  <>
                    <div className={styles.reviewScore}>
                      <span className={styles.reviewStars} aria-hidden="true">
                        {'★'.repeat(feedback.rating)}
                        <span style={{ color: '#e0dbd2' }}>{'★'.repeat(5 - feedback.rating)}</span>
                      </span>
                      <strong>{feedback.rating}/5</strong>
                      <time dateTime={feedback.createdAt}>
                        Gửi ngày {formatDateOnly(feedback.createdAt)}
                      </time>
                    </div>

                    {feedback.isVisible === false && (
                      <div className={styles.reviewHidden}>
                        <strong>Đánh giá này đang bị ẩn</strong>
                        <p>
                          {feedback.hiddenReason
                            ? `Lý do: ${feedback.hiddenReason}`
                            : 'Quản trị viên đã ẩn đánh giá này khỏi hồ sơ gia sư.'}
                        </p>
                      </div>
                    )}

                    {feedback.comment && <p className={styles.reviewComment}>{feedback.comment}</p>}

                    {(feedback.initialGoal || feedback.actualResult || feedback.courseDuration) && (
                      <dl className={styles.reviewDiary}>
                        {feedback.initialGoal && (
                          <div>
                            <dt>Mục tiêu ban đầu</dt>
                            <dd>{feedback.initialGoal}</dd>
                          </div>
                        )}
                        {feedback.actualResult && (
                          <div>
                            <dt>Kết quả đạt được</dt>
                            <dd>{feedback.actualResult}</dd>
                          </div>
                        )}
                        {feedback.courseDuration && (
                          <div>
                            <dt>Thời gian đã học</dt>
                            <dd>{feedback.courseDuration}</dd>
                          </div>
                        )}
                      </dl>
                    )}

                    {feedback.reply && (
                      <div className={styles.reviewReply}>
                        <div className={styles.reviewReplyHead}>
                          <MessageSquare size={14} />
                          <span>Phản hồi từ gia sư</span>
                          {feedback.repliedAt && (
                            <time dateTime={feedback.repliedAt}>{formatDateOnly(feedback.repliedAt)}</time>
                          )}
                        </div>
                        <p>{feedback.reply}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className={styles.reviewEmpty}>
                    <p>
                      Khóa học đã hoàn thành. Chia sẻ trải nghiệm của bạn để giúp phụ huynh khác
                      chọn được gia sư phù hợp.
                    </p>
                    <button
                      className={styles.primaryBtn}
                      type="button"
                      onClick={() => setShowReviewModal(true)}
                    >
                      <Star size={16} /> Viết đánh giá
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>

          <aside className={styles.sideColumn}>
            {!isCancelled && (
              <section className={`${styles.card} ${styles.progressCard}`}>
                <div className={styles.sectionHeader}>
                  <div>
                    <span className={styles.sectionIcon}>
                      <CheckCircle2 size={18} />
                    </span>
                    <div>
                      <p>Trạng thái</p>
                      <h2>Tiến trình đặt lịch</h2>
                    </div>
                  </div>
                  <strong className={styles.progressValue}>{progressValue}</strong>
                </div>
                {booking.status === 'pending_tutor' && (
                  <div className={`${styles.responseDeadline} ${responseDeadlineTone}`}>
                    <Clock3 size={19} />
                    <div>
                      <strong>
                        {responseDeadline
                          ? responseDeadline.isExpired
                            ? 'Đã hết thời gian phản hồi của gia sư'
                            : `Gia sư còn ${responseDeadline.remainingLabel} để phản hồi`
                          : 'Đang chờ gia sư phản hồi'}
                      </strong>
                      <span>
                        {responseDeadline ? responseDeadline.deadlineLabel : 'Thời hạn phản hồi đang được cập nhật.'}
                      </span>
                    </div>
                  </div>
                )}
                <div className={styles.progressBar} aria-label={`Đã hoàn thành ${progressValue} bước`}>
                  <span style={{ width: `${progressBarWidth}%` }} />
                </div>
                <div className={styles.timeline}>
                  {progressSteps.map((step, index) => {
                    const isCompleted = isCourseCompleted || index < progressIndex;
                    const isCurrent = !isCourseCompleted && index === progressIndex;
                    return (
                      <div
                        className={`${styles.timelineStep} ${isCurrent ? styles.timelineStepCurrent : ''}`}
                        key={step.key}
                      >
                        <div className={styles.timelineIndicator}>
                          {isCompleted ? (
                            <CheckCircle2 className={styles.timelineCompleted} size={20} />
                          ) : isCurrent ? (
                            <span className={styles.timelineCurrentDot} />
                          ) : (
                            <Circle className={styles.timelineUpcoming} size={20} />
                          )}
                          {index < progressSteps.length - 1 && (
                            <span
                              className={`${styles.timelineLine} ${index < progressIndex ? styles.timelineLineCompleted : ''}`}
                            />
                          )}
                        </div>
                        <div className={styles.timelineContent}>
                          <strong>{step.label}</strong>
                          <span>{step.description}</span>
                          {step.date && <time>{formatDateTime(step.date)}</time>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {isCancelled && (
              <section className={styles.cancelledCard}>
                <XCircle size={22} />
                <div>
                  <span>Lịch đặt đã kết thúc</span>
                  <h2>{statusConfig.label}</h2>
                  <p>
                    {booking.status === 'payment_timeout'
                      ? 'Yêu cầu đặt lịch tự động bị hủy do quá hạn thanh toán.'
                      : booking.cancellationReason || 'Lịch đặt đã được hủy theo yêu cầu.'}
                  </p>
                  {booking.cancelledAt && <time>{formatDateTime(booking.cancelledAt)}</time>}

                  {/* Câu hỏi đầu tiên khi thấy lớp bị hủy luôn là "tiền của tôi đâu?" — trước đây
                      trang chỉ báo đã hủy rồi im lặng, phải mở ví ra tự dò giao dịch. */}
                  <dl className={styles.refundSummary}>
                    <div>
                      <dt>Đã thanh toán</dt>
                      <dd>{formatPrice(paidSoFar)}</dd>
                    </div>
                    <div>
                      <dt>Số tiền hoàn</dt>
                      <dd className={refundAmount > 0 ? styles.refundPositive : undefined}>
                        {refundAmount > 0 ? formatPrice(refundAmount) : 'Không có khoản hoàn'}
                      </dd>
                    </div>
                    {refundStatusLabel && (
                      <div>
                        <dt>Trạng thái hoàn tiền</dt>
                        <dd>{refundStatusLabel}</dd>
                      </div>
                    )}
                  </dl>
                  <small className={styles.refundNote}>
                    {refundAmount > 0
                      ? 'Khoản hoàn đã được cộng vào ví TopTutor của bạn; xem chi tiết ở trang Ví.'
                      : 'Các buổi đã dạy được thanh toán cho gia sư nên không phát sinh khoản hoàn.'}
                  </small>
                </div>
              </section>
            )}

            <section className={`${styles.card} ${styles.paymentCard}`}>
              <div className={styles.sectionHeader}>
                <div>
                  <span className={styles.sectionIcon}>
                    <CreditCard size={18} />
                  </span>
                  <div>
                    <p>Học phí</p>
                    <h2>Chi tiết thanh toán</h2>
                  </div>
                </div>
              </div>

              <div className={styles.totalPayment}>
                <span>Tổng thanh toán</span>
                <strong>{formatPrice(booking.finalPrice)}</strong>
              </div>
              <div className={styles.priceBreakdown}>
                <div className={styles.priceRow}>
                  <span>Học phí gốc</span>
                  <strong>{formatPrice(booking.price)}</strong>
                </div>
                {booking.discountApplied > 0 && (
                  <div className={`${styles.priceRow} ${styles.priceDiscount}`}>
                    <span>
                      <Tag size={13} /> Ưu đãi
                    </span>
                    <strong>-{formatPrice(booking.discountApplied)}</strong>
                  </div>
                )}
                <div className={styles.priceRow}>
                  <span>Phí dịch vụ (5%)</span>
                  <strong>+{formatPrice(parentServiceFee)}</strong>
                </div>
              </div>

              <div className={styles.paymentPhases}>
                <div className={depositPaid ? styles.phasePaid : ''}>
                  <span>{depositPaid ? <CheckCircle2 size={17} /> : <Circle size={17} />}</span>
                  <div>
                    <small>Đợt 1 · Buổi học đầu tiên</small>
                    <strong>{formatPrice(booking.depositAmount)}</strong>
                  </div>
                  <time>{booking.depositPaidAt ? formatDateTime(booking.depositPaidAt) : 'Chưa thanh toán'}</time>
                </div>
                <div className={remainingPaid ? styles.phasePaid : ''}>
                  <span>{remainingPaid ? <CheckCircle2 size={17} /> : <Circle size={17} />}</span>
                  <div>
                    <small>Đợt 2 · Phần còn lại</small>
                    <strong>{formatPrice(booking.remainingAmount)}</strong>
                  </div>
                  <time>{booking.remainingPaidAt ? formatDateTime(booking.remainingPaidAt) : 'Chưa thanh toán'}</time>
                </div>
              </div>

              {paymentBadge && (
                <div className={`${styles.paymentStatusBox} ${styles[`paymentTone${paymentBadge.tone}`]}`}>
                  {paymentBadge.tone === 'success' ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
                  <span>{paymentBadge.label}</span>
                </div>
              )}
              {booking.paymentDueAt && !remainingPaid && (
                <div className={styles.paymentDue}>
                  <Clock3 size={15} />
                  <span>Hạn thanh toán: {formatDateTime(booking.paymentDueAt)}</span>
                </div>
              )}
              {booking.refundAmount != null && booking.refundAmount > 0 && (
                <div className={styles.refundBox}>
                  <span>Tiền hoàn lại</span>
                  <strong>{formatPrice(booking.refundAmount)}</strong>
                  <small>{booking.refundStatus === 'refunded' ? 'Đã hoàn trả' : 'Đang xử lý'}</small>
                </div>
              )}
            </section>

            {hasActions && (
              <section className={styles.actionPanel}>
                {canReview && (
                  <button className={styles.primaryBtn} type="button" onClick={() => setShowReviewModal(true)}>
                    <MessageSquare size={17} /> Đánh giá khóa học
                  </button>
                )}
                {canPayDeposit && (
                  <button
                    className={styles.primaryBtn}
                    type="button"
                    onClick={() => navigate(`${basePath}/booking/${booking.bookingId}/payment`)}
                  >
                    <CreditCard size={17} /> Thanh toán đặt cọc
                  </button>
                )}
                {canPayRemaining && (
                  <button
                    className={styles.primaryBtn}
                    type="button"
                    onClick={() => navigate(`${basePath}/booking/${booking.bookingId}/payment`)}
                  >
                    <CreditCard size={17} /> Thanh toán phần còn lại
                  </button>
                )}
                {remainingLocked && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start',
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: '#fff7ed',
                      border: '1px solid #fed7aa',
                      color: '#9a3412',
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    <Clock3 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>Bạn có thể thanh toán các buổi học còn lại sau khi buổi học đầu tiên kết thúc.</span>
                  </div>
                )}
                {cancelBlockedByTrialWindow ? (
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start',
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: '#fff7ed',
                      border: '1px solid #fed7aa',
                      color: '#9a3412',
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    <Clock3 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>
                      Đã trong vòng {TRIAL_CANCEL_WINDOW_HOURS}h trước buổi học đầu tiên nên không thể tự hủy để
                      nhận hoàn tiền nữa.{' '}
                      {lessonDetailPath ? (
                        <>
                          Nếu gia sư không vào lớp, hãy{' '}
                          <a href={lessonDetailPath} onClick={(event) => { event.preventDefault(); navigate(lessonDetailPath); }}>
                            báo cáo vắng mặt tại buổi học này
                          </a>
                          .
                        </>
                      ) : (
                        'Nếu gia sư không vào lớp, hãy báo cáo vắng mặt ngay tại buổi học đó.'
                      )}
                    </span>
                  </div>
                ) : (
                  (canCancel || canFinalizeEarly) && (
                    <button className={styles.cancelBtn} type="button" onClick={() => setShowCancelModal(true)}>
                      <XCircle size={17} /> Hủy đặt lịch
                    </button>
                  )
                )}
              </section>
            )}
          </aside>
        </div>
      </main>

      <CreateFeedbackModal
        open={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onSuccess={() => {
          setShowReviewModal(false);
          // Nạp lại để thẻ hiển thị đúng nội dung vừa gửi/sửa thay vì chỉ ẩn nút đi.
          void refreshFeedbackState(booking.status);
        }}
        bookingId={booking.bookingId}
        tutorName={booking.tutor?.fullName}
        subjectName={booking.subject?.subjectName}
        existingFeedback={feedback}
      />

      <Modal
        title={canFinalizeEarly ? 'Kết thúc khóa học sớm' : 'Hủy đặt lịch'}
        open={showCancelModal}
        onCancel={() => {
          setShowCancelModal(false);
          setCancelReason('');
        }}
        confirmLoading={cancelLoading}
        onOk={async () => {
          if (!cancelReason.trim()) {
            antMessage.warning(canFinalizeEarly ? 'Vui lòng nhập lý do kết thúc khóa học' : 'Vui lòng nhập lý do hủy đặt lịch');
            return;
          }
          setCancelLoading(true);
          try {
            if (canFinalizeEarly) {
              await finalizeBookingEarly(booking.bookingId, cancelReason.trim());
              antMessage.success('Đã kết thúc khóa học. Các buổi chưa học đã được hủy.');
            } else {
              await cancelBooking(booking.bookingId, cancelReason.trim());
              antMessage.success('Hủy đặt lịch thành công');
            }
            setShowCancelModal(false);
            const response = await getBookingById(booking.bookingId);
            setBooking(response.content);
            await refreshFeedbackState(response.content.status);
          } catch (error) {
            antMessage.error(
              getApiErrorMessage(
                error,
                canFinalizeEarly ? 'Không thể kết thúc khóa học' : 'Không thể hủy đặt lịch',
              ),
            );
          } finally {
            setCancelLoading(false);
          }
        }}
        okText={canFinalizeEarly ? 'Xác nhận kết thúc' : 'Xác nhận hủy'}
        cancelText="Đóng"
        okButtonProps={{ danger: true }}
      >
        <div className={styles.cancelModalCopy}>
          <p>
            Bạn có chắc chắn muốn {canFinalizeEarly ? 'kết thúc' : 'hủy'} lịch đặt{' '}
            <strong>BK-{booking.bookingId}</strong> không?
          </p>
          {canFinalizeEarly ? (
            <p>
              Buổi học đã dạy sẽ được thanh toán đầy đủ cho gia sư. Các buổi chưa học sẽ bị hủy và bạn sẽ{' '}
              <strong>không bị tính phí</strong> cho phần học phí còn lại chưa thanh toán.
            </p>
          ) : (
            (depositPaid || remainingPaid) && (
              <p>
                Bạn đã thanh toán cho khóa học này. Toàn bộ số tiền đã thanh toán sẽ được hoàn vào ví của bạn sau khi hủy.
                Lưu ý: không thể hủy khi khóa học đã có buổi diễn ra.
              </p>
            )
          )}
        </div>
        <Input.TextArea
          rows={4}
          placeholder="Vui lòng nhập lý do hủy đặt lịch..."
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          required
        />
      </Modal>
    </div>
  );
};

export default BookingDetailPage;

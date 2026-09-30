import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getCurrentUserRole, setPendingRedirect } from '../../services/auth.service';
import styles from './styles.module.css';

type PortalRole = 'parent' | 'student' | 'tutor';

/**
 * Đích tới theo từng vai trò cho một "khu vực" chung — dùng cho nút CTA trong tin ZNS, nơi
 * người nhận cùng 1 template có thể là phụ huynh HOẶC học sinh tự quản lý (>=16, không có phụ
 * huynh) HOẶC gia sư, nên không thể gắn cứng 1 URL cổng cụ thể vào nút. Xem GoRedirect bên dưới.
 *
 * Nhận thêm `id` để đi thẳng vào 1 bản ghi cụ thể (ví dụ trang thanh toán của đúng booking trong
 * tin nhắc thanh toán) — thiếu id thì rơi về màn hình danh sách, không bao giờ vỡ.
 */
const TARGET_BY_ROLE: Record<string, Partial<Record<PortalRole, (id?: string) => string>>> = {
  lessons: {
    parent: () => '/parent-portal/lessons',
    student: () => '/student-portal/calendar',
  },
  bookings: {
    parent: () => '/parent-portal/lessons',
    student: () => '/student-portal/calendar',
    tutor: () => '/tutor-portal/bookings',
  },
  // Khu vực dùng cho nút "Thanh toán ngay" của template payment_reminder: đưa thẳng tới danh sách
  // đơn đặt lịch học, nơi người dùng tự chọn booking cần đóng tiền. Không mang id nên URL nút là
  // tĩnh — bấm được ngay lúc Zalo kiểm duyệt, không cần link demo riêng.
  booking: {
    parent: () => '/parent-portal/booking',
    student: () => '/student-portal/booking',
    tutor: () => '/tutor-portal/bookings',
  },
  payment: {
    parent: (id) => (id ? `/parent-portal/booking/${id}/payment` : '/parent-portal/booking'),
    student: (id) => (id ? `/student-portal/booking/${id}/payment` : '/student-portal/booking'),
  },
  payout: {
    tutor: () => '/tutor-portal/finance/withdrawals',
  },
  disputes: {
    parent: () => '/parent-portal/disputes',
    student: () => '/student-portal/disputes',
    tutor: () => '/tutor-portal/disputes',
  },
};

/** Tiêu đề + mô tả cho màn hình chờ đăng nhập, để người lạ mở link vẫn hiểu đang ở đâu. */
const TARGET_INFO: Record<string, { title: string; desc: string; idLabel?: string }> = {
  payment: {
    title: 'Thanh toán học phí TopTutor',
    desc: 'Vui lòng đăng nhập bằng tài khoản đã đặt lịch học để xem môn học, số tiền, hạn thanh toán và hoàn tất thanh toán.',
    idLabel: 'Mã đặt lịch',
  },
  lessons: {
    title: 'Lịch học trên TopTutor',
    desc: 'Vui lòng đăng nhập để xem lịch học và thông tin buổi học của quý khách.',
  },
  bookings: {
    title: 'Đơn đặt lịch học trên TopTutor',
    desc: 'Vui lòng đăng nhập để xem chi tiết đơn đặt lịch học.',
    idLabel: 'Mã đặt lịch',
  },
  booking: {
    title: 'Đơn đặt lịch học và thanh toán học phí',
    desc: 'Vui lòng đăng nhập bằng tài khoản đã đặt lịch học để xem đơn đặt lịch, số tiền cần đóng và hoàn tất thanh toán học phí.',
    idLabel: 'Mã đặt lịch',
  },
  payout: {
    title: 'Yêu cầu rút tiền trên TopTutor',
    desc: 'Vui lòng đăng nhập bằng tài khoản gia sư để xem tình trạng yêu cầu rút tiền.',
    idLabel: 'Mã yêu cầu',
  },
  disputes: {
    title: 'Khiếu nại trên TopTutor',
    desc: 'Vui lòng đăng nhập để xem kết quả xử lý khiếu nại.',
    idLabel: 'Mã khiếu nại',
  },
};

const FALLBACK_INFO = {
  title: 'TopTutor',
  desc: 'Vui lòng đăng nhập để tiếp tục.',
  idLabel: undefined as string | undefined,
};

/**
 * Route trung gian cho nút thao tác (CTA) trong tin ZNS: /go/payment, /go/lessons, /go/bookings,
 * /go/payout, /go/disputes. Cùng 1 URL nút bấm dùng chung cho mọi người nhận của 1 template, nhưng
 * đích thật (parent-portal hay student-portal hay tutor-portal) phụ thuộc vai trò tài khoản ĐANG
 * đăng nhập trên máy bấm vào link — không đọc được từ tin nhắn. Trang này tự dò vai trò rồi điều hướng.
 *
 * Chưa đăng nhập: KHÔNG redirect câm sang /login mà hiện một màn hình tự giới thiệu rồi mới mời
 * đăng nhập. Lý do không chỉ là trải nghiệm: đội kiểm duyệt Zalo bấm thử link demo của nút trước khi
 * duyệt template, thấy form đăng nhập trắng trơn là từ chối (mã NOTE_2 / NOTE_5). Đích được nhớ lại
 * qua storage để đăng nhập xong quay về đúng chỗ.
 */
const GoRedirect = () => {
  const { target, id: pathId } = useParams<{ target: string; id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Zalo tự chèn zasrc/utm_* vào URL lúc người dùng bấm nút, nên chỉ đọc đúng khoá đã khai trong
  // template (`b`), không bao giờ suy ra id theo vị trí tham số.
  const id = pathId ?? searchParams.get('b') ?? undefined;

  // Vai trò đọc từ cache đồng bộ của storage adapter nên tính được ngay khi render — không cần
  // state trung gian, tránh cascading render.
  const role = getCurrentUserRole()?.toLowerCase() as PortalRole | undefined;
  const dest = role && target ? TARGET_BY_ROLE[target]?.[role]?.(id) : undefined;

  useEffect(() => {
    if (!role) {
      void setPendingRedirect(`${window.location.pathname}${window.location.search}`);
      return;
    }
    navigate(dest ?? '/', { replace: true });
  }, [role, dest, navigate]);

  // Đã đăng nhập thì trang này chỉ là trạm trung chuyển, không vẽ gì.
  if (role) return null;

  const info = (target && TARGET_INFO[target]) || FALLBACK_INFO;

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <span className={styles.brand}>TopTutor</span>
        <h1 className={styles.title}>{info.title}</h1>
        {id && info.idLabel && (
          <p className={styles.ref}>
            {info.idLabel}: <strong>{id}</strong>
          </p>
        )}
        <p className={styles.desc}>{info.desc}</p>
        <button type="button" className={styles.action} onClick={() => navigate('/login')}>
          Đăng nhập để tiếp tục
        </button>
        <p className={styles.hint}>Đăng nhập xong, hệ thống sẽ đưa quý khách trở lại đúng trang này.</p>
      </div>
    </div>
  );
};

export default GoRedirect;

import React, { useEffect, useMemo, useState } from 'react';
import { PortalLayout } from '../../components/shared/PortalLayout';
import { signalRService } from '../../services/signalr.service';
import type { NavItem, ProfileMenuItem } from '../../components/shared/PortalLayout';
import { buildStudentProfileMenuItems } from '../shared/profileMenus';
import { useUnreadMessageBadge } from '../../hooks/useUnreadMessageBadge';
import { useUnreadBadgesByTab } from '../../hooks/useUnreadBadgesByTab';
import { StudentProfileProvider, useStudentProfile } from '../../contexts/StudentProfileContext';
import portalLayoutStyles from '../../components/shared/PortalLayout/PortalLayout.module.css';
import TutorTour from '../../components/TutorTour/TutorTour';
import TourPageMenu from '../../components/TutorTour/TourPageMenu';
import TourWelcomePrompt from '../../components/TutorTour/TourWelcomePrompt';
import { usePortalTour, type PageTour } from '../../components/TutorTour/usePortalTour';

import {
  DashboardIcon,
  MessagesIcon,
  BookingIcon,
  AccountIcon,
  CalendarIcon,
  ChildrenIcon,
  WalletIcon,
  DisputeIcon,
  FavoriteIcon,
  ProgressIcon,
} from '../shared/icons';

const MESSAGES_PATH = '/student-portal/messages';

// Map sidebar path → notification types thuộc tab đó. Đồng bộ với BE
// `MV.DomainLayer/Constants/NotificationType.cs`.
const NOTIFICATION_TYPES_BY_PATH: Record<string, string[]> = {
  '/student-portal/booking': [
    'booking_new',
    'booking_accepted',
    'booking_declined',
    'booking_cancelled',
    'payment_remaining_required',
    'booking_payment_due_soon',
    // Đánh giá khóa học nằm trong trang chi tiết booking nên badge đổ về tab này.
    'feedback_request',
    'feedback_reply',
    'feedback_moderated',
    'booking_timeout',
  ],
  '/student-portal/calendar': [
    'lesson_reminder',
    'lesson_checkin',
    'lesson_confirmed',
    'lesson_no_show',
    'lesson_schedule_change',
    'lesson_report',
    'lesson_confirm_deadline',
  ],
  '/student-portal/wallet': ['withdrawal_request', 'payment_success', 'payment_refund_success'],
  '/student-portal/disputes': ['dispute_message'],
};

const DISPUTES_PATH = '/student-portal/disputes';

const baseStudentNavItems: NavItem[] = [
  { path: '/student-portal/dashboard', label: 'Tổng quan', icon: DashboardIcon, dataTour: 'nav-dashboard' },
  { path: '/student-portal/booking', label: 'Đặt lịch', icon: BookingIcon, dataTour: 'nav-booking' },
  { path: '/student-portal/calendar', label: 'Thời khóa biểu', icon: CalendarIcon, dataTour: 'nav-calendar' },
  { path: '/student-portal/progress', label: 'Tiến trình học', icon: ProgressIcon, dataTour: 'nav-progress' },
  { path: '/student-portal/favorites', label: 'Yêu thích', icon: FavoriteIcon, dataTour: 'nav-favorites' },
  { path: MESSAGES_PATH, label: 'Tin nhắn', icon: MessagesIcon, dataTour: 'nav-messages' },
  { path: '/student-portal/wallet', label: 'Tài chính', icon: WalletIcon, dataTour: 'nav-wallet' },
  { path: DISPUTES_PATH, label: 'Khiếu nại', icon: DisputeIcon, dataTour: 'nav-disputes' },
  { path: '/student-portal/profile', label: 'Hồ sơ học sinh', icon: ChildrenIcon, dataTour: 'nav-profile' },
  { path: '/student-portal/account', label: 'Tài khoản', icon: AccountIcon, dataTour: 'nav-account' },
];

// ─── Tour Steps — 1 tour riêng cho mỗi trang chính, chọn qua TourPageMenu ───
// Không cần navigate() động (không có bước ép đổi tab/query param) — dựng 1 lần ở module scope.
const PAGE_TOURS: PageTour[] = [
  {
    key: 'dashboard',
    label: 'Tổng quan',
    description: 'Thao tác nhanh và thống kê buổi học.',
    icon: <DashboardIcon />,
    route: '/student-portal/dashboard',
    steps: [
      {
        target: '[data-tour="sidebar"]',
        title: '🎯 Chào mừng đến TopTutor!',
        description: 'Đây là Bảng điều khiển của bạn. Menu bên trái giúp bạn truy cập nhanh mọi chức năng học tập.',
        placement: 'right',
      },
      {
        target: '[data-tour="nav-dashboard"]',
        title: '📊 Tổng quan',
        description: 'Xem nhanh số buổi học sắp tới, yêu cầu chờ xác nhận và số buổi đã hoàn thành.',
        placement: 'right',
      },
      {
        target: '[data-tour="student-dashboard-actions"]',
        title: '⚡ Thao tác nhanh',
        description: 'Đặt lịch học mới hoặc xem thời khóa biểu — chỉ 1 click.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="student-dashboard-stats"]',
        title: '📈 Thống kê nhanh',
        description: 'Theo dõi số buổi sắp tới, buổi chờ xác nhận và tổng số buổi đã hoàn thành.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="student-dashboard-upcoming"]',
        title: '📅 Buổi học sắp tới',
        description: 'Danh sách buổi học trong 14 ngày tới — bấm vào 1 buổi để xem chi tiết hoặc vào lớp.',
        placement: 'top',
      },
      {
        target: '[data-tour="nav-booking"]',
        title: '🎉 Sẵn sàng rồi!',
        description: 'Chúc bạn có những buổi học thật hiệu quả trên TopTutor! Cần hỗ trợ, đừng ngần ngại liên hệ đội ngũ của chúng tôi nhé. 💪',
        placement: 'right',
      },
    ],
  },
  {
    key: 'booking',
    label: 'Đặt lịch',
    description: 'Theo dõi và thanh toán các lịch học đã đặt.',
    icon: <BookingIcon />,
    route: '/student-portal/booking',
    steps: [
      {
        target: '[data-tour="nav-booking"]',
        title: '📥 Đặt lịch',
        description: 'Quản lý toàn bộ lịch học, thanh toán và tiến độ các booking bạn đã đặt.',
        placement: 'right',
      },
      {
        target: '[data-tour="booking-tabs"]',
        title: '🗂️ Lọc theo trạng thái',
        description: 'Chuyển giữa các trạng thái booking để theo dõi từng nhóm yêu cầu.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="booking-card"]',
        title: '🗒️ Thông tin booking',
        description: 'Mỗi thẻ hiển thị gia sư, môn học, lịch học và trạng thái thanh toán.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="booking-tabs"]',
        title: '🎉 Xong rồi!',
        description: 'Thanh toán đúng hạn giúp lịch học của bạn diễn ra suôn sẻ, không gián đoạn.',
        placement: 'bottom',
      },
    ],
  },
  {
    key: 'calendar',
    label: 'Thời khóa biểu',
    description: 'Xem lịch học theo tuần, tháng hoặc danh sách.',
    icon: <CalendarIcon />,
    route: '/student-portal/calendar',
    steps: [
      {
        target: '[data-tour="nav-calendar"]',
        title: '📅 Thời khóa biểu',
        description: 'Toàn bộ buổi học đã lên lịch của bạn nằm ở đây.',
        placement: 'right',
      },
      {
        target: '[data-tour="lessons-toolbar"]',
        title: '🔀 Điều hướng & đổi kiểu xem',
        description: 'Nhảy về hôm nay, xem tuần/tháng trước-sau, hoặc đổi giữa Lịch tuần / Dạng lưới / Danh sách.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="lessons-filters"]',
        title: '🏷️ Lọc theo trạng thái',
        description: 'Lọc nhanh buổi Lên lịch, Chờ xác nhận hoặc Hoàn thành.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="lessons-filters"]',
        title: '🎉 Xong rồi!',
        description: 'Click vào 1 buổi học bất kỳ để xem chi tiết, vào lớp hoặc xem báo cáo buổi học.',
        placement: 'bottom',
      },
    ],
  },
  {
    key: 'messages',
    label: 'Tin nhắn',
    description: 'Trò chuyện với gia sư và đội ngũ hỗ trợ.',
    icon: <MessagesIcon />,
    route: MESSAGES_PATH,
    steps: [
      {
        target: '[data-tour="nav-messages"]',
        title: '💌 Tin nhắn',
        description: 'Nơi bạn trao đổi trực tiếp với gia sư về buổi học.',
        placement: 'right',
      },
      {
        target: '[data-tour="messages-sidebar"]',
        title: '📋 Danh sách hội thoại',
        description: 'Tất cả cuộc trò chuyện của bạn nằm ở đây. Click vào 1 hội thoại để mở khung chat bên phải.',
        placement: 'right',
      },
      {
        target: '[data-tour="messages-chat"]',
        title: '💬 Khung chat',
        description: 'Nhắn tin, gửi file đính kèm với gia sư ngay tại đây.',
        placement: 'left',
      },
      {
        target: '[data-tour="messages-chat"]',
        title: '🎉 Xong rồi!',
        description: 'Trao đổi thường xuyên với gia sư giúp bạn học tốt hơn.',
        placement: 'left',
      },
    ],
  },
  {
    key: 'wallet',
    label: 'Tài chính',
    description: 'Số dư, rút tiền và lịch sử giao dịch.',
    icon: <WalletIcon />,
    route: '/student-portal/wallet',
    steps: [
      {
        target: '[data-tour="nav-wallet"]',
        title: '💳 Tài chính',
        description: 'Quản lý số dư và các giao dịch của bạn tại đây.',
        placement: 'right',
      },
      {
        target: '[data-tour="wallet-balance-cards"]',
        title: '💰 Số dư của bạn',
        description: 'Số tiền khả dụng, đang tạm giữ (do khiếu nại/tranh chấp) và tổng số dư.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="wallet-withdraw-btn"]',
        title: '🏦 Rút tiền',
        description: 'Gửi yêu cầu rút tiền về tài khoản ngân hàng khi số dư khả dụng lớn hơn 0.',
        placement: 'left',
      },
      {
        target: '[data-tour="wallet-transactions"]',
        title: '🧾 Giao dịch gần đây',
        description: 'Lịch sử các khoản tiền vào/ra ví của bạn — click từng dòng để xem chi tiết.',
        placement: 'top',
      },
      {
        target: '[data-tour="wallet-balance-cards"]',
        title: '🎉 Xong rồi!',
        description: 'Mọi khoản thanh toán đều được ghi nhận minh bạch — bạn có thể kiểm tra bất cứ lúc nào.',
        placement: 'bottom',
      },
    ],
  },
  {
    key: 'disputes',
    label: 'Khiếu nại',
    description: 'Tạo và theo dõi khiếu nại liên quan buổi học.',
    icon: <DisputeIcon />,
    route: DISPUTES_PATH,
    steps: [
      {
        target: '[data-tour="nav-disputes"]',
        title: '⚠️ Khiếu nại',
        description: 'Nơi bạn báo cáo và theo dõi các vấn đề phát sinh trong buổi học.',
        placement: 'right',
      },
      {
        target: '[data-tour="disputes-create-btn"]',
        title: '➕ Tạo khiếu nại',
        description: 'Gặp vấn đề với buổi học? Tạo khiếu nại mới để đội ngũ hỗ trợ can thiệp.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="disputes-tabs"]',
        title: '🗂️ Lọc theo trạng thái',
        description: 'Lọc nhanh khiếu nại đang chờ xử lý, đang xem xét, hay đã đóng.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="disputes-table"]',
        title: '📋 Danh sách khiếu nại',
        description: 'Xem mã hồ sơ, buổi học liên quan và trạng thái xử lý. Click 1 dòng để xem chi tiết.',
        placement: 'top',
      },
      {
        target: '[data-tour="disputes-tabs"]',
        title: '🎉 Xong rồi!',
        description: 'Cung cấp thông tin đầy đủ giúp khiếu nại được xử lý nhanh và công bằng hơn.',
        placement: 'bottom',
      },
    ],
  },
  {
    key: 'profile',
    label: 'Hồ sơ học sinh',
    description: 'Thông tin học tập, xác minh danh tính.',
    icon: <ChildrenIcon />,
    route: '/student-portal/profile',
    steps: [
      {
        target: '[data-tour="nav-profile"]',
        title: '🎓 Hồ sơ học sinh',
        description: 'Thông tin học tập và xác minh danh tính của bạn nằm ở đây.',
        placement: 'right',
      },
      {
        target: '[data-tour="student-profile-academic"]',
        title: '📝 Thông tin học tập',
        description: 'Họ tên, ngày sinh, khối lớp, trường học và mục tiêu học tập.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="student-profile-identity"]',
        title: '✅ Xác minh độ tuổi',
        description: 'Xác minh CCCD để mở khoá tính năng tự đặt lịch học (yêu cầu đủ 16 tuổi).',
        placement: 'top',
      },
      {
        target: '[data-tour="student-profile-parent-phone"]',
        title: '📞 SĐT phụ huynh',
        description: 'Thêm số điện thoại phụ huynh (tuỳ chọn) để nhận thông báo theo dõi việc học.',
        placement: 'top',
      },
      {
        target: '[data-tour="student-profile-progress"]',
        title: '📊 Tiến trình hồ sơ',
        description: 'Theo dõi các bước cần hoàn tất để hồ sơ của bạn đầy đủ nhất.',
        placement: 'left',
      },
      {
        target: '[data-tour="nav-account"]',
        title: '🎉 Xong rồi!',
        description: 'Hồ sơ càng đầy đủ, trải nghiệm học tập trên TopTutor càng suôn sẻ.',
        placement: 'right',
      },
    ],
  },
  {
    key: 'account',
    label: 'Tài khoản',
    description: 'Thông tin cá nhân và bảo mật đăng nhập.',
    icon: <AccountIcon />,
    route: '/student-portal/account',
    steps: [
      {
        target: '[data-tour="nav-account"]',
        title: '👤 Tài khoản',
        description: 'Quản lý thông tin cá nhân và bảo mật đăng nhập của bạn tại đây.',
        placement: 'right',
      },
      {
        target: '[data-tour="account-avatar"]',
        title: '🖼️ Ảnh đại diện',
        description: 'Đổi ảnh đại diện hiển thị trên tài khoản của bạn.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="account-personal-info"]',
        title: '📇 Thông tin cá nhân',
        description: 'Cập nhật thông tin cá nhân của bạn.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="account-password"]',
        title: '🔒 Đổi mật khẩu',
        description: 'Đổi mật khẩu đăng nhập định kỳ để bảo vệ tài khoản của bạn.',
        placement: 'top',
      },
      {
        target: '[data-tour="account-password"]',
        title: '🎉 Xong rồi!',
        description: 'Giữ thông tin tài khoản cập nhật giúp bạn không bỏ lỡ thông báo quan trọng nào.',
        placement: 'top',
      },
    ],
  },
];

interface StudentLayoutProps {
  children?: React.ReactNode;
}

const WALLET_PATH = '/student-portal/wallet';
const BOOKING_PATH = '/student-portal/booking';

// Inner: nằm TRONG StudentProfileProvider nên đọc được isParentManaged để lọc menu.
const StudentLayoutInner: React.FC<StudentLayoutProps> = ({ children }) => {
  // useUnreadMessageBadge/useUnreadBadgesByTab bên dưới chỉ ĐĂNG KÝ lắng nghe (subscribeTo...) trên kết
  // nối SignalR có sẵn — không tự mở kết nối. Trước đây không có ai gọi connect() cho toàn bộ portal học
  // sinh (chỉ Header.tsx — không dùng ở layout này — và trang tin nhắn phụ huynh mới gọi), nên mọi badge/
  // sự kiện real-time (kể cả AI tóm tắt xong) chưa từng thực sự chạy, chỉ fetch 1 lần lúc load trang.
  useEffect(() => {
    signalRService.connect().catch(() => {/* đã tự xử lý bên trong service (silent, tự retry) */});
  }, []);

  const unreadMessageCount = useUnreadMessageBadge(MESSAGES_PATH);
  const badgesByPath = useUnreadBadgesByTab(NOTIFICATION_TYPES_BY_PATH);
  // Tài khoản do phụ huynh quản lý: chỉ vào học & tương tác → ẩn menu ví (chỉ hiện khi chắc chắn tự đăng ký).
  const { isParentManaged, loading } = useStudentProfile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const showWallet = !loading && !isParentManaged;
  // Đặt lịch: chỉ phụ huynh mới được đặt lịch cho con → ẩn y như ví với tài khoản do phụ huynh quản lý.
  const showBooking = !loading && !isParentManaged;
  // Học sinh do phụ huynh quản lý giờ ĐƯỢC tự tạo/xem khiếu nại (xem StudentLessonDetail) → không
  // ẩn theo isParentManaged nữa, chỉ ẩn khi đang loading hồ sơ.
  const showDisputes = !loading;

  // Ví ẩn đúng theo điều kiện của sidebar; khiếu nại luôn hiện (trừ lúc đang tải hồ sơ).
  const profileMenuItems = useMemo<ProfileMenuItem[]>(
    () => buildStudentProfileMenuItems({ showWallet, showDisputes, showBooking }),
    [showWallet, showDisputes, showBooking],
  );

  const navItems = useMemo<NavItem[]>(
    () =>
      baseStudentNavItems
        .filter((item) => showWallet || item.path !== WALLET_PATH)
        .filter((item) => showBooking || item.path !== BOOKING_PATH)
        .filter((item) => showDisputes || item.path !== DISPUTES_PATH)
        .map((item) => {
          if (item.path === MESSAGES_PATH) {
            return { ...item, badge: unreadMessageCount };
          }
          const count = badgesByPath[item.path];
          return count ? { ...item, badge: count } : item;
        }),
    [unreadMessageCount, badgesByPath, showWallet, showBooking, showDisputes],
  );

  // Modal chọn trang không được liệt kê tour cho trang mà chính sidebar của user cũng
  // không hiện (Ví/Khiếu nại ẩn khi tài khoản do phụ huynh quản lý).
  const pageTours = useMemo(
    () =>
      PAGE_TOURS.filter((tour) => showWallet || tour.key !== 'wallet')
        .filter((tour) => showBooking || tour.key !== 'booking')
        .filter((tour) => showDisputes || tour.key !== 'disputes'),
    [showWallet, showBooking, showDisputes],
  );

  const tour = usePortalTour(pageTours, 'student', {
    onSidebarOpen: () => setSidebarOpen(true),
    onSidebarClose: () => setSidebarOpen(false),
  });

  // Tour menu button in sidebar nav footer
  const sidebarNavFooter = (
    <div
      className={`${portalLayoutStyles.navItem} ${portalLayoutStyles.navFooterItem}`}
      title="Hướng dẫn sử dụng"
      onClick={tour.handleOpenTourMenu}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="9" cy="9" r="7" />
        <path d="M9 6v0.01M9 8.5v4" strokeLinecap="round" />
      </svg>
      <span className={portalLayoutStyles.navText}>Hướng dẫn</span>
    </div>
  );

  const tourExtras = (
    <>
      {tour.showTourPrompt && (
        <TourWelcomePrompt
          title="Chào mừng bạn đến TopTutor!"
          description="Hãy để TopTutor hướng dẫn bạn khám phá các tính năng để có trải nghiệm học tập tốt nhất nhé!"
          onAccept={tour.handleAcceptTour}
          onSkip={tour.handleSkipTour}
        />
      )}

      {tour.showTourMenu && (
        <TourPageMenu
          options={tour.tourPageOptions}
          completedKeys={tour.completedPageTours}
          onSelect={tour.handleSelectPageTour}
          onClose={tour.closeTourMenu}
        />
      )}

      {tour.showTour && tour.activeTour && (
        <TutorTour
          steps={tour.activeTour.steps}
          onComplete={tour.handleTourComplete}
          onSidebarOpen={tour.onSidebarOpen}
          onSidebarClose={tour.onSidebarClose}
        />
      )}
    </>
  );

  return (
    <PortalLayout
      navItems={navItems}
      userRole="STUDENT"
      showSidebarUserCard={true}
      showAvatarImage={false}
      profileMenuItems={profileMenuItems}
      sidebarNavFooter={sidebarNavFooter}
      sidebarDataTour="sidebar"
      sidebarOpenExternal={sidebarOpen}
      onSidebarOpen={() => setSidebarOpen(true)}
      onSidebarClose={() => setSidebarOpen(false)}
      extras={tourExtras}
    >
      {children}
    </PortalLayout>
  );
};

const StudentLayout: React.FC<StudentLayoutProps> = ({ children }) => (
    <StudentProfileProvider>
        <StudentLayoutInner>{children}</StudentLayoutInner>
    </StudentProfileProvider>
);

export default StudentLayout;

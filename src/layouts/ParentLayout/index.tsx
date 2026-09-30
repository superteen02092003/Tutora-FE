import React, { useEffect, useMemo, useState } from 'react';
import { PortalLayout } from '../../components/shared/PortalLayout';
import type { NavItem } from '../../components/shared/PortalLayout';
import { parentProfileMenuItems } from '../shared/profileMenus';
import { getUserInfoFromToken } from '../../services/auth.service';
import { StudentProvider, useStudentContext } from '../../contexts/StudentContext';
import { useNextLesson } from '../shared/useLayoutData';
import { useUnreadMessageBadge } from '../../hooks/useUnreadMessageBadge';
import { useUnreadBadgesByTab } from '../../hooks/useUnreadBadgesByTab';
import portalLayoutStyles from '../../components/shared/PortalLayout/PortalLayout.module.css';
import TutorTour from '../../components/TutorTour/TutorTour';
import TourPageMenu from '../../components/TutorTour/TourPageMenu';
import TourWelcomePrompt from '../../components/TutorTour/TourWelcomePrompt';
import { usePortalTour, type PageTour } from '../../components/TutorTour/usePortalTour';
import {
    DashboardIcon, ChildrenIcon, MessagesIcon, BookingIcon,
    AccountIcon, CalendarIcon, ClockIcon, WalletIcon, DisputeIcon,
  FavoriteIcon,
} from '../shared/icons';

const MESSAGES_PATH = '/parent-portal/messages';
const LESSONS_PATH = '/parent-portal/lessons';

// Map sidebar path → notification types thuộc tab đó. Đồng bộ với BE
// `MV.DomainLayer/Constants/NotificationType.cs`.
const NOTIFICATION_TYPES_BY_PATH: Record<string, string[]> = {
    '/parent-portal/booking': [
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
    ],
    '/parent-portal/wallet': ['withdrawal_request'],
    '/parent-portal/disputes': ['dispute_message'],
};

const baseParentNavItems: NavItem[] = [
    { path: '/parent-portal/dashboard', label: 'Tổng quan', icon: DashboardIcon, dataTour: 'nav-dashboard' },
    { path: '/parent-portal/student', label: 'Quản lý học sinh', icon: ChildrenIcon, dataTour: 'nav-student' },
    { path: MESSAGES_PATH, label: 'Tin nhắn', icon: MessagesIcon, dataTour: 'nav-messages' },
    { path: '/parent-portal/booking', label: 'Đặt lịch', icon: BookingIcon, dataTour: 'nav-booking' },
    { path: '/parent-portal/favorites', label: 'Yêu thích', icon: FavoriteIcon, dataTour: 'nav-favorites' },
    { path: LESSONS_PATH, label: 'Thời khóa biểu', icon: CalendarIcon, dataTour: 'nav-lessons' },
    { path: '/parent-portal/disputes', label: 'Khiếu nại', icon: DisputeIcon, dataTour: 'nav-disputes' },
    { path: '/parent-portal/wallet', label: 'Tài chính', icon: WalletIcon, dataTour: 'nav-wallet' },
    { path: '/parent-portal/account', label: 'Tài khoản', icon: AccountIcon, dataTour: 'nav-account' },
];

// ─── Tour Steps — 1 tour riêng cho mỗi trang chính, chọn qua TourPageMenu ───
const buildPageTours = (): PageTour[] => [
    {
        key: 'dashboard',
        label: 'Tổng quan',
        description: 'Thao tác nhanh và thống kê lịch hẹn.',
        icon: <DashboardIcon />,
        route: '/parent-portal/dashboard',
        steps: [
            {
                target: '[data-tour="sidebar"]',
                title: '🎯 Chào mừng đến TopTutor!',
                description: 'Đây là Bảng điều khiển của bạn. Menu bên trái giúp bạn truy cập nhanh mọi chức năng theo dõi việc học của con.',
                placement: 'right',
            },
            {
                target: '[data-tour="nav-dashboard"]',
                title: '📊 Tổng quan',
                description: 'Xem nhanh số lịch hẹn, số con đã liên kết, buổi học trong tuần và yêu cầu đang chờ xử lý.',
                placement: 'right',
            },
            {
                target: '[data-tour="parent-dashboard-actions"]',
                title: '⚡ Thao tác nhanh',
                description: 'Tìm gia sư mới, quản lý lịch hẹn hoặc xem lịch học — chỉ 1 click.',
                placement: 'bottom',
            },
            {
                target: '[data-tour="parent-dashboard-stats"]',
                title: '📈 Thống kê nhanh',
                description: 'Theo dõi tổng lịch hẹn, số con đã liên kết, buổi học tuần này và các yêu cầu cần xử lý.',
                placement: 'bottom',
            },
            {
                target: '[data-tour="nav-student"]',
                title: '🎉 Sẵn sàng rồi!',
                description: 'Chúc bạn đồng hành cùng con thật hiệu quả trên TopTutor! Cần hỗ trợ, đừng ngần ngại liên hệ đội ngũ của chúng tôi nhé. 💪',
                placement: 'right',
            },
        ],
    },
    {
        key: 'student',
        label: 'Quản lý học sinh',
        description: 'Thêm và quản lý hồ sơ các con.',
        icon: <ChildrenIcon />,
        route: '/parent-portal/student',
        steps: [
            {
                target: '[data-tour="nav-student"]',
                title: '👨‍👩‍👧 Quản lý học sinh',
                description: 'Nơi bạn thêm và quản lý hồ sơ của từng con — mỗi con là 1 hồ sơ riêng, dùng để đặt lịch và theo dõi việc học.',
                placement: 'right',
            },
            {
                target: '[data-tour="parent-student-add-btn"]',
                title: '➕ Thêm con',
                description: 'Tạo hồ sơ học sinh mới cho con của bạn để bắt đầu đặt lịch học.',
                placement: 'bottom',
            },
            {
                target: '[data-tour="parent-student-card"]',
                title: '🗂️ Hồ sơ học sinh',
                description: 'Mỗi thẻ là 1 con — sửa thông tin, đặt lại mật khẩu, xem lịch học hoặc đặt gia sư mới ngay từ đây.',
                placement: 'bottom',
            },
            {
                target: '[data-tour="nav-messages"]',
                title: '🎉 Xong rồi!',
                description: 'Hồ sơ càng đầy đủ, việc đặt lịch và theo dõi tiến độ học tập càng dễ dàng.',
                placement: 'right',
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
                description: 'Nơi bạn trao đổi trực tiếp với gia sư của con về lịch học và tiến độ.',
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
                description: 'Trao đổi thường xuyên với gia sư giúp bạn nắm rõ tình hình học tập của con.',
                placement: 'left',
            },
        ],
    },
    {
        key: 'booking',
        label: 'Đặt lịch',
        description: 'Theo dõi và thanh toán các lịch học đã đặt.',
        icon: <BookingIcon />,
        route: '/parent-portal/booking',
        steps: [
            {
                target: '[data-tour="nav-booking"]',
                title: '📥 Đặt lịch',
                description: 'Quản lý toàn bộ lịch học, thanh toán và tiến độ các booking bạn đã đặt cho con.',
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
                description: 'Thanh toán đúng hạn giúp lịch học của con diễn ra suôn sẻ, không gián đoạn.',
                placement: 'bottom',
            },
        ],
    },
    {
        key: 'lessons',
        label: 'Thời khóa biểu',
        description: 'Xem lịch học theo tuần, tháng hoặc danh sách.',
        icon: <CalendarIcon />,
        route: LESSONS_PATH,
        steps: [
            {
                target: '[data-tour="nav-lessons"]',
                title: '📅 Thời khóa biểu',
                description: 'Toàn bộ buổi học đã lên lịch của các con nằm ở đây.',
                placement: 'right',
            },
            {
                target: '[data-tour="lessons-toolbar"]',
                title: '🔀 Điều hướng & đổi kiểu xem',
                description: 'Nhảy về hôm nay, xem tuần/tháng trước-sau, hoặc đổi giữa Lịch tuần / Dạng lưới / Danh sách.',
                placement: 'bottom',
            },
            {
                target: '[data-tour="lessons-child-filter"]',
                title: '👨‍👩‍👧 Lọc theo con',
                description: 'Nếu có nhiều con, lọc lịch học riêng cho từng bé tại đây.',
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
                description: 'Click vào 1 buổi học bất kỳ để xem chi tiết và theo dõi báo cáo buổi học.',
                placement: 'bottom',
            },
        ],
    },
    {
        key: 'disputes',
        label: 'Khiếu nại',
        description: 'Tạo và theo dõi khiếu nại liên quan buổi học.',
        icon: <DisputeIcon />,
        route: '/parent-portal/disputes',
        steps: [
            {
                target: '[data-tour="nav-disputes"]',
                title: '⚠️ Khiếu nại',
                description: 'Nơi bạn báo cáo và theo dõi các vấn đề phát sinh trong buổi học của con.',
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
        key: 'wallet',
        label: 'Tài chính',
        description: 'Số dư, rút tiền và lịch sử giao dịch.',
        icon: <WalletIcon />,
        route: '/parent-portal/wallet',
        steps: [
            {
                target: '[data-tour="nav-wallet"]',
                title: '💳 Tài chính',
                description: 'Quản lý số dư và các giao dịch liên quan đến việc học của con tại đây.',
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
        key: 'account',
        label: 'Tài khoản',
        description: 'Thông tin cá nhân và bảo mật đăng nhập.',
        icon: <AccountIcon />,
        route: '/parent-portal/account',
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
                description: 'Cập nhật số điện thoại, email, địa chỉ liên hệ.',
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

// Nội dung tour không cần navigate() động (không có bước nào ép đổi tab/query param) —
// dựng 1 lần ở module scope, không phải useMemo trong component.
const PAGE_TOURS = buildPageTours();

// Next Lesson indicator shown in header
const NextLessonIndicator: React.FC = () => {
    const { nextLesson, loadNextLesson } = useNextLesson();

    useEffect(() => {
        const user = getUserInfoFromToken();
        if (user) loadNextLesson();
    }, [loadNextLesson]);

    if (!nextLesson) return null;

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 9999,
            backgroundColor: 'rgba(26, 34, 56, 0.06)',
        }}>
            <ClockIcon />
            <span style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 12, lineHeight: '18px', color: '#525252', whiteSpace: 'nowrap',
            }}>
                Tiếp: {new Date(nextLesson.scheduledStart).toLocaleDateString('vi-VN', {
                    day: '2-digit', month: '2-digit',
                })} {new Date(nextLesson.scheduledStart).toLocaleTimeString('vi-VN', {
                    hour: '2-digit', minute: '2-digit',
                })}
            </span>
        </div>
    );
};

interface ParentLayoutProps {
    children?: React.ReactNode;
}

const ParentLayoutInner: React.FC<ParentLayoutProps> = ({ children }) => {
    // Activate student context (side effects)
    useStudentContext();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const tour = usePortalTour(PAGE_TOURS, 'parent', {
        onSidebarOpen: () => setSidebarOpen(true),
        onSidebarClose: () => setSidebarOpen(false),
    });

    // Tin nhắn unread badge — sidebar nav
    const unreadMessageCount = useUnreadMessageBadge(MESSAGES_PATH);
    // Notification badges per-tab — group unread noti theo `type` → map sang path sidebar.
    const badgesByPath = useUnreadBadgesByTab(NOTIFICATION_TYPES_BY_PATH);

    const navItems = useMemo<NavItem[]>(
        () =>
            baseParentNavItems.map((item) => {
                if (item.path === MESSAGES_PATH) {
                    return { ...item, badge: unreadMessageCount };
                }
                const count = badgesByPath[item.path];
                return count ? { ...item, badge: count } : item;
            }),
        [unreadMessageCount, badgesByPath],
    );

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
                    description="Hãy để TopTutor hướng dẫn bạn khám phá các tính năng để đồng hành cùng con hiệu quả nhất nhé!"
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

    // showSidebarUserCard: card đáy sidebar là trigger menu tài khoản. Trên mobile
    // ProfileDropdown ở header bị ẩn nên tắt card = mất lối vào tài khoản.
    return (
        <PortalLayout
            navItems={navItems}
            userRole="PARENT"
            headerLeft={<NextLessonIndicator />}
            showSidebarUserCard={true}
            showAvatarImage={true}
            profileMenuItems={parentProfileMenuItems}
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

const ParentLayout: React.FC<ParentLayoutProps> = ({ children }) => (
    <StudentProvider>
        <ParentLayoutInner>{children}</ParentLayoutInner>
    </StudentProvider>
);

export default ParentLayout;

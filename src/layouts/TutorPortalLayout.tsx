import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PortalLayout } from '../components/shared/PortalLayout';
import type { NavItem } from '../components/shared/PortalLayout';
import { tutorProfileMenuItems } from './shared/profileMenus';
import styles from '../components/shared/PortalLayout/PortalLayout.module.css';
import TutorTour from '../components/TutorTour/TutorTour';
import TourPageMenu from '../components/TutorTour/TourPageMenu';
import TourWelcomePrompt from '../components/TutorTour/TourWelcomePrompt';
import { usePortalTour, guardedNavigate, type PageTour } from '../components/TutorTour/usePortalTour';
import { useUnreadMessageBadge } from '../hooks/useUnreadMessageBadge';
import { useUnreadBadgesByTab } from '../hooks/useUnreadBadgesByTab';
import { signalRService } from '../services/signalr.service';

const MESSAGES_PATH = '/tutor-portal/messages';

// Map sidebar path → notification types thuộc tab đó. Đồng bộ với BE
// `MV.DomainLayer/Constants/NotificationType.cs`. Tin nhắn không vào đây
// (đã có `useUnreadMessageBadge` đếm chat unread riêng).
const NOTIFICATION_TYPES_BY_PATH: Record<string, string[]> = {
    '/tutor-portal/bookings': [
        'booking_new',
        'booking_accepted',
        'booking_declined',
        'booking_cancelled',
        'payment_remaining_required',
        // Đánh giá gia sư nhận được hiển thị trong thẻ booking đã hoàn thành.
        'feedback_received',
        'feedback_moderated',
    ],
    '/tutor-portal/finance': ['payment_success'],
    '/tutor-portal/disputes': ['dispute_message'],
};

// ─── Tutor-specific SVG Icons ───

const DashboardIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
        <path d="M2 4C2 2.89543 2.89543 2 4 2H7C7.55228 2 8 2.44772 8 3V7C8 7.55228 7.55228 8 7 8H4C2.89543 8 2 7.10457 2 6V4Z" />
        <path d="M2 12C2 10.8954 2.89543 10 4 10H7C7.55228 10 8 10.4477 8 11V15C8 15.5523 7.55228 16 7 16H4C2.89543 16 2 15.1046 2 14V12Z" />
        <path d="M10 3C10 2.44772 10.4477 2 11 2H14C15.1046 2 16 2.89543 16 4V6C16 7.10457 15.1046 8 14 8H11C10.4477 8 10 7.55228 10 7V3Z" />
        <path d="M10 11C10 10.4477 10.4477 10 11 10H14C15.1046 10 16 10.8954 16 12V14C16 15.1046 15.1046 16 14 16H11C10.4477 16 10 15.5523 10 15V11Z" />
    </svg>
);

const ProfileIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
        <path d="M9 8C10.6569 8 12 6.65685 12 5C12 3.34315 10.6569 2 9 2C7.34315 2 6 3.34315 6 5C6 6.65685 7.34315 8 9 8Z" />
        <path d="M2 16C2 12.6863 5.13401 10 9 10C12.866 10 16 12.6863 16 16H2Z" />
    </svg>
);

const ClassIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
        <path d="M9 2L1 6L9 10L17 6L9 2Z" />
        <path d="M1 12L9 16L17 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
);

// Bảng/màn chiếu — trang "Lớp học" (quản lý lớp + tiến độ + tài liệu).
const ClassroomIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1.5" y="2.5" width="15" height="11" rx="2" strokeLinecap="round" />
        <path d="M9 13.5V16" strokeLinecap="round" />
        <path d="M6 16H12" strokeLinecap="round" />
        <path d="M5 9.5L7.5 7L9.5 9L13 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const FinanceIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="4" width="16" height="12" rx="2" strokeLinecap="round" />
        <path d="M1 8H17" strokeLinecap="round" />
        <path d="M12 12H14" strokeLinecap="round" />
        <path d="M4 4V3C4 2.44772 4.44772 2 5 2H13C13.5523 2 14 2.44772 14 3V4" strokeLinecap="round" />
    </svg>
);

const MessagesIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M1 4L9 9L17 4M1 14V4C1 2.89543 1.89543 2 3 2H15C16.1046 2 17 2.89543 17 4V14C17 15.1046 16.1046 16 15 16H3C1.89543 16 1 15.1046 1 14Z" strokeLinecap="round" />
    </svg>
);

const BookingIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M11 3V1M7 3V1M3 13V5C3 3.89543 3.89543 3 5 3H13C14.1046 3 15 3.89543 15 5V13C15 14.1046 14.1046 15 13 15H5C3.89543 15 3 14.1046 3 13Z" strokeLinecap="round" />
        <path d="M7 8L9 10L12 7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 8H15" strokeLinecap="round" />
    </svg>
);

const TeachingSetupIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 4.5H15" strokeLinecap="round" />
        <path d="M3 9H15" strokeLinecap="round" />
        <path d="M3 13.5H9" strokeLinecap="round" />
        <circle cx="12.5" cy="13.5" r="2.5" />
        <path d="M12.5 12.25V13.5L13.4 14.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const DisputeIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 1.5L16.5 15H1.5L9 1.5Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 7V10" strokeLinecap="round" />
        <circle cx="9" cy="12.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
);

const AccountIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="9" cy="5.5" r="3" />
        <path d="M2.5 16.5C2.5 13.5 5.18629 11 9 11C12.8137 11 15.5 13.5 15.5 16.5" strokeLinecap="round" />
    </svg>
);

// ─── Navigation items ───

// Static base list — chỉ chứa các field không thay đổi runtime. Badge được
// inject dynamically trong component qua `useUnreadMessageBadge`.
const baseNavItems: NavItem[] = [
    { path: '/tutor-portal/dashboard', label: 'Tổng quan', icon: DashboardIcon, dataTour: 'nav-dashboard' },
    { path: '/tutor-portal/profile', label: 'Hồ sơ gia sư', icon: ProfileIcon, dataTour: 'nav-profile' },
    { path: '/tutor-portal/onboarding', label: 'Thiết lập giảng dạy', icon: TeachingSetupIcon, dataTour: 'nav-onboarding' },
    { path: MESSAGES_PATH, label: 'Tin nhắn', icon: MessagesIcon, dataTour: 'nav-messages' },
    { path: '/tutor-portal/bookings', label: 'Đặt lịch', icon: BookingIcon, dataTour: 'nav-bookings' },
    { path: '/tutor-portal/calendar', label: 'Lịch dạy', icon: ClassIcon, dataTour: 'nav-classes' },
    { path: '/tutor-portal/classes', label: 'Lớp học', icon: ClassroomIcon, dataTour: 'nav-classrooms' },
    { path: '/tutor-portal/disputes', label: 'Khiếu nại', icon: DisputeIcon, dataTour: 'nav-disputes' },
    { path: '/tutor-portal/finance', label: 'Tài chính', icon: FinanceIcon, dataTour: 'nav-finance' },
    { path: '/tutor-portal/account', label: 'Tài khoản', icon: AccountIcon, dataTour: 'nav-account' },
];

// ─── Tour Steps — 1 tour riêng cho mỗi trang chính, chọn qua TourPageMenu ───
// Mỗi tour (trừ Dashboard) theo khuôn: 1 bước định hướng (highlight mục sidebar,
// dùng nav-* selector có sẵn) → N bước nội dung trang → 1 bước chia tay (TutorTour
// tự nhận bước cuối là farewell modal, không cần target thật).

// Đổi bước con của wizard onboarding — dùng guardedNavigate dùng chung (chỉ navigate khi
// step đích khác step hiện tại, tránh chớp giật do navigate tới URL y hệt).
const navigateOnboardingStep = (
    navigate: ReturnType<typeof useNavigate>,
    step: 'availability' | 'pricing' | 'packages',
) => guardedNavigate(navigate, '/tutor-portal/onboarding', { step });

// Hàm dựng thay vì hằng số cố định — tour "onboarding" cần điều hướng giữa các bước
// con của wizard (?step=...) qua `onEnter`, nên phải nhận `navigate` từ component.
const buildPageTours = (navigate: ReturnType<typeof useNavigate>): PageTour[] => [
    {
        key: 'dashboard',
        label: 'Tổng quan',
        description: 'Thống kê nhanh, thao tác nhanh và lịch mini.',
        icon: <DashboardIcon />,
        route: '/tutor-portal/dashboard',
        steps: [
            {
                target: '[data-tour="sidebar"]',
                title: '🎯 Chào mừng đến TopTutor!',
                description: 'Đây là Bảng điều khiển của bạn. Menu bên trái giúp bạn truy cập nhanh mọi chức năng quản lý gia sư.',
                placement: 'right',
            },
            {
                target: '[data-tour="nav-dashboard"]',
                title: '📊 Tổng quan',
                description: 'Xem tổng quan hoạt động: thống kê buổi học, đánh giá, doanh thu, và lịch dạy.',
                placement: 'right',
            },
            {
                target: '[data-tour="stats-grid"]',
                title: '📈 Thống kê nhanh',
                description: 'Các thẻ thống kê giúp bạn theo dõi số buổi học, đánh giá trung bình, số dư ví, và doanh thu.',
                placement: 'bottom',
            },
            {
                target: '[data-tour="quick-actions"]',
                title: '⚡ Thao tác nhanh',
                description: 'Điểm danh, thêm lịch rảnh, tạo lớp học, rút tiền — chỉ 1 click!',
                placement: 'bottom',
            },
            {
                target: '[data-tour="calendar-widget"]',
                title: '📅 Lịch mini',
                description: 'Xem nhanh những ngày có lớp (chấm xanh). Click vào ngày để xem chi tiết lịch dạy.',
                placement: 'left',
            },
            {
                target: '[data-tour="nav-profile"]',
                title: '🪪 Hồ sơ gia sư',
                description: 'Chỉnh sửa hồ sơ hiển thị cho phụ huynh: ảnh đại diện, giới thiệu, bằng cấp, giá dạy, video giới thiệu.',
                placement: 'right',
            },
            {
                target: '[data-tour="nav-messages"]',
                title: '💌 Tin nhắn',
                description: 'Nhắn tin trực tiếp với phụ huynh và học sinh. Hỗ trợ gửi file đính kèm.',
                placement: 'right',
            },
            {
                target: '[data-tour="nav-bookings"]',
                title: '📥 Yêu cầu đặt lịch',
                description: 'Xem và phản hồi yêu cầu đặt lịch từ phụ huynh. Chấp nhận hoặc từ chối lịch học.',
                placement: 'right',
            },
            {
                target: '[data-tour="nav-classes"]',
                title: '🎓 Lịch dạy',
                description: 'Xem lịch dạy theo tuần, biết buổi nào sắp tới giờ, vào lớp online và mở chi tiết lớp học.',
                placement: 'right',
            },
            {
                target: '[data-tour="nav-finance"]',
                title: '💳 Tài chính',
                description: 'Xem thu nhập, lịch sử giao dịch, rút tiền về tài khoản ngân hàng của bạn.',
                placement: 'right',
            },
            {
                target: '[data-tour="nav-account"]',
                title: '👤 Tài khoản',
                description: 'Quản lý thông tin cá nhân, cập nhật hồ sơ và đổi mật khẩu tài khoản của bạn.',
                placement: 'right',
            },
            {
                target: '[data-tour="stats-grid"]',
                title: '🎉 Sẵn sàng rồi!',
                description: 'Chúc bạn có trải nghiệm làm gia sư thật tuyệt vời với TopTutor! Nếu cần hỗ trợ, đừng ngần ngại liên hệ đội ngũ của chúng tôi nhé. 💪',
                placement: 'bottom',
            },
        ],
    },
    {
        key: 'profile',
        label: 'Hồ sơ gia sư',
        description: 'Thông tin hiển thị cho phụ huynh, chứng chỉ, xác minh danh tính.',
        icon: <ProfileIcon />,
        route: '/tutor-portal/profile',
        steps: [
            {
                target: '[data-tour="nav-profile"]',
                title: '🪪 Hồ sơ gia sư',
                description: 'Đây là trang phụ huynh sẽ thấy khi tìm gia sư. Hãy cùng xem qua từng phần nhé.',
                placement: 'right',
            },
            {
                target: '[data-tour="profile-editbar"]',
                title: '👀 Xem trước / Chỉnh sửa',
                description: 'Chuyển qua lại giữa chế độ xem trước (giống góc nhìn phụ huynh) và chỉnh sửa thông tin.',
                placement: 'top',
            },
            {
                target: '[data-tour="profile-hero"]',
                title: '📌 Thông tin cơ bản',
                description: 'Tên, ảnh đại diện, đánh giá, khu vực dạy, hình thức dạy và trạng thái "đang nhận học viên".',
                placement: 'bottom',
            },
            {
                target: '[data-tour="profile-about"]',
                title: '📝 Giới thiệu bản thân',
                description: 'Bio, học vấn, GPA, kinh nghiệm giảng dạy — càng chi tiết càng dễ được phụ huynh tin tưởng.',
                placement: 'bottom',
            },
            {
                target: '[data-tour="profile-credentials"]',
                title: '🎓 Chứng chỉ',
                description: 'Thêm chứng chỉ, bằng cấp để tăng độ tin cậy hồ sơ. Có thể xem trước ảnh chứng chỉ đã tải lên.',
                placement: 'top',
            },
            {
                target: '[data-tour="profile-identity"]',
                title: '✅ Xác minh danh tính',
                description: 'Xác minh CCCD giúp hồ sơ có huy hiệu tin cậy, tăng tỷ lệ được phụ huynh chọn.',
                placement: 'top',
            },
            {
                target: '[data-tour="profile-pricing"]',
                title: '💬 Góc nhìn phụ huynh',
                description: 'Đây là khối "Đặt buổi học thử" / "Gửi tin nhắn" mà phụ huynh nhìn thấy khi ghé hồ sơ của bạn.',
                placement: 'left',
            },
            {
                target: '[data-tour="profile-hero"]',
                title: '🎉 Xong rồi!',
                description: 'Hồ sơ càng đầy đủ, càng dễ được phụ huynh chọn. Cập nhật thường xuyên nhé!',
                placement: 'bottom',
            },
        ],
    },
    {
        key: 'onboarding',
        label: 'Thiết lập giảng dạy',
        description: 'Lịch rảnh, môn & giá, gói lịch học gợi ý.',
        icon: <TeachingSetupIcon />,
        route: '/tutor-portal/onboarding',
        steps: [
            {
                target: '[data-tour="nav-onboarding"]',
                title: '📐 Thiết lập giảng dạy',
                description: 'Đây là nơi cấu hình lịch rảnh, môn dạy, học phí và gói lịch học — càng đầy đủ, phụ huynh càng dễ đặt lịch với bạn.',
                placement: 'right',
            },
            {
                target: '[data-tour="onboarding-stepper"]',
                title: '🗺️ 3 bước thiết lập',
                description: 'Lịch rảnh → Môn & giá → Gói lịch học. Mỗi mục hiện trạng thái riêng; bước sau chỉ mở khi bước trước đã có dữ liệu.',
                placement: 'bottom',
            },
            {
                target: '[data-tour="onboarding-body"]',
                title: '✍️ Bước 1 — Lịch rảnh',
                description: 'Chọn khung giờ bạn có thể nhận booking. Đây là bước bắt buộc đầu tiên — số buổi/giờ dạy tối đa ở bước sau đều tính từ lịch rảnh này.',
                placement: 'top',
                // Tour có thể được bấm khi tutor đang đứng sẵn ở step khác (vd packages) —
                // luôn ép về đúng bước "availability" trước khi highlight, tránh lệch giữa
                // nội dung tooltip và nội dung trang đang hiển thị.
                onEnter: () => navigateOnboardingStep(navigate, 'availability'),
            },
            {
                target: '[data-tour="onboarding-pricing-form"]',
                title: '💵 Bước 2 — Thêm cấu hình môn học',
                description: 'Chọn môn, khối lớp áp dụng, giá theo giờ, thời lượng và số buổi/tuần. Mỗi cấu hình là 1 tổ hợp môn + khối lớp riêng.',
                placement: 'right',
                onEnter: () => navigateOnboardingStep(navigate, 'pricing'),
            },
            {
                target: '[data-tour="onboarding-pricing-list"]',
                title: '📋 Các cấu hình đã thêm',
                description: 'Danh sách môn/giá bạn đã lưu hiện ở đây — có thể sửa hoặc xoá bất cứ lúc nào, kể cả sau khi hồ sơ đã hoạt động.',
                placement: 'left',
                onEnter: () => navigateOnboardingStep(navigate, 'pricing'),
            },
            {
                target: '[data-tour="onboarding-packages"]',
                title: '📦 Bước 3 — Gói lịch học (tuỳ chọn)',
                description: 'Tạo gói học cố định theo tháng để phụ huynh đặt lịch nhanh hơn — hệ thống tự tạo lịch dạy theo gói, không bắt buộc phải có.',
                placement: 'top',
                onEnter: () => navigateOnboardingStep(navigate, 'packages'),
            },
            {
                target: '[data-tour="onboarding-cta"]',
                title: '➡️ Tiếp tục / Hoàn tất',
                description: 'Lưu bước hiện tại và chuyển sang bước kế tiếp. Ở bước cuối, nút này sẽ hoàn tất toàn bộ thiết lập.',
                placement: 'top',
            },
            {
                target: '[data-tour="onboarding-cta"]',
                title: '🎉 Xong rồi!',
                description: 'Thiết lập càng sớm, bạn càng sớm nhận được yêu cầu đặt lịch từ phụ huynh!',
                placement: 'top',
            },
        ],
    },
    {
        key: 'messages',
        label: 'Tin nhắn',
        description: 'Trò chuyện trực tiếp với phụ huynh và học sinh.',
        icon: <MessagesIcon />,
        route: '/tutor-portal/messages',
        steps: [
            {
                target: '[data-tour="nav-messages"]',
                title: '💌 Tin nhắn',
                description: 'Nơi bạn trao đổi trực tiếp với phụ huynh và học sinh về buổi học.',
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
                description: 'Nhắn tin, gửi file đính kèm với phụ huynh/học sinh ngay tại đây.',
                placement: 'left',
            },
            {
                target: '[data-tour="messages-chat"]',
                title: '🎉 Xong rồi!',
                description: 'Phản hồi tin nhắn nhanh giúp phụ huynh yên tâm hơn khi chọn bạn làm gia sư.',
                placement: 'left',
            },
        ],
    },
    {
        key: 'bookings',
        label: 'Yêu cầu đặt lịch',
        description: 'Xem và phản hồi các yêu cầu đặt lịch từ phụ huynh.',
        icon: <BookingIcon />,
        route: '/tutor-portal/bookings',
        steps: [
            {
                target: '[data-tour="nav-bookings"]',
                title: '📥 Yêu cầu đặt lịch',
                description: 'Mọi yêu cầu đặt lịch từ phụ huynh đều xuất hiện ở đây, chờ bạn phản hồi.',
                placement: 'right',
            },
            {
                target: '[data-tour="bookings-tabs"]',
                title: '🗂️ Lọc theo trạng thái',
                description: 'Chuyển giữa Chờ xác nhận, Đã thanh toán, Hoàn thành, Đã hủy để theo dõi từng nhóm yêu cầu.',
                placement: 'bottom',
            },
            {
                target: '[data-tour="bookings-card"]',
                title: '🗒️ Thông tin yêu cầu',
                description: 'Mỗi thẻ hiển thị học sinh, môn học, số buổi và lịch học dự kiến do phụ huynh đề xuất.',
                placement: 'bottom',
            },
            {
                target: '[data-tour="bookings-payout"]',
                title: '💰 Chi tiết thanh toán',
                description: 'Xem trước số tiền bạn thực nhận sau khi trừ phí, cùng trạng thái đặt cọc.',
                placement: 'left',
            },
            {
                target: '[data-tour="bookings-actions"]',
                title: '✅ Chấp nhận hoặc từ chối',
                description: 'Phản hồi càng sớm, phụ huynh càng chủ động sắp xếp lịch học. Yêu cầu có thời hạn phản hồi.',
                placement: 'top',
            },
            {
                target: '[data-tour="bookings-tabs"]',
                title: '🎉 Xong rồi!',
                description: 'Đừng để yêu cầu quá hạn phản hồi nhé — phụ huynh rất coi trọng tốc độ phản hồi của gia sư.',
                placement: 'bottom',
            },
        ],
    },
    {
        key: 'calendar',
        label: 'Lịch dạy',
        description: 'Xem lịch dạy theo tuần, tháng hoặc danh sách.',
        icon: <ClassIcon />,
        route: '/tutor-portal/calendar',
        steps: [
            {
                target: '[data-tour="nav-classes"]',
                title: '🎓 Lịch dạy',
                description: 'Toàn bộ buổi dạy đã lên lịch của bạn nằm ở đây.',
                placement: 'right',
            },
            {
                target: '[data-tour="calendar-nav"]',
                title: '📅 Điều hướng thời gian',
                description: 'Nút "Hôm nay" đưa bạn về ngày hiện tại, mũi tên hai bên để xem tuần/tháng trước hoặc sau.',
                placement: 'bottom',
            },
            {
                target: '[data-tour="calendar-view-switch"]',
                title: '🔀 Đổi kiểu xem',
                description: 'Chuyển đổi giữa Lịch tuần, Dạng lưới và Danh sách tùy theo bạn muốn xem tổng quan hay chi tiết.',
                placement: 'bottom',
            },
            {
                target: '[data-tour="calendar-filters"]',
                title: '🏷️ Lọc theo trạng thái',
                description: 'Lọc nhanh các buổi Lên lịch, Chờ xác nhận hoặc Hoàn thành.',
                placement: 'bottom',
            },
            {
                target: '[data-tour="calendar-view-switch"]',
                title: '🎉 Xong rồi!',
                description: 'Click vào 1 buổi học bất kỳ để xem chi tiết, vào lớp hoặc gửi báo cáo buổi học.',
                placement: 'bottom',
            },
        ],
    },
    {
        key: 'finance',
        label: 'Tài chính',
        description: 'Số dư, thu nhập và rút tiền.',
        icon: <FinanceIcon />,
        route: '/tutor-portal/finance',
        steps: [
            {
                target: '[data-tour="nav-finance"]',
                title: '💳 Tài chính',
                description: 'Theo dõi thu nhập và quản lý việc rút tiền của bạn tại đây.',
                placement: 'right',
            },
            {
                target: '[data-tour="finance-overview-cards"]',
                title: '💰 Số dư của bạn',
                description: 'Số dư khả dụng có thể rút ngay, và tiền học đang được hệ thống tạm giữ để bảo đảm buổi học.',
                placement: 'bottom',
            },
            {
                target: '[data-tour="finance-withdraw-btn"]',
                title: '🏦 Rút tiền',
                description: 'Gửi yêu cầu rút tiền về tài khoản ngân hàng đã liên kết khi số dư đủ điều kiện tối thiểu.',
                placement: 'left',
            },
            {
                target: '[data-tour="finance-chart"]',
                title: '📈 Biểu đồ thu nhập',
                description: 'Theo dõi xu hướng thu nhập theo tuần/tháng để biết giai đoạn nào bạn dạy nhiều nhất.',
                placement: 'bottom',
            },
            {
                target: '[data-tour="finance-transactions"]',
                title: '🧾 Giao dịch gần đây',
                description: 'Lịch sử các khoản tiền vào/ra ví của bạn. Bấm "Xem tất cả" để xem đầy đủ lịch sử giao dịch.',
                placement: 'top',
            },
            {
                target: '[data-tour="finance-overview-cards"]',
                title: '🎉 Xong rồi!',
                description: 'Mọi khoản thu nhập đều được ghi nhận minh bạch — bạn có thể kiểm tra bất cứ lúc nào.',
                placement: 'bottom',
            },
        ],
    },
    {
        key: 'disputes',
        label: 'Khiếu nại',
        description: 'Theo dõi và phản hồi các khiếu nại liên quan buổi học.',
        icon: <DisputeIcon />,
        route: '/tutor-portal/disputes',
        steps: [
            {
                target: '[data-tour="nav-disputes"]',
                title: '⚠️ Khiếu nại',
                description: 'Các khiếu nại liên quan đến buổi học của bạn (từ phụ huynh hoặc do bạn báo cáo) đều hiện ở đây.',
                placement: 'right',
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
                description: 'Xem mã hồ sơ, buổi học liên quan, mức độ ưu tiên và trạng thái xử lý. Click 1 dòng để xem chi tiết và phản hồi.',
                placement: 'top',
            },
            {
                target: '[data-tour="disputes-tabs"]',
                title: '🎉 Xong rồi!',
                description: 'Phản hồi khiếu nại sớm và đầy đủ thông tin giúp quá trình xử lý nhanh và công bằng hơn.',
                placement: 'bottom',
            },
        ],
    },
    {
        key: 'account',
        label: 'Tài khoản',
        description: 'Thông tin cá nhân và bảo mật đăng nhập.',
        icon: <AccountIcon />,
        route: '/tutor-portal/account',
        steps: [
            {
                target: '[data-tour="nav-account"]',
                title: '👤 Tài khoản',
                description: 'Quản lý thông tin cá nhân và bảo mật đăng nhập của bạn tại đây.',
                placement: 'right',
            },
            {
                target: '[data-tour="account-profile-card"]',
                title: '🖼️ Ảnh đại diện',
                description: 'Đổi ảnh đại diện tài khoản — khác với ảnh trên hồ sơ gia sư hiển thị cho phụ huynh.',
                placement: 'bottom',
            },
            {
                target: '[data-tour="account-personal-info"]',
                title: '📇 Thông tin cá nhân',
                description: 'Cập nhật số điện thoại, email, địa chỉ. Họ tên và ngày sinh sẽ bị khóa sau khi xác minh CCCD.',
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

// ─── Component ───

const TutorPortalLayout: React.FC = () => {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const pageTours = useMemo(() => buildPageTours(navigate), [navigate]);
    const tour = usePortalTour(pageTours, 'tutor', {
        onSidebarOpen: () => setSidebarOpen(true),
        onSidebarClose: () => setSidebarOpen(false),
    });

    // useUnreadMessageBadge/useUnreadBadgesByTab bên dưới chỉ ĐĂNG KÝ lắng nghe trên kết nối SignalR có
    // sẵn — không tự mở kết nối. Trước đây không có nơi nào trong tutor portal gọi connect() (chỉ
    // Header.tsx — không dùng ở layout này), nên mọi real-time (badge, AI điền báo cáo xong,...) chưa
    // từng thực sự chạy, chỉ fetch 1 lần lúc load trang.
    useEffect(() => {
        signalRService.connect().catch(() => {/* đã tự xử lý bên trong service (silent, tự retry) */});
    }, []);

    // Tin nhắn unread badge — fetch + SignalR real-time + auto-clear khi vào /messages.
    const unreadMessageCount = useUnreadMessageBadge(MESSAGES_PATH);
    // Notification badges per-tab — group unread noti theo `type` → map sang path sidebar.
    const badgesByPath = useUnreadBadgesByTab(NOTIFICATION_TYPES_BY_PATH);

    const navItems = useMemo<NavItem[]>(
        () =>
            baseNavItems.map((item) => {
                if (item.path === MESSAGES_PATH) {
                    return { ...item, badge: unreadMessageCount };
                }
                const count = badgesByPath[item.path];
                return count ? { ...item, badge: count } : item;
            }),
        [unreadMessageCount, badgesByPath],
    );

    // Prefetch all tutor portal pages after initial load
    useEffect(() => {
        const timer = setTimeout(() => {
            import('../pages/TutorPortal/TutorPortalProfile');
            import('../pages/TutorPortal/TutorPortalDashboard');
            import('../pages/TutorPortal/TutorPortalMessages');
            import('../pages/TutorPortal/TutorPortalCalendar');
            import('../pages/TutorPortal/TutorPortalClassSessionDetail');
            import('../pages/TutorPortal/TutorPortalBookings');
            import('../pages/TutorFinance/TutorFinanceDashboard/TutorFinanceDashboardPage');
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    const isActive = (path: string, pathname: string) => {
        // "Lịch dạy" cũng sáng khi đang xem chi tiết một buổi học.
        if (path === '/tutor-portal/calendar') {
            return pathname === path || pathname.startsWith('/tutor-portal/class-sessions/');
        }
        if (path === '/tutor-portal/finance' || path === '/tutor-portal/sessions') {
            return pathname.startsWith(path);
        }
        return pathname === path;
    };

    // Tour menu button in sidebar nav footer
    const sidebarNavFooter = (
        <div
            className={`${styles.navItem} ${styles.navFooterItem}`}
            title="Hướng dẫn sử dụng"
            onClick={tour.handleOpenTourMenu}
        >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="9" cy="9" r="7" />
                <path d="M9 6v0.01M9 8.5v4" strokeLinecap="round" />
            </svg>
            <span className={styles.navText}>Hướng dẫn</span>
        </div>
    );

    // Tour-related extras (prompt modal + picker modal + tour component)
    const tourExtras = (
        <>
            {tour.showTourPrompt && (
                <TourWelcomePrompt
                    title="Chào mừng bạn đến TopTutor!"
                    description="Hãy để TopTutor hướng dẫn bạn khám phá các tính năng để có trải nghiệm mượt mà nhất nhé!"
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
            userRole="TUTOR"
            isActive={isActive}
            sidebarNavFooter={sidebarNavFooter}
            showSidebarUserCard={true}
            showAvatarImage={true}
            profileMenuItems={tutorProfileMenuItems}
            sidebarDataTour="sidebar"
            sidebarOpenExternal={sidebarOpen}
            onSidebarOpen={() => setSidebarOpen(true)}
            onSidebarClose={() => setSidebarOpen(false)}
            extras={tourExtras}
        />
    );
};

export default TutorPortalLayout;

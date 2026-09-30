// Shared SVG Icon components used across Parent & Student layouts

// Logo Icon (TUTORA symbol)
export const LogoIcon = () => (
    <img src="/tutora-logo.png" alt="TopTutor" width="28" height="28" />
);

// Notification Bell Icon
export const NotificationIcon = () => (
    <svg width="18" height="20" viewBox="0 0 18 20" fill="currentColor">
        <path d="M9 0C5.68629 0 3 2.68629 3 6V11L1 14V15H17V14L15 11V6C15 2.68629 12.3137 0 9 0Z" />
        <path d="M9 20C10.6569 20 12 18.6569 12 17H6C6 18.6569 7.34315 20 9 20Z" />
    </svg>
);

// Clock Icon for next lesson
export const ClockIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="7" cy="7" r="5.5" />
        <path d="M7 4V7L9 8.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Dropdown Arrow
export const ChevronDown = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Nav Icons
export const DashboardIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
        <path d="M2 4C2 2.89543 2.89543 2 4 2H7C7.55228 2 8 2.44772 8 3V7C8 7.55228 7.55228 8 7 8H4C2.89543 8 2 7.10457 2 6V4Z" />
        <path d="M2 12C2 10.8954 2.89543 10 4 10H7C7.55228 10 8 10.4477 8 11V15C8 15.5523 7.55228 16 7 16H4C2.89543 16 2 15.1046 2 14V12Z" />
        <path d="M10 3C10 2.44772 10.4477 2 11 2H14C15.1046 2 16 2.89543 16 4V6C16 7.10457 15.1046 8 14 8H11C10.4477 8 10 7.55228 10 7V3Z" />
        <path d="M10 11C10 10.4477 10.4477 10 11 10H14C15.1046 10 16 10.8954 16 12V14C16 15.1046 15.1046 16 14 16H11C10.4477 16 10 15.5523 10 15V11Z" />
    </svg>
);

export const ChildrenIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
        <path d="M9 8C10.6569 8 12 6.65685 12 5C12 3.34315 10.6569 2 9 2C7.34315 2 6 3.34315 6 5C6 6.65685 7.34315 8 9 8Z" />
        <path d="M2 16C2 12.6863 5.13401 10 9 10C12.866 10 16 12.6863 16 16H2Z" />
    </svg>
);

export const MessagesIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M1 4L9 9L17 4M1 14V4C1 2.89543 1.89543 2 3 2H15C16.1046 2 17 2.89543 17 4V14C17 15.1046 16.1046 16 15 16H3C1.89543 16 1 15.1046 1 14Z" strokeLinecap="round" />
    </svg>
);

export const BookingIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M11 3V1M7 3V1M3 13V5C3 3.89543 3.89543 3 5 3H13C14.1046 3 15 3.89543 15 5V13C15 14.1046 14.1046 15 13 15H5C3.89543 15 3 14.1046 3 13Z" strokeLinecap="round" />
        <path d="M7 8L9 10L12 7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 8H15" strokeLinecap="round" />
    </svg>
);

export const AccountIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="9" cy="7" r="3.5" />
        <path d="M2 16c0-3.314 3.134-6 7-6s7 2.686 7 6" strokeLinecap="round" />
    </svg>
);

export const WalletIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="4" width="14" height="10" rx="2" />
        <path d="M2 7h14" strokeLinecap="round" />
        <circle cx="12.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
    </svg>
);

// Hamburger Menu Icon for mobile
export const MenuIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 5H17M3 10H17M3 15H17" strokeLinecap="round" />
    </svg>
);

// Close Icon for mobile sidebar
export const CloseIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 5L15 15M15 5L5 15" strokeLinecap="round" />
    </svg>
);

// Logout Icon
export const LogoutIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M6 16H3C2.44772 16 2 15.5523 2 15V3C2 2.44772 2.44772 2 3 2H6" strokeLinecap="round" />
        <path d="M12 12L16 9L12 6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 9H7" strokeLinecap="round" />
    </svg>
);

export const CalendarIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="14" height="13" rx="2" />
        <path d="M12 1v4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 1v4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 7h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const DisputeIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 1.5L16.5 15H1.5L9 1.5Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 7V10" strokeLinecap="round" />
        <circle cx="9" cy="12.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
);

export const LinkIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M7.5 10.5L10.5 7.5" strokeLinecap="round" />
        <path d="M5.5 12.5L3.5 14.5C2.67 15.33 2.67 16.67 3.5 17.5C4.33 18.33 5.67 18.33 6.5 17.5L8.5 15.5" strokeLinecap="round" />
        <path d="M12.5 5.5L14.5 3.5C15.33 2.67 15.33 1.33 14.5 0.5C13.67 -0.33 12.33 -0.33 11.5 0.5L9.5 2.5" strokeLinecap="round" />
    </svg>
);

// Progress Icon — cột biểu đồ tăng dần, cho trang "Tiến trình học tập" của học sinh
export const ProgressIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2.5 15.5h13" />
        <path d="M5 15.5V11" />
        <path d="M9 15.5V7.5" />
        <path d="M13 15.5V4" />
    </svg>
);

export const FavoriteIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
);

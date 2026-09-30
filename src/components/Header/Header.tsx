import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Header.css";
import { clearUserFromStorage, getCurrentUser, getUserInfoFromToken, getUserProfile } from "../../services/auth.service";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import ProfileDropdown from "../shared/PortalLayout/ProfileDropdown";
import { getRoleLabel } from "../../utils/roleLabel";
import type { ProfileMenuItem } from "../shared/PortalLayout/ProfileDropdown";
import NotificationDropdown from '../NotificationDropdown/NotificationDropdown';
import { getProfileMenuItemsByRole } from "../../layouts/shared/profileMenus";
import { useNotifications } from '../../layouts/shared/useLayoutData';
import { ABOUT_BASE_PATH } from "../../constants/policy";
import { getMyLinkStatus } from "../../services/student.service";

const generateAvatarUrl = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3d4a3e&color=f2f0e4&size=128`;

interface HeaderProps {
  profileMenuItems?: ProfileMenuItem[];
  variant?: 'default' | 'portal';
  /** On mobile portals, the hamburger controls the portal sidebar rather than the public-site menu. */
  onPortalMenuToggle?: () => void;
  portalMenuOpen?: boolean;
}

const Header = ({
  profileMenuItems: profileMenuItemsProp,
  variant = 'default',
  onPortalMenuToggle,
  portalMenuOpen = false,
}: HeaderProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userDisplayName, setUserDisplayName] = useState<string>("User");
  const [userRole, setUserRole] = useState<string>("");
  const [userAvatar, setUserAvatar] = useState<string>("");
  const [studentSelfRegistered, setStudentSelfRegistered] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const {
    notificationCount,
    showNotificationDropdown,
    setShowNotificationDropdown,
    handleRefreshNotificationCount,
  } = useNotifications(variant === 'portal' && isLoggedIn);

  // Ẩn user info trên trang đăng ký/đăng nhập
  const isAuthPage = location.pathname === "/register" || location.pathname === "/login";

  useEffect(() => {
    // Check if user is logged in from localStorage
    const user = getCurrentUser();
    if (user && user.accessToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoggedIn(true);

      const userInfo = getUserInfoFromToken();
      const displayName = userInfo?.fullname ||
        (userInfo?.firstName && userInfo?.lastName ? `${userInfo.firstName} ${userInfo.lastName}` : null) ||
        userInfo?.email?.split('@')[0] ||
        "User";
      setUserDisplayName(displayName);
      setUserRole(userInfo?.role || "");
      setUserAvatar(generateAvatarUrl(displayName));

      if (userInfo?.userId) {
        getUserProfile()
          .then((profile) => {
            const avatar = profile?.content?.avatarUrl || profile?.content?.avatarurl;
            if (avatar) setUserAvatar(avatar);
          })
          .catch(() => { /* giữ avatar fallback */ });
      }
    } else {
      setIsLoggedIn(false);
    }
  }, [location.pathname]); // Re-check on navigation

  useEffect(() => {
    if (userRole.toLowerCase() !== "student") return;

    let cancelled = false;
    getMyLinkStatus()
      .then((res) => {
        if (cancelled) return;
        const linked = res.content?.linked === true || !!res.content?.studentProfile?.parentId;
        setStudentSelfRegistered(!linked);
      })
      .catch(() => { /* giữ ẩn */ });

    return () => { cancelled = true; };
  }, [userRole]);

  // Đồng bộ khi trang tài khoản vừa đổi ảnh đại diện
  useEffect(() => {
    const handleAvatarUpdated = (e: Event) => {
      const newUrl = (e as CustomEvent<string>).detail;
      if (newUrl) setUserAvatar(newUrl);
    };
    window.addEventListener("avatar-updated", handleAvatarUpdated);
    return () => window.removeEventListener("avatar-updated", handleAvatarUpdated);
  }, []);

  const confirmLogout = async () => {
    await clearUserFromStorage();
    setShowLogoutConfirm(false);
    setIsLoggedIn(false);
    setIsMenuOpen(false);
    navigate("/login");
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const defaultProfileMenuItems = useMemo<ProfileMenuItem[]>(() => [
    ...getProfileMenuItemsByRole(userRole, { studentSelfRegistered }),
    {
      key: "logout",
      label: "Đăng xuất",
      materialIcon: "logout",
      danger: true,
      startsGroup: true,
      onSelect: () => setShowLogoutConfirm(true),
    },
  ], [userRole, studentSelfRegistered]);

  const profileMenuItems = profileMenuItemsProp ?? defaultProfileMenuItems;

  return (
    <header className={`header ${variant === 'portal' ? 'portal-header' : ''}`}>
      <div className="header-content">
        <Link to="/" className="logo-link">
          <div className="logo-icon">
            <img src="/tutora-logo.png" alt="TopTutor" width="38" height="38" />
          </div>
          <div className="logo-text">
            <span className="logo-name">TOPTUTOR</span>
            <span className="logo-tagline">Gia sư cấp 2, cấp 3</span>
          </div>
        </Link>
        <nav className="main-nav">
          <Link to="/tutor-search" className="nav-link">
            TÌM GIA SƯ
          </Link>
          {/* Trang thật thay cho anchor /#about — trang chủ không có section id="about"
              nên anchor cũ cuộn không tới đâu. */}
          <Link to={ABOUT_BASE_PATH} className="nav-link">
            VỀ CHÚNG TÔI
          </Link>
        </nav>

        {/* Auth Buttons - Xử lý điều kiện hiển thị */}
        <div className="auth-buttons">
          {isLoggedIn && !isAuthPage ? (
            // --- DROPDOWN TÀI KHOẢN KHI ĐÃ ĐĂNG NHẬP ---
            <>
              {variant === 'portal' && (
                <div className="portal-notification">
                  <button
                    type="button"
                    className="portal-notification-btn"
                    aria-label={`Thông báo${notificationCount > 0 ? `, ${notificationCount} chưa đọc` : ''}`}
                    aria-expanded={showNotificationDropdown}
                    onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">notifications</span>
                    {notificationCount > 0 && (
                      <span className="portal-notification-badge" aria-hidden="true">
                        {notificationCount > 99 ? '99+' : notificationCount}
                      </span>
                    )}
                  </button>
                  <NotificationDropdown
                    isOpen={showNotificationDropdown}
                    onClose={() => setShowNotificationDropdown(false)}
                    onCountUpdate={handleRefreshNotificationCount}
                  />
                </div>
              )}
              <ProfileDropdown
              name={userDisplayName}
              role={getRoleLabel(userRole)}
              initials={getInitials(userDisplayName)}
              avatarUrl={userAvatar}
              items={profileMenuItems}
              onNavigate={(path) => navigate(path)}
              />
            </>
          ) : (
            <>
              <Link to="/login" className="btn-login">
                ĐĂNG NHẬP
              </Link>
              <Link to="/register" className="btn-signup">
                ĐĂNG KÝ
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="mobile-menu-btn"
          onClick={() => {
            if (variant === 'portal' && onPortalMenuToggle) {
              onPortalMenuToggle();
              return;
            }
            setIsMenuOpen(!isMenuOpen);
          }}
          aria-label={variant === 'portal' ? 'Mở menu portal' : 'Mở menu'}
          aria-expanded={variant === 'portal' ? portalMenuOpen : isMenuOpen}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      {/* Mobile Menu */}
      {variant !== 'portal' && isMenuOpen && (
        <div className="mobile-menu">
          <nav className="mobile-nav">
            <Link
              to="/tutor-search"
              className="mobile-nav-link"
              onClick={() => setIsMenuOpen(false)}
            >
              TÌM GIA SƯ
            </Link>
            <Link
              to={ABOUT_BASE_PATH}
              className="mobile-nav-link"
              onClick={() => setIsMenuOpen(false)}
            >
              VỀ CHÚNG TÔI
            </Link>
          </nav>

          {/* Mobile Auth Section */}
          <div className="mobile-auth">
            {isLoggedIn && !isAuthPage ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "1rem",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    width: "100%",
                  }}
                >
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt={userDisplayName}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: '#3d4a3e',
                        color: '#f2f0e4',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {getInitials(userDisplayName)}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>
                      {userDisplayName}
                    </span>
                  </div>
                </div>

                {/* Cùng bộ thao tác nhanh với dropdown ở desktop */}
                {getProfileMenuItemsByRole(userRole, { studentSelfRegistered }).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="mobile-quick-action"
                    onClick={() => {
                      setIsMenuOpen(false);
                      navigate(item.key);
                    }}
                  >
                    {item.materialIcon && (
                      <span className="material-symbols-outlined">{item.materialIcon}</span>
                    )}
                    <span>{item.label}</span>
                  </button>
                ))}

                <button
                  className="btn-login"
                  style={{
                    width: "100%",
                    border: "1px solid #ef4444",
                    color: "#ef4444",
                    cursor: "pointer",
                  }}
                  onClick={() => setShowLogoutConfirm(true)}
                >
                  ĐĂNG XUẤT
                </button>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="btn-login"
                  onClick={() => setIsMenuOpen(false)}
                >
                  ĐĂNG NHẬP
                </Link>
                <Link
                  to="/register"
                  className="btn-signup"
                  onClick={() => setIsMenuOpen(false)}
                >
                  ĐĂNG KÝ
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showLogoutConfirm}
        type="warning"
        title="Đăng xuất"
        message="Bạn có chắc muốn kết thúc phiên làm việc hiện tại không?"
        confirmText="Đăng xuất"
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </header>
  );
};

export default Header;

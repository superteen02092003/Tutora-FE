/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/Login/LoginForm.tsx — Dùng SimpleAuth API (không qua Supabase)
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import InputGroup from "../../components/InputGroup";
import ForgotPasswordModal from "../../components/ForgotPasswordModal";
import GoogleSignInButton from "../../components/GoogleSignInButton";
import ZaloSignInButton from "../../components/ZaloSignInButton";
import axios from "axios";
import { saveUserToStorage, googleAuth, takePendingRedirect } from "../../services/auth.service";

const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5166') + '/api';
const REMEMBERED_PHONE_KEY = 'TUTORA_remembered_phone';

// Chỉ giữ chữ số và dấu '+' đứng đầu (cho số dạng +84...).
const sanitizePhone = (raw: string) => raw.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');

const looksLikeEmail = (raw: string) => raw.includes('@');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Các origin được phép quay lại sau khi đăng nhập (AI Homework Helper...).
 * Allowlist chứ KHÔNG nhận mọi URL: nếu không sẽ thành lỗ hổng open redirect,
 * kẻ xấu gửi link ?returnUrl=<trang giả> để lừa người dùng ngay sau khi login.
 */
const ALLOWED_RETURN_ORIGINS = Array.from(
  new Set(
    (import.meta.env.VITE_ALLOWED_RETURN_ORIGINS || '')
      .split(',')
      .map((o: string) => o.trim())
      .filter(Boolean),
  ),
);

const getSafeReturnUrl = (): string | null => {
  const raw = new URLSearchParams(window.location.search).get('returnUrl');
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin === window.location.origin) return null;
    return ALLOWED_RETURN_ORIGINS.includes(url.origin) ? url.href : null;
  } catch {
    return null;
  }
};

// Tạm thời cho tới khi BE set cookie HttpOnly Domain=.tutora.vn — lúc đó bỏ hàm này.
const appendSessionToReturnUrl = (returnUrl: string, accessToken: string, refreshToken: string) => {
  const url = new URL(returnUrl);
  const fragment = new URLSearchParams({ accessToken, refreshToken });
  url.hash = fragment.toString();
  return url.href;
};

const LoginForm: React.FC = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ phone: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);

  // Load remembered phone on mount
  useEffect(() => {
    const savedPhone = localStorage.getItem(REMEMBERED_PHONE_KEY);
    if (savedPhone) {
      setFormData((prev) => ({ ...prev, phone: savedPhone }));
      setRememberMe(true);
    }
  }, []);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "phone") {
      const next = looksLikeEmail(value) || /[a-zA-Z]/.test(value) ? value.trim() : sanitizePhone(value);
      setFormData((prev) => ({ ...prev, phone: next }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Decode JWT payload to extract role (lowercase). Returns '' on decode error.
   */
  const getRoleFromToken = (token: string): string => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(
        decodeURIComponent(
          atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        )
      );
      const roleClaim = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
      return (payload[roleClaim] || '').toLowerCase();
    } catch {
      return '';
    }
  };

  /**
   * Map role -> portal path cho 3 portal còn lại trong repo này.
   * Admin đã chuyển sang repo riêng `tutora-admin-frontend` — caller PHẢI xử lý
   * role='admin' riêng (toast + redirect external) trước khi gọi hàm này.
   */
  const getPortalPathFromRole = (role: string): string => {
    switch (role) {
      case 'tutor': return '/tutor-portal/dashboard';
      case 'parent': return '/parent-portal/dashboard';
      case 'student': return '/student-portal/dashboard';
      default: return '/';
    }
  };

  const ADMIN_PORTAL_URL = import.meta.env.VITE_ADMIN_PORTAL_URL || 'https://cms.tutora.vn';

  /**
   * Hoàn tất đăng nhập sau khi đã có JWT (dùng chung cho password & Google).
   * Admin có cổng riêng (tutora-admin-frontend) → KHÔNG save token, chỉ cảnh báo.
   * Trả về true nếu đăng nhập user-facing thành công.
   */
  const finishLogin = (token: string, refreshToken: string): boolean => {
    const role = getRoleFromToken(token);

    if (role === 'admin') {
      toast.warning(
        <div style={{ lineHeight: 1.5 }}>
          <strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
            Tài khoản quản trị
          </strong>
          <span style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
            Vui lòng dùng cổng quản trị riêng.
          </span>
          <a
            href={ADMIN_PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#1a2238', fontWeight: 600, fontSize: 13, textDecoration: 'underline' }}
          >
            Đi tới TopTutor Admin →
          </a>
        </div>,
        { autoClose: 10000, toastId: 'admin-wrong-portal' }
      );
      return false;
    }

    saveUserToStorage({ accessToken: token, refreshToken });
    toast.success("Đăng nhập thành công!");

    const returnUrl = getSafeReturnUrl();
    setTimeout(() => {
      if (returnUrl) {
        window.location.href = appendSessionToReturnUrl(returnUrl, token, refreshToken);
        return;
      }
      // Ai bấm nút trong tin ZNS lúc chưa đăng nhập thì /go/... đã nhớ sẵn đích — trả họ về đúng
      // trang đó thay vì thả về dashboard.
      void takePendingRedirect().then((pending) => navigate(pending ?? getPortalPathFromRole(role)));
    }, 800);
    return true;
  };

  /**
   * Callback khi GIS trả idToken. Gọi /auth/google:
   *  - Có sẵn tài khoản (SĐT đã xác thực) → BE trả { accessToken, refreshToken } → đăng nhập luôn.
   *  - Chưa hoàn tất → BE trả socialRegistrationToken → sang trang hoàn tất đăng ký (role + SĐT + OTP).
   */
  const handleGoogleCredential = async (idToken: string) => {
    try {
      setIsSubmitting(true);
      const data = await googleAuth(idToken);

      if (data?.accessToken) {
        finishLogin(data.accessToken, data.refreshToken);
        return;
      }

      if (data?.requiresPhoneInput || data?.requiresRoleSelection) {
        navigate('/auth/social-complete', {
          state: {
            socialRegistrationToken: data.socialRegistrationToken,
            email: data.email,
            phone: data.phone,
            requiresRoleSelection: data.requiresRoleSelection,
          },
        });
        return;
      }

      toast.error(data?.message || data?.errorMessage || "Đăng nhập Google thất bại.");
    } catch (error: any) {
      console.error("Google login error:", error);
      toast.error(error.response?.data?.message || "Đăng nhập Google thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const identifier = formData.phone.trim();

    if (!identifier || !formData.password) {
      toast.warning("Vui lòng nhập đầy đủ email/số điện thoại và mật khẩu!");
      return;
    }

    // Chấp nhận email / số điện thoại / username — khớp đúng 3 nhánh phân loại
    // của /auth/login (SimpleAuthService.SimpleLoginAsync): chứa '@' → email;
    // toàn số hoặc bắt đầu bằng '+' → số điện thoại; còn lại → username (tài
    // khoản con do phụ huynh tạo dùng username, không có số điện thoại).
    if (looksLikeEmail(identifier)) {
      if (!EMAIL_RE.test(identifier)) {
        toast.warning("Email không hợp lệ!");
        return;
      }
    } else if (identifier.startsWith("+") || /^\d+$/.test(identifier)) {
      const phoneDigits = identifier.replace(/\D/g, "");
      if (phoneDigits.length < 9 || phoneDigits.length > 11) {
        toast.warning("Số điện thoại không hợp lệ!");
        return;
      }
    } else if (identifier.length < 3) {
      toast.warning("Tên đăng nhập không hợp lệ!");
      return;
    }

    try {
      setIsSubmitting(true);

      // Call auth login API directly (no Supabase) — đăng nhập bằng email HOẶC SĐT
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        emailOrPhone: identifier,
        password: formData.password,
      });

      const data = response.data;
      const content = data.content;

      // BE chặn đăng nhập khi SĐT chưa xác thực → trả 200 kèm requiresPhoneVerification.
      // Đưa sang trang nhập OTP và tự gửi lại mã mới (OTP đăng ký có thể đã hết hạn).
      if (content?.requiresPhoneVerification) {
        const phone = content.phone || formData.phone;
        toast.info("Số điện thoại chưa được xác thực. Vui lòng nhập mã OTP để hoàn tất.");
        navigate(`/verify-phone?phone=${encodeURIComponent(phone)}`, {
          state: { autoResend: true },
        });
        return;
      }

      const token = content?.token;
      const refreshToken = content?.refreshToken;

      if (!token) {
        throw new Error("Không nhận được token từ server");
      }

      // Hoàn tất đăng nhập (admin được chặn bên trong finishLogin).
      const loggedIn = finishLogin(token, refreshToken);

      // Chỉ ghi nhớ SĐT khi đăng nhập user-facing thành công.
      if (loggedIn) {
        if (rememberMe) {
          localStorage.setItem(REMEMBERED_PHONE_KEY, identifier);
        } else {
          localStorage.removeItem(REMEMBERED_PHONE_KEY);
        }
      }
    } catch (error: any) {
      console.error("Login Error:", error);

      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.content ||
        error.message ||
        "Đăng nhập thất bại";

      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-form relative">
      {/* --- NỘI DUNG FORM CHÍNH --- */}
      <div className="login-form__header animate-fade-in-up">
        <h1 className="login-form__title">Chào mừng trở lại</h1>
      </div>

      <div className="login-form__body">
        <form onSubmit={handleSubmit} className="login-form__form">
          <div className="animate-fade-in-up delay-100">
            <InputGroup
              id="phone"
              name="phone"
              type="text"
              label="Số điện thoại, email hoặc tên đăng nhập"
              placeholder="090..., email@example.com hoặc tên đăng nhập"
              icon="phone"
              value={formData.phone}
              onChange={handleChange}
              disabled={isSubmitting}
              autoComplete="username"
            />
          </div>

          <div className="animate-fade-in-up delay-200">
            <InputGroup
              id="password"
              name="password"
              type="password"
              label="Mật khẩu"
              placeholder="••••••••"
              icon="lock"
              value={formData.password}
              onChange={handleChange}
              showPasswordToggle={true}
              disabled={isSubmitting}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', marginLeft: '5px' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isSubmitting}
                  style={{ width: '16px', height: '16px', accentColor: '#1a2238', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', color: '#555', fontWeight: 500 }}>Ghi nhớ đăng nhập</span>
              </label>
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(true)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                disabled={isSubmitting}
              >
                Quên mật khẩu?
              </button>
            </div>
          </div>

          <div className="login-form__submit animate-fade-in-up delay-300">
            <button
              type="submit"
              className="login-form__button"
              disabled={isSubmitting}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                opacity: isSubmitting ? 0.7 : 1,
                cursor: isSubmitting ? "not-allowed" : "pointer",
              }}
            >
              {isSubmitting && (
                <svg
                  className="animate-spin"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </div>

          {/* Divider "hoặc" */}
          <div
            className="animate-fade-in-up delay-300"
            style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}
          >
            <span style={{ flex: 1, height: 1, background: 'rgba(26,34,56,0.12)' }} />
            <span style={{ fontSize: 12, color: 'rgba(26,34,56,0.45)', fontWeight: 500 }}>HOẶC</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(26,34,56,0.12)' }} />
          </div>

          <div className="login-form__social animate-fade-in-up delay-300">
            <GoogleSignInButton onCredential={handleGoogleCredential} disabled={isSubmitting} />
            <ZaloSignInButton disabled={isSubmitting} />
          </div>

          <div className="login-form__register animate-fade-in-up delay-300">
            <p>
              Chưa có tài khoản?{" "}
              <Link to="/register" className="login-form__register-link">
                Đăng ký ngay
              </Link>
            </p>
          </div>
        </form>
      </div>
      <div className="login-form__accent"></div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
      />
    </div>
  );
};

export default LoginForm;

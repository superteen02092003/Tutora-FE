/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/SocialRegister/SocialRegisterPage.tsx
// Hoàn tất đăng ký sau khi đăng nhập Google (BE yêu cầu role + SĐT + xác thực OTP).
//   B1 (collect): chọn vai trò (nếu cần) + nhập SĐT  → POST /auth/social/complete-registration
//   B2 (otp):     nhập OTP                            → POST /auth/social/verify-phone → JWT
// socialRegistrationToken được sinh từ POST /auth/google, sống 15' và đi xuyên suốt 2 bước.
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import {
  completeSocialRegistration,
  verifySocialPhoneOtp,
  resendSocialPhoneOtp,
  saveUserToStorage,
  getRoleFromToken,
} from "../../services/auth.service";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import PolicyConsent from "../../components/PolicyConsent";
import styles from "../../styles/pages/reset-password.module.css";

const RESEND_COOLDOWN = 60; // giây
const SS_KEY = "tutora_social_reg"; // sessionStorage: sống sót khi refresh giữa luồng

type Step = "collect" | "otp";

interface SocialState {
  socialRegistrationToken: string;
  email?: string;
  phone?: string;
  requiresRoleSelection?: boolean;
}

const ROLE_OPTIONS = [
  { value: "Student", label: "Học sinh" },
  { value: "Parent", label: "Phụ huynh" },
  { value: "Tutor", label: "Gia sư" },
];

const portalPathFromRole = (role: string): string => {
  switch (role) {
    case "admin": return "/admin-portal/dashboard";
    case "tutor": return "/tutor-portal/dashboard";
    case "parent": return "/parent-portal/dashboard";
    case "student": return "/student-portal/dashboard";
    default: return "/";
  }
};

const ArrowLeftIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const SocialRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Lấy dữ liệu phiên: ưu tiên navigation state, fallback sessionStorage (chịu được refresh).
  const initial = useMemo<SocialState | null>(() => {
    const fromState = location.state as SocialState | null;
    if (fromState?.socialRegistrationToken) return fromState;
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      if (raw) return JSON.parse(raw) as SocialState;
    } catch {
      /* ignore */
    }
    return null;
  }, [location.state]);

  const [token] = useState(initial?.socialRegistrationToken || "");
  // TẠM GỠ cùng các thay đổi Zalo phía BE (xem SocialRegistrationService.BeginAsync).
  //  // BE không còn hỏi vai trò ngay ở bước đổi code, vì lúc đó nó mới chỉ tra được theo
  //  // zalo_user_id — khoá đã chứng minh là không ổn định. Vai trò chỉ được hỏi sau khi số
  //  // điện thoại cho thấy đúng là người mới, nên cờ này phải là state để nhận cập nhật đó.
  //  const [needRole, setNeedRole] = useState(initial?.requiresRoleSelection ?? false);
  const needRole = initial?.requiresRoleSelection ?? false;

  const [step, setStep] = useState<Step>("collect");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [otp, setOtp] = useState("");
  // Đăng ký qua mạng xã hội không đi qua RegisterForm nên phải hỏi đồng ý ở đây,
  // nếu không sẽ có người tạo được tài khoản mà chưa từng thấy điều khoản.
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Thiếu token (vào thẳng URL hoặc phiên mất) → quay lại đăng nhập.
  useEffect(() => {
    if (!token) {
      toast.warning("Phiên đăng ký đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.");
      navigate("/login", { replace: true });
      return;
    }
    // Lưu lại để chịu được refresh giữa chừng.
    try {
      sessionStorage.setItem(SS_KEY, JSON.stringify(initial));
    } catch {
      /* ignore */
    }
  }, [token, initial, navigate]);

  // Đếm ngược nút "Gửi lại mã".
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const clearSession = () => {
    try {
      sessionStorage.removeItem(SS_KEY);
    } catch {
      /* ignore */
    }
  };

  // Một số lỗi BE đồng nghĩa phiên không còn dùng được → đưa về đăng nhập.
  const handleFatal = (message: string) => {
    toast.error(message);
    clearSession();
    setTimeout(() => navigate("/login", { replace: true }), 1500);
  };

  // --- B1: gửi role + SĐT, BE gửi OTP ---
  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();

    if (needRole && !role) {
      toast.warning("Vui lòng chọn vai trò của bạn (Học sinh / Phụ huynh / Gia sư).");
      return;
    }
    if (!/^\+?\d{9,15}$/.test(phone.trim())) {
      toast.warning("Số điện thoại không hợp lệ!");
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await completeSocialRegistration(token, phone.trim(), needRole ? role : undefined);
      const content = data?.content;
      if (content?.requiresPhoneVerification) {
        toast.success("Mã OTP đã được gửi tới số điện thoại của bạn.");
        setStep("otp");
        setCooldown(RESEND_COOLDOWN);
        return;
      }
      // Không kỳ vọng rơi vào đây — coi như cần thử lại.
      toast.error(data?.message || "Không thể gửi mã OTP. Vui lòng thử lại.");
    } catch (error: any) {
      const message = error.response?.data?.message || "Có lỗi xảy ra. Vui lòng thử lại.";
      if (message.includes("Phiên đăng ký")) {
        handleFatal(message);
        return;
      }
      // TẠM GỠ — chỉ có tác dụng khi BE hoãn hỏi vai trò sang bước này.
      //  // SĐT không thuộc về tài khoản nào → đây thật sự là người mới, và giờ BE mới hỏi vai trò.
      //  // Giữ nguyên SĐT vừa nhập để người dùng chỉ phải bổ sung phần còn thiếu.
      //  if (error.response?.data?.content?.requiresRoleSelection) {
      //    setNeedRole(true);
      //    toast.warning(message);
      //    return;
      //  }
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- B2: xác thực OTP → nhận JWT ---
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.replace(/\D/g, "");
    if (code.length !== 6) {
      toast.warning("Vui lòng nhập đủ 6 chữ số mã OTP.");
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await verifySocialPhoneOtp(token, code);
      const accessToken = data?.content?.token;
      const refreshToken = data?.content?.refreshToken;
      if (!accessToken) throw new Error("Không nhận được token từ server");

      await saveUserToStorage({ accessToken, refreshToken });
      window.dispatchEvent(new Event("auth-change"));
      clearSession();

      const userRole = (getRoleFromToken(accessToken) || "").toLowerCase();
      toast.success("Xác thực thành công! Chào mừng bạn đến với TopTutor.");
      setTimeout(() => navigate(portalPathFromRole(userRole), { replace: true }), 1200);
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || "Xác thực thất bại.";
      if (message.includes("Phiên đăng ký")) {
        handleFatal(message);
        return;
      }
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    try {
      setIsResending(true);
      await resendSocialPhoneOtp(token);
      toast.success("Đã gửi lại mã xác thực. Vui lòng kiểm tra tin nhắn SMS.");
      setCooldown(RESEND_COOLDOWN);
    } catch (error: any) {
      const message = error.response?.data?.message || "Không gửi lại được mã. Vui lòng thử lại.";
      if (message.includes("Phiên đăng ký")) {
        handleFatal(message);
        return;
      }
      toast.error(message);
    } finally {
      setIsResending(false);
    }
  };

  if (!token) return null;

  return (
    <div className={styles.page}>
      <Header />

      <div className={styles.container}>
        <div className={styles.wrapper}>
          <div className={styles.card}>
            <div className={styles.cardContent}>
              {step === "collect" ? (
                <>
                  <h1 className={styles.title}>Hoàn tất đăng ký</h1>
                  <p className={styles.description}>
                    {initial?.email ? (
                      <>
                        Tài khoản <strong>{initial.email}</strong> cần bổ sung thông tin để tiếp tục.
                      </>
                    ) : (
                      "Vui lòng bổ sung thông tin để hoàn tất tài khoản."
                    )}
                  </p>

                  <form onSubmit={handleComplete}>
                    {needRole && (
                      <div className={styles.fieldGroup}>
                        <label className={styles.label}>Bạn là</label>
                        <div style={{ display: "flex", gap: 10 }}>
                          {ROLE_OPTIONS.map((opt) => {
                            const active = role === opt.value;
                            return (
                              <button
                                type="button"
                                key={opt.value}
                                onClick={() => setRole(opt.value)}
                                style={{
                                  flex: 1,
                                  padding: "12px 6px",
                                  borderRadius: 14,
                                  border: `2px solid ${active ? "#3d4a3e" : "rgba(26,34,56,0.12)"}`,
                                  background: active ? "rgba(61,74,62,0.08)" : "#faf9f6",
                                  color: active ? "#3d4a3e" : "#1a2238",
                                  fontWeight: 600,
                                  fontSize: 14,
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                }}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className={styles.fieldGroupLast}>
                      <label htmlFor="social-phone" className={styles.label}>Số điện thoại</label>
                      <div className={styles.inputWrapper}>
                        <input
                          id="social-phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, ""))}
                          placeholder="090..."
                          className={styles.input}
                          style={{ paddingLeft: 16 }}
                        />
                      </div>
                    </div>

                    <PolicyConsent
                      checked={agreedToPolicy}
                      onChange={setAgreedToPolicy}
                      docs={["terms", "privacy"]}
                      disabled={isSubmitting}
                      className={styles.policyConsent}
                    />

                    <button
                      type="submit"
                      disabled={isSubmitting || !agreedToPolicy}
                      className={styles.btnPrimary}
                    >
                      {isSubmitting ? "Đang gửi mã..." : "Tiếp tục"}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <h1 className={styles.title}>Xác thực số điện thoại</h1>
                  <p className={styles.description}>
                    Nhập mã OTP gồm 6 chữ số đã được gửi tới <strong>{phone}</strong>
                  </p>

                  <form onSubmit={handleVerify}>
                    <div className={styles.fieldGroupLast}>
                      <label htmlFor="social-otp" className={styles.label}>Mã xác thực (OTP)</label>
                      <div className={styles.inputWrapper}>
                        <input
                          id="social-otp"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="______"
                          className={styles.input}
                          style={{ paddingLeft: 16, letterSpacing: "0.5em", textAlign: "center", fontSize: 20, fontWeight: 700 }}
                        />
                      </div>
                    </div>

                    <button type="submit" disabled={isSubmitting} className={styles.btnPrimary}>
                      {isSubmitting ? "Đang xác thực..." : "Xác nhận"}
                    </button>

                    <div style={{ textAlign: "center", marginTop: 12, marginBottom: 4 }}>
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={cooldown > 0 || isResending}
                        className={styles.backLink}
                      >
                        {cooldown > 0
                          ? `Gửi lại mã sau ${cooldown}s`
                          : isResending
                            ? "Đang gửi..."
                            : "Gửi lại mã"}
                      </button>
                    </div>
                  </form>
                </>
              )}

              <div style={{ textAlign: "center", marginTop: step === "collect" ? 16 : 0 }}>
                <button
                  type="button"
                  onClick={() => {
                    clearSession();
                    navigate("/login");
                  }}
                  className={styles.backLink}
                >
                  <ArrowLeftIcon /> Quay lại đăng nhập
                </button>
              </div>
            </div>

            <div className={styles.accentBar} />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default SocialRegisterPage;

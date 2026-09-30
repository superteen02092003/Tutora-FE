import React, { useId } from 'react';
import { Link } from 'react-router-dom';
import { POLICY_LABELS, POLICY_SLUGS, policyPath, type PolicySlug } from '../../constants/policy';
import { isZaloMiniApp } from '../../services/zalo-env';
import styles from './PolicyConsent.module.css';

export interface PolicyConsentProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Văn bản cần dẫn link, theo thứ tự hiển thị. Mặc định: điều khoản + bảo mật. */
  docs?: PolicySlug[];
  /** Câu dẫn trước danh sách văn bản. Đổi theo ngữ cảnh, vd "Tôi đã đọc và đồng ý với". */
  leadText?: string;
  /** Dòng phụ dưới nhãn — nơi nhắc điều khoản đắt giá nhất của luồng đó. */
  hint?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

const DEFAULT_DOCS: PolicySlug[] = [POLICY_SLUGS.terms, POLICY_SLUGS.privacy];

/**
 * Ô tick "đồng ý với chính sách" dùng chung cho mọi luồng cần xác nhận (đăng ký, đặt lịch,
 * thanh toán, rút tiền, hoàn tất hồ sơ gia sư).
 *
 * Link mở tab mới trên web để người dùng đọc mà không mất dữ liệu form đang nhập dở —
 * mất nguyên form đặt lịch chỉ vì bấm xem điều khoản là lỗi UX đắt hơn nhiều so với việc
 * mở thêm một tab. Trong Zalo Mini App không có khái niệm tab nên điều hướng tại chỗ,
 * người dùng bấm back để quay lại.
 *
 * Component chỉ quản lý phần hiển thị và trạng thái tick — việc chặn submit do phía gọi
 * quyết định (thường là `disabled={... || !agreed}` trên nút chính).
 */
const PolicyConsent: React.FC<PolicyConsentProps> = ({
  checked,
  onChange,
  docs = DEFAULT_DOCS,
  leadText = 'Tôi đã đọc và đồng ý với',
  hint,
  disabled = false,
  className,
}) => {
  // useId để nhiều ô tick trên cùng một trang không đụng id — label bấm vào vẫn đúng ô.
  const inputId = useId();
  const openInNewTab = !isZaloMiniApp();

  return (
    <div className={`${styles.wrap} ${className || ''}`}>
      <input
        id={inputId}
        type="checkbox"
        className={styles.checkbox}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <div className={styles.textCol}>
        <label htmlFor={inputId} className={styles.label}>
          {leadText}{' '}
          {docs.map((slug, index) => (
            <React.Fragment key={slug}>
              {index > 0 && (index === docs.length - 1 ? ' và ' : ', ')}
              <Link
                to={policyPath(slug)}
                className={styles.link}
                {...(openInNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {POLICY_LABELS[slug]}
              </Link>
            </React.Fragment>
          ))}{' '}
          của TopTutor.
        </label>
        {hint && <p className={styles.hint}>{hint}</p>}
      </div>
    </div>
  );
};

export default PolicyConsent;

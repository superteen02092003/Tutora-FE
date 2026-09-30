import React, { useState } from 'react';
import { Button, Card, Empty } from 'antd';
import { BankOutlined, CalendarOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { maskBankAccount } from '../../utils/formatters';
import { getBankCardTheme } from '../../utils/bankTheme';
import { useBankBrand } from '../../hooks/useBankBrand';
import BankCardArtwork from './BankCardArtwork';
import { BankCardChip, ContactlessGlyph } from './BankCardChip';
import type { BankAccount } from '../../services/bankAccount.service';

interface Props {
  bankInfo: BankAccount | null;
  loading: boolean;
  onEdit: () => void;
  /** Mở modal xác nhận xoá (xác thực OTP trước khi xoá thật) — xem BankAccountDeleteModal. */
  onDeleteClick?: () => void;
}

/**
 * Khối "tài khoản nhận tiền" dùng chung cho cả ba portal (gia sư / phụ huynh / học sinh — cả
 * ba route bank-account đều render component này), nên mọi thay đổi ở đây áp dụng đồng loạt.
 *
 * Mặt thẻ mô phỏng thẻ vật lý của chính ngân hàng đã chọn: màu + hoạ tiết theo thương hiệu
 * (bankTheme.ts + BankCardArtwork), logo thật lấy từ API danh sách ngân hàng (useBankBrand),
 * chip EMV và contactless (BankCardChip). Không nhận ra ngân hàng → bộ mặc định navy + vàng.
 */
const BankAccountCard: React.FC<Props> = ({ bankInfo, loading, onEdit, onDeleteClick }) => {
  const hasBankInfo = Boolean(bankInfo?.bankName && bankInfo?.accountNumber && bankInfo?.accountHolderName);

  // Hook phải chạy trước mọi nhánh return sớm bên dưới (loading / chưa có tài khoản).
  const brand = useBankBrand(hasBankInfo ? bankInfo?.bankName : null);
  const logoUrl = brand?.logoUrl ?? null;

  // Logo tải từ CDN ngoài (VietQR) nên có thể lỗi. Lưu chính URL đã lỗi (không phải cờ boolean)
  // để khi đổi ngân hàng thì URL mới tự động được thử lại, không cần effect reset.
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);

  if (loading) {
    return <Card className="finance-surface finance-bank-info-card" loading />;
  }

  if (!hasBankInfo) {
    return (
      <section className="finance-surface finance-bank-info-card finance-bank-empty">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div className="finance-empty-copy">
              <strong>Chưa có tài khoản nhận tiền</strong>
              <span>Thêm tài khoản ngân hàng trước khi tạo yêu cầu rút tiền.</span>
            </div>
          }
        >
          <Button
            type="primary"
            size="large"
            className="finance-primary-action"
            icon={<BankOutlined />}
            onClick={onEdit}
          >
            Thêm tài khoản
          </Button>
        </Empty>
      </section>
    );
  }

  const changedDate = bankInfo?.bankChangedAt
    ? new Date(bankInfo.bankChangedAt).toLocaleDateString('vi-VN')
    : 'Chưa ghi nhận';

  const theme = getBankCardTheme(bankInfo?.bankName);
  const themeStyle = {
    '--bank-from': theme.from,
    '--bank-to': theme.to,
    '--bank-glow': theme.glow,
    '--bank-accent': theme.accent,
    '--bank-shadow': theme.shadow,
  } as React.CSSProperties;

  // Góc trên-phải là chỗ nhận diện ngân hàng, giống thẻ thật: có logo thì hiện logo, không thì
  // hiện tên ngân hàng dạng chữ. Tên ngân hàng vì vậy LUÔN xuất hiện đúng một lần trên thẻ —
  // dạng chữ ở góc trên khi thiếu logo, hoặc ở góc dưới-phải khi logo đã chiếm góc trên.
  const showLogo = Boolean(logoUrl) && failedLogoUrl !== logoUrl;
  const bankName = bankInfo?.bankName ?? '';

  return (
    <section className="finance-surface finance-bank-info-card">
      <div className="finance-card-heading">
        <div>
          <span className="finance-card-heading__icon" aria-hidden="true">
            <BankOutlined />
          </span>
          <div>
            <h2>Tài khoản nhận tiền</h2>
            <p>Được sử dụng cho mọi yêu cầu rút tiền</p>
          </div>
        </div>
        <div className="finance-card-heading__actions">
          <Button icon={<EditOutlined />} onClick={onEdit}>
            Thay đổi
          </Button>
          {onDeleteClick && (
            <Button danger icon={<DeleteOutlined />} onClick={onDeleteClick}>
              Xoá
            </Button>
          )}
        </div>
      </div>

      <div className="finance-bank-visual" style={themeStyle} aria-label="Thông tin tài khoản ngân hàng">
        <BankCardArtwork motif={theme.motif} />

        <div className="finance-bank-visual__top">
          <span className="finance-bank-visual__label">TOPTUTOR PAYOUT</span>
          {showLogo ? (
            <span className="finance-bank-visual__logo">
              <img src={logoUrl!} alt={bankName} loading="lazy" onError={() => setFailedLogoUrl(logoUrl)} />
            </span>
          ) : (
            <span className="finance-bank-visual__wordmark">{bankName}</span>
          )}
        </div>

        <div className="finance-bank-visual__emv">
          <BankCardChip />
          <ContactlessGlyph />
        </div>

        <div className="finance-bank-visual__number">{maskBankAccount(bankInfo?.accountNumber || '')}</div>

        <div className="finance-bank-visual__bottom">
          <div className="finance-bank-visual__holder">
            <span>Chủ tài khoản</span>
            <strong>{bankInfo?.accountHolderName}</strong>
          </div>
          {showLogo && <span className="finance-bank-visual__brand">{bankName}</span>}
        </div>
      </div>

      <div className="finance-bank-meta">
        <CalendarOutlined aria-hidden="true" />
        <span>Cập nhật gần nhất</span>
        <strong>{changedDate}</strong>
      </div>
    </section>
  );
};

export default BankAccountCard;

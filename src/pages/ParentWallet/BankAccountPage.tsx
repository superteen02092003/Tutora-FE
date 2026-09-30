import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from 'antd';
import { toast } from 'react-toastify';
import {
  getBankAccount,
  getBankAccountHistory,
  type BankAccount,
  type BankAccountAuditLogItem,
} from '../../services/bankAccount.service';
import { takePendingRedirect } from '../../services/auth.service';
import { formatDateTime, maskBankAccount } from '../../utils/formatters';
import BankAccountCard from '../../components/BankAccount/BankAccountCard';
import BankAccountForm from '../../components/BankAccount/BankAccountForm';
import BankAccountDeleteModal from '../../components/BankAccount/BankAccountDeleteModal';
import FinanceShell from './components/FinanceShell';
import '../../styles/pages/tutor-finance.css';
import { getApiErrorMessage } from '../../utils/apiError';

const ACTION_LABEL: Record<BankAccountAuditLogItem['action'], string> = {
  created: 'Thêm tài khoản',
  updated: 'Cập nhật tài khoản',
  deleted: 'Xoá tài khoản',
};

/**
 * Quản lý tài khoản ngân hàng cho Parent/Student — dùng chung 1 component cho cả 2 role (đăng ký
 * ở cả /parent-portal/wallet/bank-account và /student-portal/wallet/bank-account trong App.tsx),
 * cùng cách StudentWallet tái dùng nguyên component của ParentWallet. Mọi lưu/xoá đều qua OTP —
 * xem BankAccountForm/BankAccountDeleteModal.
 */
const BankAccountPage = () => {
  const navigate = useNavigate();
  const [bankInfo, setBankInfo] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [history, setHistory] = useState<BankAccountAuditLogItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchBankInfo = useCallback(async () => {
    setLoading(true);
    try {
      const info = await getBankAccount();
      setBankInfo(info);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể tải thông tin tài khoản ngân hàng.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const items = await getBankAccountHistory();
      setHistory(items);
    } catch {
      // Lịch sử chỉ mang tính tham khảo — lỗi tải không chặn phần quản lý tài khoản chính.
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBankInfo();
    void fetchHistory();
  }, [fetchBankInfo, fetchHistory]);

  const handleUpdateSuccess = () => {
    setIsEditModalOpen(false);
    void fetchBankInfo();
    void fetchHistory();

    // Đến đây từ WithdrawModal (chưa có tài khoản, bị dẫn sang lưu trước) → quay lại đúng chỗ cũ
    // (trang ví) để tiếp tục rút tiền, thay vì ở lại trang quản lý tài khoản ngân hàng.
    void takePendingRedirect().then((path) => {
      if (path) navigate(path);
    });
  };

  const handleDeleteSuccess = () => {
    setIsDeleteModalOpen(false);
    void fetchBankInfo();
    void fetchHistory();
  };

  return (
    <FinanceShell
      title="Tài khoản ngân hàng"
      titleInfo="Quản lý tài khoản nhận tiền khi bạn tạo yêu cầu rút tiền từ TopTutor."
    >
      <div className="finance-bank-layout">
        <BankAccountCard
          bankInfo={bankInfo}
          loading={loading}
          onEdit={() => setIsEditModalOpen(true)}
          onDeleteClick={() => setIsDeleteModalOpen(true)}
        />
      </div>

      <section className="finance-surface" style={{ marginTop: 24, padding: 24 }}>
        <h2 style={{ marginTop: 0 }}>Lịch sử thay đổi</h2>
        {historyLoading ? (
          <p>Đang tải...</p>
        ) : history.length === 0 ? (
          <p>Chưa có thay đổi nào.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {history.map((item, index) => (
              <li
                key={index}
                style={{
                  padding: '14px 0',
                  borderTop: index === 0 ? undefined : '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <strong>{ACTION_LABEL[item.action]}</strong>
                  <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13 }}>{formatDateTime(item.changedAt)}</span>
                </div>
                {item.action === 'deleted' ? (
                  <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.6)', marginTop: 4 }}>
                    {item.oldBankName} — {maskBankAccount(item.oldAccountNumber || '')}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.6)', marginTop: 4 }}>
                    {item.newBankName} — {maskBankAccount(item.newAccountNumber || '')} ({item.newAccountHolderName})
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        className="finance-modal"
        title={bankInfo?.bankName ? 'Cập nhật tài khoản ngân hàng' : 'Thêm tài khoản ngân hàng'}
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        footer={null}
        destroyOnHidden
        centered
        width={620}
      >
        <BankAccountForm bankInfo={bankInfo} onSuccess={handleUpdateSuccess} onCancel={() => setIsEditModalOpen(false)} />
      </Modal>

      <BankAccountDeleteModal
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onSuccess={handleDeleteSuccess}
      />
    </FinanceShell>
  );
};

export default BankAccountPage;

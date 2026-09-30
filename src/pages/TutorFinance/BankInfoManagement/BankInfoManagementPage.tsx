import React, { useEffect, useState } from 'react';
import { Modal } from 'antd';
import { CheckCircleFilled, InfoCircleOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { toast } from 'react-toastify';
import { getApiErrorMessage } from '../../../utils/apiError';
import { getBankAccount, type BankAccount } from '../../../services/bankAccount.service';
import { DEFAULT_MIN_WITHDRAWAL, getMinWithdrawalAmount } from '../../../services/withdrawalLimit.service';
import { formatCurrency } from '../../../utils/formatters';
import FinancePageShell from '../components/FinancePageShell';
import BankAccountCard from '../../../components/BankAccount/BankAccountCard';
import BankAccountForm from '../../../components/BankAccount/BankAccountForm';
import BankAccountDeleteModal from '../../../components/BankAccount/BankAccountDeleteModal';
import '../../../styles/pages/tutor-finance.css';

const BankInfoManagementPage: React.FC = () => {
  const [bankInfo, setBankInfo] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  // Lấy từ API thay vì ghi cứng: ngưỡng này do admin cấu hình, hardcode ở đây sẽ lệch với mức
  // backend thực sự chặn (trước đó ghi 10,000 VND trong khi hệ thống đang áp dụng 50,000 VND).
  const [minWithdraw, setMinWithdraw] = useState(DEFAULT_MIN_WITHDRAWAL);

  const fetchData = async () => {
    setLoading(true);
    try {
      const info = await getBankAccount();
      setBankInfo(info);
    } catch (error) {
      console.error('Failed to fetch bank info:', error);
      toast.error(getApiErrorMessage(error, 'Không thể tải thông tin tài khoản ngân hàng'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // getMinWithdrawalAmount không bao giờ throw, hỏng API thì rơi về DEFAULT_MIN_WITHDRAWAL.
    getMinWithdrawalAmount().then(setMinWithdraw);
  }, []);

  const handleUpdateSuccess = () => {
    setIsEditModalOpen(false);
    fetchData();
  };

  const handleDeleteSuccess = () => {
    setIsDeleteModalOpen(false);
    fetchData();
  };

  return (
    <FinancePageShell
      title="Tài khoản ngân hàng"
      titleInfo="Quản lý tài khoản nhận tiền khi yêu cầu rút thu nhập từ TopTutor."
    >
      <div className="finance-bank-layout">
        <BankAccountCard
          bankInfo={bankInfo}
          loading={loading}
          onEdit={() => setIsEditModalOpen(true)}
          onDeleteClick={() => setIsDeleteModalOpen(true)}
        />

        <aside className="finance-surface finance-policy-card">
          <div className="finance-policy-card__header">
            <span className="finance-policy-card__icon" aria-hidden="true">
              <InfoCircleOutlined />
            </span>
            <div>
              <h2>Chính sách thanh toán</h2>
              <p>Những điều cần biết trước khi rút tiền</p>
            </div>
          </div>

          <ul className="finance-policy-list">
            <li>
              <CheckCircleFilled aria-hidden="true" />
              <span>Tiền được chuyển vào đúng tài khoản bạn đăng ký tại trang này.</span>
            </li>
            <li>
              <CheckCircleFilled aria-hidden="true" />
              <span>Yêu cầu được admin/staff xét duyệt và chuyển khoản trong vòng 24 giờ.</span>
            </li>
            <li>
              <CheckCircleFilled aria-hidden="true" />
              <span>Số tiền rút tối thiểu là {formatCurrency(minWithdraw)} cho mỗi giao dịch.</span>
            </li>
            <li>
              <CheckCircleFilled aria-hidden="true" />
              <span>Mỗi thời điểm chỉ có một yêu cầu rút tiền đang được xử lý.</span>
            </li>
          </ul>

          <div className="finance-security-note">
            <SafetyCertificateOutlined aria-hidden="true" />
            <div>
              <strong>Mọi thay đổi đều cần xác thực OTP</strong>
              <span>Bảo vệ bạn khỏi bị đổi tài khoản nhận tiền nếu chẳng may lộ tài khoản đăng nhập.</span>
            </div>
          </div>
        </aside>
      </div>

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
    </FinancePageShell>
  );
};

export default BankInfoManagementPage;

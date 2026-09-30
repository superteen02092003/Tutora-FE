import React from 'react';
import { Card, Tooltip } from 'antd';
import {
  CalendarOutlined,
  DollarCircleOutlined,
  InfoCircleOutlined,
  LockOutlined,
  RiseOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { formatCurrency, formatDate, formatDateTime } from '../../../../utils/formatters';
import type { FinanceSummary } from '../../../../types/finance.types';

interface Props {
  summary: FinanceSummary | null;
  loading: boolean;
}

interface MetricItem {
  key: string;
  label: string;
  value: string;
  note: string;
  tooltip: string;
  icon: React.ReactNode;
  tone: string;
  details?: { label: string; value: string }[];
}

const FinanceOverviewCards: React.FC<Props> = ({ summary, loading }) => {
  const metrics: MetricItem[] = [
    {
      key: 'total',
      label: 'Tổng số dư',
      value: formatCurrency(summary?.totalBalance ?? 0),
      note: 'Bao gồm số dư khả dụng và đang tạm giữ',
      tooltip: 'Tổng giá trị hiện có trong ví, gồm số tiền có thể rút và số tiền đang tạm giữ',
      icon: <DollarCircleOutlined />,
      tone: 'navy',
    },
    {
      key: 'frozen',
      label: 'Tiền học được bảo đảm',
      value: formatCurrency(summary?.frozenBalance ?? 0),
      note: '',
      tooltip: 'Tổng tiền phụ huynh đã thanh toán và hệ thống đang giữ để bảo đảm cho các buổi học',
      icon: <LockOutlined />,
      tone: 'burgundy',
      details: [
        {
          label: 'Trong đó chờ vào số dư',
          value: formatCurrency(summary?.pendingSettlement ?? 0),
        },
        ...(summary?.hasActiveDispute
          ? [
              {
                label: 'Đang bị giữ do có tranh chấp',
                value: formatCurrency(summary?.disputedAmount ?? 0),
              },
            ]
          : []),
      ],
    },
    {
      key: 'earned',
      label: 'Tổng thu nhập',
      value: formatCurrency(summary?.totalEarned ?? 0),
      note: 'Tổng tích lũy từ trước đến nay',
      tooltip: 'Tổng số tiền bạn đã kiếm được trên TopTutor',
      icon: <RiseOutlined />,
      tone: 'green',
    },
    {
      key: 'last-withdrawal',
      label: 'Lần rút gần nhất',
      value: summary?.lastWithdrawalAt ? formatDateTime(summary.lastWithdrawalAt) : 'Chưa có',
      note: summary?.lastWithdrawalAt ? 'Thời điểm gửi yêu cầu rút tiền gần nhất' : 'Bạn chưa gửi yêu cầu rút tiền',
      tooltip: 'Thời điểm bạn tạo yêu cầu rút tiền gần nhất, không phụ thuộc trạng thái xử lý',
      icon: <CalendarOutlined />,
      tone: 'slate',
    },
  ];

  return (
    <section className="finance-overview-grid" aria-label="Tổng quan số dư" data-tour="finance-overview-cards">
      <Card className="finance-card finance-balance-card" loading={loading}>
        <div className="finance-balance-card__header">
          <div className="finance-balance-card__label">
            <span className="finance-balance-card__icon" aria-hidden="true">
              <WalletOutlined />
            </span>
            <span>Số dư khả dụng</span>
          </div>
          <Tooltip title="Số tiền bạn có thể rút ngay lập tức">
            <InfoCircleOutlined className="finance-info-icon" aria-label="Thông tin số dư khả dụng" />
          </Tooltip>
        </div>

        <div className="finance-balance-card__value">{formatCurrency(summary?.availableBalance ?? 0)}</div>

        <div className="finance-balance-card__footer">
          <span className="finance-live-dot" aria-hidden="true" />
          Cập nhật ngày {formatDate(new Date().toISOString())}
        </div>
      </Card>

      {metrics.map((metric) => (
        <Card
          key={metric.key}
          className={`finance-card finance-metric-card finance-metric-card--${metric.tone}`}
          loading={loading}
        >
          <div className="finance-metric-card__top">
            <span className="finance-metric-card__icon" aria-hidden="true">
              {metric.icon}
            </span>
            <Tooltip title={metric.tooltip}>
              <InfoCircleOutlined className="finance-info-icon" aria-label={`Thông tin ${metric.label}`} />
            </Tooltip>
          </div>
          <span className="finance-metric-card__label">{metric.label}</span>
          <strong className="finance-metric-card__value">{metric.value}</strong>
          {metric.note && <span className="finance-metric-card__note">{metric.note}</span>}
          {metric.details?.map((detail) => (
            <div className="finance-metric-card__breakdown" key={detail.label}>
              <span>{detail.label}</span>
              <strong>{detail.value}</strong>
            </div>
          ))}
        </Card>
      ))}
    </section>
  );
};

export default FinanceOverviewCards;

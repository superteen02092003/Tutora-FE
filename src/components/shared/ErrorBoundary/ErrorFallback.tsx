import React from 'react';
import { Link } from 'react-router-dom';

export interface ErrorFallbackProps {
  error?: Error | null;
  onReset?: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, onReset }) => {
  const isDev = import.meta.env.DEV;

  const handleReload = () => {
    if (onReset) onReset();
    window.location.reload();
  };

  return (
    <div className="error-page">
      <div className="error-container">
        <div className="error-logo">
          <span className="logo-text">TOPTUTOR</span>
        </div>

        <h1 className="error-code">Oops!</h1>
        <div className="error-divider"></div>
        <h2 className="error-title">Đã xảy ra lỗi</h2>

        <p className="error-message">
          Rất tiếc, có sự cố ngoài dự kiến. Vui lòng thử tải lại trang hoặc quay về trang chủ.
        </p>

        {isDev && error && (
          <pre
            style={{
              textAlign: 'left',
              background: '#fff5f5',
              color: '#c53030',
              padding: '12px 16px',
              borderRadius: 8,
              maxWidth: 640,
              margin: '12px auto',
              overflow: 'auto',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
            }}
          >
            {error.name}: {error.message}
            {error.stack ? `\n\n${error.stack}` : null}
          </pre>
        )}

        <div className="error-actions">
          <button onClick={handleReload} className="error-btn-primary">
            Tải lại trang
          </button>
          <Link to="/" className="error-btn-secondary">
            Về trang chủ
          </Link>
        </div>

        <div className="error-footer">
          Cần hỗ trợ? <a href="mailto:support@toptutor.ai" className="error-link">Liên hệ chúng tôi</a>
        </div>
      </div>
    </div>
  );
};

export default ErrorFallback;

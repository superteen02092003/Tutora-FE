import React from "react";
import { Link } from "react-router-dom";

const NotFoundPage: React.FC = () => {
    return (
        <div className="error-page">
            <div className="error-container">
                <div className="error-logo">
                    <span className="logo-text">TOPTUTOR</span>
                </div>

                <h1 className="error-code">404</h1>

                <div className="error-divider"></div>

                <h2 className="error-title">Trang không tìm thấy</h2>

                <p className="error-message">
                    Xin lỗi, trang bạn đang tìm kiếm có thể đã bị xóa, đổi tên hoặc tạm thời không có sẵn.
                </p>

                <div className="error-actions">
                    <Link to="/" className="error-btn-primary">
                        Về trang chủ
                    </Link>
                    <button onClick={() => window.history.back()} className="error-btn-secondary">
                        Quay lại
                    </button>
                </div>

                <div className="error-footer">
                    Cần hỗ trợ? <a href="mailto:support@toptutor.ai" className="error-link">Liên hệ chúng tôi</a>
                </div>
            </div>
        </div>
    );
};

export default NotFoundPage;

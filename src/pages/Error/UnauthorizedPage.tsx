import React from "react";
import { Link } from "react-router-dom";

const UnauthorizedPage: React.FC = () => {
    return (
        <div className="error-page">
            <div className="error-container">
                <div className="error-logo">
                    <span className="logo-text">TOPTUTOR</span>
                </div>

                <h1 className="error-code">401</h1>

                <div className="error-divider"></div>

                <h2 className="error-title">Chưa xác thực</h2>

                <p className="error-message">
                    Bạn cần đăng nhập để truy cập trang này. Vui lòng đăng nhập với tài khoản của bạn.
                </p>

                <div className="error-actions">
                    <Link to="/login" className="error-btn-primary">
                        Đăng nhập ngay
                    </Link>
                    <Link to="/register" className="error-btn-secondary">
                        Tạo tài khoản
                    </Link>
                </div>

                <div className="error-footer">
                    Cần hỗ trợ? <a href="mailto:support@toptutor.ai" className="error-link">Liên hệ chúng tôi</a>
                </div>
            </div>
        </div>
    );
};

export default UnauthorizedPage;

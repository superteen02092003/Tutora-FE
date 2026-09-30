import React from "react";
import { Link } from "react-router-dom";

const ForbiddenPage: React.FC = () => {
    return (
        <div className="error-page">
            <div className="error-container">
                <div className="error-logo">
                    <span className="logo-text">TOPTUTOR</span>
                </div>

                <h1 className="error-code">403</h1>

                <div className="error-divider"></div>

                <h2 className="error-title">Truy cập bị từ chối</h2>

                <p className="error-message">
                    Bạn không có quyền truy cập vào trang này. Vui lòng liên hệ quản trị viên nếu bạn tin rằng đây là một sự nhầm lẫn.
                </p>

                <div className="error-actions">
                    <Link to="/" className="error-btn-primary">
                        Về trang chủ
                    </Link>
                    <Link to="/login" className="error-btn-secondary">
                        Đăng nhập
                    </Link>
                </div>

                <div className="error-footer">
                    Cần hỗ trợ? <a href="mailto:support@toptutor.ai" className="error-link">Liên hệ chúng tôi</a>
                </div>
            </div>
        </div>
    );
};

export default ForbiddenPage;

import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages/error.css';

interface ErrorPageProps {
    errorCode: string;
    title: string;
    message: string;
    actionText: string;
    actionLink: string;
    secondaryActionText?: string;
    secondaryActionLink?: string;
}

const ErrorPage: React.FC<ErrorPageProps> = ({
    errorCode,
    title,
    message,
    actionText,
    actionLink,
    secondaryActionText,
    secondaryActionLink,
}) => {
    const navigate = useNavigate();

    const handleAction = () => {
        navigate(actionLink);
    };

    const handleSecondaryAction = () => {
        if (secondaryActionLink) {
            navigate(secondaryActionLink);
        }
    };

    return (
        <div className="error-page">
            <div className="error-container">
                {/* Logo */}
                <div className="error-logo">
                    <span className="logo-text">TOPTUTOR</span>
                </div>

                {/* Error Code */}
                <div className="error-code">{errorCode}</div>

                {/* Divider */}
                <div className="error-divider"></div>

                {/* Content */}
                <h1 className="error-title">{title}</h1>
                <p className="error-message">{message}</p>

                {/* Actions */}
                <div className="error-actions">
                    <button
                        className="error-btn-primary"
                        onClick={handleAction}
                    >
                        {actionText}
                    </button>
                    {secondaryActionText && secondaryActionLink && (
                        <button
                            className="error-btn-secondary"
                            onClick={handleSecondaryAction}
                        >
                            {secondaryActionText}
                        </button>
                    )}
                </div>

                {/* Footer Text */}
                <p className="error-footer">
                    Nếu bạn cho rằng đây là một lỗi, vui lòng{' '}
                    <a href="mailto:support@toptutor.ai" className="error-link">
                        liên hệ hỗ trợ
                    </a>
                </p>
            </div>
        </div>
    );
};

export default ErrorPage;

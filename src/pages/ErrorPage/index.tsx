import React from 'react';
import ErrorPage from './ErrorPage';

export const NotFoundPage: React.FC = () => (
    <ErrorPage
        errorCode="404"
        title="Không Tìm Thấy Trang"
        message="Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển. Vui lòng kiểm tra lại URL hoặc quay về trang chủ."
        actionText="Về Trang Chủ"
        actionLink="/"
        secondaryActionText="Tìm Gia Sư"
        secondaryActionLink="/tutor-search"
    />
);

export const UnauthorizedPage: React.FC = () => (
    <ErrorPage
        errorCode="401"
        title="Yêu Cầu Đăng Nhập"
        message="Bạn cần đăng nhập để truy cập trang này. Vui lòng đăng nhập hoặc tạo tài khoản mới để tiếp tục."
        actionText="Đăng Nhập"
        actionLink="/login"
        secondaryActionText="Đăng Ký"
        secondaryActionLink="/register"
    />
);

export const ForbiddenPage: React.FC = () => (
    <ErrorPage
        errorCode="403"
        title="Truy Cập Bị Từ Chối"
        message="Bạn không có quyền truy cập trang này. Trang này chỉ dành cho người dùng có vai trò phù hợp trong hệ thống."
        actionText="Về Trang Chủ"
        actionLink="/"
        secondaryActionText="Liên Hệ Hỗ Trợ"
        secondaryActionLink="mailto:support@toptutor.ai"
    />
);

export default ErrorPage;

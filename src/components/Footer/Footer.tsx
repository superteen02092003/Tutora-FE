import { Link } from "react-router-dom";
import { POLICY_LABELS, POLICY_SLUGS, policyPath } from "../../constants/policy";
import "./Footer.css";

const Footer = () => {
    const footerLinks = {
        academic: [
            "Tìm gia sư",
            "Đăng ký dạy kèm",
            "Cách hoạt động",
            "Môn học hỗ trợ",
        ],
        platform: [
            "Theo dõi học tập",
            "Báo cáo tiến độ",
            "Lộ trình cá nhân",
            "Hỗ trợ phụ huynh",
        ],
        resources: [
            "Về chúng tôi",
            "Trở thành Gia sư",
            "Liên hệ hỗ trợ",
            "Câu hỏi thường gặp",
        ],
    };

    return (
        <footer className="footer">
            <div className="footer-container">
                <div className="footer-main">
                    {/* Brand Column */}
                    <div className="footer-brand">
                        <div className="footer-logo">
                            <div className="footer-logo-icon">
                                <img src="/toptutor-logo.png" alt="TopTutor" width="38" height="38" />
                            </div>
                            <span className="footer-logo-text">TOPTUTOR.</span>
                        </div>
                        <p className="footer-tagline">
                            "Kết nối phụ huynh với gia sư uy tín. Minh bạch — Bảo đảm — Tiện lợi."
                        </p>
                    </div>

                    {/* Links Columns */}
                    <div className="footer-links-column">
                        <h4 className="footer-links-title">HỌC THUẬT</h4>
                        <ul className="footer-links">
                            {footerLinks.academic.map((link, index) => (
                                <li key={index}><a href="#">{link}</a></li>
                            ))}
                        </ul>
                    </div>

                    <div className="footer-links-column">
                        <h4 className="footer-links-title">NỀN TẢNG</h4>
                        <ul className="footer-links">
                            {footerLinks.platform.map((link, index) => (
                                <li key={index}><a href="#">{link}</a></li>
                            ))}
                        </ul>
                    </div>

                    <div className="footer-links-column">
                        <h4 className="footer-links-title">TÀI NGUYÊN</h4>
                        <ul className="footer-links">
                            {footerLinks.resources.map((link, index) => (
                                <li key={index}><a href="#">{link}</a></li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Footer Bottom */}
                <div className="footer-bottom">
                    <span className="copyright">© 2026 TopTutor. All Rights Reserved.</span>
                    <div className="footer-legal">
                        <Link to={policyPath(POLICY_SLUGS.about)}>{POLICY_LABELS.about}</Link>
                        <Link to={policyPath(POLICY_SLUGS.privacy)}>{POLICY_LABELS.privacy}</Link>
                        <Link to={policyPath(POLICY_SLUGS.terms)}>{POLICY_LABELS.terms}</Link>
                        <Link to={policyPath(POLICY_SLUGS.cookies)}>{POLICY_LABELS.cookies}</Link>
                        <Link to={policyPath(POLICY_SLUGS.communityGuidelines)}>
                            {POLICY_LABELS['community-guidelines']}
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;

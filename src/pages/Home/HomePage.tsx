import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { isZaloMiniApp } from "../../services/zalo-env";

// Trusted Universities Banner
const TrustedBanner = () => {
    const investors = [
        { name: "Dream-lab.ai", highlight: true },
        { name: "FPT University", highlight: false },
    ];

    // Build one long sequence of items (repeated many times to guarantee filling any viewport)
    const REPEAT_COUNT = 10;
    const items: { name: string; highlight: boolean }[] = [];
    for (let i = 0; i < REPEAT_COUNT; i++) {
        items.push(...investors);
    }

    const renderGroup = (keyPrefix: string) => (
        <div className="trusted-scroll-group" key={keyPrefix} aria-hidden={keyPrefix !== 'a'}>
            {items.map((inv, index) => (
                <span
                    key={`${keyPrefix}-${index}`}
                    className={`university-name ${inv.highlight ? 'highlight' : ''}`}
                >
                    {inv.name}
                </span>
            ))}
        </div>
    );

    return (
        <div className="trusted-banner">
            <div className="trusted-content">
                <div className="trusted-scroll">
                    {renderGroup('a')}
                    {renderGroup('b')}
                </div>
            </div>
        </div>
    );
};

// Hero Section
const HeroSection = () => {
    const navigate = useNavigate();
    const inMiniApp = isZaloMiniApp();
    return (
        <section className="hero-section">
            <div className="hero-container">
                {/* Left Content */}
                <div className="hero-left">
                    <div className="hero-badge">
                        <span className="badge-dot"></span>
                        <span className="badge-text">Gia sư được xác minh hồ sơ & đánh giá sau mỗi buổi học</span>
                    </div>

                    <h1 className="hero-title">
                        <span className="title-line">Tìm gia sư</span>
                        <span className="title-line">
                            <em className="title-accent">phù hợp.</em>
                        </span>
                        <span className="title-line">Theo dõi tiến bộ</span>
                        <span className="title-line">từng buổi.</span>
                    </h1>

                    <p className="hero-description">
                        TopTutor giúp phụ huynh tìm gia sư đã được xác minh, đặt lịch học online, và nhận báo cáo tiến độ sau mỗi buổi — tất cả trên một nền tảng duy nhất.
                    </p>

                    <div className="hero-buttons">
                        <button className="btn-primary" onClick={() => navigate('/tutor-search')}>TÌM GIA SƯ</button>
                        {!inMiniApp && (
                            <button className="btn-secondary" onClick={() => navigate('/register')}>ĐĂNG KÝ DẠY KÈM</button>
                        )}
                    </div>
                </div>

                {/* Right Content — ẩn trong Mini App để tiết kiệm viewport */}
                {!inMiniApp && <div className="hero-right">
                    <div className="hero-image-wrapper">
                        <img
                            src="/students-studying.png"
                            alt="Students studying together"
                            className="hero-image"
                        />
                        <div className="hero-image-gradient"></div>
                        <div className="hero-lms-badge">
                            <span className="lms-title">TopTutor — Theo dõi học tập.</span>
                            <span className="lms-subtitle">Báo cáo tiến độ tự động sau mỗi buổi học.</span>
                        </div>
                    </div>

                    {/* Rating Badge */}
                    <div className="rating-badge">
                        <span className="rating-number">4.9/5</span>
                        <span className="rating-label">Đánh giá trung bình</span>
                    </div>
                </div>}
            </div>
        </section>
    );
};

// Statistics Section
const StatisticsSection = () => {
    const stats = [
        {
            value: "01",
            label: "Xác minh hồ sơ",
            sublabel: "CMND, bằng cấp & phỏng vấn trước khi dạy",
            icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11l3 3L22 4"></path>
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
                </svg>
            )
        },
        {
            value: "02",
            label: "Giữ tiền an toàn",
            sublabel: "Tiền chỉ chuyển sau khi buổi học hoàn tất",
            icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0110 0v4"></path>
                </svg>
            )
        },
        {
            value: "03",
            label: "Báo cáo tự động",
            sublabel: "Phụ huynh nhận báo cáo ngay sau buổi học",
            icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
            )
        },
        {
            value: "04",
            label: "Đổi gia sư dễ dàng",
            sublabel: "Không hài lòng? Đổi mà không mất lịch sử học",
            icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 1l4 4-4 4"></path>
                    <path d="M3 11V9a4 4 0 014-4h14"></path>
                    <path d="M7 23l-4-4 4-4"></path>
                    <path d="M21 13v2a4 4 0 01-4 4H3"></path>
                </svg>
            )
        },
    ];

    return (
        <section className="statistics-section">
            <div className="statistics-glow-bg"></div>
            <div className="statistics-container">
                {/* Left Content */}
                <div className="statistics-left">
                    <div className="security-badge">
                        <span className="security-icon">🛡️</span>
                        <span>An tâm tuyệt đối</span>
                    </div>
                    <h2 className="statistics-title">
                        TOPTUTOR BẢO VỆ<br />
                        CẢ PHỤ HUYNH <span className="title-gold">LẪN GIA SƯ.</span>
                    </h2>
                    <p className="statistics-description">
                        "Cơ chế giữ tiền trung gian, xác minh gia sư, và báo cáo buổi học tự động — được thiết kế để bảo vệ quyền lợi của bạn từ ngày đầu."
                    </p>
                </div>

                {/* Right Content - Stats Grid */}
                <div className="statistics-grid">
                    {stats.map((stat, index) => (
                        <div key={index} className="stat-card">
                            <span className="stat-value">{stat.value}</span>
                            <div className="stat-icon-wrapper">
                                {stat.icon}
                            </div>
                            <div className="stat-content">
                                <span className="stat-label">{stat.label}</span>
                                <span className="stat-sublabel">{stat.sublabel}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

// Features Section (Tutor Benefits)
const FeaturesSection = () => {
    const benefits = [
        "Tự đặt giá, tự chọn lịch — bạn quyết định dạy bao nhiêu giờ/tuần.",
        "Thanh toán bảo đảm qua Escrow — không lo bị quỵt tiền sau buổi dạy.",
        "Công cụ quản lý sẵn sàng — lịch dạy, báo cáo tự động gửi phụ huynh.",
    ];

    return (
        <section className="features-section">
            {/* Left: Cards */}
            <div className="features-cards">
                <div className="feature-column">
                    <div className="feature-card-image">
                        <img src="/collaboration-1.png" alt="Tham gia đội ngũ gia sư" />
                    </div>
                    <div className="feature-card green">
                        <h3 className="feature-card-title">Tham gia đội ngũ gia sư.</h3>
                        <p className="feature-card-description">
                            Nền tảng hỗ trợ đầy đủ để bạn tập trung hoàn toàn vào giảng dạy.
                        </p>
                    </div>
                </div>

                <div className="feature-column offset">
                    <div className="feature-card gold">
                        <h3 className="feature-card-title">Hiệu quả rõ rệt.</h3>
                        <p className="feature-card-description">
                            Giúp học sinh tiến bộ thực sự, và phụ huynh sẽ giới thiệu bạn cho người khác.
                        </p>
                    </div>
                    <div className="feature-card-image">
                        <img src="/collaboration-2.png" alt="Hiệu quả rõ rệt" />
                    </div>
                </div>
            </div>

            {/* Right: Content */}
            <div className="features-content">
                <h2 className="features-title">
                    HÀNG TRĂM<br />
                    PHỤ HUYNH<br />
                    <span className="title-green">ĐANG TÌM.</span><br />
                    HỌ CHỈ THIẾU BẠN.
                </h2>

                <p className="features-description">
                    Hàng trăm phụ huynh đang đăng ký tìm gia sư mỗi tháng. Đăng ký ngay để bắt đầu nhận học sinh và có thu nhập ổn định theo lịch của bạn.
                </p>

                <ul className="benefits-list">
                    {benefits.map((benefit, index) => (
                        <li key={index} className="benefit-item">
                            <span className="benefit-dot">
                                <span className="benefit-dot-inner"></span>
                            </span>
                            <span className="benefit-text">{benefit}</span>
                        </li>
                    ))}
                </ul>

                <button className="btn-apply" onClick={() => window.location.href = '/register'}>ĐĂNG KÝ DẠY KÈM</button>
            </div>
        </section>
    );
};

// FAQ Section
const TestimonialsSection = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const faqs = [
        {
            question: "TopTutor có uy tín không? Mới quá?",
            answer: "TopTutor được đầu tư bởi Dream-lab.ai và FPT University. Chúng tôi sử dụng cơ chế giữ tiền trung gian (Escrow) — tiền của bạn chỉ được chuyển cho gia sư sau khi buổi học hoàn tất.",
            tag: "Về độ tin cậy",
        },
        {
            question: "Gia sư trên TopTutor là ai?",
            answer: "Chủ yếu là sinh viên giỏi tại các trường đại học lớn và giáo viên có kinh nghiệm. Mỗi gia sư đều được xác minh hồ sơ — CMND, bằng cấp và phỏng vấn — trước khi nhận học sinh.",
            tag: "Về gia sư",
        },
        {
            question: "Chi phí học trên TopTutor thế nào?",
            answer: "Giá do gia sư tự đặt. Phụ huynh chỉ trả thêm 5% phí dịch vụ cho TopTutor. Không có phí ẩn, không thu trước khi buổi học diễn ra.",
            tag: "Về chi phí",
        },
        {
            question: "Tôi có thể theo dõi con học không?",
            answer: "Có. Sau mỗi buổi, phụ huynh nhận báo cáo chi tiết: nội dung đã học, bài tập, và nhận xét của gia sư.",
            tag: "Về theo dõi",
        },
        {
            question: "Nếu không hài lòng với gia sư?",
            answer: "Bạn có thể đổi gia sư bất cứ lúc nào. Lịch sử học tập của con được lưu lại đầy đủ, gia sư mới tiếp tục ngay mà không cần bắt đầu lại từ đầu.",
            tag: "Về hỗ trợ",
        },
    ];

    const toggle = (index: number) => {
        setOpenIndex(prev => prev === index ? null : index);
    };

    return (
        <section className="testimonials-section">
            <div className="testimonials-container">
                {/* Header */}
                <div className="testimonials-header">
                    <div className="testimonials-title-group">
                        <span className="testimonials-label">Câu hỏi thường gặp</span>
                        <h2 className="testimonials-title">
                            PHỤ HUYNH<br />THƯỜNG HỎI GÌ?
                        </h2>
                    </div>
                    <p className="testimonials-description">
                        "Những câu hỏi phổ biến nhất từ phụ huynh khi lần đầu tìm hiểu về TopTutor."
                    </p>
                </div>

                {/* FAQ Accordion */}
                <div className="faq-list">
                    {faqs.map((faq, index) => {
                        const isOpen = openIndex === index;
                        return (
                            <div key={index} className={`faq-item${isOpen ? ' open' : ''}`}>
                                <button className="faq-question" onClick={() => toggle(index)}>
                                    <div className="faq-question-left">
                                        <span className="faq-tag">{faq.tag}</span>
                                        <span className="faq-question-text">{faq.question}</span>
                                    </div>
                                    <svg className="faq-chevron" width="20" height="20" viewBox="0 0 20 20" fill="none">
                                        <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                                <div className="faq-answer">
                                    <p className="faq-answer-text">{faq.answer}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

// Main HomePage Component
const HomePage = () => {
    const inMiniApp = isZaloMiniApp();
    return (
        <div className="homepage">
            {!inMiniApp && <Header />}
            <main className="main-content">
                {!inMiniApp && <TrustedBanner />}
                <HeroSection />
                {!inMiniApp && <StatisticsSection />}
                {!inMiniApp && <FeaturesSection />}
                {!inMiniApp && <TestimonialsSection />}
            </main>
            {!inMiniApp && <Footer />}
        </div>
    );
};

export default HomePage;

import { useState, useEffect, useCallback } from 'react';
import type { FeedbackItem } from '../../../services/tutorDetail.service';
import { getTutorFeedbacks, getTutorFeedbackStats, type FeedbackDto, type FeedbackStatsDto } from '../../../services/feedback.service';
import { StarIcon, QuoteIcon } from './icons';

const RatingBar = ({ star, count, percent }: { star: number; count: number; percent: number }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
        <span style={{ minWidth: '12px', color: '#666' }}>{star}</span>
        <StarIcon />
        <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: '#f0ece3' }}>
            <div style={{ width: `${percent}%`, height: '100%', borderRadius: '3px', background: '#D4B483', transition: 'width 0.3s' }} />
        </div>
        <span style={{ minWidth: '28px', textAlign: 'right', color: '#999', fontSize: '11px' }}>{count}</span>
    </div>
);

interface TestimonialsSectionProps {
    feedbacks: FeedbackItem[] | null;
    totalFeedbacks: number;
    tutorId?: string;
}

const TestimonialsSection = ({ feedbacks, totalFeedbacks, tutorId }: TestimonialsSectionProps) => {
    const [allFeedbacks, setAllFeedbacks] = useState<(FeedbackItem | FeedbackDto)[]>([]);
    const [stats, setStats] = useState<FeedbackStatsDto | null>(null);
    const [page, setPage] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (feedbacks) setAllFeedbacks(feedbacks);
    }, [feedbacks]);

    const effectiveTotal = Math.max(totalFeedbacks, stats?.totalReviews || 0);
    const hasMore = effectiveTotal > allFeedbacks.length;

    useEffect(() => {
        if (!tutorId) return;
        getTutorFeedbackStats(tutorId)
            .then(res => {
                const data = res.content || res;
                setStats(data);
            })
            .catch(() => { });
    }, [tutorId]);

    const loadMore = useCallback(async () => {
        if (!tutorId || loadingMore) return;
        try {
            setLoadingMore(true);
            const pageToFetch = allFeedbacks.length <= (feedbacks?.length || 0) ? 1 : page + 1;
            const res = await getTutorFeedbacks(tutorId, pageToFetch, 5);
            const data = res.content || res;
            const newItems = Array.isArray(data) ? data : data?.items || [];

            if (newItems.length > 0) {
                if (pageToFetch === 1) {
                    setAllFeedbacks(newItems);
                } else {
                    setAllFeedbacks(prev => {
                        const existingIds = new Set(prev.map(f => f.feedbackId));
                        const filtered = newItems.filter((f: FeedbackDto) => !existingIds.has(f.feedbackId));
                        return [...prev, ...filtered];
                    });
                }
                setPage(pageToFetch);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingMore(false);
        }
    }, [tutorId, page, loadingMore, allFeedbacks.length, feedbacks?.length]);

    const handleNext = async () => {
        if (currentIndex < allFeedbacks.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else if (hasMore) {
            await loadMore();
            setCurrentIndex(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const testimonial = allFeedbacks[currentIndex];

    return (
        <section className="section5">
            <div className="heading-24">
                {/* Người viết đánh giá là phụ huynh khi booking có phụ huynh, còn lại là học
                    viên tự đặt lịch (xem CanReviewBooking/ReviewerRoleOf ở FeedbackService) —
                    nên tiêu đề gọi tên cả hai. */}
                <h2 className="testimonials-title">Đánh giá từ học viên & phụ huynh</h2>
            </div>

            {stats && (
                <div style={{
                    display: 'flex', gap: '24px', alignItems: 'center',
                    padding: '16px 20px', marginBottom: '10px',
                    background: 'rgba(242, 240, 228, 0.5)', borderRadius: '12px',
                    border: '1px solid rgba(62, 47, 40, 0.08)',
                }}>
                    <div style={{ textAlign: 'center', minWidth: '80px' }}>
                        <div style={{ fontSize: '32px', fontWeight: 700, color: '#1a2238' }}>
                            {(stats.averageRating || 0).toFixed(1)}
                        </div>
                        <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', margin: '4px 0' }}>
                            {[1, 2, 3, 4, 5].map(i => <StarIcon key={i} filled={i <= Math.round(stats.averageRating)} />)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#999' }}>{stats.totalReviews} đánh giá</div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <RatingBar star={5} count={stats.rating5Count} percent={stats.rating5Percent} />
                        <RatingBar star={4} count={stats.rating4Count} percent={stats.rating4Percent} />
                        <RatingBar star={3} count={stats.rating3Count} percent={stats.rating3Percent} />
                        <RatingBar star={2} count={stats.rating2Count} percent={stats.rating2Percent} />
                        <RatingBar star={1} count={stats.rating1Count} percent={stats.rating1Percent} />
                    </div>
                </div>
            )}

            <div className="container84">
                {testimonial ? (
                    <div className="component-8" style={{ width: '100%' }}>
                        <div className="container85">
                            <div className="component-122">
                                <QuoteIcon />
                            </div>
                        </div>
                        <div className="container86">
                            <div className="container87">
                                <div className="container88">
                                    <div className="background7">
                                        <b className="l">{
                                            (('fromUserName' in testimonial ? testimonial.fromUserName : (testimonial as any).parentName) || 'P').charAt(0)
                                        }</b>
                                    </div>
                                    <div className="container89">
                                        <div className="heading-47">
                                            <b className="l-minh-anh">
                                                {('fromUserName' in testimonial ? testimonial.fromUserName : (testimonial as any).parentName) || 'Học viên'}
                                            </b>
                                        </div>
                                        <div className="container90">
                                            <span className="hc-sinh-year">{testimonial.createdAt ? new Date(testimonial.createdAt).toLocaleDateString('vi-VN') : 'Học viên'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="container91">
                                    <i className="chuyn-mn-ca">"{testimonial.comment || 'Không có bình luận.'}"</i>
                                </div>
                                <div className="container92">
                                    <div className="border2">
                                        <b className="xc-thc-bi">Xác thực bởi TopTutor LMS</b>
                                    </div>
                                    {('courseDuration' in testimonial && (testimonial as any).courseDuration) && (
                                        <div className="border2">
                                            <b className="xc-thc-bi">Học trong {(testimonial as any).courseDuration}</b>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="background8">
                                <div className="container93">
                                    <span className="mc-tiu-ban">Mục tiêu ban đầu</span>
                                    <div className="container95">
                                        <b className="thi-y">{('initialGoal' in testimonial ? (testimonial as any).initialGoal : null) || '—'}</b>
                                    </div>
                                </div>
                                <div className="horizontal-divider3"></div>
                                <div className="container96">
                                    <span className="mc-tiu-ban">Kết quả thực tế</span>
                                    <div className="container98">
                                        <b className="t-a-biology">{('actualResult' in testimonial ? (testimonial as any).actualResult : null) || '—'}</b>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {(testimonial as any).reply && (
                            <div className="testimonial-reply">
                                <div className="testimonial-reply-head">
                                    <span>Phản hồi từ gia sư</span>
                                    {(testimonial as any).repliedAt && (
                                        <time dateTime={(testimonial as any).repliedAt}>
                                            {new Date((testimonial as any).repliedAt).toLocaleDateString('vi-VN')}
                                        </time>
                                    )}
                                </div>
                                <p>{(testimonial as any).reply}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="empty-message-center" style={{ width: '100%', textAlign: 'center', padding: '40px', color: 'rgba(62, 47, 40, 0.5)', fontStyle: 'italic' }}>
                        {loadingMore ? 'Đang tải đánh giá...' : 'Gia sư chưa có đánh giá nào.'}
                    </p>
                )}

                {effectiveTotal > 1 && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        marginTop: '20px'
                    }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={handlePrev}
                                disabled={currentIndex === 0}
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    border: '1px solid #e4ded5',
                                    background: currentIndex === 0 ? '#f5f5f5' : '#fff',
                                    cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <span style={{ fontSize: '18px', color: '#3e2f28' }}>←</span>
                            </button>
                            <button
                                onClick={handleNext}
                                disabled={currentIndex === effectiveTotal - 1 || loadingMore}
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    border: '1px solid #e4ded5',
                                    background: (currentIndex === effectiveTotal - 1) ? '#f5f5f5' : '#fff',
                                    cursor: (currentIndex === effectiveTotal - 1) ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <span style={{ fontSize: '18px', color: '#3e2f28' }}>{loadingMore ? '...' : '→'}</span>
                            </button>
                        </div>

                        <div style={{ fontSize: '14px', color: '#999', fontWeight: 500 }}>
                            Đánh giá {currentIndex + 1} / {effectiveTotal}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default TestimonialsSection;

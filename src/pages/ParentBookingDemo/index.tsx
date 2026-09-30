import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GraduationCap,
  Heart,
  MousePointerClick,
  PackageCheck,
  Play,
  Repeat2,
  RotateCcw,
  Route,
  ShieldCheck,
  Star,
  UsersRound,
  X,
} from 'lucide-react';
import { formatVNDNumber } from '../../utils/formatters';
import Header from '../../components/Header';
import {
  CHILDREN,
  DAY_NAMES,
  TUTORS,
  type BookingSlot,
  type FixedCombo,
  type Tutor,
  type TutorCombo,
  type WeeklySlot,
} from './data';
// Contract booking thật (đối chiếu mapping). Demo CHƯA gửi thật — chờ BE (xem plan Part E).
import type { CreateBookingPayload } from '../../services/booking.service';
import styles from './styles.module.css';

type BookingStep = 1 | 2 | 3 | 4;
type BookingMode = 'availability' | 'package';

const STEPS: { id: BookingStep; label: string }[] = [
  { id: 1, label: 'Học sinh & môn' },
  { id: 2, label: 'Cách đặt' },
  { id: 3, label: 'Lịch học' },
  { id: 4, label: 'Xác nhận' },
];

const addDays = (date: Date, numberOfDays: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + numberOfDays);
  return next;
};

const getEndOfNextMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 2, 0);

// Hết hạn booking = ĐÚNG ngày này tháng sau, BAO GỒM ngày cuối (vd 15/6 → 15/7 tính cả 15/7).
// Clamp khi ngày không tồn tại ở tháng sau (31/1 → 28/2).
const getBookingValidityEnd = (startDate: Date) => {
  const nextMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
  const lastDayOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
  nextMonth.setDate(Math.min(startDate.getDate(), lastDayOfNextMonth));
  return nextMonth;
};

// Thứ 2 của tuần chứa date (mốc neo lưới calendar theo tuần).
const mondayOf = (date: Date) => addDays(date, -((date.getDay() + 6) % 7));

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const fromDateKey = (dateKey: string) => new Date(`${dateKey}T00:00:00`);

const formatDate = (dateKey: string) =>
  fromDateKey(dateKey).toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });

const formatFullDate = (date: Date) =>
  date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const formatShortDate = (date: Date) =>
  date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  });

const formatPrice = (amount: number) => `${formatVNDNumber(amount)} ₫`;

const formatSubjectGrade = (grade: number) => `Lớp ${grade}`;

const formatPackageName = (name: string) => name.replace(/^Combo\b/i, 'Gói');

const formatPackageType = (type: TutorCombo['type']) => (type === 'fixed' ? 'Gói cố định' : 'Gói linh hoạt');

const getSlotKey = (slot: Pick<BookingSlot, 'date' | 'startTime'>) => `${slot.date}-${slot.startTime}`;

const sortSlots = (slots: BookingSlot[]) =>
  [...slots].sort((first, second) => getSlotKey(first).localeCompare(getSlotKey(second)));

// Combo session (canonical) dùng startHour/startMinute — đổi sang "HH:mm".
const pad2 = (n: number) => String(n).padStart(2, '0');
const formatSessionTime = (session: { startHour: number; startMinute: number }) =>
  `${pad2(session.startHour)}:${pad2(session.startMinute)}`;

// Quy ước ngày của demo: 1=T2..7=CN. Combo (canonical) dùng 0=CN..6=T7 → đổi CN 0→7.
const toDemoWeekday = (jsDay: number) => (jsDay === 0 ? 7 : jsDay);

// 1 "pattern tuần" = các khung giờ lặp lại mỗi tuần (dayOfWeek theo quy ước demo 1..7).
interface WeeklyPatternSlot {
  dayOfWeek: number;
  startTime: string;
  durationHours: number;
}

// Combo cố định → pattern tuần.
const comboToWeeklyPattern = (combo: FixedCombo): WeeklyPatternSlot[] =>
  combo.sessions.map((session) => ({
    dayOfWeek: toDemoWeekday(session.dayOfWeek),
    startTime: formatSessionTime(session),
    durationHours: session.durationHours,
  }));

// ── Hỗ trợ lưới 30 phút ──
const timeToMinutes = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + (minute || 0);
};
const minutesToTime = (mins: number) => `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
// 1 khung [startTime, +durationHours] có phủ ô 30 phút bắt đầu tại cellMin (phút) không.
const slotCoversCell = (startTime: string, durationHours: number, cellMin: number) =>
  timeToMinutes(startTime) <= cellMin && cellMin < timeToMinutes(startTime) + durationHours * 60;

// 2 khoảng [startMinA,+durA] và [startMinB,+durB] (phút/giờ) có chồng nhau không.
const rangesOverlap = (startMinA: number, durHoursA: number, startMinB: number, durHoursB: number) =>
  startMinA < startMinB + durHoursB * 60 && startMinB < startMinA + durHoursA * 60;

// Buổi [startTime, +durationHours] có được PHỦ KÍN bởi lịch rảnh liền mạch của ngày đó (gộp ô 30').
const sessionFitsAvailability = (
  dayOfWeek: number,
  startTime: string,
  durationHours: number,
  availability: WeeklySlot[],
) => {
  const startMin = timeToMinutes(startTime);
  for (let cur = startMin; cur < startMin + durationHours * 60; cur += 30) {
    const covered = availability.some(
      (slot) =>
        slot.dayOfWeek === dayOfWeek &&
        slot.available !== false &&
        slotCoversCell(slot.startTime, slot.durationHours, cur),
    );
    if (!covered) return false;
  }
  return true;
};

// Hiển thị số giờ/buổi (lấy từ môn đã chọn). Vd 1.5 → "1h30".
const formatDuration = (hours: number) => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} phút`;
  return m === 0 ? `${h} giờ` : `${h}h${m}`;
};

// Lặp pattern tuần từ startDate đến hết cửa sổ 1 tháng (BAO GỒM ngày cuối). Số buổi 4 hay 5 tuỳ lịch.
const buildScheduleFromPattern = (pattern: WeeklyPatternSlot[], startDate: Date): BookingSlot[] => {
  if (!pattern.length) return [];
  const windowEnd = getBookingValidityEnd(startDate);
  const slots: BookingSlot[] = [];
  for (let day = new Date(startDate); day <= windowEnd; day = addDays(day, 1)) {
    const demoDow = toDemoWeekday(day.getDay());
    pattern
      .filter((slot) => slot.dayOfWeek === demoDow)
      .forEach((slot) =>
        slots.push({
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          durationHours: slot.durationHours,
          date: toDateKey(day),
        }),
      );
  }
  return sortSlots(slots);
};

const getLowestRate = (tutor: Tutor) => Math.min(...tutor.subjects.map((subject) => subject.hourlyRate));

const getSchedulePreview = (tutor: Tutor) => {
  const grouped = tutor.availability.reduce<Record<number, string[]>>((current, slot) => {
    current[slot.dayOfWeek] = [...(current[slot.dayOfWeek] ?? []), slot.startTime];
    return current;
  }, {});

  return Object.entries(grouped)
    .slice(0, 3)
    .map(([day, times]) => ({
      day: DAY_NAMES[Number(day) - 1],
      times,
    }));
};

const TutorBrowse = ({ onViewTutor }: { onViewTutor: (tutorId: string) => void }) => (
  <main className={styles.browseShell}>
    <section className={styles.searchHero}>
      <span className={styles.eyebrow}>Tìm gia sư phù hợp</span>
      <h1>Chọn người đồng hành cho con</h1>
      <p>Xem hồ sơ gia sư trước khi bắt đầu quy trình đặt lịch học.</p>
      <div className={styles.searchPills}>
        <span>Gia sư đã xác minh</span>
        <span>Lịch học linh hoạt</span>
        <span>Demo frontend-only</span>
      </div>
    </section>

    <section className={styles.resultsSection}>
      <div className={styles.resultsHeading}>
        <div>
          <span className={styles.eyebrow}>Danh sách đề xuất</span>
          <h2>Gia sư nổi bật</h2>
        </div>
        <span>{TUTORS.length} hồ sơ phù hợp</span>
      </div>

      <div className={styles.resultGrid}>
        {TUTORS.map((tutor) => (
          <article key={tutor.id} className={styles.tutorResultCard}>
            <div className={styles.tutorResultBody}>
              <div className={styles.tutorCardHeader}>
                <div className={styles.tutorIdentity}>
                  <span className={styles.avatar}>{tutor.initials}</span>
                  <div>
                    <h3>{tutor.name}</h3>
                    <span className={styles.verifiedBadge}>
                      <ShieldCheck size={12} />
                      Đã xác minh
                    </span>
                  </div>
                </div>
                <span className={styles.rating}>
                  <Star size={14} fill="currentColor" />
                  {tutor.rating}
                </span>
              </div>

              <p className={styles.tutorCredential}>{tutor.education}</p>

              <div className={styles.subjectTags}>
                {tutor.subjects.map((subject) => (
                  <span key={subject.id}>{subject.name}</span>
                ))}
              </div>

              <div className={styles.gradeRow}>
                <BookOpen size={14} />
                {tutor.subjects.map((subject) => (
                  <span key={subject.id}>
                    {subject.name}: {formatSubjectGrade(subject.grade)}
                  </span>
                ))}
              </div>

              <div className={styles.tutorStats}>
                <span>
                  <strong>{tutor.yearsExperience} năm</strong>
                  Kinh nghiệm
                </span>
                <span>
                  <strong>{tutor.studentCount}</strong>
                  Học sinh
                </span>
                <span>
                  <strong>{tutor.reviewCount}</strong>
                  Đánh giá
                </span>
              </div>
            </div>

            <footer className={styles.tutorResultFooter}>
              <div>
                <small>Học phí từ</small>
                <strong>{formatPrice(getLowestRate(tutor))}</strong>
                <span>/ giờ</span>
              </div>
              <button type="button" onClick={() => onViewTutor(tutor.id)}>
                Xem chi tiết
                <ArrowRight size={15} />
              </button>
            </footer>
          </article>
        ))}
      </div>
    </section>
  </main>
);

const TutorDetail = ({ tutor, onBack, onBooking }: { tutor: Tutor; onBack: () => void; onBooking: () => void }) => {
  const schedulePreview = getSchedulePreview(tutor);

  return (
    <main className={styles.detailShell}>
      <button type="button" className={styles.backLink} onClick={onBack}>
        <ArrowLeft size={16} />
        Quay lại danh sách gia sư
      </button>

      <div className={styles.detailLayout}>
        <div className={styles.detailContent}>
          <section className={styles.profileHero}>
            <div className={styles.profileHeroTop}>
              <span>
                <i />
                TopTutor Original Interview
              </span>
              <small>Click để xem phỏng vấn học thuật</small>
            </div>
            <button type="button" className={styles.playButton} aria-label="Xem video giới thiệu">
              <Play size={20} fill="currentColor" />
            </button>
            <div className={styles.profileHeroBottom}>
              <span className={styles.profileAvatar}>{tutor.initials}</span>
              <div>
                <small>{tutor.education}</small>
                <h1>{tutor.name}</h1>
                <p>{tutor.title}</p>
              </div>
            </div>
            <div className={styles.heroRating}>
              <div>
                <span>
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star key={index} size={13} fill="currentColor" />
                  ))}
                </span>
                <strong>
                  {tutor.rating} ({tutor.reviewCount} đánh giá)
                </strong>
              </div>
              <Heart size={19} />
            </div>
          </section>

          <section className={styles.teachingMeta}>
            <div className={styles.detailSubjectTags}>
              {tutor.subjects.map((subject) => (
                <span key={subject.id}>{subject.name}</span>
              ))}
            </div>
            <div className={styles.gradeGroups}>
              <strong>Cấp lớp giảng dạy</strong>
              {tutor.subjects.map((subject) => (
                <span key={subject.id}>
                  {subject.name}: <b>{formatSubjectGrade(subject.grade)}</b>
                </span>
              ))}
            </div>
          </section>

          <section className={styles.infoPanel}>
            <span className={styles.eyebrow}>Về gia sư</span>
            <h2>Phương pháp học tập rõ ràng, theo sát tiến độ</h2>
            <p>{tutor.bio}</p>
            <div className={styles.featureGrid}>
              <span>
                <Award size={19} />
                <b>{tutor.yearsExperience} năm kinh nghiệm</b>
                <small>Lộ trình được điều chỉnh theo năng lực thực tế.</small>
              </span>
              <span>
                <UsersRound size={19} />
                <b>{tutor.studentCount} học sinh đã đồng hành</b>
                <small>Phản hồi ngắn sau mỗi buổi học cho phụ huynh.</small>
              </span>
            </div>
          </section>
        </div>

        <aside className={styles.bookingSidebar}>
          <section className={styles.bookingCard}>
            <div className={styles.bookingCardHead}>
              <span className={styles.eyebrow}>Bắt đầu lộ trình học thuật</span>
              <div>
                <strong>{formatPrice(getLowestRate(tutor))}</strong>
                <small>/ giờ học</small>
              </div>
              <em>Buổi học thử: {formatPrice(tutor.trialLessonPrice)}</em>
            </div>
            <div className={styles.bookingCardBody}>
              <span>Lịch dạy</span>
              {schedulePreview.map((item) => (
                <div key={item.day} className={styles.schedulePreviewRow}>
                  <strong>{item.day}</strong>
                  <small>{item.times.join(' · ')}</small>
                </div>
              ))}
            </div>
            <div className={styles.bookingCardFoot}>
              <button type="button" onClick={onBooking}>
                Đặt lịch ngay
              </button>
            </div>
          </section>
          <div className={styles.verificationNote}>
            <ShieldCheck size={18} />
            <div>
              <strong>Đã xác minh bởi TopTutor Council</strong>
              <span>Hoàn học phí nếu không hài lòng sau buổi học đầu tiên.</span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
};

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// Lịch tháng mô phỏng: vẽ các tháng mà cửa sổ booking chạm tới, tô đậm ngày có buổi học.
const MonthSimulation = ({
  slots,
  windowStart,
  windowEnd,
  variant = 'side',
}: {
  slots: BookingSlot[];
  windowStart: Date;
  windowEnd: Date;
  variant?: 'side' | 'confirm';
}) => {
  const countByDate = new Map<string, number>();
  slots.forEach((slot) => countByDate.set(slot.date, (countByDate.get(slot.date) ?? 0) + 1));

  // Danh sách tháng cần vẽ: từ tháng của windowStart đến tháng của windowEnd (thường 1–2 tháng).
  const months: { year: number; month: number }[] = [];
  let cursor = new Date(windowStart.getFullYear(), windowStart.getMonth(), 1);
  const lastMonth = new Date(windowEnd.getFullYear(), windowEnd.getMonth(), 1);
  while (cursor <= lastMonth) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  const inWindow = (date: Date) => date >= windowStart && date <= windowEnd;

  return (
    <aside className={`${styles.monthSim} ${variant === 'confirm' ? styles.monthSimConfirm : ''}`}>
      <div className={styles.monthSimHead}>
        <CalendarRange size={15} />
        <span>Lịch học theo tháng</span>
      </div>

      {slots.length === 0 ? (
        <p className={styles.monthSimEmpty}>Chọn khung giờ bên trái — lịch học sẽ tự phân bổ và hiện ở đây.</p>
      ) : (
        <>
          <div className={styles.monthSimMonths}>
            {months.map(({ year, month }) => {
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7; // canh Thứ 2 đầu tuần
              return (
                <div key={`${year}-${month}`} className={styles.monthSimGrid}>
                  <div className={styles.monthSimTitle}>
                    Tháng {month + 1}/{year}
                  </div>
                  <div className={styles.monthSimWeekdays}>
                    {WEEKDAY_LABELS.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                  <div className={styles.monthSimDays}>
                    {Array.from({ length: leadingBlanks }, (_, index) => (
                      <span key={`blank-${index}`} className={styles.monthSimBlank} />
                    ))}
                    {Array.from({ length: daysInMonth }, (_, index) => {
                      const day = index + 1;
                      const date = new Date(year, month, day);
                      const count = countByDate.get(toDateKey(date)) ?? 0;
                      const muted = !inWindow(date);
                      return (
                        <span
                          key={day}
                          className={`${styles.monthSimDay} ${count > 0 ? styles.monthSimDayActive : ''} ${
                            muted ? styles.monthSimDayMuted : ''
                          }`}
                          title={count > 0 ? `${day}/${month + 1}: ${count} buổi` : undefined}
                        >
                          {day}
                          {count > 0 && <i className={styles.monthSimDot} />}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </aside>
  );
};

const ParentBookingDemo = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { tutorId } = useParams<{ tutorId: string }>();
  const selectedTutor = TUTORS.find((tutor) => tutor.id === tutorId);
  const [showBooking, setShowBooking] = useState(false);
  const [step, setStep] = useState<BookingStep>(1);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedChildId, setSelectedChildId] = useState('');
  const [selectedBookingMode, setSelectedBookingMode] = useState<BookingMode | ''>('');
  const [selectedComboId, setSelectedComboId] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<BookingSlot[]>([]);
  const [visibleWeekIndex, setVisibleWeekIndex] = useState(0);
  const [createdBookingId, setCreatedBookingId] = useState('');
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  // Gói: các buổi phụ huynh bấm trong MỘT tuần (tuần đó bị khóa sau lần bấm đầu tiên).
  // Ngày bắt đầu = ngày sớm nhất trong đây; pattern (thứ + giờ) tự lặp đến hết cửa sổ 1 tháng.
  const [pickedWeekSlots, setPickedWeekSlots] = useState<BookingSlot[]>([]);

  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);
  const bookingDeadline = useMemo(() => getEndOfNextMonth(today), [today]);
  const thisWeekStart = mondayOf(today); // Thứ 2 của tuần hiện tại — cho phép bắt đầu từ hôm nay.
  const selectedSubject = selectedTutor?.subjects.find((subject) => subject.id === selectedSubjectId);
  // Số giờ mỗi buổi = theo MÔN đã chọn (gia sư đặt khi setup môn + giá). Mặc định 1.5 nếu chưa chọn.
  const sessionHours = selectedSubject?.hoursPerSession ?? 1.5;
  const sessionsPerWeek = selectedSubject?.sessionsPerWeek ?? 1;
  const selectedChild = CHILDREN.find((child) => child.id === selectedChildId);
  const selectedCombo = selectedTutor?.combos.find((combo) => combo.id === selectedComboId);
  const isAvailabilityMode = selectedBookingMode === 'availability';
  const isPackageMode = selectedBookingMode === 'package'; // gói CỐ ĐỊNH (không còn gói linh hoạt)
  const isFixedPackage = isPackageMode && selectedCombo?.type === 'fixed';
  const fixedCombos = selectedTutor?.combos.filter((combo): combo is FixedCombo => combo.type === 'fixed') ?? [];
  const scheduleChoiceLabel = isAvailabilityMode
    ? 'Tự chọn lịch rảnh'
    : selectedCombo
      ? formatPackageName(selectedCombo.name)
      : 'Gói cố định';
  // Cả 2 chế độ: phụ huynh bấm các buổi trong MỘT tuần → ngày bắt đầu = ngày sớm nhất, tuần đó bị khóa.
  const sortedPicks = sortSlots(pickedWeekSlots);
  const lockedWeekStart = sortedPicks.length ? mondayOf(fromDateKey(sortedPicks[0].date)) : null;
  const navLocked = lockedWeekStart != null;
  const bookingWindowStart = sortedPicks.length ? fromDateKey(sortedPicks[0].date) : null;
  const bookingWindowEnd = bookingWindowStart ? getBookingValidityEnd(bookingWindowStart) : null;
  const gradeMatches = Boolean(
    selectedSubject && selectedChild && selectedSubject.grade === selectedChild.grade,
  );
  const chosenHours = selectedSlots.reduce((sum, slot) => sum + slot.durationHours, 0);
  const subtotal = chosenHours * (selectedSubject?.hourlyRate ?? 0);
  const serviceFee = Math.round(subtotal * 0.05);
  const total = subtotal + serviceFee;
  // Pattern tuần của gói cố định — dùng để tô/bấm các ô thuộc gói (theo phủ thời lượng).
  const fixedPattern = selectedCombo?.type === 'fixed' ? comboToWeeklyPattern(selectedCombo) : [];
  // Lưới calendar luôn neo từ tuần hiện tại; nav bị khóa khi đã chốt tuần bắt đầu.
  const visibleWeekStart = addDays(thisWeekStart, visibleWeekIndex * 7);
  const visibleDays = Array.from({ length: 7 }, (_, index) => addDays(visibleWeekStart, index));
  const maxVisibleWeekIndex = Math.max(
    0,
    Math.floor((bookingDeadline.getTime() - thisWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)),
  );
  // Lưới calendar chia theo Ô 30 PHÚT. Chỉ hiện các mốc 30' có lịch rảnh (gộp khung dài thành nhiều ô,
  // bỏ qua khoảng trống) — sort tăng dần theo phút.
  const calendarTimes = (() => {
    const covered = new Set<number>();
    (selectedTutor?.availability ?? []).forEach((slot) => {
      if (slot.available === false) return;
      const start = timeToMinutes(slot.startTime);
      for (let m = start; m < start + slot.durationHours * 60; m += 30) covered.add(m);
    });
    return [...covered].sort((a, b) => a - b).map(minutesToTime);
  })();

  const resetBooking = () => {
    setStep(1);
    setSelectedSubjectId('');
    setSelectedChildId('');
    setSelectedBookingMode('');
    setSelectedComboId('');
    setSelectedSlots([]);
    setVisibleWeekIndex(0);
    setCreatedBookingId('');
    setCloseConfirmOpen(false);
    setPickedWeekSlots([]);
  };

  const openBooking = () => {
    resetBooking();
    setShowBooking(true);
  };

  const closeBooking = () => {
    setShowBooking(false);
    resetBooking();
  };

  const hasBookingProgress =
    !createdBookingId &&
    Boolean(selectedSubjectId || selectedChildId || selectedBookingMode || selectedComboId || selectedSlots.length);

  // Đóng modal khi đang đặt dở (chưa gửi) → hỏi xác nhận để tránh mất lựa chọn do lỡ tay click ra nền.
  const requestClose = () => {
    if (hasBookingProgress) {
      setCloseConfirmOpen(true);
      return;
    }
    closeBooking();
  };

  useEffect(() => {
    if (!showBooking) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showBooking]);

  useEffect(() => {
    if (!tutorId || !location.pathname.startsWith('/demo/parent-booking/tutor/')) return;
    navigate(`/demo/parent-booking/${tutorId}`, { replace: true });
  }, [location.pathname, navigate, tutorId]);

  const viewTutor = (nextTutorId: string) => {
    resetBooking();
    navigate(`/demo/parent-booking/${nextTutorId}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const backToBrowse = () => {
    setShowBooking(false);
    resetBooking();
    navigate('/demo/parent-booking');
  };

  const selectSubject = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedChildId('');
    setSelectedBookingMode('');
    setSelectedComboId('');
    setSelectedSlots([]);
    setPickedWeekSlots([]);
    setVisibleWeekIndex(0);
  };

  const selectChild = (childId: string) => {
    setSelectedChildId(childId);
    setSelectedBookingMode('');
    setSelectedComboId('');
    setSelectedSlots([]);
    setPickedWeekSlots([]);
    setVisibleWeekIndex(0);
  };

  const selectBookingMode = (mode: BookingMode) => {
    setSelectedBookingMode(mode);
    setSelectedComboId('');
    setSelectedSlots([]);
    setPickedWeekSlots([]);
    setVisibleWeekIndex(0);
  };

  const selectCombo = (combo: TutorCombo) => {
    if (combo.id === selectedComboId) return; // đang chọn rồi → không reset tuần đã chọn
    setSelectedBookingMode('package');
    setSelectedComboId(combo.id);
    setVisibleWeekIndex(0);
    // Cả 2 loại gói: phụ huynh tự bấm chọn TUẦN BẮT ĐẦU trên lịch (chưa fill sẵn).
    setPickedWeekSlots([]);
    setSelectedSlots([]);
  };

  // Chiếu pattern tuần (thứ + giờ của các ô đã bấm) ra cả cửa sổ, bắt đầu từ ngày sớm nhất.
  const projectFromWeekPicks = (weekSlots: BookingSlot[]) => {
    if (!weekSlots.length) {
      setSelectedSlots([]);
      return;
    }
    const sorted = sortSlots(weekSlots);
    const pattern: WeeklyPatternSlot[] = weekSlots.map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      durationHours: slot.durationHours,
    }));
    setSelectedSlots(buildScheduleFromPattern(pattern, fromDateKey(sorted[0].date)));
  };

  // Tự chọn lịch rảnh: bấm 1 ô = đặt buổi [giờ bấm, +sessionHours] (tự bôi đủ độ dài theo môn), khóa tuần.
  // Bấm vào buổi đã đặt để bỏ; cho phép nhiều buổi/ngày (không chồng nhau).
  const toggleAvailabilityPick = (dateKey: string, dayOfWeek: number, startTime: string) => {
    const cellMin = timeToMinutes(startTime);
    const covering = pickedWeekSlots.find(
      (p) => p.date === dateKey && slotCoversCell(p.startTime, p.durationHours, cellMin),
    );
    if (!covering && pickedWeekSlots.length >= sessionsPerWeek) return;
    const next = covering
      ? pickedWeekSlots.filter((p) => p !== covering)
      : [...pickedWeekSlots, { dayOfWeek, startTime, durationHours: sessionHours, date: dateKey }];
    setPickedWeekSlots(next);
    projectFromWeekPicks(next);
  };

  // Gói cố định: bấm 1 buổi của gói = chọn cả pattern của tuần đó làm tuần bắt đầu (khóa tuần).
  const pickFixedStartWeek = (weekMonday: Date) => {
    if (selectedCombo?.type !== 'fixed') return;
    const pattern = comboToWeeklyPattern(selectedCombo);
    const datedInWeek: BookingSlot[] = pattern.map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      durationHours: slot.durationHours,
      date: toDateKey(addDays(weekMonday, slot.dayOfWeek - 1)), // demo: T2=1 → offset 0
    }));
    // Tuần 1 chỉ gồm buổi từ hôm nay trở đi (không bắt đầu ở quá khứ); pattern vẫn lặp đủ các tuần sau.
    const futureInWeek = datedInWeek.filter((slot) => fromDateKey(slot.date) >= today);
    if (!futureInWeek.length) return;
    setPickedWeekSlots(futureInWeek);
    setSelectedSlots(buildScheduleFromPattern(pattern, fromDateKey(sortSlots(futureInWeek)[0].date)));
  };

  // Bỏ chọn hết → mở khóa, cho phép đổi tuần bắt đầu khác.
  const clearPicks = () => {
    setPickedWeekSlots([]);
    setSelectedSlots([]);
  };

  const canContinue = () => {
    if (step === 1) return Boolean(selectedSubject && selectedChild && gradeMatches);
    if (step === 2) return isAvailabilityMode || isPackageMode; // chỉ cần chọn cách đặt
    if (step === 3) {
      if (isAvailabilityMode) return pickedWeekSlots.length === sessionsPerWeek && selectedSlots.length > 0;
      // Cần ≥1 buổi đã sinh: lịch rảnh = đã bấm khung giờ; gói cố định = đã chọn gói + tuần bắt đầu.
      return selectedSlots.length > 0;
    }
    return true;
  };

  const goNext = () => {
    if (!canContinue() || step === 4) return;
    setStep((current) => (current + 1) as BookingStep);
  };

  const goBack = () => {
    if (step === 1) return;
    setStep((current) => (current - 1) as BookingStep);
  };

  const createBooking = () => {
    if (!canContinue()) return;

    // TODO(BE blocker — plan Part E): demo chưa lấy được tutorSubjectGradePriceId &
    // packageId THẬT (cần endpoint public của gia sư: giá theo môn/lớp + danh sách gói;
    // full-profile hiện chưa trả). Khi BE sẵn sàng: thay 0 bằng id thật, dùng tutorId/
    // studentId là GUID thật, rồi gọi createBooking(payload) từ booking.service.
    // Hiện chỉ build + log payload để kiểm tra mapping và mô phỏng thành công.
    const dateKeyOf = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const toIsoSlot = (dateKey: string, startTime: string, durationHours: number) => {
      const [h, m] = startTime.split(':').map(Number);
      const endMin = h * 60 + m + Math.round(durationHours * 60);
      const end = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
      return { scheduledStart: `${dateKey}T${startTime}:00`, scheduledEnd: `${dateKey}T${end}:00` };
    };

    const payload: CreateBookingPayload = {
      studentId: selectedChild?.id,
      tutorId: selectedTutor?.id ?? '',
      // subjectId mock là chuỗi ('math'); BE dùng số → bỏ qua ở demo.
      tutorSubjectGradePriceId: 0, // TODO(BE): id giá theo môn/lớp
      packageId: 0, // TODO(BE): id gói (fixed/flexible)
      totalSessions: selectedSlots.length,
      startDate: bookingWindowStart ? `${dateKeyOf(bookingWindowStart)}T00:00:00` : new Date().toISOString(),
      // availability mode → flexible slots; package mode → BE tự sinh từ fixedSlots.
      flexibleSlots: isAvailabilityMode
        ? selectedSlots.map((s) => toIsoSlot(s.date, s.startTime, s.durationHours))
        : undefined,
    };
    // eslint-disable-next-line no-console
    console.log('[ParentBookingDemo] Booking payload (chờ BE để gửi thật):', payload);

    setCreatedBookingId(`DEMO-${String(Date.now()).slice(-6)}`);
  };

  return (
    <div className={styles.page}>
      <Header />

      {selectedTutor ? (
        <TutorDetail tutor={selectedTutor} onBack={backToBrowse} onBooking={openBooking} />
      ) : (
        <TutorBrowse onViewTutor={viewTutor} />
      )}

      {showBooking && selectedTutor && (
        <div className={styles.modalBackdrop} onMouseDown={requestClose}>
          <section
            className={styles.bookingModal}
            role="dialog"
            aria-modal="true"
            aria-label={`Đặt lịch học với ${selectedTutor.name}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {createdBookingId ? (
              <div className={styles.modalSuccess}>
                <button type="button" className={styles.modalClose} onClick={closeBooking} aria-label="Đóng modal">
                  <X size={22} />
                </button>
                <span className={styles.successIcon}>
                  <CheckCircle2 size={42} />
                </span>
                <span className={styles.eyebrow}>Gửi yêu cầu thành công</span>
                <h2>Yêu cầu đặt lịch đã được gửi</h2>
                <p>Gia sư sẽ xem lịch học và phản hồi cho phụ huynh trong thời gian sớm nhất.</p>
                <div className={styles.bookingCode}>
                  <span>Mã đặt lịch</span>
                  <strong>{createdBookingId}</strong>
                </div>
                {bookingWindowStart && bookingWindowEnd && (
                  <div className={styles.successTerm}>
                    <CalendarRange size={16} />
                    <span>
                      Hiệu lực booking: {formatFullDate(bookingWindowStart)} - {formatFullDate(bookingWindowEnd)}
                    </span>
                  </div>
                )}
                <button type="button" className={styles.primaryButton} onClick={closeBooking}>
                  <RotateCcw size={16} />
                  Hoàn tất
                </button>
              </div>
            ) : (
              <>
                <header className={styles.modalHeader}>
                  <div>
                    <h2>Đặt lịch học</h2>
                    <p>
                      với <strong>{selectedTutor.name}</strong>
                    </p>
                  </div>
                  <button type="button" className={styles.modalClose} onClick={requestClose} aria-label="Đóng modal">
                    <X size={22} />
                  </button>
                </header>

                <nav className={styles.modalStepper} aria-label="Tiến trình đặt lịch">
                  {STEPS.map((item, index) => (
                    <div
                      key={item.id}
                      className={`${styles.modalStep} ${step === item.id ? styles.modalStepActive : ''} ${
                        step > item.id ? styles.modalStepDone : ''
                      }`}
                    >
                      <span>{step > item.id ? <Check size={15} /> : item.id}</span>
                      <strong>{item.label}</strong>
                      {index < STEPS.length - 1 && <i />}
                    </div>
                  ))}
                </nav>

                <div className={styles.modalBody}>
                  {step === 1 && (
                    <>
                      <div className={styles.sectionHeading}>
                        <span className={styles.headingIcon}>
                          <GraduationCap size={20} />
                        </span>
                        <div>
                          <span className={styles.eyebrow}>Bước 01</span>
                          <h2>Chọn môn học và trẻ</h2>
                        </div>
                      </div>

                      <section className={styles.formSection}>
                        <h3>Môn học muốn đặt</h3>
                        <div className={styles.subjectGrid}>
                          {selectedTutor.subjects.map((subject) => (
                            <button
                              key={subject.id}
                              type="button"
                              className={`${styles.subjectCard} ${
                                selectedSubjectId === subject.id ? styles.selectedCard : ''
                              }`}
                              onClick={() => selectSubject(subject.id)}
                            >
                              <div className={styles.subjectCardHead}>
                                <span className={styles.subjectIcon}>
                                  <BookOpen size={17} />
                                </span>
                                <div>
                                  <strong>{subject.name}</strong>
                                  <small>{formatSubjectGrade(subject.grade)}</small>
                                </div>
                              </div>

                              <div className={styles.subjectPrice}>
                                <span>Học phí</span>
                                <strong>{formatPrice(subject.hourlyRate)} / giờ</strong>
                              </div>

                              <div className={styles.subjectSetupGrid}>
                                <span>
                                  <Clock3 size={14} />
                                  <b>{formatDuration(subject.hoursPerSession)}</b>
                                  <small>/ buổi</small>
                                </span>
                                <span>
                                  <CalendarDays size={14} />
                                  <b>{subject.sessionsPerWeek}</b>
                                  <small>buổi/tuần</small>
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </section>

                      <section className={styles.formSection}>
                        <h3>Trẻ sẽ tham gia học</h3>
                        <div className={styles.childGrid}>
                          {CHILDREN.map((child) => (
                            <button
                              key={child.id}
                              type="button"
                              className={`${styles.childCard} ${
                                selectedChildId === child.id ? styles.selectedCard : ''
                              }`}
                              onClick={() => selectChild(child.id)}
                              disabled={!selectedSubject}
                            >
                              <span className={styles.childAvatar}>{child.initials}</span>
                              <span>
                                <strong>{child.name}</strong>
                                <small>
                                  Lớp {child.grade} · {child.school}
                                </small>
                              </span>
                            </button>
                          ))}
                        </div>
                        {!selectedSubject && <p className={styles.inlineHint}>Hãy chọn môn học trước khi chọn trẻ.</p>}
                      </section>

                      {selectedChild && selectedSubject && !gradeMatches && (
                        <div className={styles.warningBox}>
                          <AlertTriangle size={19} />
                          <div>
                            <strong>Khối lớp chưa phù hợp</strong>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <div className={styles.sectionHeading}>
                        <span className={styles.headingIcon}>
                          <Route size={20} />
                        </span>
                        <div>
                          <span className={styles.eyebrow}>Bước 02</span>
                          <h2>Chọn cách đặt lịch</h2>
                        </div>
                      </div>

                      <div className={styles.bookingModeGrid}>
                        <button
                          type="button"
                          className={`${styles.bookingModeCard} ${isAvailabilityMode ? styles.selectedCard : ''}`}
                          onClick={() => selectBookingMode('availability')}
                        >
                          <span className={`${styles.bookingModeIcon} ${styles.availabilityModeIcon}`}>
                            <MousePointerClick size={20} />
                          </span>
                          <span className={styles.comboType}>Theo lịch rảnh</span>
                          <h3>Tự chọn lịch rảnh</h3>
                          <small>{isAvailabilityMode ? 'Đã chọn' : 'Chọn cách này'}</small>
                        </button>

                        <button
                          type="button"
                          className={`${styles.bookingModeCard} ${isPackageMode ? styles.selectedCard : ''}`}
                          onClick={() => selectBookingMode('package')}
                        >
                          <span className={`${styles.bookingModeIcon} ${styles.packageModeIcon}`}>
                            <PackageCheck size={20} />
                          </span>
                          <span className={styles.comboType}>Theo gói cố định</span>
                          <h3>Chọn gói cố định</h3>
                          <small>{isPackageMode ? 'Đã chọn' : 'Xem các gói'}</small>
                        </button>
                      </div>
                    </>
                  )}

                  {step === 3 && (
                    <>
                      <div className={styles.sectionHeading}>
                        <span className={styles.headingIcon}>
                          <CalendarDays size={20} />
                        </span>
                        <div>
                          <span className={styles.eyebrow}>Bước 03</span>
                          <h2>{isPackageMode && !selectedCombo ? 'Chọn gói cố định' : 'Chọn lịch học'}</h2>
                        </div>
                      </div>

                      {isPackageMode && (
                        <section className={styles.comboPickSection}>
                          {fixedCombos.length === 0 ? (
                            <p className={styles.noFitNotice}>
                              <AlertTriangle size={15} />
                              Gia sư chưa tạo gói cố định nào. Hãy chọn "Tự chọn lịch rảnh" để đặt theo lịch trống.
                            </p>
                          ) : (
                            <div className={styles.comboGrid}>
                              {fixedCombos.map((combo) => {
                                const isSelected = combo.id === selectedComboId;
                                return (
                                  <button
                                    key={combo.id}
                                    type="button"
                                    className={`${styles.comboCard} ${isSelected ? styles.selectedCard : ''}`}
                                    onClick={() => selectCombo(combo)}
                                  >
                                    <span className={`${styles.comboIcon} ${styles.fixedPackageIcon}`}>
                                      <Repeat2 size={18} />
                                    </span>
                                    <span className={styles.comboType}>{formatPackageType(combo.type)}</span>
                                    <h3>{formatPackageName(combo.name)}</h3>
                                    <div className={styles.comboMeta}>
                                      <span>
                                        <BookOpen size={14} />
                                        {sessionsPerWeek} buổi / tuần
                                      </span>
                                      <span>
                                        <Clock3 size={14} />
                                        {formatDuration(sessionHours)} / buổi
                                      </span>
                                    </div>
                                    <ul className={styles.comboSessionList}>
                                      {combo.sessions.map((session, i) => (
                                        <li key={i}>
                                          <strong>{DAY_NAMES[toDemoWeekday(session.dayOfWeek) - 1]}</strong>
                                          <span>{formatSessionTime(session)}</span>
                                        </li>
                                      ))}
                                    </ul>
                                    <small>{isSelected ? 'Đã chọn' : 'Chọn gói'}</small>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </section>
                      )}

                      {(isAvailabilityMode || selectedCombo) && (
                        <>
                          {isAvailabilityMode && selectedSubject && (
                            <section className={styles.durationInfo}>
                              <Clock3 size={15} />
                              <span>
                                {selectedSubject.name}: <strong>{formatDuration(sessionHours)}/buổi</strong> ·{' '}
                                <strong>{sessionsPerWeek} buổi/tuần</strong>. Chọn buổi học đầu tiên để bắt đầu hành
                                trình học cùng gia sư.
                              </span>
                            </section>
                          )}

                          {sortedPicks.length > 0 && (
                            <section className={styles.packageSetup}>
                              <div className={styles.packageWindowInfo}>
                                <CalendarRange size={15} />
                                <span>
                                  Bắt đầu <strong>{bookingWindowStart && formatFullDate(bookingWindowStart)}</strong> →{' '}
                                  <strong>{bookingWindowEnd && formatFullDate(bookingWindowEnd)}</strong> ·{' '}
                                  {isAvailabilityMode ? (
                                    <>{selectedSlots.length} buổi dự kiến</>
                                  ) : (
                                    <strong>{selectedSlots.length} buổi</strong>
                                  )}
                                </span>
                              </div>
                              <button type="button" className={styles.changeWeekBtn} onClick={clearPicks}>
                                <RotateCcw size={14} />
                                Đổi tuần khác
                              </button>
                            </section>
                          )}

                          <div className={styles.scheduleLayout}>
                            <section className={styles.calendarSection}>
                              <div className={styles.calendarHeading}>
                                <div>
                                  <span className={styles.eyebrow}>Lịch rảnh của gia sư</span>
                                  <h3>{scheduleChoiceLabel}</h3>
                                </div>
                                <div className={styles.calendarControls}>
                                  <button
                                    type="button"
                                    onClick={() => setVisibleWeekIndex((current) => Math.max(0, current - 1))}
                                    disabled={navLocked || visibleWeekIndex === 0}
                                    aria-label="Tuần trước"
                                  >
                                    <ChevronLeft size={18} />
                                  </button>
                                  <strong>
                                    {formatShortDate(visibleDays[0])} - {formatShortDate(visibleDays[6])}
                                  </strong>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVisibleWeekIndex((current) => Math.min(maxVisibleWeekIndex, current + 1))
                                    }
                                    disabled={navLocked || visibleWeekIndex === maxVisibleWeekIndex}
                                    aria-label="Tuần sau"
                                  >
                                    <ChevronRight size={18} />
                                  </button>
                                </div>
                              </div>

                              <div className={styles.legend}>
                                <span>
                                  <i className={styles.availableDot} />
                                  Lịch trống
                                </span>
                                <span>
                                  <i className={styles.selectedDot} />
                                  Đã chọn
                                </span>
                                <span>
                                  <i className={styles.unavailableDot} />
                                  Không mở lịch
                                </span>
                              </div>

                              <div className={styles.calendarScroller}>
                                <div className={styles.calendarGrid}>
                                  <div className={`${styles.calendarCell} ${styles.timeHead}`}>Giờ học</div>
                                  {visibleDays.map((date, index) => (
                                    <div
                                      key={toDateKey(date)}
                                      className={`${styles.calendarCell} ${styles.dayHead} ${
                                        date < today || date > bookingDeadline ? styles.dayOutsideWindow : ''
                                      }`}
                                    >
                                      <strong>{DAY_NAMES[index]}</strong>
                                      <span>{formatShortDate(date)}</span>
                                    </div>
                                  ))}

                                  {calendarTimes.map((time) => (
                                    <div className={styles.calendarRow} key={time}>
                                      <div className={`${styles.calendarCell} ${styles.timeCell}`}>{time}</div>
                                      {visibleDays.map((date, dayIndex) => {
                                        const cellMin = timeToMinutes(time);
                                        const dateKey = toDateKey(date);
                                        // Ô có nằm trong lịch rảnh gia sư không (khung dài trải nhiều ô).
                                        const isOpen = selectedTutor.availability.some(
                                          (slot) =>
                                            slot.dayOfWeek === dayIndex + 1 &&
                                            slot.available !== false &&
                                            slotCoversCell(slot.startTime, slot.durationHours, cellMin),
                                        );
                                        const isPast = date < today;
                                        // Đã chọn nếu một buổi đã đặt phủ ô này (buổi dài trải nhiều ô đều sáng).
                                        const isSelected = selectedSlots.some(
                                          (selectedSlot) =>
                                            selectedSlot.date === dateKey &&
                                            slotCoversCell(selectedSlot.startTime, selectedSlot.durationHours, cellMin),
                                        );

                                        // Có thể bấm hay không + handler — tuỳ chế độ.
                                        let clickable = false;
                                        let onCellClick: (() => void) | null = null;
                                        if (!isPast && (isOpen || isSelected)) {
                                          if (isAvailabilityMode) {
                                            // Bấm = đặt buổi dài đúng sessionHours (theo môn) từ giờ này (nếu lọt lịch rảnh & không chồng buổi khác).
                                            const fits = sessionFitsAvailability(
                                              dayIndex + 1,
                                              time,
                                              sessionHours,
                                              selectedTutor.availability,
                                            );
                                            const overlaps = pickedWeekSlots.some(
                                              (p) =>
                                                p.date === dateKey &&
                                                rangesOverlap(
                                                  timeToMinutes(p.startTime),
                                                  p.durationHours,
                                                  cellMin,
                                                  sessionHours,
                                                ),
                                            );
                                            const hasRemainingPick = pickedWeekSlots.length < sessionsPerWeek;
                                            clickable =
                                              isSelected ||
                                              (fits &&
                                                !overlaps &&
                                                hasRemainingPick &&
                                                (navLocked || date <= bookingDeadline));
                                            onCellClick = () => toggleAvailabilityPick(dateKey, dayIndex + 1, time);
                                          } else if (isFixedPackage) {
                                            // Gói cố định: chỉ ô thuộc buổi của gói mới bấm; bấm = chọn cả tuần đó làm tuần bắt đầu.
                                            const isComboCell = fixedPattern.some(
                                              (p) =>
                                                p.dayOfWeek === dayIndex + 1 &&
                                                slotCoversCell(p.startTime, p.durationHours, cellMin),
                                            );
                                            clickable = !navLocked && isComboCell && date <= bookingDeadline;
                                            onCellClick = () => pickFixedStartWeek(mondayOf(date));
                                          }
                                        }
                                        const showAvailable = clickable && !isSelected;

                                        return (
                                          <div
                                            key={`${dateKey}-${time}`}
                                            className={`${styles.calendarCell} ${styles.slotCell}`}
                                          >
                                            <button
                                              type="button"
                                              className={`${styles.slotButton} ${
                                                isSelected
                                                  ? styles.slotSelected
                                                  : showAvailable
                                                    ? styles.slotAvailable
                                                    : styles.slotUnavailable
                                              }`}
                                              disabled={!clickable}
                                              onClick={() => onCellClick?.()}
                                              aria-label={`${formatDate(dateKey)} lúc ${time}`}
                                            >
                                              {isSelected ? (
                                                <>
                                                  <Check size={13} />
                                                  Đã chọn
                                                </>
                                              ) : showAvailable ? (
                                                '+ Chọn'
                                              ) : (
                                                '—'
                                              )}
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </section>
                            <MonthSimulation
                              slots={selectedSlots}
                              windowStart={bookingWindowStart ?? today}
                              windowEnd={bookingWindowEnd ?? today}
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {step === 4 && selectedSubject && selectedChild && (isAvailabilityMode || selectedCombo) && (
                    <>
                      <div className={styles.sectionHeading}>
                        <span className={styles.headingIcon}>
                          <CheckCircle2 size={20} />
                        </span>
                        <div>
                          <span className={styles.eyebrow}>Bước 04</span>
                          <h2>Xác nhận đặt lịch</h2>
                        </div>
                      </div>

                      <div className={styles.confirmLayout}>
                        <div className={styles.confirmMain}>
                          <section className={styles.reviewHero}>
                            <span className={styles.reviewHeroAvatar}>{selectedTutor.initials}</span>
                            <div className={styles.reviewHeroContent}>
                              <span className={styles.eyebrow}>Tóm tắt đặt lịch</span>
                              <h3>
                                {selectedSubject.name} · {selectedChild.name}
                              </h3>
                              <p>
                                {selectedTutor.name} · {scheduleChoiceLabel}
                              </p>
                            </div>
                            <div className={styles.confirmQuickFacts}>
                              <span>
                                <b>{selectedSlots.length}</b>
                                <small>buổi</small>
                              </span>
                              <span>
                                <b>{formatDuration(sessionHours)}</b>
                                <small>/ buổi</small>
                              </span>
                              <span>
                                <b>{chosenHours}</b>
                                <small>giờ</small>
                              </span>
                            </div>
                          </section>

                          <MonthSimulation
                            slots={selectedSlots}
                            windowStart={bookingWindowStart ?? today}
                            windowEnd={bookingWindowEnd ?? today}
                            variant="confirm"
                          />
                        </div>

                        <aside className={styles.priceSummary}>
                          <div className={styles.priceSummaryHead}>
                            <span className={styles.eyebrow}>Học phí dự kiến</span>
                            <strong>{formatPrice(total)}</strong>
                            <small>Tổng thanh toán</small>
                          </div>
                          <div className={styles.priceLine}>
                            <span>Học phí · {chosenHours} giờ</span>
                            <strong>{formatPrice(subtotal)}</strong>
                          </div>
                          <div className={styles.priceLine}>
                            <span>Phí dịch vụ (5%)</span>
                            <strong>{formatPrice(serviceFee)}</strong>
                          </div>
                          <p className={styles.priceSummaryNote}>
                            <ShieldCheck size={14} />
                            Thanh toán sau khi gia sư xác nhận lịch học.
                          </p>
                        </aside>
                      </div>
                    </>
                  )}
                </div>

                <footer className={styles.modalFooter}>
                  <button type="button" className={styles.secondaryButton} onClick={goBack} disabled={step === 1}>
                    <ArrowLeft size={16} />
                    Quay lại
                  </button>
                  {step < 4 ? (
                    <button type="button" className={styles.primaryButton} onClick={goNext} disabled={!canContinue()}>
                      Tiếp theo
                      <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button type="button" className={styles.primaryButton} onClick={createBooking}>
                      Gửi yêu cầu
                      <ArrowRight size={16} />
                    </button>
                  )}
                </footer>
              </>
            )}

            {closeConfirmOpen && (
              <div className={styles.closeConfirm}>
                <div className={styles.closeConfirmCard}>
                  <h3>Thoát đặt lịch?</h3>
                  <p>Các lựa chọn hiện tại (môn, trẻ, gói, lịch học) sẽ bị xoá. Bạn có chắc muốn thoát?</p>
                  <div className={styles.closeConfirmActions}>
                    <button type="button" className={styles.secondaryButton} onClick={closeBooking}>
                      Thoát, bỏ lựa chọn
                    </button>
                    <button type="button" className={styles.primaryButton} onClick={() => setCloseConfirmOpen(false)}>
                      Tiếp tục đặt
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default ParentBookingDemo;

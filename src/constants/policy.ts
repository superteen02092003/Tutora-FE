/**
 * Trang "Về chúng tôi" (/about) gom phần giới thiệu Tutora và toàn bộ văn bản pháp lý vào
 * một chỗ, chuyển qua lại bằng sidebar.
 *
 * Nội dung và danh sách nằm trong DB (admin CRUD qua CMS) nên route là động theo slug. Các
 * hằng dưới đây chỉ là slug mà CODE cần trỏ tới đích danh — ô tick đồng ý ở đăng ký, đặt
 * lịch, thanh toán, rút tiền. Văn bản admin tự tạo thêm vẫn xem được qua /about/<slug> mà
 * không phải sửa file này.
 */

/** Trang mặc định của mục "Về chúng tôi" — chính là văn bản giới thiệu (slug `about`). */
export const ABOUT_BASE_PATH = '/about';

export const POLICY_SLUGS = {
  about: 'about',
  terms: 'terms',
  privacy: 'privacy',
  cookies: 'cookies',
  communityGuidelines: 'community-guidelines',
  tutorAgreement: 'tutor-agreement',
} as const;

export type PolicySlug = (typeof POLICY_SLUGS)[keyof typeof POLICY_SLUGS];

/** `about` dùng URL gốc cho gọn, các văn bản còn lại nằm dưới nó. */
export const policyPath = (slug: string) =>
  slug === POLICY_SLUGS.about ? ABOUT_BASE_PATH : `${ABOUT_BASE_PATH}/${slug}`;

/**
 * Nhãn hiển thị trong câu "Tôi đồng ý với ..." và ở Footer.
 *
 * Cố ý lấy tĩnh chứ không fetch: ô tick nằm trong form đăng ký/thanh toán, không đáng để
 * chặn render chỉ vì chờ một lời gọi API lấy tiêu đề. Nếu admin đổi tiêu đề trên CMS thì
 * trang /about hiển thị tên mới, còn nhãn ngắn ở đây giữ nguyên.
 */
export const POLICY_LABELS: Record<PolicySlug, string> = {
  about: 'Về TopTutor',
  terms: 'Điều khoản sử dụng',
  privacy: 'Chính sách bảo mật',
  cookies: 'Chính sách Cookie',
  'community-guidelines': 'Quy tắc cộng đồng',
  'tutor-agreement': 'Thoả thuận gia sư',
};

/**
 * Icon Material Symbols cho sidebar. Slug do admin tự tạo sẽ không có ở đây — dùng icon
 * mặc định thay vì để trống, tránh danh sách bị so le.
 */
export const POLICY_ICONS: Record<string, string> = {
  about: 'info',
  terms: 'gavel',
  privacy: 'lock',
  cookies: 'cookie',
  'community-guidelines': 'groups',
  'tutor-agreement': 'handshake',
};

export const DEFAULT_POLICY_ICON = 'description';

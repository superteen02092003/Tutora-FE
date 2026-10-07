import { useEffect, useState } from 'react';
import { FileText, Image as ImageIcon, Loader2, ExternalLink, Upload } from 'lucide-react';
import { getMaterials, type LearningMaterialResponse } from '../../../../services/materials.service';
import UploadMaterialModal from './UploadMaterialModal';
import styles from '../../styles.module.css';

interface MaterialsTabProps {
  bookingId: number | null;
  /** Chỉ GIA SƯ mới được tải tài liệu lên. */
  canUpload: boolean;
  refreshToken: number;
  /** Gọi sau khi tải lên xong để báo cho phía còn lại. */
  onUploaded: () => void;
}

const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

const isImage = (m: LearningMaterialResponse) =>
  IMAGE_TYPES.includes((m.fileType ?? '').toLowerCase());

const formatSize = (bytes?: number) => {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/**
 * Tài liệu học tập của khoá — gia sư và học sinh đều xem được.
 */
const MaterialsTab = ({ bookingId, canUpload, refreshToken, onUploaded }: MaterialsTabProps) => {
  const [materials, setMaterials] = useState<LearningMaterialResponse[]>([]);
  const [loading, setLoading] = useState(bookingId != null);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  // Tăng lên sau khi tải lên xong để nạp lại danh sách.
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;

    getMaterials(bookingId)
      .then((res) => {
        if (cancelled) return;
        setMaterials(res.content ?? []);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError('Không tải được danh sách tài liệu.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bookingId, reloadTick, refreshToken]);

  // Nút "Tải lên"
  const body = loading ? (
    <div className={styles.practiceEmpty}>
      <Loader2 size={18} className={styles.practiceSpin} />
      <p>Đang tải tài liệu…</p>
    </div>
  ) : error ? (
    <div className={styles.practiceEmpty}>
      <p>{error}</p>
    </div>
  ) : materials.length === 0 ? (
    <div className={styles.practiceEmpty}>
      <img src="/images/icons/folder-empty.png" alt="" className={styles.emptyStateIcon} />
      <p>
        Chưa có tài liệu nào cho khoá học này.
        {canUpload && ' Bấm "Tải tài liệu lên" để thêm.'}
      </p>
    </div>
  ) : (
    <div className={styles.practiceScroll}>
      <ul className={styles.materialFeed}>
        {materials.map((m) => {
          const image = isImage(m);
          const ready = m.contentStatus !== 'processing';

          return (
            <li key={m.materialId} className={styles.materialPost}>
              <img src="/toptutor-logo.png" alt="" className={styles.materialAvatar} />

              <div className={styles.materialPostBody}>
                <p className={styles.materialPostHead}>
                  <span className={styles.materialPostAuthor}>Tài liệu buổi học</span>
                  {m.createdAt && (
                    <span className={styles.materialPostDate}>
                      {new Date(m.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  )}
                </p>

                <a
                  href={m.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.materialCard}
                  title={`Mở ${m.title}`}
                >
                  {/* Ảnh xem trước: ảnh hiện thẳng; PDF nhúng iframe KHÔNG tương tác
                      (pointer-events: none trong CSS) để cả thẻ vẫn bấm mở được. */}
                  <span className={styles.materialPreview}>
                    {!ready ? (
                      <span className={styles.materialPreviewNote}>Đang xử lý nội dung…</span>
                    ) : image ? (
                      <img src={m.fileUrl} alt="" className={styles.materialPreviewImg} />
                    ) : (
                      <iframe
                        src={`${m.fileUrl}#toolbar=0&navpanes=0&view=FitH`}
                        title=""
                        tabIndex={-1}
                        aria-hidden
                        className={styles.materialPreviewFrame}
                      />
                    )}
                  </span>

                  <span className={styles.materialCardFoot}>
                    <span className={styles.materialIcon}>
                      {image ? <ImageIcon size={15} /> : <FileText size={15} />}
                    </span>
                    <span className={styles.materialBody}>
                      <span className={styles.materialTitle}>{m.title}</span>
                      <span className={styles.materialMeta}>
                        {[
                          (m.fileType ?? '').toUpperCase(),
                          formatSize(m.fileSize),
                          m.pageCount ? `${m.pageCount} trang` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span className={styles.materialOpenHint}>
                      <ExternalLink size={13} />
                    </span>
                  </span>
                </a>

                {m.contentStatus === 'processing' && (
                  <p className={styles.materialPending}>
                    <Loader2 size={10} className={styles.practiceSpin} />
                    Đang xử lý nội dung
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div className={styles.materialsPane}>
      {body}

      {canUpload && bookingId != null && (
        <div className={styles.materialsFooter}>
          <button
            type="button"
            className={styles.uploadTriggerBtn}
            onClick={() => setUploadOpen(true)}
          >
            <Upload size={14} />
            Tải tài liệu lên
          </button>
        </div>
      )}

      {uploadOpen && bookingId != null && (
        <UploadMaterialModal
          bookingId={bookingId}
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setReloadTick((v) => v + 1);
            onUploaded();
          }}
        />
      )}
    </div>
  );
};

export default MaterialsTab;

/**
 * Bộ phân tích cảm xúc / độ tập trung chạy CỤC BỘ trong trình duyệt — port từ
 * emotion-classroom-service/app/services/ai.py.
 *
 * Pipeline (mỗi frame):
 *   1. MediaPipe FaceLandmarker (WASM) → detect mặt + 478 landmark.
 *   2. EAR (eye aspect ratio) từ landmark mắt → phát hiện buồn ngủ (nhắm mắt).
 *   3. Crop vùng mặt → grayscale → resize 64×64 → FER+ ONNX (onnxruntime-web) → 8 cảm xúc.
 *   4. Tính engagement_score theo trọng số cảm xúc; buồn ngủ override + cap điểm.
 *
 * ẢNH KHÔNG RỜI MÁY: toàn bộ inference chạy client-side, chỉ điểm số/nhãn được trả ra.
 *
 * Model artifacts đặt tĩnh trong public/ (xem EMOTION_MODEL_URL / FACE_LANDMARKER_URL):
 *   - public/models/emotion-ferplus-8.onnx  (ONNX Model Zoo — cùng model bản Python)
 *   - public/models/face_landmarker.task    (MediaPipe FaceLandmarker)
 * Các lib nặng (@mediapipe/tasks-vision, onnxruntime-web) được import động để không phình bundle.
 */

// FER+ ONNX Model Zoo — 8 lớp, đúng thứ tự (khớp ai.py).
export const EMOTIONS = [
  'neutral',
  'happy',
  'surprise',
  'fear',
  'sad',
  'disgust',
  'angry',
  'contempt',
] as const;

export type Emotion = (typeof EMOTIONS)[number] | 'drowsy' | 'unknown';

const ENGAGEMENT_WEIGHTS: Record<(typeof EMOTIONS)[number], number> = {
  happy: 1.0,
  neutral: 0.65,
  surprise: 0.5,
  sad: 0.2,
  fear: 0.1,
  disgust: 0.1,
  angry: 0.0,
  contempt: 0.0,
};

// Chỉ số landmark mắt cho EAR — MediaPipe 478-point mesh (khớp ai.py).
const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
const EAR_THRESHOLD = 0.2; // dưới ngưỡng này → nhắm mắt

// Model FER+ nặng ~35 MB — vượt giới hạn 25 MiB/file của Cloudflare Pages, nên bản deploy trên
// Pages tải model từ nơi khác qua VITE_EMOTION_MODEL_URL. Không đặt biến thì dùng bản trong public/.
const EMOTION_MODEL_URL =
  (import.meta.env.VITE_EMOTION_MODEL_URL as string | undefined) || '/models/emotion-ferplus-8.onnx';
const FACE_LANDMARKER_URL = '/models/face_landmarker.task';
// WASM binaries của onnxruntime-web. KHÔNG đặt trong public/ vì onnxruntime tải loader .mjs bằng
// import() động — Vite chặn import file trong public/ từ source. Dùng CDN jsDelivr khớp version cài
// (chỉ runtime WASM ~vài MB, trình duyệt cache lại; model FER+ vẫn tải local). Để self-host khi
// go-live: bọc bằng vite-plugin-static-copy hoặc phục vụ /ort ngoài public/.
const ORT_WASM_PATH = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${'1.27.0'}/dist/`;
// WASM của MediaPipe tasks-vision — FilesetResolver tự tải loader từ đây (CDN chính thức).
const MEDIAPIPE_WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';

export interface FrameAnalysis {
  faceDetected: boolean;
  emotion: Emotion;
  scores: Record<string, number>;
  engagementScore: number;
  drowsy: boolean;
}

interface Landmark {
  x: number;
  y: number;
  z?: number;
}

// Kiểu tối thiểu để tránh phụ thuộc import tĩnh — các lib được nạp động.
type FaceLandmarker = {
  detect: (image: HTMLCanvasElement | ImageData | HTMLVideoElement) => {
    faceLandmarks: Landmark[][];
  };
};
type OrtModule = typeof import('onnxruntime-web');
type OrtSession = import('onnxruntime-web').InferenceSession;

let faceLandmarker: FaceLandmarker | null = null;
let ort: OrtModule | null = null;
let emotionSession: OrtSession | null = null;
let initPromise: Promise<void> | null = null;

/** Nạp model 1 lần (lazy). Trả về promise dùng chung để tránh khởi tạo song song. */
export function initEmotionEngine(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const [{ FaceLandmarker: FL, FilesetResolver }, ortModule] = await Promise.all([
      import('@mediapipe/tasks-vision'),
      import('onnxruntime-web'),
    ]);

    ort = ortModule;
    ort.env.wasm.wasmPaths = ORT_WASM_PATH;

    const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH);
    faceLandmarker = (await FL.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_LANDMARKER_URL },
      numFaces: 1,
      runningMode: 'IMAGE',
    })) as unknown as FaceLandmarker;

    emotionSession = await ort.InferenceSession.create(EMOTION_MODEL_URL);
  })();
  return initPromise;
}

function noFaceResult(): FrameAnalysis {
  return {
    faceDetected: false,
    emotion: 'unknown',
    scores: Object.fromEntries(EMOTIONS.map((e) => [e, 0])),
    engagementScore: 0,
    drowsy: false,
  };
}

function eyeAspectRatio(lm: Landmark[], idx: number[], w: number, h: number): number {
  const p = idx.map((i) => [lm[i].x * w, lm[i].y * h] as [number, number]);
  const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const a = dist(p[1], p[5]);
  const b = dist(p[2], p[4]);
  const c = dist(p[0], p[3]);
  return (a + b) / (2.0 * c + 1e-6);
}

function softmax(x: Float32Array | number[]): number[] {
  const max = Math.max(...x);
  const exps = Array.from(x, (v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

/**
 * Cắt vùng mặt từ bounding box của landmarks, grayscale + resize 64×64, trả tensor [1,1,64,64].
 * Dùng canvas thay cho OpenCV — chênh nhỏ so với bản Python là chấp nhận được.
 */
function preprocessFace(
  source: CanvasImageSource,
  lm: Landmark[],
  srcW: number,
  srcH: number,
): Float32Array | null {
  const xs = lm.map((p) => p.x);
  const ys = lm.map((p) => p.y);
  const pad = 0.35;
  const bw = Math.max(...xs) - Math.min(...xs);
  const bh = Math.max(...ys) - Math.min(...ys);
  const x1 = Math.max(0, Math.floor((Math.min(...xs) - pad * bw) * srcW));
  const x2 = Math.min(srcW, Math.floor((Math.max(...xs) + pad * bw) * srcW));
  const y1 = Math.max(0, Math.floor((Math.min(...ys) - pad * bh) * srcH));
  const y2 = Math.min(srcH, Math.floor((Math.max(...ys) + pad * bh) * srcH));
  const cw = x2 - x1;
  const ch = y2 - y1;
  if (cw <= 0 || ch <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // Cắt + resize về 64×64 trong một bước drawImage.
  ctx.drawImage(source, x1, y1, cw, ch, 0, 0, 64, 64);
  const { data } = ctx.getImageData(0, 0, 64, 64);

  // Grayscale (luminance) → tensor [1,1,64,64].
  const out = new Float32Array(64 * 64);
  for (let i = 0; i < 64 * 64; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    out[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return out;
}

/**
 * Phân tích một frame. `source` là canvas/video/ImageData đã vẽ sẵn frame camera hiện tại.
 * Trả về {faceDetected, emotion, scores, engagementScore, drowsy}.
 */
export async function analyzeFrame(
  source: HTMLCanvasElement,
  width: number,
  height: number,
): Promise<FrameAnalysis> {
  if (!faceLandmarker || !ort || !emotionSession) {
    await initEmotionEngine();
  }
  if (!faceLandmarker || !ort || !emotionSession) return noFaceResult();

  let detection;
  try {
    detection = faceLandmarker.detect(source);
  } catch {
    return noFaceResult();
  }

  if (!detection.faceLandmarks || detection.faceLandmarks.length === 0) return noFaceResult();
  const lm = detection.faceLandmarks[0];

  // EAR → buồn ngủ
  const earL = eyeAspectRatio(lm, LEFT_EYE, width, height);
  const earR = eyeAspectRatio(lm, RIGHT_EYE, width, height);
  const ear = (earL + earR) / 2.0;
  const drowsy = ear < EAR_THRESHOLD;

  // Crop mặt + FER+
  const input = preprocessFace(source, lm, width, height);
  if (!input) return noFaceResult();

  let probs: number[];
  try {
    const tensor = new ort.Tensor('float32', input, [1, 1, 64, 64]);
    const inputName = emotionSession.inputNames[0];
    const output = await emotionSession.run({ [inputName]: tensor });
    const logits = output[emotionSession.outputNames[0]].data as Float32Array;
    probs = softmax(logits);
  } catch {
    return noFaceResult();
  }

  const scores: Record<string, number> = {};
  EMOTIONS.forEach((e, i) => {
    scores[e] = Math.round(probs[i] * 10000) / 10000;
  });

  let dominant: Emotion = EMOTIONS.reduce((a, b) => (scores[a] >= scores[b] ? a : b));

  let engagement =
    Math.round(EMOTIONS.reduce((sum, e) => sum + scores[e] * ENGAGEMENT_WEIGHTS[e], 0) * 10000) /
    10000;

  // Buồn ngủ override emotion + cap engagement.
  if (drowsy) {
    dominant = 'drowsy';
    engagement = Math.min(engagement, 0.15);
  }

  return {
    faceDetected: true,
    emotion: dominant,
    scores,
    engagementScore: engagement,
    drowsy,
  };
}

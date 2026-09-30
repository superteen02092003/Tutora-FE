// Cloudflare Pages từ chối file > 25 MiB. Chỉ chạy khi build trên Pages (CF_PAGES=1) để bản Vercel
// (tutora.vn) giữ nguyên. Hai file bị bỏ đều được tải từ nơi khác lúc chạy:
//   - ort-wasm-*.wasm: onnxruntime-web tải từ jsDelivr (ort.env.wasm.wasmPaths trong emotionEngine.ts)
//   - models/emotion-ferplus-8.onnx: tải từ VITE_EMOTION_MODEL_URL
import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

if (process.env.CF_PAGES !== '1') process.exit(0);

const LIMIT = 25 * 1024 * 1024;
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

for (const file of walk('dist')) {
  const size = statSync(file).size;
  if (size > LIMIT) {
    rmSync(file);
    console.log(`prune-pages-dist: removed ${file} (${(size / 1048576).toFixed(1)} MiB)`);
  }
}

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { scanReceipt } from '../services/claude';

const router = Router();

// ─── multer 설정: 메모리 저장 (Cloud Run 무상태 → 디스크 저장 금지) ──
// fileSize: 5MB 제한 (Claude API 한계 20MB이지만 모바일 체감 속도 고려)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('허용되지 않는 이미지 형식입니다. JPEG, PNG, GIF, WebP만 지원합니다.'));
    }
  },
});

// ─── POST /receipts/scan ──────────────────────────────────────
// 영수증 이미지를 받아 Claude Vision으로 분석 후 금액·메모를 반환합니다.
// Request: multipart/form-data, 필드명 "image"
// Response: { amount: number, memo: string }
router.post('/scan', upload.single('image'), async (req: Request, res: Response) => {
  // multer가 파일을 처리하지 못한 경우
  if (!req.file) {
    res.status(400).json({ error: '이미지 파일이 필요합니다.' });
    return;
  }

  try {
    const result = await scanReceipt(req.file.buffer, req.file.mimetype);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '영수증 분석에 실패했습니다.';

    // API 키 미설정: 서버 설정 오류 (500)
    if (message.includes('ANTHROPIC_API_KEY')) {
      console.error('[receipts/scan] ANTHROPIC_API_KEY 미설정');
      res.status(500).json({ error: '서버 설정 오류입니다.' });
      return;
    }

    console.error('[receipts/scan] 분석 실패:', err);
    res.status(422).json({ error: message });
  }
});

export default router;

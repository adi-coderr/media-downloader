import { Router } from 'express';
import { analyzeMedia } from '../controllers/media.controller';
import { validateAnalyzeRequest } from '../middleware/validateRequest';

const router = Router();

router.post('/analyze', validateAnalyzeRequest, analyzeMedia);

export default router;

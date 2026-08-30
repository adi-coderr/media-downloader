import { Router } from 'express';
import { streamDownload } from '../controllers/download.controller';
import { validateDownloadQuery } from '../middleware/validateRequest';

const router = Router();

router.get('/stream', validateDownloadQuery, streamDownload);

export default router;

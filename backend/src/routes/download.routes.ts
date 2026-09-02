import { Router } from 'express';
import { createDownload, downloadStatus, streamDownload } from '../controllers/download.controller';
import { validateDownloadBody, validateDownloadQuery } from '../middleware/validateRequest';

const router = Router();

router.get('/stream', validateDownloadQuery, streamDownload);
router.post('/', validateDownloadBody, createDownload);
router.get('/:id', downloadStatus);

export default router;

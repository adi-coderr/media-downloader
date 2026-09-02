import { Router } from 'express';
import { createDownload, downloadFile, downloadStatus, streamDownload } from '../controllers/download.controller';
import { validateDownloadBody, validateDownloadQuery } from '../middleware/validateRequest';

const router = Router();

router.get('/stream', validateDownloadQuery, streamDownload);
router.post('/', validateDownloadBody, createDownload);
router.get('/:id', downloadStatus);
router.get('/:id/file', downloadFile);

export default router;

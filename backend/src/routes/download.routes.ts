import { Router } from 'express';
import {
  cancelDownload,
  fetchDownloadFile,
  getAllDownloads,
  getDownload,
  pauseDownload,
  resumeDownload,
  startDownload,
} from '../controllers/download.controller';
import { validateDownloadRequest } from '../middleware/validateRequest';

const router = Router();

router.get('/', getAllDownloads);
router.post('/', validateDownloadRequest, startDownload);
router.get('/:id', getDownload);
router.post('/:id/pause', pauseDownload);
router.post('/:id/resume', resumeDownload);
router.post('/:id/cancel', cancelDownload);
router.get('/:id/file', fetchDownloadFile);

export default router;

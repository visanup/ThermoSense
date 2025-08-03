// File: service/data-service/src/routes/index.ts
import { Router } from 'express';
import devicesRouter from './devices.route';
import imageObjectRouter from './imageObject.route';
import temperatureReadingRouter from './temperatureReading.route';

const router = Router();

router.use('/devices', devicesRouter);
router.use('/image-objects', imageObjectRouter);
router.use('/temperature-readings', temperatureReadingRouter);

export default router;
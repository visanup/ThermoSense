import { Router } from 'express';
import devicesRouter from './devices.route';
import tempRouter from './temperatureReading.route';

const router = Router();

router.use('/devices', devicesRouter);
router.use('/temperature-readings', tempRouter);

export default router;

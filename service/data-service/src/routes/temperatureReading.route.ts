// src/routes/temperatureReading.route.ts
import { Router, Request, Response } from 'express';
import { TemperatureReadingService } from '../services/temperatureReading.service';

const router = Router();
const service = new TemperatureReadingService();

/**
 * POST /temperature-readings
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { device_uid, recorded_at, temperature, raw_image_id, processed_image_id } = req.body;
    if (!device_uid || !recorded_at || !temperature) {
      return res.status(400).json({ error: 'device_uid, recorded_at, temperature required' });
    }
    const created = await service.create({
      device_uid,
      recorded_at: new Date(recorded_at),
      temperature: temperature.toString(),
      raw_image_id,
      processed_image_id,
    });
    res.status(201).json(created);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'failed to create reading' });
  }
});

/**
 * GET /temperature-readings
 */
router.get('/', async (req: Request, res: Response) => {
  const device_uid = req.query.device_uid as string | undefined;
  const limit = Number(req.query.limit || 50);
  const offset = Number(req.query.offset || 0);
  const list = await service.list(device_uid, limit, offset);
  res.json(list);
});

/**
 * GET /temperature-readings/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const item = await service.getById(id);
  if (!item) return res.status(404).json({ error: 'not found' });
  res.json(item);
});

/**
 * PATCH /temperature-readings/:id
 */
router.patch('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const updated = await service.update(id, req.body);
  if (!updated) return res.status(404).json({ error: 'not found' });
  res.json(updated);
});

/**
 * DELETE /temperature-readings/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const ok = await service.delete(id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.status(204).send();
});

export default router;

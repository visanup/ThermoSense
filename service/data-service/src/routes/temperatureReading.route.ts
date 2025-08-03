// File: service/data-service/src/routes/temperatureReading.route.ts
import { Router, Request, Response } from 'express';
import { TemperatureReadingService } from '../services/temperatureReading.service';

const router = Router();
const service = new TemperatureReadingService();


router.get('/', async (req: Request, res: Response) => {
  try {
    const list = await service.list();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const r = await service.getById(id);
    if (!r) return res.status(404).json({ error: 'TemperatureReading not found' });
    res.json(r);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


router.post('/', async (req: Request, res: Response) => {
  try {
    const created = await service.create(req.body);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});


router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = await service.update(id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});


router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await service.delete(id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

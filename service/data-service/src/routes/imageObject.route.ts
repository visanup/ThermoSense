// File: service/data-service/src/routes/imageObject.route.ts
import { Router, Request, Response } from 'express';
import { ImageObjectService } from '../services/imageObject.service';

const router = Router();
const service = new ImageObjectService();


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
    const obj = await service.getById(id);
    if (!obj) return res.status(404).json({ error: 'ImageObject not found' });
    res.json(obj);
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
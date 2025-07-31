// src/routes/devices.route.ts
import { Router, Request, Response } from 'express';
import { DeviceService } from '../services/devices.service';

const router = Router();
const service = new DeviceService();

/**
 * @openapi
 * components:
 *   schemas:
 *     Device:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         device_uid:
 *           type: string
 *           example: "abc-123-xyz"
 *         name:
 *           type: string
 *           example: "Temperature Sensor A"
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     CreateDeviceRequest:
 *       type: object
 *       required:
 *         - device_uid
 *       properties:
 *         device_uid:
 *           type: string
 *           example: "abc-123-xyz"
 *         name:
 *           type: string
 *           example: "Temperature Sensor A"
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           example: "device_uid already exists"
 *     DeviceListResponse:
 *       type: object
 *       properties:
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Device'
 *         total:
 *           type: integer
 *           example: 123
 *         limit:
 *           type: integer
 *           example: 50
 *         offset:
 *           type: integer
 *           example: 0
 */

/**
 * @openapi
 * /devices:
 *   post:
 *     summary: Create a new device
 *     tags:
 *       - Devices
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateDeviceRequest'
 *     responses:
 *       "201":
 *         description: Device created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Device'
 *       "400":
 *         description: Missing required field
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       "409":
 *         description: Conflict - device_uid exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       "500":
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    if (!payload.device_uid) {
      return res.status(400).json({ error: 'device_uid is required' });
    }
    const existing = await service.getByUid(payload.device_uid);
    if (existing) {
      return res.status(409).json({ error: 'device_uid already exists' });
    }
    const created = await service.create(payload);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to create device' });
  }
});

/**
 * @openapi
 * /devices:
 *   get:
 *     summary: List devices with pagination
 *     tags:
 *       - Devices
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Maximum items to return
 *         required: false
 *         schema:
 *           type: integer
 *           default: 50
 *       - name: offset
 *         in: query
 *         description: Number of items to skip
 *         required: false
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       "200":
 *         description: List of devices
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeviceListResponse'
 */
router.get('/', async (req: Request, res: Response) => {
  const limit = Number(req.query.limit || 50);
  const offset = Number(req.query.offset || 0);
  const list = await service.list(limit, offset);
  res.json(list);
});

/**
 * @openapi
 * /devices/{id}:
 *   get:
 *     summary: Get a device by ID
 *     tags:
 *       - Devices
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Device numeric ID
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       "200":
 *         description: Device object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Device'
 *       "404":
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const device = await service.getById(id);
  if (!device) return res.status(404).json({ error: 'not found' });
  res.json(device);
});

/**
 * @openapi
 * /devices/{id}:
 *   patch:
 *     summary: Update a device by ID
 *     tags:
 *       - Devices
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Device numeric ID
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     requestBody:
 *       description: Fields to update
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Device Name"
 *     responses:
 *       "200":
 *         description: Updated device
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Device'
 *       "404":
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const updated = await service.update(id, req.body);
  if (!updated) return res.status(404).json({ error: 'not found' });
  res.json(updated);
});

/**
 * @openapi
 * /devices/{id}:
 *   delete:
 *     summary: Delete a device by ID
 *     tags:
 *       - Devices
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Device numeric ID
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       "204":
 *         description: Deleted successfully (no content)
 *       "404":
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const ok = await service.delete(id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.status(204).send();
});

export default router;

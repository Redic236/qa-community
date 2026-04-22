import { Router } from 'express';
import * as AuthController from '../controllers/AuthController';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { registerSchema, loginSchema, updateProfileSchema } from '../schemas/auth';
import { authLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), AuthController.register);
router.post('/login', authLimiter, validate(loginSchema), AuthController.login);
router.get('/me', requireAuth, AuthController.me);
router.patch('/me', requireAuth, validate(updateProfileSchema), AuthController.updateMe);

export default router;

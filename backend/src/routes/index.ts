import { Router } from 'express';
import authRouter from './auth';
import questionsRouter from './questions';
import answersRouter from './answers';
import votesRouter from './votes';
import usersRouter from './users';
import reportsRouter from './reports';
import commentsRouter from './comments';
import notificationsRouter from './notifications';
import adminRouter from './admin';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/questions', questionsRouter);
router.use('/answers', answersRouter);
router.use('/votes', votesRouter);
router.use('/reports', reportsRouter);
router.use('/comments', commentsRouter);
router.use('/notifications', notificationsRouter);
router.use('/admin', adminRouter);

export default router;

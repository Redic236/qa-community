import { sequelize } from '../config/database';
import { User, initUserModel } from './User';
import { Question, initQuestionModel } from './Question';
import { Answer, initAnswerModel } from './Answer';
import { Vote, initVoteModel } from './Vote';
import { PointRecord, initPointRecordModel } from './PointRecord';
import { Report, initReportModel } from './Report';
import { Comment, initCommentModel } from './Comment';
import { Notification, initNotificationModel } from './Notification';
import { Follow, initFollowModel } from './Follow';
import { UserAchievement, initUserAchievementModel } from './UserAchievement';
import { Upload, initUploadModel } from './Upload';

initUserModel(sequelize);
initQuestionModel(sequelize);
initAnswerModel(sequelize);
initVoteModel(sequelize);
initPointRecordModel(sequelize);
initReportModel(sequelize);
initCommentModel(sequelize);
initNotificationModel(sequelize);
initFollowModel(sequelize);
initUserAchievementModel(sequelize);
initUploadModel(sequelize);

User.hasMany(Question, { foreignKey: 'authorId', as: 'questions' });
Question.belongsTo(User, { foreignKey: 'authorId', as: 'author' });

User.hasMany(Answer, { foreignKey: 'authorId', as: 'answers' });
Answer.belongsTo(User, { foreignKey: 'authorId', as: 'author' });

Question.hasMany(Answer, { foreignKey: 'questionId', as: 'answerList' });
Answer.belongsTo(Question, { foreignKey: 'questionId', as: 'question' });

User.hasMany(Vote, { foreignKey: 'userId', as: 'votes' });
Vote.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(PointRecord, { foreignKey: 'userId', as: 'pointRecords' });
PointRecord.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Report, { foreignKey: 'reporterId', as: 'submittedReports' });
Report.belongsTo(User, { foreignKey: 'reporterId', as: 'reporter' });
Report.belongsTo(User, { foreignKey: 'reviewerId', as: 'reviewer' });

User.hasMany(Comment, { foreignKey: 'authorId', as: 'comments' });
Comment.belongsTo(User, { foreignKey: 'authorId', as: 'author' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Follow, { foreignKey: 'followerId', as: 'follows' });
Follow.belongsTo(User, { foreignKey: 'followerId', as: 'follower' });

User.hasMany(UserAchievement, { foreignKey: 'userId', as: 'achievements' });
UserAchievement.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Upload, { foreignKey: 'uploaderId', as: 'uploads' });
Upload.belongsTo(User, { foreignKey: 'uploaderId', as: 'uploader' });

export {
  sequelize,
  User,
  Question,
  Answer,
  Vote,
  PointRecord,
  Report,
  Comment,
  Notification,
  Follow,
  UserAchievement,
  Upload,
};

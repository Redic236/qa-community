import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { User } from '../models';
import { env } from '../config/env';
import { ROLES, type Role } from '../utils/constants';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors';

const SALT_ROUNDS = 10;

export interface UserDto {
  id: number;
  username: string;
  email: string;
  avatar: string | null;
  points: number;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResult {
  user: UserDto;
  token: string;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  username?: string;
  avatar?: string | null;
  currentPassword?: string;
  newPassword?: string;
}

function toDto(user: User): UserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar ?? null,
    points: user.points,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function signToken(user: { id: number; role: Role }): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign({ userId: user.id, role: user.role }, env.JWT_SECRET, options);
}

export class AuthService {
  static async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await User.findOne({
      where: { email: input.email },
    });
    if (existing) {
      throw new BadRequestError('Email already registered', 'emailRegistered');
    }

    const usernameTaken = await User.findOne({
      where: { username: input.username },
    });
    if (usernameTaken) {
      throw new BadRequestError('Username already taken', 'usernameTaken');
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const user = await User.create({
      username: input.username,
      email: input.email,
      password: passwordHash,
    });

    return { user: toDto(user), token: signToken({ id: user.id, role: user.role }) };
  }

  static async login(input: LoginInput): Promise<AuthResult> {
    const user = await User.findOne({ where: { email: input.email } });
    if (!user) {
      throw new UnauthorizedError('Invalid credentials', 'invalidCredentials');
    }

    const match = await bcrypt.compare(input.password, user.password);
    if (!match) {
      throw new UnauthorizedError('Invalid credentials', 'invalidCredentials');
    }

    return { user: toDto(user), token: signToken({ id: user.id, role: user.role }) };
  }

  static async updateProfile(userId: number, input: UpdateProfileInput): Promise<UserDto> {
    const user = await User.findByPk(userId);
    if (!user) throw new NotFoundError('User not found', 'userNotFound');

    if (input.username !== undefined && input.username !== user.username) {
      const existing = await User.findOne({ where: { username: input.username } });
      if (existing) throw new BadRequestError('Username already taken', 'usernameTaken');
      user.username = input.username;
    }

    if (input.avatar !== undefined) {
      user.avatar = input.avatar;
    }

    if (input.newPassword) {
      if (!input.currentPassword) {
        throw new BadRequestError(
          'Current password is required to change password',
          'currentPasswordRequired'
        );
      }
      const match = await bcrypt.compare(input.currentPassword, user.password);
      // 400 rather than 401: the user IS authenticated, their request payload
      // is just wrong. A 401 here would trip the frontend's auto-logout and
      // evict the session, which is the opposite of what we want.
      if (!match) throw new BadRequestError('Current password is incorrect', 'currentPasswordIncorrect');
      user.password = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
    }

    await user.save();
    return toDto(user);
  }

  static verifyToken(token: string): { userId: number; role: Role } {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      if (typeof payload === 'object' && payload !== null && 'userId' in payload) {
        const obj = payload as { userId: number; role?: Role };
        // Tokens issued before the role rollout don't carry one — treat them
        // as plain users. Admins must re-login to pick up the role claim.
        return {
          userId: Number(obj.userId),
          role: obj.role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.USER,
        };
      }
      throw new UnauthorizedError('Invalid token payload', 'invalidTokenPayload');
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError('Invalid token', 'invalidToken');
    }
  }
}

export { toDto as toUserDto };

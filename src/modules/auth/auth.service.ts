import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as admin from 'firebase-admin';
import { getFirebaseApp } from '../../config/firebase.config';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class AuthService {
  private readonly firebaseApp: admin.app.App;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    this.firebaseApp = getFirebaseApp(configService);
  }

  async verifyAndLoadUser(idToken: string): Promise<UserDocument> {
    let decodedToken: admin.auth.DecodedIdToken;
    try {
      decodedToken = await this.firebaseApp.auth().verifyIdToken(idToken);
    } catch {
      throw new UnauthorizedException({ error: 'AUTH_INVALID' });
    }

    const { uid, email, name, picture } = decodedToken;

    const user = await this.userModel.findOneAndUpdate(
      { $or: [{ firebaseUid: uid }, { email: email ?? '' }] },
      {
        $set: { firebaseUid: uid },
        $setOnInsert: {
          email: email ?? '',
          displayName: name ?? '',
          photoUrl: picture ?? '',
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    if (!user) throw new UnauthorizedException({ error: 'AUTH_INVALID' });
    return user;
  }

  async createSession(idToken: string): Promise<{ user: UserDocument; expiresAt: Date }> {
    const user = await this.verifyAndLoadUser(idToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h
    return { user, expiresAt };
  }
}

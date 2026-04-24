import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

let firebaseApp: admin.app.App | undefined;

export function getFirebaseApp(configService: ConfigService): admin.app.App {
  if (firebaseApp) return firebaseApp;

  const saJson = configService.get<string>('FIREBASE_ADMIN_SA_JSON');
  if (!saJson) throw new Error('FIREBASE_ADMIN_SA_JSON is required');

  const serviceAccount = JSON.parse(saJson) as admin.ServiceAccount;

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return firebaseApp;
}

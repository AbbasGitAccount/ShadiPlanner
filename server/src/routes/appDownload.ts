import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ApkFileInfo {
  path: string;
  size: number;
  buildType: string;
  filename: string;
}

/**
 * Searches for compiled Android APK across standard local development and build output locations.
 */
function findLocalApk(): ApkFileInfo | null {
  if (process.env.APK_FILE_PATH && fs.existsSync(process.env.APK_FILE_PATH)) {
    try {
      const stat = fs.statSync(process.env.APK_FILE_PATH);
      if (stat.isFile() && stat.size > 0) {
        return {
          path: process.env.APK_FILE_PATH,
          size: stat.size,
          buildType: 'custom',
          filename: path.basename(process.env.APK_FILE_PATH),
        };
      }
    } catch {
      // Continue to search fallbacks
    }
  }

  const candidatePaths: Array<{ path: string; buildType: string }> = [
    // Standard debug APK location from workspace root
    {
      path: path.resolve(process.cwd(), 'mobile/android/app/build/outputs/apk/debug/app-debug.apk'),
      buildType: 'debug',
    },
    // Standard release APK location from workspace root
    {
      path: path.resolve(process.cwd(), 'mobile/android/app/build/outputs/apk/release/app-release.apk'),
      buildType: 'release',
    },
    // In case process.cwd() is server directory
    {
      path: path.resolve(process.cwd(), '../mobile/android/app/build/outputs/apk/debug/app-debug.apk'),
      buildType: 'debug',
    },
    {
      path: path.resolve(process.cwd(), '../mobile/android/app/build/outputs/apk/release/app-release.apk'),
      buildType: 'release',
    },
    // Relative to compiled __dirname (dist/routes or src/routes)
    {
      path: path.resolve(__dirname, '../../mobile/android/app/build/outputs/apk/debug/app-debug.apk'),
      buildType: 'debug',
    },
    {
      path: path.resolve(__dirname, '../../../mobile/android/app/build/outputs/apk/debug/app-debug.apk'),
      buildType: 'debug',
    },
    {
      path: path.resolve(__dirname, '../../../../mobile/android/app/build/outputs/apk/debug/app-debug.apk'),
      buildType: 'debug',
    },
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate.path)) {
      try {
        const stat = fs.statSync(candidate.path);
        if (stat.isFile() && stat.size > 0) {
          return {
            path: candidate.path,
            size: stat.size,
            buildType: candidate.buildType,
            filename: 'ShadiPlanner.apk',
          };
        }
      } catch {
        // Continue to search fallbacks
      }
    }
  }

  return null;
}

/**
 * GET /api/download/info
 * Returns metadata about the latest mobile APK build and availability.
 */
router.get('/info', (_req: Request, res: Response) => {
  const localApk = findLocalApk();
  const externalUrl = process.env.APK_DOWNLOAD_URL?.trim() || null;
  const isAvailable = Boolean(localApk || externalUrl);

  const sizeFormatted = localApk
    ? `${(localApk.size / (1024 * 1024)).toFixed(1)} MB`
    : '~254 MB';

  res.json({
    available: isAvailable,
    appName: 'ShadiPlanner',
    packageName: 'com.shadiplanner.app',
    version: '1.0.0',
    versionCode: 1,
    buildType: localApk?.buildType || (externalUrl ? 'release' : 'debug'),
    minAndroidVersion: 'Android 8.0 (Oreo / API 26)+',
    architectures: ['arm64-v8a', 'armeabi-v7a', 'x86_64'],
    fileName: 'ShadiPlanner.apk',
    downloadUrl: '/api/download/apk',
    externalUrl,
    fileSize: localApk?.size || null,
    fileSizeFormatted: sizeFormatted,
    installGuide: [
      'Download ShadiPlanner.apk directly to your Android device.',
      'If prompted with "File might be harmful", tap "Download anyway".',
      'Open the file from your Notifications or Downloads folder and tap "Install".',
      'If prompted, toggle "Allow from this source" in Android Settings.',
    ],
  });
});

/**
 * GET /api/download/apk
 * Serves the Android APK file or redirects to a cloud release URL if configured.
 */
router.get('/apk', (_req: Request, res: Response) => {
  const externalUrl = process.env.APK_DOWNLOAD_URL?.trim();
  if (externalUrl) {
    return res.redirect(302, externalUrl);
  }

  const localApk = findLocalApk();
  if (!localApk) {
    return res.status(404).json({
      error: 'APK not found',
      message:
        'The Android APK is not currently hosted on this server instance. Run "cd mobile/android && ./gradlew assembleDebug" to build it locally, or set the APK_DOWNLOAD_URL environment variable to a cloud storage or GitHub Release link.',
      status: 404,
    });
  }

  // Set explicit download headers
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="ShadiPlanner.apk"');
  res.setHeader('Content-Length', localApk.size);
  res.setHeader('Cache-Control', 'public, max-age=3600');

  return res.download(localApk.path, 'ShadiPlanner.apk', (err) => {
    if (err && !res.headersSent) {
      console.error('Error sending APK download:', err);
      res.status(500).json({ error: 'Failed to stream APK download' });
    }
  });
});

// Alias for root of this router
router.get('/', (req: Request, res: Response) => {
  if (req.accepts('html') || !req.accepts('json')) {
    // Redirect to the client-side download page when accessed in a browser
    return res.redirect('/download');
  }
  return res.redirect('/api/download/info');
});

export default router;

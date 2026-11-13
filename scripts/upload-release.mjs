import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

import { execSync } from 'node:child_process';

function getGitBinary() {
  const custom = 'C:\\Users\\farhad abbas\\AppData\\Local\\GitHubDesktop\\app-3.6.7\\resources\\app\\git\\cmd\\git.exe';
  if (fs.existsSync(custom)) return `"${custom}"`;
  return 'git';
}

function getGitHubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const gitBin = getGitBinary();
  try {
    const creds = execSync(`${gitBin} credential fill`, {
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const match = creds.match(/password=(.+)/);
    if (match) return match[1].trim();
  } catch {
    // ignore
  }
  return null;
}

const token = getGitHubToken();
if (!token) {
  console.error('GITHUB_TOKEN environment variable or git credential helper token is required.');
  process.exit(1);
}
const owner = 'AbbasGitAccount';
const repo = 'ShadiPlanner';
const tag = 'v1.0.0';

const releaseApk = path.resolve('mobile/android/app/build/outputs/apk/release/app-release.apk');
const debugApk = path.resolve('mobile/android/app/build/outputs/apk/debug/app-debug.apk');
const apkPath = fs.existsSync(releaseApk) ? releaseApk : debugApk;

if (!fs.existsSync(apkPath)) {
  console.error('APK file not found at release or debug path:', releaseApk);
  process.exit(1);
}

const stats = fs.statSync(apkPath);
console.log(`Found APK: ${apkPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

async function createRelease() {
  const body = JSON.stringify({
    tag_name: tag,
    target_commitish: 'main',
    name: 'ShadiPlanner v1.0.0 Android APK',
    body: 'Direct Android APK build for ShadiPlanner Matrimonial & Wedding Planning platform.\n\n- Standalone APK compatible with Android 8.0 (API 26) and above.\n- Architectures: arm64-v8a, armeabi-v7a, x86_64.\n- Direct download: [ShadiPlanner.apk](https://github.com/AbbasGitAccount/ShadiPlanner/releases/download/v1.0.0/ShadiPlanner.apk)',
    draft: false,
    prerelease: false,
  });

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'User-Agent': 'Node-Uploader',
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    // If release for tag already exists, find it
    if (res.status === 422) {
      console.log('Release or tag already exists, fetching existing release...');
      const existingRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`, {
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'Node-Uploader',
          'Accept': 'application/vnd.github.v3+json',
        },
      });
      if (existingRes.ok) {
        return existingRes.json();
      }
    }
    throw new Error(`Failed to create release (${res.status}): ${errText}`);
  }

  return res.json();
}

function uploadAsset(releaseId) {
  return new Promise((resolve, reject) => {
    console.log(`Uploading asset to release ${releaseId}...`);

    let uploadedBytes = 0;
    const fileStream = fs.createReadStream(apkPath);

    fileStream.on('data', (chunk) => {
      uploadedBytes += chunk.length;
      const pct = ((uploadedBytes / stats.size) * 100).toFixed(1);
      process.stdout.write(`\rUploading: ${pct}% (${(uploadedBytes / 1024 / 1024).toFixed(1)} MB / ${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
    });

    const req = https.request(
      {
        hostname: 'uploads.github.com',
        path: `/repos/${owner}/${repo}/releases/${releaseId}/assets?name=ShadiPlanner.apk`,
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'Node-Uploader',
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Length': stats.size,
          'Accept': 'application/vnd.github.v3+json',
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (d) => (responseBody += d));
        res.on('end', () => {
          console.log('\nUpload response status:', res.statusCode);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(responseBody);
              resolve(parsed);
            } catch {
              resolve(responseBody);
            }
          } else {
            reject(new Error(`Asset upload failed (${res.statusCode}): ${responseBody}`));
          }
        });
      }
    );

    req.on('error', (err) => {
      console.error('\nUpload error:', err);
      reject(err);
    });

    fileStream.pipe(req);
  });
}

async function main() {
  try {
    console.log('Creating GitHub Release...');
    const release = await createRelease();
    console.log('Release created with ID:', release.id, 'Tag:', release.tag_name);

    // If an asset named ShadiPlanner.apk already exists on this release, delete it first
    if (release.assets && release.assets.length > 0) {
      for (const asset of release.assets) {
        if (asset.name === 'ShadiPlanner.apk') {
          console.log(`Deleting existing asset ${asset.id}...`);
          await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${asset.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `token ${token}`,
              'User-Agent': 'Node-Uploader',
            },
          });
        }
      }
    }

    const asset = await uploadAsset(release.id);
    console.log('\nSuccess! Direct APK download URL:');
    console.log(`https://github.com/${owner}/${repo}/releases/download/${tag}/ShadiPlanner.apk`);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();

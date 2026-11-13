import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Smartphone,
  Download,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Info,
  CalendarHeart,
  MessageCircle,
  Heart
} from 'lucide-react';
import { api, getApkDownloadUrl, ApkDownloadInfo } from '../services/api';

export const DownloadAppPage: React.FC = () => {
  const [apkInfo, setApkInfo] = useState<ApkDownloadInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);

  const downloadUrl = apkInfo?.externalUrl || getApkDownloadUrl();

  useEffect(() => {
    let mounted = true;
    api.getApkInfo()
      .then((data) => {
        if (mounted) setApkInfo(data);
      })
      .catch(() => {
        // Fallback to static info if backend metadata fails
        if (mounted) {
          setApkInfo({
            available: true,
            appName: 'ShadiPlanner',
            packageName: 'com.shadiplanner.app',
            version: '1.0.0',
            versionCode: 1,
            buildType: 'release',
            minAndroidVersion: 'Android 8.0 (API 26)+',
            architectures: ['arm64-v8a', 'armeabi-v7a', 'x86_64'],
            fileName: 'ShadiPlanner.apk',
            downloadUrl: downloadUrl,
            externalUrl: downloadUrl,
            fileSize: 266598141,
            fileSizeFormatted: '254.2 MB',
          });
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignore clipboard write failure
    }
  };

  const handleDownloadClick = () => {
    setDownloadStarted(true);
    setTimeout(() => setDownloadStarted(false), 8000);
  };

  return (
    <div className="bg-[#fffcf8] min-h-screen text-[#352629] pb-20">
      {/* Hero Header */}
      <section className="bg-gradient-to-b from-[#f8ece9] via-[#fff5f2] to-[#fffcf8] border-b border-[#f0deda] pt-12 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-100 text-rose-800 text-xs font-semibold mb-5 tracking-wide">
            <Smartphone className="w-4 h-4 text-rose-600" />
            ANDROID APPLICATION (.APK)
          </div>

          <h1 className="font-playfair text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
            Download <span className="text-rose-600 italic">ShadiPlanner</span> for Android
          </h1>

          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Carry your matrimonial search and wedding planning wherever you go. Browse verified biodatas, send interests, chat, and manage your wedding budget on the go.
          </p>

          {/* Download Box */}
          <div className="mt-10 max-w-xl mx-auto bg-white rounded-2xl shadow-xl border border-rose-100 p-6 sm:p-8 text-left transition-all">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-200 shrink-0">
                <Heart className="w-10 h-10" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-xl font-bold text-slate-900">ShadiPlanner</h2>
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    v{apkInfo?.version || '1.0.0'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Package: {apkInfo?.packageName || 'com.shadiplanner.app'}</p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-slate-600 mt-3">
                  <span><strong>Size:</strong> {apkInfo?.fileSizeFormatted || '~254 MB'}</span>
                  <span>•</span>
                  <span><strong>OS:</strong> {apkInfo?.minAndroidVersion || 'Android 8.0+'}</span>
                </div>
              </div>
            </div>

            {/* Direct Action Button */}
            <div className="mt-7 pt-6 border-t border-slate-100 flex flex-col gap-3">
              <a
                href={downloadUrl}
                download="ShadiPlanner.apk"
                onClick={handleDownloadClick}
                className="w-full inline-flex items-center justify-center gap-3 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-semibold py-4 px-6 rounded-xl shadow-md hover:shadow-lg transition-all text-base group"
              >
                <Download className="w-5 h-5 transition-transform group-hover:scale-110" />
                <span>Download Android APK</span>
              </a>

              {downloadStarted && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Download requested! Check your browser's download drawer or notification bar.</span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-500 pt-2 px-1">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Direct standalone APK
                </span>
                <button
                  onClick={handleCopyLink}
                  type="button"
                  className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-medium"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Link copied!' : 'Copy download page'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Step Installation Instructions */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16" aria-labelledby="install-guide-heading">
        <div className="text-center mb-10">
          <p className="text-xs font-bold tracking-widest text-rose-600 uppercase">STEP-BY-STEP INSTRUCTIONS</p>
          <h2 id="install-guide-heading" className="font-playfair text-2xl sm:text-3xl font-bold text-slate-900 mt-2">
            How to Install on Android
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            Since this is a direct APK build, follow these three quick steps to install it on your Android phone or tablet.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="bg-white rounded-xl p-6 border border-[#ecdcd5] shadow-sm relative flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 font-bold flex items-center justify-center text-lg mb-4">
                1
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-2">Download the APK</h3>
              <p className="text-xs leading-relaxed text-slate-600">
                Click the <strong>Download Android APK</strong> button above. Your phone's browser (Chrome, Samsung Internet, etc.) will start downloading the file.
              </p>
            </div>
            <div className="mt-5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>If prompted with <em>"File might be harmful"</em>, tap <strong>Download anyway</strong>.</span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-xl p-6 border border-[#ecdcd5] shadow-sm relative flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 font-bold flex items-center justify-center text-lg mb-4">
                2
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-2">Allow Unknown Apps</h3>
              <p className="text-xs leading-relaxed text-slate-600">
                When you tap the downloaded file to open it, Android may ask permission to install unknown apps. Tap <strong>Settings</strong> and toggle on <strong>Allow from this source</strong>.
              </p>
            </div>
            <div className="mt-5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 flex items-start gap-2">
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <span>This is standard security on Android for apps installed outside Google Play.</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-xl p-6 border border-[#ecdcd5] shadow-sm relative flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 font-bold flex items-center justify-center text-lg mb-4">
                3
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-2">Install & Open</h3>
              <p className="text-xs leading-relaxed text-slate-600">
                Return to the prompt or open your phone's <strong>Files / Downloads</strong> app, tap <strong>ShadiPlanner.apk</strong>, and select <strong>Install</strong>. Once complete, tap <strong>Open</strong>!
              </p>
            </div>
            <div className="mt-5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>You're all set! Log in with your registered account or create a new profile.</span>
            </div>
          </div>
        </div>
      </section>

      {/* App Specifications & Features */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Features Highlights */}
          <div className="bg-white rounded-2xl p-7 border border-[#ecdcd5] shadow-sm">
            <h3 className="font-playfair text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Mobile App Features
            </h3>
            <ul className="space-y-3.5 text-sm text-slate-700">
              <li className="flex items-start gap-3">
                <Heart className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span><strong>Browse Verified Profiles:</strong> Explore filtered biodatas with photos, education, and family details.</span>
              </li>
              <li className="flex items-start gap-3">
                <MessageCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span><strong>Instant Messaging:</strong> Chat with mutual matches securely and receive notifications right on your phone.</span>
              </li>
              <li className="flex items-start gap-3">
                <CalendarHeart className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span><strong>Wedding Planner:</strong> Track your wedding checklist, manage your budget, and shortlist trusted vendors.</span>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span><strong>Privacy First:</strong> Contact details are protected until mutual interest consent is established.</span>
              </li>
            </ul>
          </div>

          {/* Technical Specifications */}
          <div className="bg-white rounded-2xl p-7 border border-[#ecdcd5] shadow-sm">
            <h3 className="font-playfair text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-rose-600" />
              Technical Specifications
            </h3>
            <div className="divide-y divide-slate-100 text-xs sm:text-sm">
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">App Name</span>
                <span className="font-semibold text-slate-800">ShadiPlanner</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Version</span>
                <span className="font-semibold text-slate-800">{apkInfo?.version || '1.0.0'} ({apkInfo?.buildType || 'debug'})</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Package Identifier</span>
                <span className="font-mono text-[11px] text-slate-800">{apkInfo?.packageName || 'com.shadiplanner.app'}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Required Operating System</span>
                <span className="font-semibold text-slate-800">{apkInfo?.minAndroidVersion || 'Android 8.0+'}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Supported Devices</span>
                <span className="font-semibold text-slate-800">All Android phones & tablets</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Architecture</span>
                <span className="font-semibold text-slate-800">arm64-v8a, armeabi-v7a, x86_64</span>
              </div>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-12 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-rose-700 hover:text-rose-800 underline"
          >
            ← Back to ShadiPlanner Home
          </Link>
        </div>
      </section>
    </div>
  );
};

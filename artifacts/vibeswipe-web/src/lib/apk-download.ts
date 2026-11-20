const apkDownloadUrl = '/api/installer/VIBESWIPES.apk';

export function shouldShowAndroidApkDownload(userAgent: string, inAppShell: boolean): boolean {
  return /\bandroid\b/i.test(userAgent) && !inAppShell;
}

export default apkDownloadUrl;

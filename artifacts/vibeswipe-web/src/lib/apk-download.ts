const apkDownloadUrl = '/api/installer/VIBESWIPES.apk';

export function shouldShowAndroidApkDownload(userAgent: string, inAppShell: boolean, installed: boolean): boolean {
  return /\bandroid\b/i.test(userAgent) && !inAppShell && !installed;
}

export default apkDownloadUrl;

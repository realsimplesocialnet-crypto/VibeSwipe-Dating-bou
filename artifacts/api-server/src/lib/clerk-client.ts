import { createClerkClient } from "@clerk/backend";

export type AppClerkCredentials = {
  publishableKey: string;
  secretKey: string;
  usesExternalClerk: boolean;
};

let cachedClient: ReturnType<typeof createClerkClient> | undefined;

export function getAppClerkCredentials(): AppClerkCredentials {
  const externalPublishableKey = process.env.MYAGE_EXTERNAL_CLERK_PUBLISHABLE_KEY?.trim();
  const externalSecretKey = process.env.MYAGE_EXTERNAL_CLERK_SECRET_KEY?.trim();
  const hasExternalKey = Boolean(externalPublishableKey || externalSecretKey);

  if (hasExternalKey && (!externalPublishableKey || !externalSecretKey)) {
    throw new Error(
      "External Clerk requires both MYAGE_EXTERNAL_CLERK_PUBLISHABLE_KEY and MYAGE_EXTERNAL_CLERK_SECRET_KEY.",
    );
  }

  const publishableKey = externalPublishableKey || process.env.CLERK_PUBLISHABLE_KEY?.trim();
  const secretKey = externalSecretKey || process.env.CLERK_SECRET_KEY?.trim();
  if (!publishableKey || !secretKey) {
    throw new Error("Clerk authentication is missing a publishable key or secret key.");
  }
  if (
    hasExternalKey &&
    process.env.NODE_ENV === "production" &&
    (!publishableKey.startsWith("pk_live_") || !secretKey.startsWith("sk_live_"))
  ) {
    throw new Error("Production deployments require live external Clerk credentials.");
  }

  return {
    publishableKey,
    secretKey,
    usesExternalClerk: hasExternalKey,
  };
}

export function getAppClerkClient() {
  if (!cachedClient) {
    const { publishableKey, secretKey } = getAppClerkCredentials();
    cachedClient = createClerkClient({ publishableKey, secretKey });
  }
  return cachedClient;
}

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { configureReleaseSigning } =
  require("../scripts/configure-android-release.cjs") as {
    configureReleaseSigning(source: string): string;
  };

const expoGradle = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled false
        }
    }
}`;

test("release builds use Codemagic signing while debug builds stay unchanged", () => {
  const configured = configureReleaseSigning(expoGradle);

  assert.match(configured, /storeFile file\(keystorePath\)/);
  assert.match(
    configured,
    /storePassword System\.getenv\("CM_KEYSTORE_PASSWORD"\)/,
  );
  assert.match(configured, /keyAlias System\.getenv\("CM_KEY_ALIAS"\)/);
  assert.match(configured, /keyPassword System\.getenv\("CM_KEY_PASSWORD"\)/);
  assert.match(configured, /debug\s*\{\s*signingConfig signingConfigs\.debug/s);
  assert.match(
    configured,
    /release\s*\{\s*signingConfig signingConfigs\.release/s,
  );
});

test("release-signing configuration can be applied repeatedly", () => {
  const once = configureReleaseSigning(expoGradle);
  assert.equal(configureReleaseSigning(once), once);
});

test("fails clearly if Expo's Gradle structure differs", () => {
  assert.throws(
    () =>
      configureReleaseSigning(
        "android { buildTypes { release { minifyEnabled false } } }",
      ),
    /expected signingConfigs block/,
  );
});

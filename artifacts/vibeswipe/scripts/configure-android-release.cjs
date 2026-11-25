const fs = require("node:fs");
const path = require("node:path");

const buildDir = process.env.CM_BUILD_DIR || process.cwd();
const gradlePath = path.join(
  buildDir,
  "artifacts/vibeswipe/android/app/build.gradle",
);

function matchingBrace(source, openingBrace) {
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error(
    "Could not find the closing brace for the Android Gradle block.",
  );
}

function configureReleaseSigning(source) {
  const signingConfigStart = source.search(/\bsigningConfigs\s*\{/);
  if (signingConfigStart < 0) {
    throw new Error("Expo did not generate the expected signingConfigs block.");
  }

  const signingConfigOpen = source.indexOf("{", signingConfigStart);
  const signingConfigClose = matchingBrace(source, signingConfigOpen);
  let configured = source;

  if (
    !source
      .slice(signingConfigOpen, signingConfigClose)
      .includes("CM_KEYSTORE_PATH")
  ) {
    const releaseSigning = `
        release {
            def keystorePath = System.getenv("CM_KEYSTORE_PATH")
            if (!keystorePath) {
                throw new GradleException("Codemagic release keystore is not configured.")
            }
            storeFile file(keystorePath)
            storePassword System.getenv("CM_KEYSTORE_PASSWORD")
            keyAlias System.getenv("CM_KEY_ALIAS")
            keyPassword System.getenv("CM_KEY_PASSWORD")
        }
`;
    configured =
      configured.slice(0, signingConfigOpen + 1) +
      releaseSigning +
      configured.slice(signingConfigOpen + 1);
  }

  const buildTypesStart = configured.search(/\bbuildTypes\s*\{/);
  if (buildTypesStart < 0) {
    throw new Error("Expo did not generate the expected buildTypes block.");
  }
  const releaseStart = configured.indexOf("release {", buildTypesStart);
  if (releaseStart < 0) {
    throw new Error("Expo did not generate a release build type.");
  }

  const releaseOpen = configured.indexOf("{", releaseStart);
  const releaseClose = matchingBrace(configured, releaseOpen);
  const releaseBlock = configured.slice(releaseOpen, releaseClose + 1);
  if (releaseBlock.includes("signingConfigs.release")) return configured;

  const debugSigning = /signingConfig\s+signingConfigs\.debug/;
  if (!debugSigning.test(releaseBlock)) {
    throw new Error(
      "Could not find Expo's default release signing configuration.",
    );
  }
  const signedReleaseBlock = releaseBlock.replace(
    debugSigning,
    "signingConfig signingConfigs.release",
  );
  return (
    configured.slice(0, releaseOpen) +
    signedReleaseBlock +
    configured.slice(releaseClose + 1)
  );
}

if (require.main === module) {
  if (!fs.existsSync(gradlePath)) {
    throw new Error(`Android Gradle file not found: ${gradlePath}`);
  }
  const original = fs.readFileSync(gradlePath, "utf8");
  const updated = configureReleaseSigning(original);
  fs.writeFileSync(gradlePath, updated);
  console.log("Configured the Android release build to use Codemagic signing.");
}

module.exports = { configureReleaseSigning };

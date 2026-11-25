const path = require("node:path");

function isPathInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative);
}

function resolveStaticFilePath(root, requestPath) {
  if (typeof requestPath !== "string") return null;
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  if (decodedPath.includes("\0")) return null;

  const relativeRequestPath = decodedPath.replace(/^[/\\]+/, "");
  const filePath = path.resolve(root, relativeRequestPath);
  return isPathInside(root, filePath) ? filePath : null;
}

module.exports = { isPathInside, resolveStaticFilePath };

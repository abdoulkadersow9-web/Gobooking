const { getDefaultConfig } = require("expo/metro-config");
const os   = require("os");
const path = require("path");

const config = getDefaultConfig(__dirname);

/* ── Use all available CPU cores for parallel bundling ── */
config.maxWorkers = Math.max(os.cpus().length - 1, 2);

/* ── Stable cache version — only bump if you change the transform pipeline ── */
config.cacheVersion = "gobooking-v3";

/* ── Faster resolver ── */
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: true,
  /* Block test/docs files from bundling — reduces resolver work */
  blockList: [
    /.*\/__tests__\/.*/,
    /.*\/\.git\/.*/,
    /.*\/docs?\/.*/,
  ],
  /* Stub react-native-maps on web — it uses native codegen APIs unavailable there */
  resolveRequest: (context, moduleName, platform) => {
    if (platform === "web" && moduleName === "react-native-maps") {
      return {
        filePath: path.resolve(__dirname, "stubs/react-native-maps.js"),
        type: "sourceFile",
      };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

/* ── Transformer: optimized for fast dev builds ── */
config.transformer = {
  ...config.transformer,
  assetPlugins: config.transformer?.assetPlugins ?? [],
};

/* ── Serializer: keep output lean ── */
config.serializer = {
  ...config.serializer,
};

/* ── Watcher: only watch relevant workspace directories ── */
config.watchFolders = [path.resolve(__dirname, "../..")];

module.exports = config;

const { getDefaultConfig } = require("expo/metro-config");
const os   = require("os");
const path = require("path");

const config = getDefaultConfig(__dirname);

/* ── Use all available CPU cores for parallel bundling ── */
config.maxWorkers = Math.max(os.cpus().length - 1, 2);

/* ── Stable cache version — only bump if you change the transform pipeline ── */
config.cacheVersion = "gobooking-v4";

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
  /**
   * inlineRequires: the single most impactful startup optimization in React Native.
   * Metro wraps require() calls so modules are only evaluated when first accessed,
   * NOT at bundle parse time. Heavy screens (route, company, suivi…) are deferred
   * until the user actually navigates to them.
   * Official recommendation: https://reactnative.dev/docs/ram-bundles-inline-requires
   */
  inlineRequires: true,
};

/* ── Serializer: keep output lean ── */
config.serializer = {
  ...config.serializer,
};

/* ── Watcher: only watch relevant workspace directories ── */
config.watchFolders = [path.resolve(__dirname, "../..")];

module.exports = config;

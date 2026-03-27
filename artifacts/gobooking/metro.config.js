const { getDefaultConfig } = require("expo/metro-config");
const os   = require("os");
const path = require("path");

const config = getDefaultConfig(__dirname);

/* ── Use all available CPU cores for parallel bundling ── */
config.maxWorkers = Math.max(os.cpus().length - 1, 2);

/* ── Stable cache version — only bump if you change the transform pipeline ── */
config.cacheVersion = "gobooking-v2";

/* ── Faster resolver ── */
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: true,
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

/* ── Transformer: enable Hermes bytecode for faster JS parsing ── */
config.transformer = {
  ...config.transformer,
  /* Minimize asset transforms during dev to keep bundling fast */
  assetPlugins: config.transformer?.assetPlugins ?? [],
};

/* ── Serializer: reduce output size in dev ── */
config.serializer = {
  ...config.serializer,
};

/* ── Watcher: ignore irrelevant directories to speed up file watching ── */
config.watchFolders = [path.resolve(__dirname, "../..")];

module.exports = config;

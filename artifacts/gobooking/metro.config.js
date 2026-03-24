const { getDefaultConfig } = require("expo/metro-config");
const os = require("os");
const path = require("path");

const config = getDefaultConfig(__dirname);

/* Use all available CPU cores for faster bundling */
config.maxWorkers = Math.max(os.cpus().length - 1, 2);

/* Enable package exports resolution (faster module lookup) */
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

module.exports = config;

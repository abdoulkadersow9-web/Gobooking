const { getDefaultConfig } = require("expo/metro-config");
const os = require("os");

const config = getDefaultConfig(__dirname);

/* Use all available CPU cores for faster bundling */
config.maxWorkers = Math.max(os.cpus().length - 1, 2);

/* Enable package exports resolution (faster module lookup) */
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: true,
};

module.exports = config;

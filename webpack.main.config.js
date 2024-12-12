const path = require("path");
const webpack = require("webpack");

module.exports = {
	/**
	 * This is the main entry point for your application, it's the first file
	 * that runs in the main process.
	 */
	entry: "./src/main.js",
	// Put your normal webpack config below here
	module: {
		rules: require("./webpack.rules"),
	},
	output: {
		path: path.resolve(__dirname, ".webpack/main"),
		filename: "main.js",
	},
	resolve: {
		extensions: [".js", ".json"],
		fallback: {
			path: false,
			fs: false,
			os: false,
		},
	},
	plugins: [
		new webpack.DefinePlugin({
			MAIN_WINDOW_WEBPACK_ENTRY: JSON.stringify("../renderer/index.html"),
		}),
	],
	node: {
		__dirname: false,
		__filename: false,
	},
	target: "electron-main",
};

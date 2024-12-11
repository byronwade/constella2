const rules = require("./webpack.rules");
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

rules.push({
	test: /\.css$/,
	use: [{ loader: "style-loader" }, { loader: "css-loader", options: { importLoaders: 1 } }, { loader: "postcss-loader" }],
});

module.exports = {
	entry: "./src/index.js",
	output: {
		filename: "index.js",
		path: path.resolve(__dirname, ".webpack/main_window"),
	},
	module: {
		rules,
	},
	resolve: {
		extensions: [".js", ".jsx", ".json"],
		fallback: {
			path: require.resolve("path-browserify"),
			fs: false,
			os: false,
		},
	},
	plugins: [
		new HtmlWebpackPlugin({
			template: path.resolve(__dirname, "src/index.html"),
			filename: "index.html",
		}),
	],
};

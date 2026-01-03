const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
    resolve: {
        extensions: [".js", ".jsx", ".ts", ".tsx"],
    },
    entry: {connector: "./src/index.tsx"},
    output: {
        filename: "[name].min.js",
        chunkFilename: "[name].min.js",
        path: path.resolve(__dirname, "lib"),
        library: "connector",
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: [
                    {
                        loader: "ts-loader",
                        options: {
                            compilerOptions: {
                                "noEmit": false,
                            },
                        },
                    },
                ],
                exclude: /node_modules/,
            },
            {
                test: /\.json$/,
                type: "javascript/auto",
                use: ["json-loader"],
            },
        ],
    },
    mode: "production",
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin()],
        splitChunks: {
            cacheGroups: {
                resources: {
                    test: /[\\/]resources\.json$/,
                    name: "translations",
                    chunks: "all",
                    enforce: true,
                },
            },
        },
    },
};

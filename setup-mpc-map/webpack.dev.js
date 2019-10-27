const path = require('path');

const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

// The path to the cesium source code
const cesiumSource = 'node_modules/cesium/Source';
const cesiumWorkers = '../Build/Cesium/Workers';

module.exports = [
  {
    context: __dirname,
    entry: {
      app: './src/index.ts',
    },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, 'dist'),

      // Needed by Cesium for multiline strings
      sourcePrefix: '',
    },
    amd: {
      // Enable webpack-friendly use of require in cesium
      toUrlUndefined: true,
    },
    node: {
      // Resolve node module use of fs
      fs: 'empty',
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
              },
            },
          ],
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|gif|jpg|jpeg|svg|xml)$/,
          use: ['url-loader'],
        },
      ],
    },
    resolve: {
      alias: {
        // Cesium module name
        cesium: path.resolve(__dirname, cesiumSource),
      },
      extensions: ['.ts', '.tsx', '.js'],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: 'src/index.html',
      }),
      // Copy Cesium Assets, Widgets, and Workers to a static directory
      new CopyWebpackPlugin([{ from: path.join(cesiumSource, cesiumWorkers), to: 'Workers' }]),
      new CopyWebpackPlugin([{ from: path.join(cesiumSource, 'Assets'), to: 'Assets' }]),
      new CopyWebpackPlugin([{ from: path.join(cesiumSource, 'Widgets'), to: 'Widgets' }]),
      new webpack.DefinePlugin({
        // Define relative base path in cesium for loading assets
        CESIUM_BASE_URL: JSON.stringify(''),
      }),
    ],

    optimization: {
      runtimeChunk: 'single',
      splitChunks: {
        cacheGroups: {
          cesium: {
            test: /[\\/]cesium[\\/]/,
            name: 'cesium',
            chunks: 'all',
          },
        },
      },
    },

    // development server options
    devServer: {
      contentBase: path.join(__dirname, 'dist'),
      proxy: {
        '/api': 'http://localhost:8081',
      },
      /*
      proxy: {
        '/api': {
          target: 'https://ignition.aztecprotocol.com',
          secure: false,
        },
      },
      */
    },
  },
];

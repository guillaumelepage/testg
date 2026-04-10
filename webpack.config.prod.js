const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = merge(common, {
  mode: 'production',
  output: {
    // Content hash in filename → safe long-term caching; hash changes only when code changes
    filename: './js/app.[contenthash:8].js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html',
      // Inject the hashed script tag automatically
      inject: 'body',
    }),
  ],
});
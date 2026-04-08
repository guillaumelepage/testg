const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    liveReload: true,
    hot: true,
    open: true,
    static: ['./'],
    port: 8080,
    proxy: [
      {
        context: ['/socket.io'],
        target: 'http://localhost:3000',
        ws: true,
      },
    ],
  },
});
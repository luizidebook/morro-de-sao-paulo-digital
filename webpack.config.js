const path = require('path');

module.exports = {
  entry: './scripts.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  resolve: {
    alias: {
      leaflet: path.resolve(__dirname, 'node_modules/leaflet/dist/leaflet.js'),
    },
  },
};

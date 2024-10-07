const path = require('path');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  module: {
    rules: [
      // Règle pour les fichiers JavaScript
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            plugins: [require.resolve('react-refresh/babel')], // Ajout de React Refresh
          },
        },
      },
      // Nouvelle règle pour les fichiers CSS
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      // Règle pour les fichiers images (optionnel, mais souvent nécessaire)
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/i,
        type: 'asset/resource',
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  devServer: {
    static: path.join(__dirname, 'dist'),
    hot: true, // Active le Hot Module Replacement
    compress: true,
    port: 3000,
  },
  plugins: [
    new ReactRefreshWebpackPlugin(), // Ajout de React Refresh Plugin
  ],
};

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
      // Règle pour les fichiers CSS Modules
      {
        test: /\.module\.css$/, // Seuls les fichiers *.module.css seront traités comme CSS Modules
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: '[name]__[local]___[hash:base64:5]', // Génère des classes uniques
              },
            },
          },
        ],
      },
      // Règle pour les fichiers CSS globaux (optionnel)
      {
        test: /\.css$/,
        exclude: /\.module\.css$/, // Exclut les fichiers *.module.css
        use: ['style-loader', 'css-loader'], // Gère les fichiers CSS globaux
      },
      // Règle pour les fichiers images
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

const path = require('path');

const mode = 'development';

module.exports = [
  {
    devtool: false,
    entry: {
      'background': './src/extensions/background.ts',
      'content-script': './src/extensions/content-script.ts'
    },
    mode: mode,
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, 'extensions')
    },
    resolve: {
      extensions: [
        '.js',
        '.ts',
        '.tsx'
      ]
    }
  }
];
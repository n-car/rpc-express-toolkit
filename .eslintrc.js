module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true,
  },
  extends: [
    'airbnb-base',
    'prettier',
  ],
  plugins: [
    'prettier',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  ignorePatterns: [
    '*.min.js',
    'coverage/**',
    'node_modules/**',
  ],
  rules: {
    'prettier/prettier': 'error',
    'no-console': 'warn',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'class-methods-use-this': 'off',
    'no-underscore-dangle': 'off',
    'strict': 'off',
    'no-extend-native': 'warn',
    'global-require': 'warn',
    'no-restricted-syntax': 'warn',
    'no-plusplus': 'warn',
    'lines-between-class-members': 'warn',
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: [
          '**/*.test.js',
          '**/*.spec.js',
          'examples/**/*.js',
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['examples/**/*.js'],
      rules: {
        'no-console': 'off',
        'import/extensions': 'off',
        'no-unused-vars': 'warn',
        'arrow-body-style': 'warn',
        'no-use-before-define': 'warn',
      },
    },
  ],
};

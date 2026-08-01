import tseslint from 'typescript-eslint';

export default tseslint.config({
  files: ['**/*.ts'],
  extends: [...tseslint.configs.recommended],
  ignores: ['.output/**', '.wxt/**', 'dist/**', 'node_modules/**', 'scripts/**'],
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: ['vitest.config.ts'],
      },
      tsconfigRootDir: import.meta.dirname,
    },
  },
});

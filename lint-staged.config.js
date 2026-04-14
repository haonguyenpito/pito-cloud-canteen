const path = require('path');

// Uses .eslintrc.lint-staged.json: same rules as .eslintrc but without
// parserOptions.project, so no TypeScript type graph is loaded per commit.
// Type checking is done separately by `tsc --noEmit` in the pre-commit hook.
const buildEslintCommand = (filenames) => {
  const files = filenames.map((f) => path.relative(process.cwd(), f)).join(' ');

  return `eslint --fix --config .eslintrc.lint-staged.json ${files}`;
};

module.exports = {
  '*.{js,jsx,ts,tsx}': [buildEslintCommand],
  '*.{scss,css,html}': ['prettier --write'],
};

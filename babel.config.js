// Babel config used ONLY by Jest (not by Next.js build — Next.js uses SWC).
// next/babel preset handles TypeScript, JSX, and module transforms.
module.exports = {
  presets: [
    [
      'next/babel',
      {
        'preset-env': { targets: { node: 'current' } },
      },
    ],
  ],
};

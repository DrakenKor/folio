import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // The game simulation must be deterministic: no wall clock, no ambient
    // randomness, no engine-specific transcendentals, no presentation imports.
    files: ['game/src/sim/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['Date', 'performance', 'setTimeout', 'setInterval', 'requestAnimationFrame',
          'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'crypto']
          .map(name => ({ name, message: 'Not allowed in the deterministic simulation.' })),
      ],
      'no-restricted-properties': [
        'error',
        ...['random', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh',
          'tanh', 'asinh', 'acosh', 'atanh', 'exp', 'expm1', 'log', 'log1p', 'log2', 'log10',
          'pow', 'cbrt', 'hypot']
          .map(property => ({ object: 'Math', property, message: 'Use sim/core/fmath or the seeded RNG.' })),
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "BinaryExpression[operator='**']", message: 'Use fmath.pow.' },
        { selector: "AssignmentExpression[operator='**=']", message: 'Use fmath.pow.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*', 'react', 'react-dom', 'react/*'], message: 'The simulation has no presentation dependencies.' },
            { group: ['**/render/**', '**/ui/**', '**/platform/**', '**/debug/**', '**/audio/**'], message: 'The simulation never imports presentation code.' },
          ],
        },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'public/play/**',
    'game/assets-local/**',
    'game/.play-out/**',
  ]),
])

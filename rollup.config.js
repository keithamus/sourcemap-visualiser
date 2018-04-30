import resolve from 'rollup-plugin-node-resolve'
export default {
  input: 'src/client/index.js',
  output: {
    file: 'dist/client.js',
    sourcemap: 'inline',
    format: 'iife',
  },
  plugins: [ resolve() ],
}

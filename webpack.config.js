import path from 'path';
import { fileURLToPath } from 'url'
const __filenameNew = fileURLToPath(import.meta.url)
const __dirnameNew = path.dirname(__filenameNew)

export default {
  entry: './index.js',
  target:"node",
  output: {
    path: path.resolve(__dirnameNew, 'dist'),
    filename: 'bundle.js',
  },
  plugins: [
    new WebpackObfuscator({
        compact: true,
        rotateUnicodeArray: true,
        identifierNamesGenerator: 'mangled',         renameGlobals: true,
        rotateStringArray: true,        selfDefending: true,        stringArray: true,        stringArrayEncoding: ['base64'],
        transformObjectKeys: true,
        unicodeEscapeSequence: false       },
            ['config.js']
    )
  ]
};

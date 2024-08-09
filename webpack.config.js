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
        identifierNamesGenerator: 'mangled', // 'hexadecimal',
        renameGlobals: true,
        rotateStringArray: true,//通过固定和随机（在代码混淆时生成）的位置移动数组。这使得将删除的字符串的顺序与其原始位置相匹配变得更加困难。如果原始源代码不小，建议使用此选项，因为辅助函数可以引起注意。
        selfDefending: true,//混淆后的代码,不能使用代码美化,同时需要配置 cpmpat:true;
        stringArray: true,//删除字符串文字并将它们放在一个特殊的数组中
        stringArrayEncoding: ['base64'],
        transformObjectKeys: true,
        unicodeEscapeSequence: false //允许启用/禁用字符串转换为unicode转义序列。Unicode转义序列大大增加了代码大小，并且可以轻松地将字符串恢复为原始视图。建议仅对小型源代码启用此选项。
      },
      // 数组内是需要排除的文件
      ['config.js']
    )
  ]
};

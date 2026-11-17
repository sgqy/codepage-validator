# Codepage Validator

## 功能

自动检查文本中的字符能否用当前文档编码原样保存。无法保留的文字使用主题错误色作为前景色，下面显示警告波浪线，并在“问题”面板中记为 Warning。扩展只检查文本，不修改文件。

例如，日文通常可以用 Shift JIS 保存，emoji 则不能。即使字符可以写出字节，只要解码后变成其他字符，也会报告问题。

要求 VS Code 1.146 或更新版本。支持桌面版和远程扩展宿主。

## 使用

安装扩展后打开文本文件即可，无需设置。扩展读取 `TextDocument.encoding`，显示文件、编辑内容或更改编码时自动检查。

文字前景色使用 `editorError.foreground`。波浪线由 VS Code 的 Warning 诊断绘制，使用 `editorWarning.foreground`，并遵循编辑器自身的诊断显示设置。切换主题时颜色自动更新。

通过 VS Code 的 `Install from VSIX...` 安装本地构建的安装包。

## 设计

校验器逐个读取 Unicode 字符，执行“编码 → 解码”，再与原字符比较。相同字符在一次扫描中只转换一次。结果记录 UTF-16 偏移，与 VS Code 的文本位置一致，因此 emoji 会作为完整字符标记。

编码逻辑不依赖 VS Code。扩展层负责读取文档、发布诊断、高亮字符，以及管理事件和资源。连续编辑合并为一次检查，延迟为 150 毫秒。

扩展不推测文件的原始编码、不修复乱码，也不检查字体字形。每次检查仍扫描全文。UTF-8 BOM 按 UTF-8 字符集校验，正文中的 U+FEFF 会保留。

## 图标

![Codepage Validator](media/icon.png)

图标表现 CP932 的 `¥` → `\` 往返映射：错误色的日元符号，下方配警告波浪线，指向解码后的反斜杠。

矢量源文件为 `media/icon.svg`，全部由路径绘制，不依赖字体。[VS Code 扩展图标不接受 SVG](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#publishing-extensions)，因此安装包使用导出的 256 × 256 PNG。修改 SVG 后运行 `npm run build:icon` 重新导出。

## 开发

使用 Node.js 24 或更新版本。

```sh
npm ci
npm test
npm run test:integration
npm run package
```

`npm test` 执行严格类型检查和算法测试。集成测试在隔离的 VS Code 1.146.0 扩展宿主中验证文档编码、Warning 诊断、编辑事件和多编辑器行为，首次运行需下载安装包。

`npm run watch` 持续构建。按 F5 启动调试宿主。`npm run package` 生成 `codepage-validator-1.0.0.vsix`，内含打包后的扩展代码及许可证。

| 路径 | 内容 |
| --- | --- |
| `src/encoding.ts` | 与编辑器无关的编码校验算法 |
| `src/extension.ts` | VS Code 接入与生命周期管理 |
| `tests/unit/` | 编码算法测试 |
| `tests/host/` | 真实扩展宿主测试 |
| `scripts/build.mjs` | esbuild 构建入口 |

锁文件固定安装版本。打包工具的 `minimatch` 使用 `^11.0.1` 覆盖，修复 GHSA-g3hv-75wg-m249；上游升级后可移除此覆盖。

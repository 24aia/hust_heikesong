# 安装扩展

1. 在仓库根目录运行 `npm ci` 和 `npm run build:extension`。
2. 打开 `chrome://extensions`，启用“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择 `dist/liukanshan-reader/`，该目录根部应直接包含 `manifest.json`。
5. 刷新一个受支持的知乎单回答详情页或专栏文章页。

同一次构建也会生成 `dist/liukanshan-reader.zip` 供传输。源码不能直接作为已解压扩展加载，ZIP 也必须先解压。卸载扩展会删除本地断点；第一版不承诺跨设备同步。

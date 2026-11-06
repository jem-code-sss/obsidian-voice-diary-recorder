# Voice Diary Recorder

[English](README.md) | 简体中文

在 Obsidian 中录音并保存原始音频，配合电脑端 [Voice Diary Processor](https://github.com/jem-code-sss/obsidian-voice-diary) 本地转写。版本 **0.3.2**。

手机只需要 Obsidian、本插件和仓库同步工具。无需 Python、语音模型或 API Key。电脑端另行安装处理插件并准备识别模型；如只需要保存录音，也可以独立使用。

## 需要安装什么

| 设备 | 安装的软件 |
| --- | --- |
| 手机 | Obsidian、Voice Diary Recorder；手机电脑联用时还需 Syncthing 兼容客户端或另一种仓库同步工具。 |
| 电脑 | Obsidian、Voice Diary Processor、手动准备的 Python 与 SenseVoice 本地环境；使用 Syncthing 流程时安装电脑 Syncthing。 |
| 仅独立录音 | 只需 Obsidian 和本插件，不需要同步、Python、模型或 API。 |

完整的同步目录与软件准备步骤见电脑项目的 [安装与同步教程](https://github.com/jem-code-sss/obsidian-voice-diary/blob/main/docs/SETUP.md)。同步工具只搬运文件，不负责识别。

## 安装

插件已发布到 [Obsidian 官方社区目录](https://community.obsidian.md/plugins/voice-diary-recorder)，当前审核状态以该页面为准。同时提供手动安装包。

1. 从 [0.3.2 Release](https://github.com/jem-code-sss/obsidian-voice-diary-recorder/releases/tag/0.3.2) 下载 `voice-diary-recorder-v0.3.2.zip` 并解压。
2. 将 `voice-diary-recorder` 文件夹放入仓库的 `.obsidian/plugins/`，保持 `main.js`、`manifest.json`、`styles.css` 在该文件夹内。使用自定义配置目录时选择对应的 `plugins` 目录。
3. 重启 Obsidian，在第三方插件设置中启用 **Voice Diary Recorder**。
4. 在插件设置中应用录音保存目录。新装默认 `Voice Diary/Recordings`；请与电脑处理插件的录音目录保持一致。

从旧版手机录音功能升级时，请先在手机安装 Recorder，确认录音目录与旧路径一致，并验证同步，再升级电脑端 Processor。若本插件尚无本机设置，会仅尝试沿用旧版的合法录音目录；不迁移 Key、任务或其他配置。已有本插件设置不会被覆盖。请停用旧插件的手机录音入口，避免出现两个麦克风按钮。

## 录音与同步

点击手机悬浮麦克风、侧边栏麦克风，或执行「开始／停止录音」命令。再次点击结束，插件保存原始音频。文件名按录音开始时刻和完整 UUID 自动生成，延迟保存或重试仍保留开始时刻；扩展名与设备实际提供的录音格式匹配。配套 Processor 以该时间划分日记日期，凌晨 04:00 为一天起点，命名设置见 [电脑端指南](https://github.com/jem-code-sss/obsidian-voice-diary/blob/main/README.zh-CN.md#日记命名与日期归属)。

录音目录支持中文、空格和多级路径，须填写仓库内的相对目录。输入后点击「应用」才生效，不会移动历史录音；录音中或音频待保存时不能更改目录。

手机录音时请保持 Obsidian 在前台。切后台、锁屏或麦克风中断时结束本段并尝试保存，提示约 4 秒后消失。返回前台不会自动重新收音，请重新点击麦克风。系统冻结或强杀可能来不及保存，本插件不支持后台持续录音。

停止后如保存失败，音频保留在当前插件内存中。请保留 Obsidian 窗口，修复存储空间或目录权限，再点击麦克风或「重试保存录音」。退出应用、重载或停用插件可能丢失未保存音频；关闭时仅能尽力保存。

保存后会逐字节核对完整录音。若失败写入留下截断文件，或目标路径被不同内容占用，插件保留该文件，用含完整 UUID 的新文件名另存完整音频。若宿主已保存成功但回报错误，核对一致后沿用已完成的文件。先确认另存文件可完整回放，再处理异常文件；音频仍待保存时不要退出应用。

可使用 Syncthing、Obsidian Sync 或其他仓库同步工具。插件本身不提供同步服务，也不依赖特定工具。先确认手机音频已保存，再等待同步到电脑；电脑处理端应监听同一录音目录，并只在一台电脑开启自动处理。

## 隐私

插件没有联网接口、模型下载或转写功能，不调用 API。录音文件位于你选择的仓库目录，会受仓库同步与备份规则影响。录音目录设置保存在 Obsidian 本设备存储中。文件名与字节校验可减少误覆盖风险，不能阻止已被入侵的宿主或有仓库访问权限的其他插件修改文件。详细说明见 [PRIVACY.md](PRIVACY.md)。

## 开发

使用 Node.js 22 或更新版本，在项目根目录执行：

```powershell
npm ci
npm test
npm run build
```

输出目录为 `dist/voice-diary-recorder/`。运行源码只依赖 Obsidian 和浏览器录音 API，不导入 Node.js 或 Electron；构建与合成测试在 Node.js 中运行。测试验证编译产物的手机路径、权限等待时离开前台、重复中断、保存失败重试、目标文件校验及目录应用，不使用真实麦克风或私人音频。

不同手机系统的麦克风权限、前后台行为和录音格式可能不同。首次使用请录一小段并回放，再验证自己的同步流程。反馈时请在 [Issues](https://github.com/jem-code-sss/obsidian-voice-diary-recorder/issues) 提供版本、系统与复现步骤，避免附带私人录音和完整个人路径。

采用 [MIT 许可](LICENSE)。构建工具 [esbuild](https://github.com/evanw/esbuild) 采用 MIT 许可，由开发者自行安装，不包含在插件运行包中。Obsidian 是外部运行宿主。

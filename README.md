# Voice Diary Recorder

English | [简体中文](README.zh-CN.md)

Record audio in Obsidian and save the original files to your vault. Use the companion [Voice Diary Processor](https://github.com/jem-code-sss/obsidian-voice-diary) on a Windows computer for local transcription. Current version: **0.4.0**.

On your phone, you only need Obsidian and this plugin. No Python, speech model, or API key is needed. A vault sync tool is optional when you want to send recordings to a computer. You can also use the recorder on its own to save audio.

## Required software

| Device or use | Software |
| --- | --- |
| Phone | Obsidian and Voice Diary Recorder. To transfer recordings to a computer, also use a Syncthing-compatible client, Obsidian Sync, or another vault sync tool. |
| Windows computer for transcription | Obsidian, Voice Diary Processor, and a manually prepared Python and SenseVoice environment. Install desktop Syncthing if you choose that sync workflow. |
| Recording only | Obsidian and this plugin. No sync service, Python, model, or API is required. |

See the Processor project's [installation and sync guide](https://github.com/jem-code-sss/obsidian-voice-diary/blob/main/docs/SETUP.md) for manual dependency setup, software downloads, and matching the phone and computer folders. Sync tools transfer files; the Processor performs transcription on the computer.

## Installation

The plugin is published in the [official Obsidian community directory](https://community.obsidian.md/plugins/voice-diary-recorder). See that page for its current review status. Manual installation packages are also available.

1. Download `voice-diary-recorder-v0.4.0.zip` from the [0.4.0 release](https://github.com/jem-code-sss/obsidian-voice-diary-recorder/releases/tag/0.4.0) and extract it.
2. Put the `voice-diary-recorder` folder in your vault's `.obsidian/plugins/` directory. Keep `main.js`, `manifest.json`, and `styles.css` directly inside that folder. If you use a custom Obsidian configuration directory, use its `plugins` directory instead.
3. Restart Obsidian and enable **Voice Diary Recorder** in Community plugins.
4. In the plugin settings, apply the recording folder. New installations default to `Voice Diary/Recordings`. Use the same recording folder in the computer's Processor settings.

### Upgrading from the old combined plugin

Install Recorder on your phone first and confirm that its recording folder matches your existing folder. If Recorder has no settings on this device yet, it only attempts to reuse a valid recording folder from the old mobile plugin. It does not migrate keys, jobs, or other settings, and it does not overwrite existing Recorder settings.

After confirming the phone folder and sync, upgrade the computer to Voice Diary Processor. Disable the old mobile recording entry to avoid having two microphone buttons.

## Recording and sync

Tap the floating microphone on mobile, use the ribbon microphone, or run the start/stop recording command. Tap again to stop and save the original audio. Filenames are generated automatically from the recording's start time and a full UUID; delayed saving or a retry keeps that start time. The extension matches the recording format provided by your device. The companion Processor uses that timestamp for diary dates, with days starting at 04:00; its naming options are described in the [Processor guide](https://github.com/jem-code-sss/obsidian-voice-diary/blob/main/README.md#diary-filenames-and-dates).

### Record spoken tasks

Use the separate clipboard-list button or **Record tasks: start/stop** (`录制待办：开始／停止`) command to capture plans such as “明天买牛奶，下周整理照片”. The microphone entry remains the diary recorder. Only one recording can run at a time; finish and save it before starting another.

A task recording saves a `todo-…` audio file and an adjacent `<audio filename>.voice.json` companion file. Both must save and synchronize completely. Include `.json` files in your sync rules, and use Processor **0.4.0 or newer** on the computer. It waits for matching audio and recording metadata before extracting tasks; the Recorder itself never transcribes or calls an API. Keep the two files together when backing up or moving a task recording.

The companion file fixes the actual recording start time, local date, time zone, and audio fingerprint. Relative dates use that actual local date: at 03:59 on November 7, “tomorrow” means November 8 even though a diary would be grouped under November 6. Later synchronization, saving, or retries do not change the reference date. “Next week” is a Monday–Sunday range, not an invented deadline.

Processor saves a Markdown task note to its configurable task folder, default `Voice Diary/Tasks`. Synchronize that folder back to the phone to read and check off tasks. The tomorrow, next-week, review, and unfinished-task views live in the computer's Processor. Unclear wording needs confirmation, and neither plugin creates calendar events or system reminders. See the [voice-task guide](https://github.com/jem-code-sss/obsidian-voice-diary/blob/main/docs/VOICE-TODOS.md) for extraction options and examples.

### Saving and interruptions

The recording folder must be a relative path inside the vault. Chinese characters, spaces, and nested folders are supported. Click the settings button to apply a new folder. Applying a folder does not move existing recordings, and the folder cannot be changed while recording or while audio is waiting to be saved.

Keep Obsidian in the foreground while recording on a phone. Switching apps, locking the screen, or losing microphone access ends the current segment and triggers a save attempt. The interruption notice disappears after about four seconds. Returning to the foreground does not restart recording; tap the microphone to start a new segment. If the operating system freezes or force-closes Obsidian, saving may not be possible. Continuous background recording is not supported.

If saving fails after recording stops, the audio stays in the plugin's memory. Keep Obsidian open, resolve the storage or folder permission problem, and tap the microphone or run the retry-save command. Quitting Obsidian, reloading, or disabling the plugin can lose unsaved audio. Saving during shutdown is best effort.

Saved files are checked against the complete recording bytes. If a failed write leaves a truncated file, or the intended path contains different content, the plugin preserves that file and saves the complete audio under a new name containing a full UUID. A matching complete file is reused if the host saved it but reported an error. Check the complete replacement before removing an abnormal file; do not close Obsidian while audio is still waiting to be saved.

You may use Syncthing, Obsidian Sync, or another vault sync tool. The plugin provides no sync service and does not depend on a specific tool. Confirm that the phone has saved the audio and, for task recordings, its `.voice.json` file, then wait for them to sync to the computer. The computer's Processor should watch the same recording folder. Also sync the diary and task-note folders back to the phone. Enable automatic processing on only one computer.

## Privacy

This plugin has no network requests, model downloads, or transcription feature, and does not call an API. Recordings are stored in the vault folder you choose and follow your vault's sync and backup rules. The recording folder setting is stored in Obsidian's local storage on the current device. Safe filename and byte checks reduce accidental overwrites; they cannot protect files from a compromised host or another plugin with vault access. See [PRIVACY.md](PRIVACY.md) for details.

Task companion files follow the same sync rules. They contain a recording ID, time, time zone, audio filename, size, and fingerprint, without a transcript or API Key. These are personal recording metadata; fingerprints are not encryption or proof of origin. Check audio, companion files, and resulting task notes before sharing a vault or a bug report.

## Development and feedback

Use Node.js 22 or later. From the project root, run:

```powershell
npm ci
npm test
npm run build
```

Build output is written to `dist/voice-diary-recorder/`. At runtime, the plugin uses Obsidian and browser recording APIs; it does not import Node.js or Electron. Builds and simulated tests run in Node.js. Tests cover the compiled mobile path, leaving the foreground while waiting for microphone permission, repeated interruptions, save retries, destination file checks, and applying a folder. They do not use a real microphone or private audio.

Microphone permissions, foreground/background behavior, and recording formats vary by phone and operating system. Start with a short recording, play it back, and verify your sync workflow. Report problems through [Issues](https://github.com/jem-code-sss/obsidian-voice-diary-recorder/issues) with the plugin version, operating system, and steps to reproduce. Avoid attaching private recordings or full personal paths.

## License

This project uses the [MIT license](LICENSE). The build tool [esbuild](https://github.com/evanw/esbuild) is also MIT-licensed; developers install it separately, and it is not included in the plugin runtime package. Obsidian is the external host application.

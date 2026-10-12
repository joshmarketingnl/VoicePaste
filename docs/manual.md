# VoicePaste: manual

VoicePaste turns what you say into text and pastes it where your cursor is: in your email, in Word, in WhatsApp Web, anywhere. It runs on your own computer. No audio goes to the internet.

*Nederlandse versie: [handleiding.md](handleiding.md)*

## Install

**Windows**

1. Download [VoicePaste-Setup.exe](https://github.com/joshmarketingnl/VoicePaste/releases/latest/download/VoicePaste-Setup.exe) and open it.
2. Does Windows say "Windows protected your PC"? Click **More info**, then **Run anyway**. The app is not signed with Microsoft yet; that is why you see this.
3. VoicePaste starts by itself and from then on lives in the tray at the bottom right, next to the clock.

**Mac**

1. On the [release page](https://github.com/joshmarketingnl/VoicePaste/releases/latest), download the zip for your Mac: `arm64-mac.zip` for a Mac with an Apple chip (M1 or newer), `mac.zip` for an older Intel Mac.
2. Open the zip and drag VoicePaste to **Applications**.
3. Open VoicePaste. If macOS blocks it, go to **System Settings › Privacy & Security** and click **Open Anyway** at the bottom.
4. VoicePaste needs two permissions: **Microphone** (to hear you) and **Accessibility** (to paste). The welcome screen shows which one is still off and turns green as soon as you switch it on.

The first time, VoicePaste downloads the speech model (about 550 MB). That takes a few minutes. After that, everything also works without internet.

## Dictating

| What | Windows | Mac |
|---|---|---|
| Start recording | Ctrl+Alt+Shift+R | Cmd+Option+R |
| **Stop and paste** | Ctrl+Alt+Shift+V | Cmd+Option+V |
| Stop without pasting | Ctrl+Alt+Shift+C | Cmd+Option+C |
| Paste the last text again | Ctrl+Alt+Shift+V | Cmd+Option+V |
| Throw the recording away | Ctrl+Alt+Shift+S | Cmd+Option+S |
| Show the window | Ctrl+Alt+Shift+M | Cmd+Option+M |

This is how it almost always goes: put your cursor where the text should go, press **record**, talk, and press **paste**. VoicePaste stops, converts it and pastes it. A small dot next to your mouse shows whether it is recording, working or done.

You can mix Dutch and English. Long dictations are fine: a ten-minute recording works too.

## Settings

Click the VoicePaste icon (Windows: tray; Mac: menu bar at the top) and choose **Settings**. There you can set:

- **Spoken language**: Dutch + English (recommended), Dutch only, English only or Spanish only.
- **App language**: Dutch or English.
- **Hotkeys**: click a key, press the new combination and save.
- **Engine**: by default local, on your computer. With your own OpenAI key it can also run through OpenAI. Note: your audio then does go to OpenAI, and OpenAI charges your account per minute.

## Updates

- **Windows**: updates install by themselves at a quiet moment. You don't need to do anything.
- **Mac**: you get a notice when a new version is out. Click it; the app explains the three steps. Afterwards you often have to switch Accessibility on again. The welcome screen notices that and shows you where.

## When something goes wrong

- **Converting failed?** Your recording is kept. Click **Try again** in the window, or in the icon's menu.
- **"No sound came in"**: the microphone is off, muted, or the wrong one is selected. On a Mac: check that VoicePaste is on under Privacy & Security › Microphone.
- **Need help?** Open **Settings**, click **Copy diagnostics** under Help and paste it into a message to Josh. It contains no keys and no personal folder names.

## Frequently asked questions

**Does it cost anything?**
No. VoicePaste is free and runs on your own computer. Only if you choose to use your own OpenAI key do you pay OpenAI for that use.

**Does my voice go to the internet?**
No, not with the default setting. Converting happens on your computer. Internet is only needed for the first download and for updates.

**It doesn't paste anything.**
Mac: switch VoicePaste on under System Settings › Privacy & Security › Accessibility (sometimes again after an update). Windows: an ordinary app may not paste into programs running as administrator; open the VoicePaste window there (Ctrl+Alt+Shift+M), click **Copy** and paste it yourself with Ctrl+V.

**The first dictation after a break takes a moment.**
Correct. After fifteen minutes of nothing, VoicePaste unloads the speech model to free memory. On the next recording it wakes up while you talk; usually you won't notice.

**Converting is slow.**
On a computer with an NVIDIA graphics card or a Mac with an Apple chip it usually takes one to three seconds. Without such a graphics card the processor does all the work, which can take up to half a minute. If you want it faster, use your own OpenAI key.

**How much space and memory does it use?**
The speech model is about 550 MB. While working it uses about 2 GB of memory, which is released after fifteen quiet minutes.

**It keeps getting a word wrong.**
Speak in whole sentences; single words are harder. Names and jargon sometimes go wrong. Read the text before you send anything.

**How do I uninstall it?**
Windows: Settings › Apps › VoicePaste › Uninstall. Mac: drag VoicePaste from Applications to the Bin.

**Questions or ideas?**
VoicePaste is made by Josh. Send a message on [WhatsApp](https://wa.me/+31647569554).

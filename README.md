# Player for ZTM

A Chrome side-panel player for [Zero To Mastery](https://zerotomastery.io) courses.
Open the panel, pick a lesson, and keep browsing while it plays.

## Install

You need Chrome and Node.

1. Build it:

   ```bash
   npm install && npm run build
   ```

2. In Chrome, go to `chrome://extensions`, turn on **Developer mode**, click
   **Load unpacked**, and choose the `.output/chrome-mv3` folder.

3. Sign in at [academy.zerotomastery.io](https://academy.zerotomastery.io) in the
   same Chrome profile, then click the toolbar icon to open the panel.

For development, `npm run dev` opens Chrome with the extension loaded and live reload on.

## Features

- Your enrolled courses in one place
- Search courses and lessons
- Plays right in the side panel
- Pop out to Picture-in-Picture
- Open a lesson in its own tab
- Auto-plays the next lesson
- Queue a lesson to play next
- Pick up where you left off
- Remembers what you've watched
- Read text lessons in the panel

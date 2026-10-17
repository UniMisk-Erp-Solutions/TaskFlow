# PWA Layout Fix: Profile and Theme Button Overlap

Date: 17/10/2026.

## Problem
On narrow screens (installed PWA on a phone or a small window, 760px and below) the sidebar becomes a 68px rail. The profile avatar button and the theme (moon/sun) button were still laid out side by side in that rail, so they overlapped.

## Fix (`frontend/src/index.css`)
- In the narrow rail the profile and theme buttons now stack vertically and stay centred (`flex-direction: column`, gap 8px); the profile button no longer stretches.
- Removed an old rule that targeted a non-existent element.
- Installed-app (`display-mode: standalone`) polish: the sidebar respects the top safe area (notch) and uses `100dvh`; the sidebar footer respects the bottom safe area (home indicator).

## Verified / not verified
Not verified visually: the automated browser could not log in, so the fix was made from the CSS/markup and is untested on a phone. Please check the installed app and tell me about any other screens that look off.

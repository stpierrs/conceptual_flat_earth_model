# Icon Requirements

You need one source icon: **1024×1024 PNG, no transparency, no rounded corners.**
The stores apply their own corner masks. If you submit with pre-rounded corners
you'll get double-rounded edges.

## Current icon
`assets/ac_logo.png` is listed in the manifest. Check if it's 1024×1024.
If it's smaller, you need a new one at that size.

## What makes a good store icon
- Dark background (your #0e121a works perfectly — matches the app)
- Single clear subject visible at 64×64 (icons appear tiny in search results)
- No text (it's unreadable at small sizes and most stores discourage it)
- Something that reads as "sky / astronomy / celestial" at a glance

## Generated sizes Capacitor needs (handled automatically by `cap sync`)
Android generates these from your source icon via Android Studio's
Image Asset tool. iOS generates all required sizes via Xcode.

You don't manually create every size — you give both tools the 1024×1024
and they do the rest.

Before syncing, install the project dependencies:

```sh
npm install
npm run sync
```

## How to create the icon (if you need a new one)
- Photoshop / Illustrator / Affinity Designer: export at 1024×1024 PNG
- Figma: free, works fine, export at 1x = 1024px
- GIMP: free, open source
- Or commission one — a simple astronomy icon on Fiverr runs $20–50

## After you have the 1024×1024 icon

### Android
1. Open Android Studio → open the `android/` folder
2. Right-click `app/src/main/res` → New → Image Asset
3. Set source to your 1024×1024 PNG, icon type = Launcher Icons
4. Click Next → Finish — all sizes generated automatically

### iOS
1. Open Xcode → open `ios/App/App/Assets.xcassets/AppIcon.appiconset`
2. Drag your 1024×1024 PNG into the 1024pt slot
3. Xcode validates and generates the rest

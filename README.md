
# Product Photo Web App

A modern web application for product photography editing, built with React and Vite. This tool enables seamless product photo upload, client-side background removal, auto-cropping, and asset management with a beautiful dark-themed UI.

---

## 🚀 Project Setup

1. **Install dependencies:**
	```sh
	npm install
	```
2. **Start the development server:**
	```sh
	npm run dev
	```
3. **Build for production:**
	```sh
	npm run build
	```

---

## 🗂️ Main Components

- **App.jsx**: Main application logic and layout.
- **Sidebar**: Upload product photos, adjust background removal parameters, preview cropped/transparent assets.
- **Preview**: Drag, resize, duplicate, and delete product assets on a checkerboard canvas. Shows transparent PNGs over a chessboard background.
- **AIChatbot**: Placeholder for AI assistant (future feature).

---

## ✨ Features

- **Product Photo Upload**: Upload images directly from your device.
- **Client-side Background Removal**: Uses `@imgly/background-removal` (WASM/ONNX) for privacy and speed.
- **Alpha Matting & Threshold Controls**: Fine-tune background removal with adjustable sliders.
- **Auto-cropping**: Crops PNGs to product boundaries based on alpha channel (transparency).
- **Transparent PNG Output**: Ensures product assets have no white box and preserve transparency.
- **Preview Canvas**: Drag, resize, duplicate, and delete product images. Canvas uses a checkerboard pattern to visualize transparency.
- **Dark Theme**: Modern, accessible dark UI with clear controls.
- **Undo/Redo**: Easily revert or reapply changes in the Preview canvas.

---

## 🛠️ Technologies Used

- **React** (with hooks)
- **Vite** (for fast dev/build)
- **@imgly/background-removal** (WASM/ONNX)
- **react-rnd** (drag/resize UI)
- **Tailwind CSS** (optional, for utility classes)

---

## 📁 File Structure

- `src/App.jsx` — Main app logic and UI
- `src/App.css` — Custom styles, dark theme, checkerboard
- `src/index.css` — Base styles
- `public/` — Static assets
- `vite.config.js` — Vite configuration

---

## 📝 Notes

- All image processing is done client-side for privacy.
- The Preview canvas always shows the true transparency of your product asset.
- Future features: AI assistant, prop/background selection, export options.

---

## 📣 Feedback & Contributions

Feel free to open issues or submit PRs for improvements!

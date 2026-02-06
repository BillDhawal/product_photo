import React, { useState } from 'react';
import { removeBackground } from '@imgly/background-removal';
import { Rnd } from 'react-rnd';
import './App.css';

function Sidebar({ addPhotoFrame }) {
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alphaMatting, setAlphaMatting] = useState(true);
  const [foregroundThreshold, setForegroundThreshold] = useState(240);
  const [backgroundThreshold, setBackgroundThreshold] = useState(10);
  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    console.log('Background removal started...');
    try {
      const result = await removeBackground(file, {
        output: { format: 'image/png' },
        alphaMatting,
        foregroundThreshold,
        backgroundThreshold,
      });
      if (!result) {
        alert('Background removal failed.');
        setLoading(false);
        return;
      }
      console.log('Background removal finished.');
      // Auto-crop PNG to product boundaries
      const img = new window.Image();
      img.src = URL.createObjectURL(result);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = img.width;
      cropCanvas.height = img.height;
      const ctx = cropCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, cropCanvas.width, cropCanvas.height);
      // Find bounding box of mostly opaque pixels (alpha > 200)
      let minX = cropCanvas.width, minY = cropCanvas.height, maxX = 0, maxY = 0;
      for (let y = 0; y < cropCanvas.height; y++) {
        for (let x = 0; x < cropCanvas.width; x++) {
          const alpha = imageData.data[(y * cropCanvas.width + x) * 4 + 3];
          if (alpha > 200) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      // Handle case where nothing is found
      if (minX > maxX || minY > maxY) {
        minX = 0; minY = 0; maxX = cropCanvas.width; maxY = cropCanvas.height;
      }
      const cropWidth = maxX - minX + 1;
      const cropHeight = maxY - minY + 1;
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = cropWidth;
      finalCanvas.height = cropHeight;
      finalCanvas.getContext('2d').putImageData(
        ctx.getImageData(minX, minY, cropWidth, cropHeight),
        0, 0
      );
      finalCanvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        setPhoto(url);
        addPhotoFrame(url);
        setLoading(false);
      }, 'image/png');
    } catch (err) {
      console.error('Background removal error:', err);
      alert('Background removal failed. See console for details.');
      setLoading(false);
    }
  };
      return (
    <aside className="sidebar">
      <h2>Sidebar</h2>
      <label className="upload-label">
        <span>Add Product Photo</span>
        <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
      </label>
      <div style={{ margin: '1rem 0', color: '#e5e7eb', fontSize: '0.95rem' }}>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <input type="checkbox" checked={alphaMatting} onChange={e => setAlphaMatting(e.target.checked)} />
          Alpha Matting
        </label>
        <label>Foreground Threshold: {foregroundThreshold}
          <input type="range" min="0" max="255" value={foregroundThreshold} onChange={e => setForegroundThreshold(Number(e.target.value))} />
        </label>
        <br />
        <label>Background Threshold: {backgroundThreshold}
          <input type="range" min="0" max="255" value={backgroundThreshold} onChange={e => setBackgroundThreshold(Number(e.target.value))} />
        </label>
      </div>
      {loading && (
        <div className="photo-preview">
          <div className="spinner" />
          <span style={{ color: '#fff' }}>Removing background...</span>
        </div>
      )}
      {photo && !loading && (
        <div className="photo-preview">
          <img src={photo} alt="Product preview" style={{ background: 'none' }} />
        </div>
      )}
      <button>Select Background</button>
      <button>Select Props</button>
    </aside>
  );
}

function AIChatbot() {
  return (
    <section className="ai-chatbot">
      <h2>AI Chatbot</h2>
      <div className="chat-window">
        {/* Chatbot UI goes here */}
        <p>Ask me anything about product photography!</p>
      </div>
    </section>
  );
}



function Preview({ frames, setFrames }) {
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Undo/redo helpers
  const pushHistory = (newFrames) => {
    setHistory((h) => [...h, frames]);
    setRedoStack([]);
    setFrames(newFrames);
  };
  const undo = () => {
    if (history.length) {
      setRedoStack((r) => [...r, frames]);
      setFrames(history[history.length - 1]);
      setHistory((h) => h.slice(0, -1));
    }
  };
  const redo = () => {
    if (redoStack.length) {
      setHistory((h) => [...h, frames]);
      setFrames(redoStack[redoStack.length - 1]);
      setRedoStack((r) => r.slice(0, -1));
    }
  };

  // Drag/resize logic
  const dragFrame = (id, dx, dy) => {
    pushHistory(frames.map(f => f.id === id ? { ...f, x: f.x + dx, y: f.y + dy } : f));
  };
  const resizeFrame = (id, dw, dh) => {
    pushHistory(frames.map(f => f.id === id ? { ...f, width: Math.max(50, f.width + dw), height: Math.max(50, f.height + dh) } : f));
  };
  const selectFrame = (id) => {
    setFrames(frames.map(f => ({ ...f, selected: f.id === id })));
  };
  const deleteFrame = (id) => {
    pushHistory(frames.filter(f => f.id !== id));
  };
  const duplicateFrame = (id) => {
    const frame = frames.find(f => f.id === id);
    if (frame) {
      const newFrame = { ...frame, id: Date.now(), x: frame.x + 30, y: frame.y + 30, selected: false };
      pushHistory([...frames, newFrame]);
    }
  };
  const bringToFront = (id) => {
    const maxZ = Math.max(...frames.map(f => f.zIndex));
    pushHistory(frames.map(f => f.id === id ? { ...f, zIndex: maxZ + 1 } : f));
  };
  const sendToBack = (id) => {
    const minZ = Math.min(...frames.map(f => f.zIndex));
    pushHistory(frames.map(f => f.id === id ? { ...f, zIndex: minZ - 1 } : f));
  };

  // Render frame controls
  const renderControls = (frame) => (
    <div className="frame-controls">
      <button onClick={() => bringToFront(frame.id)}>Front</button>
      <button onClick={() => sendToBack(frame.id)}>Back</button>
      <button onClick={() => duplicateFrame(frame.id)}>Duplicate</button>
      <button className="delete" onClick={() => deleteFrame(frame.id)}>Delete</button>
    </div>
  );

  // Render frames
  return (
    <section className="preview">
      <div className="preview-toolbar">
        <button onClick={undo} disabled={!history.length}>Undo</button>
        <button onClick={redo} disabled={!redoStack.length}>Redo</button>
      </div>
      <div className="preview-canvas">
        {frames.map(frame => (
          <Rnd
            key={frame.id}
            size={{ width: frame.width, height: frame.height }}
            position={{ x: frame.x, y: frame.y }}
            style={{
              zIndex: frame.zIndex,
              border: frame.selected ? '2px solid #4f46e5' : '1px solid #ccc',
                background: 'none',
              boxSizing: 'border-box',
              cursor: 'move',
            }}
            onDragStart={() => selectFrame(frame.id)}
            onDragStop={(e, d) => {
              pushHistory(frames.map(f => f.id === frame.id ? { ...f, x: d.x, y: d.y } : f));
            }}
            onResizeStart={() => selectFrame(frame.id)}
            onResizeStop={(e, dir, ref, delta, pos) => {
              pushHistory(frames.map(f => f.id === frame.id ? {
                ...f,
                width: ref.offsetWidth,
                height: ref.offsetHeight,
                x: pos.x,
                y: pos.y,
              } : f));
            }}
            minWidth={50}
            minHeight={50}
            bounds="parent"
          >
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none' }}>
              {frame.src ? (
                <img src={frame.src} alt="Product" style={{ maxWidth: '100%', maxHeight: '100%', background: 'none' }} />
              ) : (
                <span style={{ color: '#888' }}>Product Image</span>
              )}
            </div>
            {/* Controls */}
            {frame.selected && renderControls(frame)}
          </Rnd>
        ))}
      </div>
    </section>
  );
}

function App() {
  const [frames, setFrames] = useState([]);

  // Add photo to frames
  const addPhotoFrame = (src) => {
    const img = new window.Image();
    img.src = src;
    img.onload = () => {
      setFrames((prev) => [
        ...prev,
        {
          id: Date.now(),
          x: 120,
          y: 120,
          width: img.naturalWidth,
          height: img.naturalHeight,
          zIndex: prev.length + 1,
          selected: false,
          src,
        },
      ]);
    };
  };

  return (
    <div className="app-grid">
      <Sidebar addPhotoFrame={addPhotoFrame} />
      <AIChatbot />
      <Preview frames={frames} setFrames={setFrames} />
    </div>
  );
}

export default App;

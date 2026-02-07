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
  // Chatbot state
  const models = [
    { id: 'stable-diffusion', name: 'Stable Diffusion' },
    { id: 'controlnet', name: 'ControlNet' }
  ];
  const starterPrompts = [
    'Perfume backdrop',
    'Add AI human',
    'Select from template'
  ];
  const [selectedModel, setSelectedModel] = useState(models[0].id);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [chat, setChat] = useState([
    { sender: 'bot', text: 'Hi! I am your AI assistant. What background can I create for your product photo?', suggestions: starterPrompts }
  ]);
  // Dummy image URLs
  const dummyImages = [
    'https://placehold.co/110x110?text=1',
    'https://placehold.co/110x110?text=2',
    'https://placehold.co/110x110?text=3',
    'https://placehold.co/110x110?text=4'
  ];
  // Handle prompt suggestion click
  const handleSuggestion = (p) => {
    setPrompt('');
    sendMessage(p);
  };
  // Send message (user prompt or input)
  const sendMessage = (p) => {
    if (!p) return;
    setChat(prev => [...prev, { sender: 'user', text: p }]);
    setLoading(true);
    setPrompt('');
    // Simulate API call
    setTimeout(() => {
      setChat(prev => [
        ...prev,
        {
          sender: 'bot',
          text: `Here are some generated backgrounds for: "${p}"`,
          thumbnails: dummyImages
        }
      ]);
      setLoading(false);
    }, 1200);
  };
  return (
    <section className="ai-chatbot">
      <h2 style={{ color: '#e5e7eb', fontSize: '1.35rem', marginBottom: 8 }}>AI Chatbot</h2>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: 600, color: '#e5e7eb', fontSize: '1rem', marginRight: 8 }}>Select Model:</label>
        <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #6366f1', background: '#23232a', color: '#e5e7eb', fontWeight: 500 }}>
          {models.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
      <div className="chat-window" style={{ background: '#23232a', color: '#e5e7eb', minHeight: 320, minWidth: 380, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', padding: '1.5rem', marginBottom: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {chat.map((msg, idx) => (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
            <div style={{
              background: msg.sender === 'bot' ? '#18181b' : '#6366f1',
              color: msg.sender === 'bot' ? '#e5e7eb' : '#fff',
              borderRadius: 10,
              padding: '0.75rem 1.25rem',
              fontWeight: 500,
              fontSize: '1rem',
              maxWidth: 320,
              marginBottom: msg.thumbnails ? 8 : 0,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
            }}>{msg.text}</div>
            {msg.suggestions && (
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {msg.suggestions.map(sp => (
                  <button key={sp} onClick={() => handleSuggestion(sp)} style={{ background: '#23232a', color: '#e5e7eb', border: '1px solid #6366f1', borderRadius: 8, padding: '0.25rem 0.75rem', cursor: 'pointer', fontWeight: 500, fontSize: '0.95rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>{sp}</button>
                ))}
              </div>
            )}
            {msg.thumbnails && (
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                {msg.thumbnails.map((url, tidx) => (
                  <img key={tidx} src={url} alt={`Thumbnail ${tidx + 1}`} style={{ width: 110, height: 110, borderRadius: 10, border: '2px solid #6366f1', background: '#18181b', objectFit: 'cover' }} />
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ textAlign: 'center', margin: '1rem 0' }}>
            <div className="spinner" />
            <span style={{ color: '#e5e7eb', fontWeight: 500 }}>Generating thumbnails...</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            type="text"
            placeholder="Type your prompt..."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            style={{ flex: 1, padding: '0.75rem', borderRadius: 8, border: '1px solid #6366f1', background: '#18181b', color: '#e5e7eb', fontSize: '1rem', fontWeight: 500 }}
            onKeyDown={e => { if (e.key === 'Enter') sendMessage(prompt); }}
          />
          <button onClick={() => sendMessage(prompt)} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '0.75rem 1.25rem', cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}>Send</button>
        </div>
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

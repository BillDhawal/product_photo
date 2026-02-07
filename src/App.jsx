import React, { useEffect, useMemo, useRef, useState } from 'react';
import { removeBackground } from '@imgly/background-removal';
import { Stage, Layer, Image as KonvaImage, Transformer } from 'react-konva';
import { Button, Select, TextInput } from 'flowbite-react';
import ChatBubbleOutlineRounded from '@mui/icons-material/ChatBubbleOutlineRounded';
import ImageRounded from '@mui/icons-material/ImageRounded';
import LayersRounded from '@mui/icons-material/LayersRounded';
import PhotoCameraRounded from '@mui/icons-material/PhotoCameraRounded';
import CropSquareRounded from '@mui/icons-material/CropSquareRounded';
import CropPortraitRounded from '@mui/icons-material/CropPortraitRounded';
import Inventory2Rounded from '@mui/icons-material/Inventory2Rounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import CropFreeRounded from '@mui/icons-material/CropFreeRounded';
import CameraAltRounded from '@mui/icons-material/CameraAltRounded';
import StorefrontRounded from '@mui/icons-material/StorefrontRounded';
import './App.css';
import propPodium from './assets/props/podioum_1.png';
import propSnakePlant from './assets/props/snake_plant_1.png';
import bg01 from './assets/backgrounds/background-01.jpg';
import bg02 from './assets/backgrounds/background-02.jpg';
import bg03 from './assets/backgrounds/background-03.jpg';
import bg04 from './assets/backgrounds/background-04.jpg';
import bg05 from './assets/backgrounds/background-05.jpg';
import bg06 from './assets/backgrounds/background-06.jpg';
import bg07 from './assets/backgrounds/background-07.jpg';
import bg08 from './assets/backgrounds/background-08.jpg';
import bg09 from './assets/backgrounds/background-09.jpg';
import bg10 from './assets/backgrounds/background-10.jpg';

const Icon = ({ name }) => {
  const paths = {
    wand: 'M5 15l10-10M12 4l1.5 2.5L16 8l-2.5 1.5L12 12l-1.5-2.5L8 8l2.5-1.5L12 4z',
    plus: 'M12 5v14M5 12h14',
    download: 'M12 3v12m0 0l4-4m-4 4l-4-4M5 19h14',
    layersUp: 'M12 4l7 4-7 4-7-4 7-4zm0 8l7 4-7 4-7-4 7-4z',
    layersDown: 'M12 4l7 4-7 4-7-4 7-4zm7 8l-7 4-7-4',
    undo: 'M9 7H5v4M5 11c1.5-3 4.5-4 7.5-4 3.5 0 6.5 2 7.5 5',
    redo: 'M15 7h4v4M19 11c-1.5-3-4.5-4-7.5-4-3.5 0-6.5 2-7.5 5',
    duplicate: 'M8 8h9v9H8zM6 6h9v9',
    trash: 'M5 7h14M9 7V5h6v2M8 7l1 10h6l1-10',
    props: 'M4 7h7v10H4zM13 7h7v6h-7zM13 15h7v2h-7z',
    spark: 'M12 3l1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3z',
    grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={paths[name]} />
    </svg>
  );
};

function Sidebar({ activePanel, setActivePanel, addPhotoFrame }) {
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alphaMatting, setAlphaMatting] = useState(true);
  const [foregroundThreshold, setForegroundThreshold] = useState(240);
  const [backgroundThreshold, setBackgroundThreshold] = useState(10);
  const [showUploadGuide, setShowUploadGuide] = useState(false);
  const [hideGuideNextTime, setHideGuideNextTime] = useState(false);
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
  const handleUploadTrigger = () => {
    if (!hideGuideNextTime) {
      setShowUploadGuide(true);
    } else {
      document.getElementById('product-upload-input')?.click();
    }
  };

  return (
    <aside className="sidebar">
      <div className="icon-sidebar">
        <button
          className={`icon-tile ${activePanel === 'product' ? 'active' : ''}`}
          onClick={handleUploadTrigger}
          title="Add Product Photo"
        >
          <PhotoCameraRounded />
        </button>
        <button
          className={`icon-tile ${activePanel === 'chat' ? 'active' : ''}`}
          onClick={() => setActivePanel('chat')}
          title="Chatbot"
        >
          <ChatBubbleOutlineRounded />
        </button>
        <button
          className={`icon-tile ${activePanel === 'props' ? 'active' : ''}`}
          onClick={() => setActivePanel('props')}
          title="Props"
        >
          <LayersRounded />
        </button>
        <button
          className={`icon-tile ${activePanel === 'background' ? 'active' : ''}`}
          onClick={() => setActivePanel('background')}
          title="Backgrounds"
        >
          <ImageRounded />
        </button>
      </div>
      <input
        id="product-upload-input"
        type="file"
        accept="image/*"
        onChange={handlePhotoChange}
        className="hidden-upload-input"
      />
      {loading && (
        <div className="photo-preview">
          <div className="spinner" />
          <span>Removing background...</span>
        </div>
      )}
      {photo && !loading && (
        <div className="photo-preview">
          <img src={photo} alt="Product preview" />
        </div>
      )}
      {showUploadGuide && (
        <div className="upload-modal-backdrop" onClick={() => setShowUploadGuide(false)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()}>
            <div className="upload-guide-header">
              <div>
                <h3>Upload tips</h3>
                <p>Use a clean, centered product shot.</p>
              </div>
              <button className="icon-button small" onClick={() => setShowUploadGuide(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="upload-guide-body">
              <div className="guide-section good">
                <div className="guide-title">Good example</div>
                <div className="guide-text">Undistorted angle product photo.</div>
              </div>
              <div className="guide-section bad">
                <div className="guide-title">Bad examples</div>
                <ul>
                  <li>Portrait photo</li>
                  <li>Distorted angle</li>
                  <li>Cut-off edges</li>
                  <li>Group photo</li>
                </ul>
              </div>
              <div className="control-block modal">
                <div className="control-header">
                  <div>
                    <h3>Cutout settings</h3>
                    <p>Adjust if edges look rough.</p>
                  </div>
                </div>
                <label className="checkbox-row">
                  <input type="checkbox" checked={alphaMatting} onChange={e => setAlphaMatting(e.target.checked)} />
                  <span>Alpha Matting</span>
                </label>
                <label className="range-row">
                  <span>Foreground Threshold</span>
                  <div className="range-meta">{foregroundThreshold}</div>
                  <input type="range" min="0" max="255" value={foregroundThreshold} onChange={e => setForegroundThreshold(Number(e.target.value))} />
                </label>
                <label className="range-row">
                  <span>Background Threshold</span>
                  <div className="range-meta">{backgroundThreshold}</div>
                  <input type="range" min="0" max="255" value={backgroundThreshold} onChange={e => setBackgroundThreshold(Number(e.target.value))} />
                </label>
              </div>
              <label className="checkbox-row small">
                <input
                  type="checkbox"
                  checked={hideGuideNextTime}
                  onChange={(e) => setHideGuideNextTime(e.target.checked)}
                />
                <span>I do not want to see it from now on.</span>
              </label>
              <label className="upload-action">
                <span className="primary-button">Upload product photo to begin</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    handlePhotoChange(e);
                    setShowUploadGuide(false);
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function AIChatbot() {
  // Chatbot state
  const models = [
    { id: 'stable-diffusion', name: 'Stable Diffusion' },
    { id: 'controlnet', name: 'ControlNet' }
  ];
  const [selectedModel, setSelectedModel] = useState(models[0].id);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [chat, setChat] = useState([
    { sender: 'bot', text: 'Hi! I am your AI assistant. What background can I create for your product photo?' }
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
  const showQuickPrompts = chat.length === 1 && chat[0].sender === 'bot';
  return (
    <section className="ai-chatbot">
      <div className="model-row compact">
        <label>Model</label>
        <Select
          value={selectedModel}
          onChange={e => setSelectedModel(e.target.value)}
          className="flowbite-select compact"
        >
          {models.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </Select>
      </div>
      <div className="chat-window">
        <div className="chat-history">
          {chat.map((msg, idx) => (
            <div key={idx} className={`chat-message ${msg.sender === 'user' ? 'is-user' : 'is-bot'}`}>
              <div className="chat-bubble">{msg.text}</div>
              {idx === 0 && showQuickPrompts && (
                <div className="chat-empty inline">
                  <div className="chat-empty-badge">
                    <Icon name="spark" />
                    <span>Try a quick prompt</span>
                  </div>
                  <div className="chat-empty-grid">
                    <button onClick={() => handleSuggestion('Soft morning light')} className="empty-chip">Soft morning light</button>
                    <button onClick={() => handleSuggestion('Minimal shadow play')} className="empty-chip">Minimal shadow play</button>
                    <button onClick={() => handleSuggestion('Spa marble backdrop')} className="empty-chip">Spa marble backdrop</button>
                    <button onClick={() => handleSuggestion('Botanical studio set')} className="empty-chip">Botanical studio set</button>
                  </div>
                </div>
              )}
              {msg.thumbnails && (
                <div className="thumbnail-grid">
                  {msg.thumbnails.map((url, tidx) => (
                    <button key={tidx} className="thumbnail-card">
                      <img src={url} alt={`Thumbnail ${tidx + 1}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="chat-loading">
              <div className="spinner" />
              <span>Generating thumbnails...</span>
            </div>
          )}
        </div>
        <div className="chat-input">
          <TextInput
            type="text"
            placeholder="Type your prompt..."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendMessage(prompt); }}
            className="chat-text-input"
          />
          <Button onClick={() => sendMessage(prompt)} className="primary-button">
            Send
          </Button>
        </div>
      </div>
    </section>
  );
}



function CanvasImage({ frame, isSelected, onSelect, onChange, stageSize }) {
  const shapeRef = useRef(null);
  const trRef = useRef(null);
  const [image, setImage] = useState(null);
  const isBackground = Boolean(frame.isBackground);

  useEffect(() => {
    const img = new window.Image();
    img.src = frame.src;
    img.onload = () => setImage(img);
  }, [frame.src]);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <KonvaImage
        image={image}
        x={isBackground ? 0 : frame.x}
        y={isBackground ? 0 : frame.y}
        width={isBackground ? stageSize.width : frame.width}
        height={isBackground ? stageSize.height : frame.height}
        draggable={!isBackground}
        ref={shapeRef}
        onClick={isBackground ? undefined : onSelect}
        onTap={isBackground ? undefined : onSelect}
        onDragEnd={(e) => {
          if (isBackground) return;
          onChange({
            ...frame,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={() => {
          if (isBackground) return;
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            ...frame,
            x: node.x(),
            y: node.y(),
            width: Math.max(40, node.width() * scaleX),
            height: Math.max(40, node.height() * scaleY),
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          anchorSize={10}
          borderStroke="#6366f1"
          anchorStroke="#6366f1"
          anchorFill="#0f1115"
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 40 || newBox.height < 40) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
}

function Preview({
  frames,
  setFrames,
  propsPanel,
  backgroundPanel,
  canvasPreset,
  canvasPresets,
  onPresetChange,
  stageRef,
  presetCategory,
  onCategoryChange
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const wrapRef = useRef(null);

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

  const selectFrame = (id) => {
    setFrames(frames.map(f => ({ ...f, selected: f.id === id })));
  };
  const updateFrame = (id, attrs) => {
    pushHistory(frames.map(f => f.id === id ? { ...f, ...attrs } : f));
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

  useEffect(() => {
    if (!wrapRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width: maxWidth, height: maxHeight } = entry.contentRect;
      if (!maxWidth || !maxHeight) return;
      const ratio = canvasPreset.width / canvasPreset.height;
      const width = Math.min(maxWidth, maxHeight * ratio);
      const height = width / ratio;
      setStageSize({ width, height });
    });
    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, [canvasPreset]);

  const selectedFrame = frames.find(frame => frame.selected);
  const hasSelection = Boolean(selectedFrame);

  // Render frame controls
  const renderControls = (frame) => (
    <div className="frame-controls">
      <button onClick={() => bringToFront(frame.id)} title="Bring to front" aria-label="Bring to front">
        <Icon name="layersUp" />
      </button>
      <button onClick={() => sendToBack(frame.id)} title="Send to back" aria-label="Send to back">
        <Icon name="layersDown" />
      </button>
      <button onClick={() => duplicateFrame(frame.id)} title="Duplicate" aria-label="Duplicate">
        <Icon name="duplicate" />
      </button>
      <button className="delete" onClick={() => deleteFrame(frame.id)} title="Delete" aria-label="Delete">
        <Icon name="trash" />
      </button>
    </div>
  );

  const getControlsPosition = () => {
    if (!selectedFrame) return null;
    const padding = 12;
    const controlWidth = 240;
    const controlHeight = 36;
    const centerX = selectedFrame.x + selectedFrame.width / 2;
    let left = Math.min(Math.max(centerX, controlWidth / 2 + padding), stageSize.width - controlWidth / 2 - padding);
    let top = selectedFrame.y + selectedFrame.height + 12;
    if (top + controlHeight + padding > stageSize.height) {
      top = Math.max(selectedFrame.y - controlHeight - 12, padding);
    }
    return { left, top };
  };

  // Render frames
  return (
    <section className="preview">
      <div className="preview-header">
        <div>
          <h2>Canvas</h2>
          <p>Arrange your product and props.</p>
        </div>
        <div className="preview-actions">
          <button className="icon-button" onClick={undo} disabled={!history.length} title="Undo">
            <Icon name="undo" />
          </button>
          <button className="icon-button" onClick={redo} disabled={!redoStack.length} title="Redo">
            <Icon name="redo" />
          </button>
          <div className="dimension-picker">
            <button
              className="dimension-trigger"
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="dimension-icon">{canvasPreset.icon}</span>
              <span>{canvasPreset.width} x {canvasPreset.height}px</span>
              <ExpandMoreRounded />
            </button>
            <div className={`dimension-menu ${menuOpen ? 'open' : ''}`}>
              <div className="dimension-tabs">
                <button
                  className={presetCategory === 'standard' ? 'active' : ''}
                  onClick={() => onCategoryChange('standard')}
                >
                  <CropFreeRounded />
                  Standard
                </button>
                <button
                  className={presetCategory === 'social' ? 'active' : ''}
                  onClick={() => onCategoryChange('social')}
                >
                  <CameraAltRounded />
                  SNS
                </button>
                <button
                  className={presetCategory === 'marketplace' ? 'active' : ''}
                  onClick={() => onCategoryChange('marketplace')}
                >
                  <StorefrontRounded />
                  Marketplace
                </button>
              </div>
              <div className="dimension-list">
                {canvasPresets
                  .filter((preset) => preset.category === presetCategory)
                  .map((preset) => (
                    <button
                      key={preset.id}
                      className={`dimension-row ${canvasPreset.id === preset.id ? 'active' : ''}`}
                      onClick={() => {
                        onPresetChange(preset);
                        setMenuOpen(false);
                      }}
                    >
                      <span className="dimension-row-label">
                        {preset.icon}
                        {preset.label}
                      </span>
                      <span className="dimension-row-size">
                        {preset.width} x {preset.height}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="preview-canvas-wrap" ref={wrapRef}>
        <div
          className="preview-canvas"
          style={{ width: stageSize.width, height: stageSize.height }}
        >
          <Stage
            width={stageSize.width}
            height={stageSize.height}
            ref={stageRef}
            onMouseDown={(e) => {
              if (e.target === e.target.getStage()) {
                setFrames(frames.map(f => ({ ...f, selected: false })));
              }
            }}
          >
            <Layer>
              {frames
                .slice()
                .sort((a, b) => a.zIndex - b.zIndex)
                .map(frame => (
                  <CanvasImage
                    key={frame.id}
                    frame={frame}
                    isSelected={frame.selected}
                    onSelect={() => selectFrame(frame.id)}
                    onChange={(attrs) => updateFrame(frame.id, attrs)}
                    stageSize={stageSize}
                  />
                ))}
            </Layer>
          </Stage>
          {selectedFrame && stageSize.width > 0 && stageSize.height > 0 && (
            <div className="frame-controls-floating" style={getControlsPosition()}>
              {renderControls(selectedFrame)}
            </div>
          )}
        </div>
      </div>
      {backgroundPanel}
      {propsPanel}
    </section>
  );
}

function BackgroundPanel({ open, items, onAdd, onClose }) {
  return (
    <aside className={`background-panel ${open ? 'open' : ''}`}>
      <div className="props-panel-header">
        <div>
          <h3>Backgrounds</h3>
          <p>Choose a backdrop for your scene.</p>
        </div>
        <button className="ghost-button" onClick={onClose}>Close</button>
      </div>
      <div className="props-grid">
        {items.map(item => (
          <button key={item.id} className="props-card" onClick={() => onAdd(item.src)}>
            <img src={item.src} alt={item.name} />
            <span>{item.name}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function PropsPanel({ open, items, onAdd, onClose }) {
  return (
    <aside className={`props-panel ${open ? 'open' : ''}`}>
      <div className="props-panel-header">
        <div>
          <h3>Props Library</h3>
          <p>Drag inspiration assets into the canvas.</p>
        </div>
        <button className="ghost-button" onClick={onClose}>Close</button>
      </div>
      <div className="props-grid">
        {items.map(item => (
          <button key={item.id} className="props-card" onClick={() => onAdd(item.src)}>
            <img src={item.src} alt={item.name} />
            <span>{item.name}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function App() {
  const [frames, setFrames] = useState([]);
  const [activePanel, setActivePanel] = useState('chat');
  const stageRef = useRef(null);

  const canvasPresets = useMemo(() => ([
    {
      id: 'standard-1-1',
      category: 'standard',
      label: '1:1',
      width: 1512,
      height: 1512,
      icon: <CropSquareRounded />
    },
    {
      id: 'standard-4-3',
      category: 'standard',
      label: '4:3',
      width: 2016,
      height: 1512,
      icon: <CropFreeRounded />
    },
    {
      id: 'standard-16-9',
      category: 'standard',
      label: '16:9',
      width: 2688,
      height: 1512,
      icon: <CropFreeRounded />
    },
    {
      id: 'standard-4-5',
      category: 'standard',
      label: '4:5',
      width: 1512,
      height: 1890,
      icon: <CropPortraitRounded />
    },
    {
      id: 'standard-9-16',
      category: 'standard',
      label: '9:16',
      width: 1512,
      height: 2688,
      icon: <CropPortraitRounded />
    },
    {
      id: 'sns-ig-post',
      category: 'social',
      label: 'Instagram Post',
      width: 1080,
      height: 1080,
      icon: <CameraAltRounded />
    },
    {
      id: 'sns-ig-story',
      category: 'social',
      label: 'Instagram Story',
      width: 1080,
      height: 1920,
      icon: <CameraAltRounded />
    },
    {
      id: 'sns-ig-reels',
      category: 'social',
      label: 'Instagram Reels',
      width: 1080,
      height: 1920,
      icon: <CameraAltRounded />
    },
    {
      id: 'sns-ig-feed',
      category: 'social',
      label: 'Instagram Feed',
      width: 1080,
      height: 1350,
      icon: <CameraAltRounded />
    },
    {
      id: 'sns-yt-thumb',
      category: 'social',
      label: 'YouTube Thumbnail',
      width: 1280,
      height: 720,
      icon: <CameraAltRounded />
    },
    {
      id: 'sns-yt-profile',
      category: 'social',
      label: 'YouTube Profile',
      width: 800,
      height: 800,
      icon: <CameraAltRounded />
    },
    {
      id: 'sns-yt-channel',
      category: 'social',
      label: 'YouTube Channel Art',
      width: 2560,
      height: 1440,
      icon: <CameraAltRounded />
    },
    {
      id: 'sns-fb-newsfeed',
      category: 'social',
      label: 'Facebook Newsfeed',
      width: 1200,
      height: 1200,
      icon: <CameraAltRounded />
    },
    {
      id: 'sns-fb-story',
      category: 'social',
      label: 'Facebook Story/Post',
      width: 1080,
      height: 1920,
      icon: <CameraAltRounded />
    },
    {
      id: 'sns-fb-profile',
      category: 'social',
      label: 'Facebook Profile',
      width: 720,
      height: 720,
      icon: <CameraAltRounded />
    },
    {
      id: 'market-amazon',
      category: 'marketplace',
      label: 'Amazon',
      width: 2000,
      height: 2000,
      icon: <Inventory2Rounded />
    },
    {
      id: 'market-ebay',
      category: 'marketplace',
      label: 'eBay',
      width: 1600,
      height: 1600,
      icon: <Inventory2Rounded />
    },
    {
      id: 'market-shopee',
      category: 'marketplace',
      label: 'Shopee',
      width: 1080,
      height: 1080,
      icon: <Inventory2Rounded />
    },
    {
      id: 'market-lazada',
      category: 'marketplace',
      label: 'Lazada',
      width: 1080,
      height: 1080,
      icon: <Inventory2Rounded />
    },
    {
      id: 'market-etsy',
      category: 'marketplace',
      label: 'Etsy',
      width: 2700,
      height: 2025,
      icon: <Inventory2Rounded />
    },
    {
      id: 'market-shopify',
      category: 'marketplace',
      label: 'Shopify',
      width: 2048,
      height: 2048,
      icon: <Inventory2Rounded />
    }
  ]), []);
  const [canvasPreset, setCanvasPreset] = useState(canvasPresets[0]);
  const [presetCategory, setPresetCategory] = useState('standard');
  const handleDownload = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const uri = stage.toDataURL({ pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = `product-photo-${canvasPreset.id}.png`;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const propsAssets = useMemo(() => (
    Array.from({ length: 10 }, (_, idx) => {
      const isPodium = idx % 2 === 0;
      return {
        id: isPodium ? `podium-${idx}` : `snake-plant-${idx}`,
        name: isPodium ? 'Podium' : 'Snake Plant',
        src: isPodium ? propPodium : propSnakePlant,
      };
    })
  ), []);

  const backgroundAssets = useMemo(() => ([
    { id: 'bg-01', name: 'Warm Pink', src: bg01 },
    { id: 'bg-02', name: 'Soft Orange', src: bg02 },
    { id: 'bg-03', name: 'Gold Ink', src: bg03 },
    { id: 'bg-04', name: 'Marble Gold', src: bg04 },
    { id: 'bg-05', name: 'Petal Flatlay', src: bg05 },
    { id: 'bg-06', name: 'Blue Vase', src: bg06 },
    { id: 'bg-07', name: 'Painted Wood', src: bg07 },
    { id: 'bg-08', name: 'Floral Edge', src: bg08 },
    { id: 'bg-09', name: 'Dry Twigs', src: bg09 },
    { id: 'bg-10', name: 'Studio Room', src: bg10 },
  ]), []);

  // Add photo to frames
  const addPhotoFrame = (src) => {
    const img = new window.Image();
    img.src = src;
    img.onload = () => {
      const maxInitialSize = 360;
      const scale = Math.min(1, maxInitialSize / Math.max(img.naturalWidth, img.naturalHeight));
      const scaledWidth = Math.round(img.naturalWidth * scale);
      const scaledHeight = Math.round(img.naturalHeight * scale);
      setFrames((prev) => [
        ...prev,
        {
          id: Date.now(),
          x: 120,
          y: 120,
          width: scaledWidth,
          height: scaledHeight,
          zIndex: prev.length + 1,
          selected: false,
          src,
        },
      ]);
    };
  };

  const addPropFrame = (src) => {
    const img = new window.Image();
    img.src = src;
    img.onload = () => {
      const maxInitialSize = 240;
      const scale = Math.min(1, maxInitialSize / Math.max(img.naturalWidth, img.naturalHeight));
      const scaledWidth = Math.round(img.naturalWidth * scale);
      const scaledHeight = Math.round(img.naturalHeight * scale);
      setFrames((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          x: 180,
          y: 160,
          width: scaledWidth,
          height: scaledHeight,
          zIndex: prev.length + 1,
          selected: false,
          src,
        },
      ]);
    };
  };

  const addBackgroundFrame = (src) => {
    setFrames((prev) => {
      const minZ = prev.length ? Math.min(...prev.map(f => f.zIndex)) : 0;
      const backgroundFrame = {
        id: `bg-${Date.now()}`,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        zIndex: minZ - 1,
        selected: false,
        src,
        isBackground: true,
      };
      return [...prev.filter(f => !f.isBackground), backgroundFrame];
    });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Icon name="wand" />
          </div>
          <div>
            <h1>Product Photo Studio</h1>
            <span>AI-assisted scenes & props</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" title="New Canvas">
            <Icon name="grid" />
          </button>
          <button className="icon-button" title="Add Prop" onClick={() => setActivePanel('props')}>
            <Icon name="plus" />
          </button>
          <button className="icon-button primary" title="Download" onClick={handleDownload}>
            <Icon name="download" />
          </button>
        </div>
      </header>
      <div className="app-grid">
        <Sidebar
          activePanel={activePanel}
          setActivePanel={setActivePanel}
          addPhotoFrame={addPhotoFrame}
        />
        <div className="panel-stack">
          {activePanel === 'chat' && <AIChatbot />}
          {activePanel === 'props' && (
            <PropsPanel
              open
              items={propsAssets}
              onAdd={addPropFrame}
              onClose={() => setActivePanel('chat')}
            />
          )}
          {activePanel === 'background' && (
            <BackgroundPanel
              open
              items={backgroundAssets}
              onAdd={addBackgroundFrame}
              onClose={() => setActivePanel('chat')}
            />
          )}
          {activePanel === 'product' && (
            <div className="empty-panel">
              <h3>Product</h3>
              <p>Upload and manage product images.</p>
            </div>
          )}
        </div>
        <Preview
          frames={frames}
          setFrames={setFrames}
          canvasPreset={canvasPreset}
          canvasPresets={canvasPresets}
          onPresetChange={setCanvasPreset}
          stageRef={stageRef}
          presetCategory={presetCategory}
          onCategoryChange={setPresetCategory}
          backgroundPanel={(
            <BackgroundPanel
              open={false}
              items={backgroundAssets}
              onAdd={addBackgroundFrame}
              onClose={() => setActivePanel('chat')}
            />
          )}
          propsPanel={(
            <PropsPanel
              open={false}
              items={propsAssets}
              onAdd={addPropFrame}
              onClose={() => setActivePanel('chat')}
            />
          )}
        />
      </div>
    </div>
  );
}

export default App;

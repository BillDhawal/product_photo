import React, { useEffect, useMemo, useRef, useState } from 'react';
import { removeBackground } from '@imgly/background-removal';
import { Stage, Layer, Image as KonvaImage, Transformer } from 'react-konva';
import { Button, Select, TextInput } from 'flowbite-react';
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
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
import propCherryBlossomBranch from './assets/props/cherry_blossom_branch.png';
import propCreepingPlantBranch from './assets/props/creeping_plant_branch.png';
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
import transparentLogo from './assets/logo/transparent-logo_cropped.png';
import cameraLogo from './assets/logo/transparent-logo_camera_cropped.png';

const uploadExampleImages = import.meta.glob('./assets/upload_good_bad_example/*', {
  eager: true,
  import: 'default',
});

const getUploadExamples = () => {
  const assets = Object.entries(uploadExampleImages).map(([path, src]) => ({
    path,
    src,
    name: path.split('/').pop() || '',
  }));
  const good = assets.find((item) => item.name.toLowerCase().includes('bottle'));
  const bad = assets.filter((item) => item !== good);
  return { good, bad };
};

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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const PUBLIC_FILE_BASE = import.meta.env.VITE_PUBLIC_FILE_BASE || API_BASE_URL;
const ENABLE_PROXY =
  import.meta.env.VITE_ENABLE_PROXY
    ? import.meta.env.VITE_ENABLE_PROXY === '1'
    : true;
const VECTEEZY_PROPS_TERM = import.meta.env.VITE_VECTEEZY_PROPS_TERM || 'flower, plant';
const VECTEEZY_PROPS_PER_PAGE = Number(import.meta.env.VITE_VECTEEZY_PROPS_PER_PAGE || 12);
const DEFAULT_PROMPT_PREFIX =
  'Keep the overall composition and include the props, but do not copy them rigidly. ' +
  'Props can be adjusted to better suit the product while staying consistent with the scene. ' +
  'Preserve all readable product text and logos exactly as in the reference (no misspellings or gibberish). ' +
  'Refine lighting, background texture, and overall realism without removing key elements.';

const dataUrlToBlob = (dataUrl) => {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new Blob([array], { type: mime });
};

const joinUrl = (base, path) => {
  const normalizedBase = base.replace(/\/$/, '');
  const normalizedPath = path.replace(/^\//, '');
  return `${normalizedBase}/${normalizedPath}`;
};

const toProxyUrl = (url) => `${API_BASE_URL}/proxy?url=${encodeURIComponent(url)}`;

const getCanvasSafeUrl = (url) => {
  if (!url) return url;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith(API_BASE_URL)) return url;
  if (typeof window !== 'undefined' && url.startsWith(window.location.origin)) return url;
  if (url.startsWith('http')) return ENABLE_PROXY ? toProxyUrl(url) : url;
  return url;
};

const toAspectRatio = (width, height) => {
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
};

const toIdeogramSize = (ratio, resolution = '1K') => {
  const isHd = resolution === '2K';
  switch (ratio) {
    case '1:1':
      return isHd ? 'square_hd' : 'square';
    case '4:3':
      return 'landscape_4_3';
    case '3:4':
      return 'portrait_4_3';
    case '16:9':
      return 'landscape_16_9';
    case '9:16':
      return 'portrait_16_9';
    default:
      return isHd ? 'square_hd' : 'square';
  }
};

const uploadReferenceImage = async (dataUrl) => {
  const formData = new FormData();
  formData.append('file', dataUrlToBlob(dataUrl), 'reference.jpg');
  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData
  });
  if (!response.ok) {
    throw new Error('Failed to upload reference image.');
  }
  const payload = await response.json();
  const url = payload?.url || payload?.data?.url || payload?.link;
  if (!url) {
    throw new Error('Upload response missing URL.');
  }
  return url.startsWith('http') ? url : joinUrl(PUBLIC_FILE_BASE, url);
};

const createGenerationTask = async ({
  prompt,
  inputUrl,
  aspectRatio = '4:3',
  resolution = '1K',
  model,
  quality,
  imageSize,
  renderingSpeed,
  style,
  numImages,
  seed,
  imageInput,
  outputFormat
}) => {
  const response = await fetch(`${API_BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input_url: inputUrl,
      prompt,
      aspect_ratio: aspectRatio,
      resolution,
      ...(model ? { model } : {}),
      ...(quality ? { quality } : {}),
      ...(imageSize ? { image_size: imageSize } : {}),
      ...(renderingSpeed ? { rendering_speed: renderingSpeed } : {}),
      ...(style ? { style } : {}),
      ...(numImages ? { num_images: numImages } : {}),
      ...(seed !== undefined ? { seed } : {}),
      ...(imageInput ? { image_input: imageInput } : {}),
      ...(outputFormat ? { output_format: outputFormat } : {})
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to create generation task.');
  }
  return response.json();
};

const pollGenerationTask = async (taskId) => {
  const response = await fetch(`${API_BASE_URL}/status?task_id=${encodeURIComponent(taskId)}`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to query generation task.');
  }
  return response.json();
};

function Sidebar({ activePanel, setActivePanel, addPhotoFrame }) {
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alphaMatting, setAlphaMatting] = useState(true);
  const [foregroundThreshold, setForegroundThreshold] = useState(240);
  const [backgroundThreshold, setBackgroundThreshold] = useState(10);
  const [showUploadGuide, setShowUploadGuide] = useState(false);
  const [hideGuideNextTime, setHideGuideNextTime] = useState(false);
  const uploadExamples = useMemo(() => getUploadExamples(), []);
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
      <div className="sidebar-logo" aria-hidden="true">
        <img src={cameraLogo} alt="" />
      </div>
      <div className="icon-sidebar">
        <button
          className={`icon-tile ${activePanel === 'product' ? 'active' : ''}`}
          onClick={handleUploadTrigger}
          title="Add Product Photo"
        >
          <PhotoCameraRounded />
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
        <button
          className={`icon-tile ${activePanel === 'chat' ? 'active' : ''}`}
          onClick={() => setActivePanel('chat')}
          title="Chatbot"
        >
          <ChatBubbleOutlineRounded />
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
                <div className="guide-title">
                  <span className="guide-icon good" aria-hidden="true">
                    <svg className="guide-icon-svg" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
                      <circle cx="9" cy="10" r="1" fill="currentColor" />
                      <circle cx="15" cy="10" r="1" fill="currentColor" />
                      <path
                        d="M8.5 14.2c1.1 1.3 2.6 2 3.5 2s2.4-.7 3.5-2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  Good example
                </div>
                <div className="guide-text">Undistorted angle product photo.</div>
                {uploadExamples.good?.src && (
                  <div className="guide-images">
                    <img
                      className="guide-image"
                      src={uploadExamples.good.src}
                      alt="Good example"
                    />
                  </div>
                )}
              </div>
              <div className="guide-section bad">
                <div className="guide-title">
                  <span className="guide-icon bad" aria-hidden="true">
                    <svg className="guide-icon-svg" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
                      <circle cx="9" cy="10" r="1" fill="currentColor" />
                      <circle cx="15" cy="10" r="1" fill="currentColor" />
                      <path
                        d="M8.5 15.6c1.1-1.3 2.6-2 3.5-2s2.4.7 3.5 2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  Bad example
                </div>
                {uploadExamples.bad.length ? (
                  <div className="guide-image-grid">
                    {uploadExamples.bad.map((item) => (
                      <img
                        key={item.path}
                        className="guide-image"
                        src={item.src}
                        alt="Bad example"
                      />
                    ))}
                  </div>
                ) : (
                  <ul>
                    <li>Portrait photo</li>
                    <li>Distorted angle</li>
                    <li>Cut-off edges</li>
                    <li>Group photo</li>
                  </ul>
                )}
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

function AIChatbot({ getCanvasSnapshot, onSelectGenerated, aspectRatio }) {
  // Chatbot state
  const models = [
    { id: 'flux-2/pro-image-to-image', name: 'Flux 2 (Image-to-Image)' },
    { id: 'gpt-image/1.5-image-to-image', name: 'GPT Image 1.5 (Image-to-Image)' },
    { id: 'ideogram/v3-reframe', name: 'Ideogram v3 Reframe' },
    { id: 'nano-banana-pro', name: 'Nano Banana Pro' }
  ];
  const [selectedModel, setSelectedModel] = useState(models[0].id);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [chat, setChat] = useState([
    { sender: 'bot', text: 'Hi! I am your AI assistant. What background can I create for your product photo?' }
  ]);
  // Handle prompt suggestion click
  const handleSuggestion = (p) => {
    setPrompt('');
    sendMessage(p);
  };
  // Send message (user prompt or input)
  const sendMessage = async (p) => {
    if (!p) return;
    setChat(prev => [...prev, { sender: 'user', text: p }]);
    setLoading(true);
    setPrompt('');
    try {
      // TODO: Consider langchain/langgraph for prompt orchestration.
      const finalPrompt = `${DEFAULT_PROMPT_PREFIX} ${p}`;
      const referenceImage = getCanvasSnapshot ? getCanvasSnapshot() : null;
      if (!referenceImage) {
        throw new Error('Capture a canvas image before generating.');
      }
      const inputUrl = await uploadReferenceImage(referenceImage);
      const quality =
        selectedModel === 'gpt-image/1.5-image-to-image' ? 'medium' : undefined;
      const imageSize =
        selectedModel === 'ideogram/v3-reframe'
          ? toIdeogramSize(aspectRatio, '1K')
          : undefined;
      const outputFormat =
        selectedModel === 'nano-banana-pro' ? 'png' : undefined;
      const imageInput =
        selectedModel === 'nano-banana-pro' && inputUrl ? [inputUrl] : undefined;
      const task = await createGenerationTask({
        prompt: finalPrompt,
        inputUrl,
        aspectRatio,
        model: selectedModel,
        quality,
        imageSize,
        renderingSpeed: selectedModel === 'ideogram/v3-reframe' ? 'BALANCED' : undefined,
        style: selectedModel === 'ideogram/v3-reframe' ? 'AUTO' : undefined,
        numImages: selectedModel === 'ideogram/v3-reframe' ? '2' : undefined,
        imageInput,
        outputFormat
      });
      if (task?.code && task.code !== 200) {
        throw new Error(task?.msg || 'Generation failed.');
      }
      const taskId = task?.data?.taskId || task?.data?.recordId;
      if (!taskId) {
        throw new Error(task?.msg || 'KIE task ID missing.');
      }
      let status;
      for (let i = 0; i < 20; i += 1) {
        status = await pollGenerationTask(taskId);
        const state = status?.data?.state;
        if (state === 'success' || state === 'fail') break;
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
      if (status?.data?.state !== 'success') {
        throw new Error(status?.data?.failMsg || 'Generation failed.');
      }
      let resultUrls = [];
      try {
        const resultJson = status?.data?.resultJson || '{}';
        const parsed = JSON.parse(resultJson);
        resultUrls = parsed.resultUrls || [];
      } catch (err) {
        resultUrls = [];
      }
      let finalUrls = resultUrls.slice(0, 2);
      if (finalUrls.length === 1) {
        finalUrls = [finalUrls[0], finalUrls[0]];
      }
      const thumbnails = finalUrls.map((url, idx) => ({ id: `${idx}`, url }));
      setChat(prev => [
        ...prev,
        {
          sender: 'bot',
          text: `Here are some generated backgrounds for: "${p}"`,
          thumbnails: thumbnails.map(t => t.url)
        }
      ]);
    } catch (err) {
      const message = err?.message || 'Generation failed. Please try again.';
      const hint = message.toLowerCase().includes('invalid image format')
        ? 'Tip: ensure your upload URL is public (set VITE_PUBLIC_FILE_BASE to your tunnel URL).'
        : '';
      setChat(prev => [
        ...prev,
        {
          sender: 'bot',
          text: hint ? `${message} ${hint}` : message
        }
      ]);
    } finally {
      setLoading(false);
    }
  };
  const showQuickPrompts = chat.length === 1 && chat[0].sender === 'bot';
  return (
    <section className="ai-chatbot">
      <div className="chat-header-row">
        <h3>AI Chat</h3>
      </div>
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
                    <button
                      key={tidx}
                      className="thumbnail-card"
                      onClick={() => onSelectGenerated?.(url)}
                    >
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
          <input
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
    if (frame.src && frame.src.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }
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
  onCategoryChange,
  frameReplaceRequest,
  onFrameReplaceApplied
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
  const getBackgroundZ = () => {
    const bg = frames.find(f => f.isBackground);
    return bg ? bg.zIndex : null;
  };
  const getNonBackgroundFrames = () => frames.filter(f => !f.isBackground);

  const duplicateFrame = (id) => {
    const frame = frames.find(f => f.id === id);
    if (frame) {
      const nonBg = getNonBackgroundFrames();
      const maxNonBg = nonBg.length ? Math.max(...nonBg.map(f => f.zIndex)) : 0;
      const newFrame = {
        ...frame,
        id: Date.now(),
        x: frame.x + 30,
        y: frame.y + 30,
        selected: false,
        zIndex: maxNonBg + 1
      };
      pushHistory([...frames, newFrame]);
    }
  };
  const bringToFront = (id) => {
    const nonBg = getNonBackgroundFrames();
    const maxNonBg = nonBg.length ? Math.max(...nonBg.map(f => f.zIndex)) : 0;
    pushHistory(frames.map(f => f.id === id ? { ...f, zIndex: maxNonBg + 1 } : f));
  };
  const sendToBack = (id) => {
    const bgZ = getBackgroundZ();
    const nonBg = getNonBackgroundFrames();
    const minNonBg = nonBg.length ? Math.min(...nonBg.map(f => f.zIndex)) : 0;
    const nextZ = bgZ === null ? minNonBg - 1 : Math.max(bgZ + 1, minNonBg - 1);
    pushHistory(frames.map(f => f.id === id ? { ...f, zIndex: nextZ } : f));
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

  useEffect(() => {
    if (!frameReplaceRequest) return;
    pushHistory(frameReplaceRequest);
    onFrameReplaceApplied?.();
  }, [frameReplaceRequest, onFrameReplaceApplied]);

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

function PropsPanel({
  open,
  items,
  onAdd,
  onClose,
  onLoadMore,
  hasMore,
  loading,
  error,
  searchValue,
  onSearch,
}) {
  const handleScroll = (event) => {
    if (!onLoadMore || !hasMore || loading) return;
    const target = event.currentTarget;
    const threshold = 120;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - threshold) {
      onLoadMore();
    }
  };
  return (
    <aside className={`props-panel ${open ? 'open' : ''}`}>
      <div className="props-panel-header">
        <div>
          <h3>Props Library</h3>
          <p>Drag inspiration assets into the canvas.</p>
        </div>
        <button className="ghost-button" onClick={onClose}>Close</button>
      </div>
      <div className="props-search">
        <TextInput
          sizing="sm"
          value={searchValue}
          onChange={(event) => onSearch?.(event.target.value)}
          placeholder="Search props (e.g., leaf, hand, plant)"
        />
      </div>
      <div className="props-grid" onScroll={handleScroll}>
        {items.map(item => (
          <button key={item.id} className="props-card" onClick={() => onAdd(item.src)}>
            <img src={item.src} alt={item.name} />
          </button>
        ))}
        {loading && (
          <div className="props-grid-footer">Loading more…</div>
        )}
        {error && (
          <div className="props-grid-footer error">{error}</div>
        )}
        {!hasMore && items.length > 0 && (
          <div className="props-grid-footer">End of results</div>
        )}
      </div>
    </aside>
  );
}

function App() {
  const [frames, setFrames] = useState([]);
  const [activePanel, setActivePanel] = useState('chat');
  const stageRef = useRef(null);
  const [frameReplaceRequest, setFrameReplaceRequest] = useState(null);
  const [remoteProps, setRemoteProps] = useState([]);
  const [propsPage, setPropsPage] = useState(1);
  const [propsHasMore, setPropsHasMore] = useState(true);
  const [propsLoading, setPropsLoading] = useState(false);
  const [propsError, setPropsError] = useState('');
  const [propsSearch, setPropsSearch] = useState(VECTEEZY_PROPS_TERM);

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
  const aspectRatio = useMemo(
    () => toAspectRatio(canvasPreset.width, canvasPreset.height),
    [canvasPreset]
  );

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

  const propsAssets = useMemo(() => ([
    { id: 'podium-1', name: 'Podium', src: propPodium },
    { id: 'snake-plant-1', name: 'Snake Plant', src: propSnakePlant },
    { id: 'cherry-blossom-branch', name: 'Cherry Blossom Branch', src: propCherryBlossomBranch },
    { id: 'creeping-plant-branch', name: 'Creeping Plant Branch', src: propCreepingPlantBranch },
  ]), []);
  const propLibraryItems = remoteProps.length ? remoteProps : propsAssets;

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
    const safeSrc = getCanvasSafeUrl(src);
    img.src = safeSrc;
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
          src: safeSrc,
        },
      ]);
    };
  };

  const addBackgroundFrame = (src) => {
    const safeSrc = getCanvasSafeUrl(src);
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
        src: safeSrc,
        isBackground: true,
      };
      return [...prev.filter(f => !f.isBackground), backgroundFrame];
    });
  };

  const replaceWithBackground = (src) => {
    const safeSrc = getCanvasSafeUrl(src);
    const backgroundFrame = {
      id: `bg-${Date.now()}`,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      zIndex: 0,
      selected: false,
      src: safeSrc,
      isBackground: true,
    };
    // Replace scene with AI background only; undo restores prior frames.
    setFrameReplaceRequest([{ ...backgroundFrame, zIndex: 0 }]);
  };

  const fetchPropsPage = async (pageToLoad = 1, termOverride = propsSearch) => {
    if (propsLoading) return;
    setPropsLoading(true);
    setPropsError('');
    try {
      const params = new URLSearchParams({
        term: termOverride,
        content_type: 'png',
        page: String(pageToLoad),
        per_page: String(VECTEEZY_PROPS_PER_PAGE),
        sort_by: 'relevance',
        license_type: 'commercial',
      });
      const response = await fetch(`${API_BASE_URL}/vecteezy/resources?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to load props (status ${response.status}).`);
      }
      const payload = await response.json();
      const resources = Array.isArray(payload?.resources) ? payload.resources : [];
      const mapped = resources
        .map((item) => ({
          id: `vecteezy-${item.id}`,
          name: item.title || `Prop ${item.id}`,
          src: item.thumbnail_2x_url || item.thumbnail_url,
        }))
        .filter((item) => item.src);
      setRemoteProps((prev) => (pageToLoad === 1 ? mapped : [...prev, ...mapped]));
      setPropsPage(pageToLoad);
      const lastPage = Number(payload?.last_page || pageToLoad);
      setPropsHasMore(pageToLoad < lastPage);
    } catch (error) {
      setPropsError(error.message || 'Failed to load props.');
    } finally {
      setPropsLoading(false);
    }
  };

  useEffect(() => {
    if (activePanel === 'props' && remoteProps.length === 0 && !propsLoading) {
      fetchPropsPage(1);
    }
  }, [activePanel, remoteProps.length, propsLoading]);

  useEffect(() => {
    const trimmed = propsSearch.trim();
    if (!trimmed || activePanel !== 'props') return;
    const handle = setTimeout(() => {
      setRemoteProps([]);
      setPropsHasMore(true);
      fetchPropsPage(1, trimmed);
    }, 350);
    return () => clearTimeout(handle);
  }, [propsSearch, activePanel]);

  const handlePropsLoadMore = () => {
    if (propsLoading || !propsHasMore) return;
    fetchPropsPage(propsPage + 1);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <img src={transparentLogo} alt="prodshoots.ai logo" />
          </div>
        </div>
        <div className="topbar-actions">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="ghost-button">Sign in</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="ghost-button">Sign up</button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
          <button className="icon-button primary" title="Download" onClick={handleDownload}>
            <Icon name="download" />
          </button>
        </div>
      </header>
      <SignedIn>
        <div className="app-grid">
          <Sidebar
            activePanel={activePanel}
            setActivePanel={setActivePanel}
            addPhotoFrame={addPhotoFrame}
          />
          <div className="panel-stack">
            {activePanel === 'chat' && (
              <AIChatbot
                getCanvasSnapshot={() => stageRef.current?.toDataURL({ pixelRatio: 1 }) || null}
                onSelectGenerated={(url) => replaceWithBackground(url)}
                aspectRatio={aspectRatio}
              />
            )}
            {activePanel === 'props' && (
              <PropsPanel
                open
                    items={propLibraryItems}
                onAdd={addPropFrame}
                onClose={() => setActivePanel('chat')}
                    onLoadMore={handlePropsLoadMore}
                    hasMore={propsHasMore}
                    loading={propsLoading}
                    error={propsError}
                    searchValue={propsSearch}
                    onSearch={setPropsSearch}
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
            frameReplaceRequest={frameReplaceRequest}
            onFrameReplaceApplied={() => setFrameReplaceRequest(null)}
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
                    items={propLibraryItems}
                onAdd={addPropFrame}
                onClose={() => setActivePanel('chat')}
                    onLoadMore={handlePropsLoadMore}
                    hasMore={propsHasMore}
                    loading={propsLoading}
                    error={propsError}
                    searchValue={propsSearch}
                    onSearch={setPropsSearch}
              />
            )}
          />
        </div>
      </SignedIn>
      <SignedOut>
        <div className="empty-panel" style={{ maxWidth: 420, margin: '2rem auto' }}>
          <h3>Sign in required</h3>
          <p>Please sign in to access the studio.</p>
        </div>
      </SignedOut>
      <button
        className="feedback-fab"
        type="button"
        title="Send feedback"
        onClick={() => window.alert('Share your feedback with us at support@example.com')}
      >
        ?
      </button>
    </div>
  );
}

export default App;

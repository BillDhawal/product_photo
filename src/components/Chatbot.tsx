import React, { useState, useEffect } from "react";
import { Dropdown, Button, Spinner, TextInput } from "flowbite-react";

const STARTER_PROMPTS = [
  "Perfume backdrop",
  "Add AI human",
  "Select from template",
];

export default function Chatbot() {
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch available models on mount
  useEffect(() => {
    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => setModels(data.models || []))
      .catch(() => setModels([]));
  }, []);

  const handlePromptButton = (p: string) => setPrompt(p);

  const handleGenerate = async () => {
    setError("");
    if (!image || !prompt || !selectedModel) {
      setError("Please upload an image, select a model, and enter a prompt.");
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append("image", image);
    formData.append("prompt", prompt);
    formData.append("model", selectedModel);
    formData.append("num_images", "4");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.images) setThumbnails(data.images);
      else setError(data.error || "Generation failed.");
    } catch {
      setError("Server error.");
    }
    setLoading(false);
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-900">
      <div className="w-full max-w-lg bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-700 h-[90vh] flex flex-col">
        {/* Header */}
        <h2 className="text-2xl font-bold text-white mb-4 text-center">AI Chatbot</h2>
        {/* Model Selection */}
        <div className="mb-4">
          <label className="block text-gray-300 mb-1">Select Model:</label>
          <Dropdown
            label={
              selectedModel
                ? models.find((m) => m.id === selectedModel)?.name
                : "Select Model"
            }
            dismissOnClick={true}
            className="w-full"
          >
            {models.map((model) => (
              <Dropdown.Item key={model.id} onClick={() => setSelectedModel(model.id)}>
                {model.name}
              </Dropdown.Item>
            ))}
          </Dropdown>
        </div>

        {/* Make the chatbot content scrollable */}
        <div className="flex-1 overflow-y-auto pr-2">
          {/* Chatbot Messages */}
          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <div className="text-white mb-3">
              Hi! I am your AI assistant. What background can I create for your product photo?
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {STARTER_PROMPTS.map((sp) => (
                <Button
                  key={sp}
                  size="sm"
                  color="gray"
                  className="border border-blue-400 text-blue-400 bg-transparent hover:bg-blue-900"
                  onClick={() => handlePromptButton(sp)}
                >
                  {sp}
                </Button>
              ))}
            </div>
            {prompt && (
              <div className="flex justify-end mb-2">
                <div className="bg-blue-600 text-white px-4 py-2 rounded-lg">{prompt}</div>
              </div>
            )}
            {thumbnails.length > 0 && (
              <div className="bg-gray-800 text-white rounded-lg p-3 mb-2">
                Here are some generated backgrounds for: <span className="font-semibold">"{prompt}"</span>
              </div>
            )}
          </div>

          {/* Thumbnails in 2x2 Matrix */}
          {thumbnails.length > 0 && (
            <div className="w-full mt-4 flex flex-col items-center">
              <div className="grid grid-cols-2 grid-rows-2 gap-4 w-full max-w-xs">
                {thumbnails.slice(0, 4).map((url, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-900 rounded-lg flex items-center justify-center border border-blue-500 overflow-hidden aspect-square"
                    style={{ width: "100%", height: "100%" }}
                  >
                    <img
                      src={url}
                      alt={`Generated ${idx + 1}`}
                      className="object-cover w-full h-full"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Image Upload */}
        <div className="mb-4">
          <input
            type="file"
            accept="image/png, image/jpeg"
            className="block w-full text-gray-300"
            onChange={(e) => setImage(e.target.files?.[0] || null)}
          />
        </div>

        {/* Custom Prompt Input */}
        <div className="flex gap-2 mb-4">
          <TextInput
            placeholder="Type your prompt..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-1"
            color="gray"
          />
          <Button onClick={handleGenerate} disabled={loading} color="blue">
            {loading ? <Spinner size="sm" /> : "Send"}
          </Button>
        </div>

        {/* Error Message */}
        {error && <div className="text-red-400 mb-2">{error}</div>}

        {/* Thumbnails in 2x2 Matrix */}
        {thumbnails.length > 0 && (
          <div className="w-full mt-4 flex flex-col items-center">
            <div className="grid grid-cols-2 grid-rows-2 gap-4 w-full max-w-xs">
              {thumbnails.slice(0, 4).map((url, idx) => (
                <div
                  key={idx}
                  className="bg-gray-900 rounded-lg flex items-center justify-center border border-blue-500 overflow-hidden aspect-square"
                >
                  <img
                    src={url}
                    alt={`Generated ${idx + 1}`}
                    className="object-cover w-full h-full"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
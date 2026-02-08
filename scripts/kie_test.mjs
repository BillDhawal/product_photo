const API_KEY = process.env.KIE_API_KEY;

if (!API_KEY) {
  console.error('Missing KIE_API_KEY in environment.');
  process.exit(1);
}

const BASE_URL = 'https://api.kie.ai';
const MODEL = 'flux-2/pro-image-to-image';
const DEFAULT_PROMPT =
  'High-end product photography on a clean studio background, soft diffused light, natural shadows, premium look, minimal props.';

const createTask = async ({ inputUrls, prompt, aspectRatio = '4:3', resolution = '1K' }) => {
  const response = await fetch(`${BASE_URL}/api/v1/jobs/createTask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      input: {
        input_urls: inputUrls,
        prompt,
        aspect_ratio: aspectRatio,
        resolution
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Create task failed.');
  }

  return response.json();
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const output = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--input-url') output.inputUrl = args[i + 1];
    if (arg === '--prompt') output.prompt = args[i + 1];
    if (arg === '--aspect') output.aspectRatio = args[i + 1];
    if (arg === '--resolution') output.resolution = args[i + 1];
  }
  return output;
};

const main = async () => {
  const { inputUrl, prompt, aspectRatio, resolution } = parseArgs();
  const resolvedInputUrl = inputUrl || process.env.KIE_INPUT_URL;
  if (!resolvedInputUrl) {
    console.error('Missing input URL. Use --input-url or KIE_INPUT_URL.');
    process.exit(1);
  }

  try {
    const result = await createTask({
      inputUrls: [resolvedInputUrl],
      prompt: prompt || DEFAULT_PROMPT,
      aspectRatio: aspectRatio || '4:3',
      resolution: resolution || '1K'
    });
    console.log('Task created:', result);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
};

main();

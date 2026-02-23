export const maxDuration = 60; // Vercel Pro allows up to 60 seconds

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb', // 3 min audio can be up to ~20MB in base64
    },
  },
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { audio, mimeType } = req.body;

    if (!audio) {
      return res.status(400).json({ error: 'No audio data', transcript: '' });
    }

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audio, 'base64');
    
    if (audioBuffer.length < 100) {
      return res.status(400).json({ error: 'Audio too short', transcript: '' });
    }

    // Determine file extension and content type from mimeType
    let ext = 'webm';
    let contentType = 'audio/webm';
    if (mimeType) {
      if (mimeType.includes('mp4')) {
        ext = 'mp4';
        contentType = 'audio/mp4';
      } else if (mimeType.includes('ogg')) {
        ext = 'ogg';
        contentType = 'audio/ogg';
      } else if (mimeType.includes('wav')) {
        ext = 'wav';
        contentType = 'audio/wav';
      }
    }

    // Build multipart form data for OpenAI Whisper API
    const boundary = '----WhisperBoundary' + Date.now();
    
    const fileFieldHeader = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="audio.${ext}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
    );
    const modelField = Buffer.from(
      `\r\n--${boundary}\r\n` +
      `Content-Disposition: form-data; name="model"\r\n\r\n` +
      `whisper-1`
    );
    const languageField = Buffer.from(
      `\r\n--${boundary}\r\n` +
      `Content-Disposition: form-data; name="language"\r\n\r\n` +
      `en`
    );
    const closing = Buffer.from(`\r\n--${boundary}--\r\n`);

    const requestBody = Buffer.concat([fileFieldHeader, audioBuffer, modelField, languageField, closing]);

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: requestBody,
    });

    if (!whisperResponse.ok) {
      const errorData = await whisperResponse.json().catch(() => ({}));
      console.error('Whisper API error:', whisperResponse.status, errorData);
      return res.status(500).json({ error: 'Transcription failed', detail: errorData });
    }

    const result = await whisperResponse.json();
    
    res.status(200).json({ transcript: result.text || '' });
  } catch (error) {
    console.error('Transcribe error:', error.message);
    res.status(500).json({ error: 'Transcription failed', detail: error.message });
  }
}

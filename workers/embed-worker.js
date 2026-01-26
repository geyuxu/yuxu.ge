/**
 * Cloudflare Worker - Embedding API Proxy
 *
 * Proxies embedding requests to OpenAI, protecting the API key.
 *
 * Environment Variables (set in Cloudflare Dashboard):
 *   - OPENAI_API_KEY: Your OpenAI API key
 *
 * Deploy:
 *   1. Create a new Worker in Cloudflare Dashboard
 *   2. Paste this code
 *   3. Add OPENAI_API_KEY to Environment Variables
 *   4. Deploy and note the Worker URL
 *   5. Update search-client.js with your Worker URL
 */

// Allowed origins (update for your domain)
const ALLOWED_ORIGINS = [
    'https://yuxu.ge',
    'https://www.yuxu.ge',
    // Add localhost for development if needed:
    // 'http://localhost:3000',
    // 'http://127.0.0.1:5500',
];

// OpenAI embedding config (must match index-builder.mjs)
const EMBEDDING_CONFIG = {
    model: 'text-embedding-3-small',
    dimensions: 512,
};

/**
 * Handle CORS preflight
 */
function handleOptions(request) {
    const origin = request.headers.get('Origin');
    const isAllowed = ALLOWED_ORIGINS.includes(origin);

    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': isAllowed ? origin : '',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
        },
    });
}

/**
 * Add CORS headers to response
 */
function corsHeaders(origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin);
    return {
        'Access-Control-Allow-Origin': isAllowed ? origin : '',
        'Content-Type': 'application/json',
    };
}

/**
 * Get embedding from OpenAI
 */
async function getEmbedding(text, apiKey) {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: EMBEDDING_CONFIG.model,
            input: text,
            dimensions: EMBEDDING_CONFIG.dimensions,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
}

/**
 * Main request handler
 */
export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin') || '';

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return handleOptions(request);
        }

        // Only allow POST
        if (request.method !== 'POST') {
            return new Response(
                JSON.stringify({ error: 'Method not allowed' }),
                { status: 405, headers: corsHeaders(origin) }
            );
        }

        // Check API key is configured
        if (!env.OPENAI_API_KEY) {
            return new Response(
                JSON.stringify({ error: 'Server configuration error' }),
                { status: 500, headers: corsHeaders(origin) }
            );
        }

        try {
            // Parse request body
            const body = await request.json();
            const text = body.text;

            if (!text || typeof text !== 'string') {
                return new Response(
                    JSON.stringify({ error: 'Missing or invalid "text" field' }),
                    { status: 400, headers: corsHeaders(origin) }
                );
            }

            // Limit text length (prevent abuse)
            if (text.length > 1000) {
                return new Response(
                    JSON.stringify({ error: 'Text too long (max 1000 chars)' }),
                    { status: 400, headers: corsHeaders(origin) }
                );
            }

            // Get embedding
            const embedding = await getEmbedding(text, env.OPENAI_API_KEY);

            return new Response(
                JSON.stringify({ embedding }),
                { status: 200, headers: corsHeaders(origin) }
            );

        } catch (err) {
            console.error('Worker error:', err);
            return new Response(
                JSON.stringify({ error: err.message }),
                { status: 500, headers: corsHeaders(origin) }
            );
        }
    },
};

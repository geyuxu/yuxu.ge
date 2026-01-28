/**
 * Cloudflare Worker - OpenAI API Proxy
 *
 * Endpoints:
 *   POST /embed  - Get text embeddings (for vector search)
 *   POST /chat   - Chat completion with RAG context
 *
 * Environment Variables (set in Cloudflare Dashboard):
 *   - OPENAI_API_KEY: Your OpenAI API key
 *
 * Deploy:
 *   1. Create a new Worker in Cloudflare Dashboard
 *   2. Paste this code
 *   3. Add OPENAI_API_KEY to Environment Variables
 *   4. Deploy and note the Worker URL
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

// Chat config
const CHAT_CONFIG = {
    model: 'gpt-4o-mini',
    maxTokens: 1024,
    temperature: 0.7,
};

const SYSTEM_PROMPT = `你是 Yuxu 个人网站的 AI 助手。你的任务是：
1. 回答关于博客内容、项目和作者的问题
2. 提供友好、专业的技术交流

如果提供了相关的博客内容作为上下文，请基于这些内容回答问题。
如果问题超出上下文范围，你可以基于通用知识回答，但要说明这不是来自博客的内容。
回答请简洁明了，使用中文或英文取决于用户的提问语言。`;

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
        throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
}

/**
 * Chat completion with OpenAI
 */
async function chatCompletion(messages, context, apiKey) {
    const systemMessage = context
        ? `${SYSTEM_PROMPT}\n\n以下是相关的博客内容供参考：\n${context}`
        : SYSTEM_PROMPT;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: CHAT_CONFIG.model,
            messages: [
                { role: 'system', content: systemMessage },
                ...messages,
            ],
            max_tokens: CHAT_CONFIG.maxTokens,
            temperature: CHAT_CONFIG.temperature,
        }),
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
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

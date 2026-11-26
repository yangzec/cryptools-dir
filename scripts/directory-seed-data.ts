/**
 * Demo directory seed (8 categories, 15 tags, 30 tools).
 * Fixed IDs so `dir:seed --clean` only removes these rows.
 */

export type SeedCategory = {
  id: string;
  slug: string;
  icon: string;
  sort: number;
  nameEn: string;
  descEn: string;
  nameZh: string;
  descZh: string;
};

export type SeedTag = {
  id: string;
  slug: string;
  nameEn: string;
  nameZh: string;
};

export type SeedTool = {
  id: string;
  slug: string;
  nameEn: string;
  nameZh: string;
  taglineEn: string;
  taglineZh: string;
  iconUrl: string;
  websiteUrl: string;
  pricing: string;
  categorySlug: string;
  featured?: boolean;
  sort?: number;
  tagSlugs: string[];
  /** Local paths under public/, e.g. /imgs/screenshots/chatgpt.jpg */
  screenshots?: string[];
};

export const SEED_CATEGORIES: SeedCategory[] = [
  {
    id: '6b5d7a28-e7f2-41e0-bf55-7c96658699f3',
    slug: 'coding',
    icon: 'code',
    sort: 70,
    nameEn: 'Coding',
    descEn: 'AI pair programmers, app builders and coding agents.',
    nameZh: '编程',
    descZh: 'AI 结对编程、应用生成和编程智能体。',
  },
  {
    id: 'd2e2fe04-9227-4d49-9905-c64372878909',
    slug: 'chatbots',
    icon: 'message-square',
    sort: 80,
    nameEn: 'AI Chatbots',
    descEn: 'General-purpose assistants you can talk to.',
    nameZh: 'AI 聊天',
    descZh: '可以直接对话的通用 AI 助手。',
  },
  {
    id: 'fd406692-31af-4b79-8ceb-5ea395a243d9',
    slug: 'image',
    icon: 'image',
    sort: 60,
    nameEn: 'Image Generation',
    descEn: 'Create and edit images from text prompts.',
    nameZh: '图像生成',
    descZh: '用文字提示生成和编辑图片。',
  },
  {
    id: '8db31741-ee30-46ff-8a40-aad927b47d0c',
    slug: 'video',
    icon: 'video',
    sort: 50,
    nameEn: 'Video',
    descEn: 'Generate, edit and translate video with AI.',
    nameZh: '视频',
    descZh: '用 AI 生成、剪辑和翻译视频。',
  },
  {
    id: '69b0990b-e758-4bae-bae8-0af8d7afa6d3',
    slug: 'audio',
    icon: 'audio-lines',
    sort: 40,
    nameEn: 'Voice & Music',
    descEn: 'Text-to-speech, voice cloning and AI music.',
    nameZh: '语音与音乐',
    descZh: '文字转语音、声音克隆和 AI 音乐。',
  },
  {
    id: '7312594a-35c4-4954-9e03-38622af692a6',
    slug: 'productivity',
    icon: 'wand',
    sort: 20,
    nameEn: 'Productivity',
    descEn: 'Slides, notes and meetings, done faster.',
    nameZh: '效率',
    descZh: '更快地做幻灯片、笔记和会议。',
  },
  {
    id: '20aae868-28ca-49b9-8072-42cb8486ae3f',
    slug: 'research',
    icon: 'search',
    sort: 10,
    nameEn: 'Search & Research',
    descEn: 'Answer engines and research assistants.',
    nameZh: '搜索与研究',
    descZh: '答案引擎和研究助手。',
  },
  {
    id: '426a6f44-84e2-43d0-ad73-7d9139539ae3',
    slug: 'writing',
    icon: 'pen-tool',
    sort: 30,
    nameEn: 'Writing',
    descEn: 'Draft, rewrite and polish text.',
    nameZh: '写作',
    descZh: '起草、改写和润色文字。',
  },
];

export const SEED_TAGS: SeedTag[] = [
  {
    id: 'a1000001-0001-4000-8000-000000000001',
    slug: 'api',
    nameEn: 'API',
    nameZh: 'API',
  },
  {
    id: 'a1000001-0001-4000-8000-000000000002',
    slug: 'agent',
    nameEn: 'Agent',
    nameZh: '智能体',
  },
  {
    id: 'a1000001-0001-4000-8000-000000000003',
    slug: 'chatbot',
    nameEn: 'Chatbot',
    nameZh: '聊天机器人',
  },
  {
    id: 'a1000001-0001-4000-8000-000000000004',
    slug: 'video-generation',
    nameEn: 'Video Generation',
    nameZh: '视频生成',
  },
  {
    id: 'a1000001-0001-4000-8000-000000000005',
    slug: 'image-generation',
    nameEn: 'Image Generation',
    nameZh: '图像生成',
  },
  {
    id: 'a1000001-0001-4000-8000-000000000006',
    slug: 'search',
    nameEn: 'Search',
    nameZh: '搜索',
  },
  {
    id: 'a1000001-0001-4000-8000-000000000007',
    slug: 'app-builder',
    nameEn: 'App Builder',
    nameZh: '应用生成',
  },
  {
    id: 'a1000001-0001-4000-8000-000000000008',
    slug: 'code-assistant',
    nameEn: 'Code Assistant',
    nameZh: '编程助手',
  },
  {
    id: 'a1000001-0001-4000-8000-000000000009',
    slug: 'writing',
    nameEn: 'Writing',
    nameZh: '写作',
  },
  {
    id: 'a1000001-0001-4000-8000-00000000000a',
    slug: 'avatar',
    nameEn: 'Avatar',
    nameZh: '数字人',
  },
  {
    id: 'a1000001-0001-4000-8000-00000000000b',
    slug: 'music',
    nameEn: 'Music',
    nameZh: '音乐',
  },
  {
    id: 'a1000001-0001-4000-8000-00000000000c',
    slug: 'open-source',
    nameEn: 'Open Source',
    nameZh: '开源',
  },
  {
    id: 'a1000001-0001-4000-8000-00000000000d',
    slug: 'meeting',
    nameEn: 'Meeting',
    nameZh: '会议',
  },
  {
    id: 'a1000001-0001-4000-8000-00000000000e',
    slug: 'presentation',
    nameEn: 'Presentation',
    nameZh: '演示文稿',
  },
  {
    id: 'a1000001-0001-4000-8000-00000000000f',
    slug: 'text-to-speech',
    nameEn: 'Text to Speech',
    nameZh: '文字转语音',
  },
];

const favicon = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

const localIcon = (slug: string) => `/imgs/icons/${slug}.png`;

const localShots = (slug: string, count: number) =>
  Array.from({ length: count }, (_, i) =>
    i === 0
      ? `/imgs/screenshots/${slug}.jpg`
      : `/imgs/screenshots/${slug}-${i + 1}.jpg`
  );

export const SEED_TOOLS: SeedTool[] = [
  {
    id: '64815743-79ec-4df3-90e0-603f5a19ff43',
    slug: 'chatgpt',
    nameEn: 'ChatGPT',
    nameZh: 'ChatGPT',
    taglineEn:
      "OpenAI's assistant for writing, analysis, coding and everyday questions.",
    taglineZh: 'OpenAI 推出的 AI 助手，擅长写作、分析、编程和日常问答。',
    iconUrl: localIcon('chatgpt'),
    websiteUrl: 'https://chatgpt.com',
    pricing: 'freemium',
    categorySlug: 'chatbots',
    featured: true,
    sort: 100,
    screenshots: localShots('chatgpt', 2),
    tagSlugs: ['chatbot', 'api', 'writing'],
  },
  {
    id: '0bd3b5c5-54bc-4e25-b9e7-28b675edfdc5',
    slug: 'claude',
    nameEn: 'Claude',
    nameZh: 'Claude',
    taglineEn:
      'A thoughtful AI assistant for writing, research, coding and long documents.',
    taglineZh: '一款严谨可靠的 AI 助手，擅长写作、研究、编程和长文档处理。',
    iconUrl: localIcon('claude'),
    websiteUrl: 'https://claude.ai',
    pricing: 'freemium',
    categorySlug: 'chatbots',
    featured: true,
    sort: 95,
    screenshots: localShots('claude', 2),
    tagSlugs: ['chatbot', 'api', 'writing'],
  },
  {
    id: '1a4ad60c-3e20-4d14-8675-f9cd61f26003',
    slug: 'gemini',
    nameEn: 'Gemini',
    nameZh: 'Gemini',
    taglineEn:
      "Google's multimodal assistant, built into Search, Gmail and Docs.",
    taglineZh: 'Google 原生多模态大模型，深度整合于搜索、Gmail 和文档应用。',
    iconUrl: favicon('gemini.google.com'),
    websiteUrl: 'https://gemini.google.com',
    pricing: 'freemium',
    categorySlug: 'chatbots',
    sort: 90,
    tagSlugs: ['chatbot', 'search'],
  },
  {
    id: '72ea2559-4ee7-4a0e-bc28-112396e4c76b',
    slug: 'deepseek',
    nameEn: 'DeepSeek',
    nameZh: 'DeepSeek',
    taglineEn:
      'Open-weight reasoning models with a free chat app and a low-cost API.',
    taglineZh: '开源前沿深度推理大模型，提供免费对话平台与低成本 API。',
    iconUrl: favicon('chat.deepseek.com'),
    websiteUrl: 'https://chat.deepseek.com',
    pricing: 'freemium',
    categorySlug: 'chatbots',
    sort: 85,
    tagSlugs: ['chatbot', 'api', 'open-source'],
  },
  {
    id: '8c772cb8-971c-43f1-93c6-681b95fbb048',
    slug: 'ollama',
    nameEn: 'Ollama',
    nameZh: 'Ollama',
    taglineEn: 'Run open large language models locally with one command.',
    taglineZh: '一行终端命令即可在本地设备轻松下载并运行开源大模型。',
    iconUrl: favicon('ollama.com'),
    websiteUrl: 'https://ollama.com',
    pricing: 'free',
    categorySlug: 'chatbots',
    sort: 80,
    tagSlugs: ['open-source', 'api'],
  },
  {
    id: 'b2000002-0002-4000-8000-000000000001',
    slug: 'grok',
    nameEn: 'Grok',
    nameZh: 'Grok',
    taglineEn: "xAI's real-time assistant with a sharp sense of humor.",
    taglineZh: 'xAI 的实时对话助手，风格犀利且信息新鲜。',
    iconUrl: favicon('x.ai'),
    websiteUrl: 'https://x.ai',
    pricing: 'freemium',
    categorySlug: 'chatbots',
    sort: 75,
    tagSlugs: ['chatbot', 'search'],
  },
  {
    id: '77c2cbd0-c406-4b52-948d-4dd03a0839e6',
    slug: 'cursor',
    nameEn: 'Cursor',
    nameZh: 'Cursor',
    taglineEn:
      'The AI code editor: autocomplete, chat and agents across your codebase.',
    taglineZh: 'AI 代码编辑器：智能补全、对话和贯穿整个代码库的智能体。',
    iconUrl: localIcon('cursor'),
    websiteUrl: 'https://cursor.com',
    pricing: 'freemium',
    categorySlug: 'coding',
    featured: true,
    sort: 100,
    screenshots: localShots('cursor', 1),
    tagSlugs: ['code-assistant', 'agent'],
  },
  {
    id: '77a83d7f-ca2f-4886-b48c-d67b3664d502',
    slug: 'claude-code',
    nameEn: 'Claude Code',
    nameZh: 'Claude Code',
    taglineEn:
      'An agentic coding tool that works in your terminal, IDE and browser.',
    taglineZh: '能在终端、IDE 和浏览器间无缝协同的高性能自主编程工具。',
    iconUrl: favicon('claude.com'),
    websiteUrl: 'https://claude.com',
    pricing: 'paid',
    categorySlug: 'coding',
    sort: 95,
    tagSlugs: ['code-assistant', 'agent'],
  },
  {
    id: 'cf159930-b3b4-4b55-a0bc-4cbeba7ee6e3',
    slug: 'github-copilot',
    nameEn: 'GitHub Copilot',
    nameZh: 'GitHub Copilot',
    taglineEn: 'AI pair programmer inside VS Code, JetBrains and GitHub.',
    taglineZh: '深度集成于主流 IDE 的全天候 AI 结对编程助手。',
    iconUrl: favicon('github.com'),
    websiteUrl: 'https://github.com/features/copilot',
    pricing: 'freemium',
    categorySlug: 'coding',
    sort: 90,
    tagSlugs: ['code-assistant'],
  },
  {
    id: 'd9e836ec-85d7-4632-9cb7-740e7d56e9c0',
    slug: 'v0',
    nameEn: 'v0',
    nameZh: 'v0',
    taglineEn:
      'Describe a UI or app and get working React code you can deploy.',
    taglineZh: '通过自然语言描述界面，即刻生成可直接部署的 React 前端组件。',
    iconUrl: favicon('v0.app'),
    websiteUrl: 'https://v0.app',
    pricing: 'freemium',
    categorySlug: 'coding',
    sort: 85,
    tagSlugs: ['app-builder', 'code-assistant'],
  },
  {
    id: '0d0bc51a-7b3b-48ae-94a2-97abdf440268',
    slug: 'bolt',
    nameEn: 'Bolt',
    nameZh: 'Bolt',
    taglineEn:
      'Prompt, run, edit and deploy full-stack web apps in the browser.',
    taglineZh: '在浏览器内全流程提示生成、运行、在线调试并部署全栈 Web 应用。',
    iconUrl: favicon('bolt.new'),
    websiteUrl: 'https://bolt.new',
    pricing: 'freemium',
    categorySlug: 'coding',
    sort: 80,
    tagSlugs: ['app-builder', 'agent'],
  },
  {
    id: '44ff7cfa-62fa-4a61-9c16-52c7811ef173',
    slug: 'replit',
    nameEn: 'Replit',
    nameZh: 'Replit',
    taglineEn:
      'Build and ship apps from a prompt with an AI agent and hosting built in.',
    taglineZh: '内置 AI 智能体协作与云端一键托管，助你从想法直达产品上线。',
    iconUrl: favicon('replit.com'),
    websiteUrl: 'https://replit.com',
    pricing: 'freemium',
    categorySlug: 'coding',
    sort: 75,
    tagSlugs: ['app-builder', 'agent'],
  },
  {
    id: 'b2000002-0002-4000-8000-000000000002',
    slug: 'windsurf',
    nameEn: 'Windsurf',
    nameZh: 'Windsurf',
    taglineEn: 'Agentic IDE from Codeium for cascading multi-file edits.',
    taglineZh: 'Codeium 出品的智能体 IDE，擅长跨文件级联改动。',
    iconUrl: favicon('windsurf.com'),
    websiteUrl: 'https://windsurf.com',
    pricing: 'freemium',
    categorySlug: 'coding',
    sort: 70,
    tagSlugs: ['code-assistant', 'agent'],
  },
  {
    id: 'e7aa955d-f032-44fd-87c5-0c5809036c5d',
    slug: 'midjourney',
    nameEn: 'Midjourney',
    nameZh: 'Midjourney',
    taglineEn: 'Striking, artistic images from text prompts.',
    taglineZh: '用文字提示生成极具艺术感的图像。',
    iconUrl: localIcon('midjourney'),
    websiteUrl: 'https://www.midjourney.com',
    pricing: 'paid',
    categorySlug: 'image',
    featured: true,
    sort: 100,
    tagSlugs: ['image-generation'],
  },
  {
    id: '2c73c242-a7d5-45a4-927d-94cff01524e9',
    slug: 'ideogram',
    nameEn: 'Ideogram',
    nameZh: 'Ideogram',
    taglineEn: 'Image generation that gets text and typography right.',
    taglineZh: '精准呈现文字与版式设计的高清 AI 图像生成与设计工具。',
    iconUrl: favicon('ideogram.ai'),
    websiteUrl: 'https://ideogram.ai',
    pricing: 'freemium',
    categorySlug: 'image',
    sort: 90,
    tagSlugs: ['image-generation'],
  },
  {
    id: '2e1e07b8-1ae5-48b8-bfae-22e39fe75390',
    slug: 'leonardo-ai',
    nameEn: 'Leonardo.Ai',
    nameZh: 'Leonardo.Ai',
    taglineEn: 'Generate production-ready art and assets with fine control.',
    taglineZh: '具备精细控制能力、面向生产级场景的数字艺术与游戏资产生成平台。',
    iconUrl: favicon('leonardo.ai'),
    websiteUrl: 'https://leonardo.ai',
    pricing: 'freemium',
    categorySlug: 'image',
    sort: 85,
    tagSlugs: ['image-generation'],
  },
  {
    id: '2e1e07b8-1ae5-48b8-bfae-22e39fe75391',
    slug: 'krea',
    nameEn: 'Krea',
    nameZh: 'Krea',
    taglineEn: 'Real-time image generation, upscaling and enhancement.',
    taglineZh: '毫秒级实时图像绘制生成、超分辨率放大与细节画质增强。',
    iconUrl: favicon('www.krea.ai'),
    websiteUrl: 'https://krea.ai',
    pricing: 'freemium',
    categorySlug: 'image',
    sort: 80,
    tagSlugs: ['image-generation'],
  },
  {
    id: '9f1ca20f-74cf-474a-b3d9-36733fa99148',
    slug: 'runway',
    nameEn: 'Runway',
    nameZh: 'Runway',
    taglineEn: 'Generate and edit video with state-of-the-art models.',
    taglineZh: '运用前沿 AI 模型生成电影级视频并进行精细化后期编辑。',
    iconUrl: localIcon('runway'),
    websiteUrl: 'https://runwayml.com',
    pricing: 'freemium',
    categorySlug: 'video',
    featured: true,
    sort: 100,
    screenshots: localShots('runway', 1),
    tagSlugs: ['video-generation'],
  },
  {
    id: 'b2000002-0002-4000-8000-000000000003',
    slug: 'pika',
    nameEn: 'Pika',
    nameZh: 'Pika',
    taglineEn: 'Idea-to-video generation with playful motion controls.',
    taglineZh: '从想法到短视频，支持生动的运动与镜头控制。',
    iconUrl: favicon('pika.art'),
    websiteUrl: 'https://pika.art',
    pricing: 'freemium',
    categorySlug: 'video',
    sort: 90,
    tagSlugs: ['video-generation'],
  },
  {
    id: 'b2000002-0002-4000-8000-000000000004',
    slug: 'luma-ai',
    nameEn: 'Luma AI',
    nameZh: 'Luma AI',
    taglineEn: 'Dream Machine for cinematic text-to-video clips.',
    taglineZh: 'Dream Machine 电影感文生视频工具。',
    iconUrl: favicon('lumalabs.ai'),
    websiteUrl: 'https://lumalabs.ai',
    pricing: 'freemium',
    categorySlug: 'video',
    sort: 85,
    tagSlugs: ['video-generation'],
  },
  {
    id: 'b2000002-0002-4000-8000-000000000005',
    slug: 'heygen',
    nameEn: 'HeyGen',
    nameZh: 'HeyGen',
    taglineEn: 'AI avatars and localized talking-head videos.',
    taglineZh: 'AI 数字人与多语言口播视频生成。',
    iconUrl: favicon('heygen.com'),
    websiteUrl: 'https://www.heygen.com',
    pricing: 'freemium',
    categorySlug: 'video',
    sort: 80,
    tagSlugs: ['video-generation', 'avatar'],
  },
  {
    id: '6faf3e1f-4139-4f1d-bb6c-ad9af9c77d44',
    slug: 'elevenlabs',
    nameEn: 'ElevenLabs',
    nameZh: 'ElevenLabs',
    taglineEn: 'Lifelike text-to-speech, voice cloning and dubbing.',
    taglineZh: '超拟真人声语音合成、声音克隆与多语言智能配音。',
    iconUrl: localIcon('elevenlabs'),
    websiteUrl: 'https://elevenlabs.io',
    pricing: 'freemium',
    categorySlug: 'audio',
    featured: true,
    sort: 100,
    screenshots: localShots('elevenlabs', 2),
    tagSlugs: ['text-to-speech', 'api'],
  },
  {
    id: 'b2000002-0002-4000-8000-000000000006',
    slug: 'suno',
    nameEn: 'Suno',
    nameZh: 'Suno',
    taglineEn: 'Make complete songs from a short text prompt.',
    taglineZh: '用短提示词生成完整歌曲。',
    iconUrl: localIcon('suno'),
    websiteUrl: 'https://suno.com',
    pricing: 'freemium',
    categorySlug: 'audio',
    sort: 90,
    tagSlugs: ['music'],
  },
  {
    id: 'b2000002-0002-4000-8000-000000000007',
    slug: 'udio',
    nameEn: 'Udio',
    nameZh: 'Udio',
    taglineEn: 'High-quality AI music generation and remixing.',
    taglineZh: '高质量 AI 音乐生成与混音。',
    iconUrl: favicon('udio.com'),
    websiteUrl: 'https://www.udio.com',
    pricing: 'freemium',
    categorySlug: 'audio',
    sort: 85,
    tagSlugs: ['music'],
  },
  {
    id: '23f28252-2ae3-4482-bac2-17d7cc776cc7',
    slug: 'gamma',
    nameEn: 'Gamma',
    nameZh: 'Gamma',
    taglineEn:
      'Beautiful presentations, docs and sites, generated from a prompt.',
    taglineZh: '输入一句话即可快速生成精美演示文稿、在线文档与网页。',
    iconUrl: localIcon('gamma'),
    websiteUrl: 'https://gamma.app',
    pricing: 'freemium',
    categorySlug: 'productivity',
    featured: true,
    sort: 100,
    screenshots: localShots('gamma', 1),
    tagSlugs: ['presentation'],
  },
  {
    id: 'b2000002-0002-4000-8000-000000000008',
    slug: 'otter-ai',
    nameEn: 'Otter.ai',
    nameZh: 'Otter.ai',
    taglineEn: 'Meeting notes and transcriptions that keep teams aligned.',
    taglineZh: '会议录音转写与自动纪要，帮助团队对齐。',
    iconUrl: favicon('otter.ai'),
    websiteUrl: 'https://otter.ai',
    pricing: 'freemium',
    categorySlug: 'productivity',
    sort: 90,
    tagSlugs: ['meeting'],
  },
  {
    id: 'b2000002-0002-4000-8000-000000000009',
    slug: 'fireflies',
    nameEn: 'Fireflies.ai',
    nameZh: 'Fireflies.ai',
    taglineEn: 'AI notetaker for Zoom, Meet and Teams calls.',
    taglineZh: '面向 Zoom / Meet / Teams 的 AI 会议记录助手。',
    iconUrl: favicon('fireflies.ai'),
    websiteUrl: 'https://fireflies.ai',
    pricing: 'freemium',
    categorySlug: 'productivity',
    sort: 85,
    tagSlugs: ['meeting'],
  },
  {
    id: '83b25cc9-6465-480d-bd63-421e5c6f4b6e',
    slug: 'perplexity',
    nameEn: 'Perplexity',
    nameZh: 'Perplexity',
    taglineEn: 'An answer engine that searches the web and cites its sources.',
    taglineZh: '实时检索全网并附带权威信源引用的智能问答搜索引擎。',
    iconUrl: localIcon('perplexity'),
    websiteUrl: 'https://www.perplexity.ai',
    pricing: 'freemium',
    categorySlug: 'research',
    featured: true,
    sort: 100,
    screenshots: localShots('perplexity', 1),
    tagSlugs: ['search'],
  },
  {
    id: 'b2000002-0002-4000-8000-00000000000a',
    slug: 'consensus',
    nameEn: 'Consensus',
    nameZh: 'Consensus',
    taglineEn: 'Search academic papers and get evidence-backed answers.',
    taglineZh: '检索学术论文并给出有证据支撑的答案。',
    iconUrl: favicon('consensus.app'),
    websiteUrl: 'https://consensus.app',
    pricing: 'freemium',
    categorySlug: 'research',
    sort: 90,
    tagSlugs: ['search'],
  },
  {
    id: 'b2000002-0002-4000-8000-00000000000b',
    slug: 'jasper',
    nameEn: 'Jasper',
    nameZh: 'Jasper',
    taglineEn: 'Brand-aware AI writing for marketing teams.',
    taglineZh: '面向营销团队的品牌一致性 AI 写作助手。',
    iconUrl: favicon('jasper.ai'),
    websiteUrl: 'https://www.jasper.ai',
    pricing: 'paid',
    categorySlug: 'writing',
    sort: 100,
    tagSlugs: ['writing'],
  },
];

export const SEED_CATEGORY_IDS = SEED_CATEGORIES.map((c) => c.id);
export const SEED_TAG_IDS = SEED_TAGS.map((t) => t.id);
export const SEED_TOOL_IDS = SEED_TOOLS.map((t) => t.id);

if (SEED_CATEGORIES.length !== 8) {
  throw new Error(`Expected 8 seed categories, got ${SEED_CATEGORIES.length}`);
}
if (SEED_TAGS.length !== 15) {
  throw new Error(`Expected 15 seed tags, got ${SEED_TAGS.length}`);
}
if (SEED_TOOLS.length !== 30) {
  throw new Error(`Expected 30 seed tools, got ${SEED_TOOLS.length}`);
}

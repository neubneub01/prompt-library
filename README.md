# Prompt Library

A modern, self-hosted prompt management application built with Next.js, SQLite, and the Vercel AI SDK. Browse, search, and run your collection of AI prompts with multiple LLM provider support.

## Features

- **Prompt Management**: Store and organize your AI prompts with categories and tags
- **Full-Text Search**: Fast search powered by SQLite FTS5
- **Multi-Provider Support**: OpenAI, Anthropic, and Google AI integration
- **Streaming Responses**: Real-time streaming with the Vercel AI SDK
- **Run History**: Track all prompt executions with token usage and cost estimates
- **Docker Ready**: Easy deployment with Docker and docker-compose
- **Modern UI**: Beautiful interface built with shadcn/ui and Tailwind CSS

## Quick Start

### Prerequisites

- Node.js 20+
- npm or pnpm
- At least one LLM API key (OpenAI, Anthropic, or Google)

### Local Development

1. **Clone and install dependencies:**

```bash
cd prompt-library
npm install
```

2. **Set up environment variables:**

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...
```

3. **Initialize the database and seed sample prompts:**

```bash
npm run db:push
npm run db:seed
```

4. **Start the development server:**

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your prompt library.

## Docker Deployment

### Using Docker Compose (Recommended)

1. **Create your environment file:**

```bash
cp .env.example .env
```

Edit `.env` with your API keys.

2. **Build and start the container:**

```bash
docker-compose up -d
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Manual Docker Build

```bash
# Build the image
docker build -t prompt-library .

# Run the container
docker run -d \
  -p 3000:3000 \
  -v prompt-library-data:/app/data \
  -e OPENAI_API_KEY=your-key \
  -e ANTHROPIC_API_KEY=your-key \
  prompt-library
```

## Project Structure

```
prompt-library/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/chat/           # Streaming chat API endpoint
│   │   ├── history/            # Run history page
│   │   └── prompt/[id]/        # Prompt detail & run page
│   ├── components/             # React components
│   │   └── ui/                 # shadcn/ui components
│   ├── lib/
│   │   ├── db/                 # Database schema and queries
│   │   └── llm/                # LLM provider configuration
│   └── actions/                # Server actions
├── scripts/
│   └── seed.ts                 # Database seeding script
├── data/                       # SQLite database (auto-created)
├── drizzle.config.ts           # Drizzle ORM configuration
├── Dockerfile                  # Docker build configuration
└── docker-compose.yml          # Docker Compose configuration
```

## Database

The application uses SQLite with Drizzle ORM. The database file is stored at `data/prompt-library.db`.

### Schema

- **prompts**: Store prompt templates with metadata, variables schema, and examples
- **runs**: Track all prompt executions with inputs, outputs, and metrics
- **secrets**: (Optional) Store API keys per provider

### Commands

```bash
# Generate migrations
npm run db:generate

# Apply schema changes
npm run db:push

# Open Drizzle Studio
npm run db:studio

# Seed sample prompts
npm run db:seed
```

## Adding Custom Prompts

Edit `scripts/seed.ts` to add your own prompts. Each prompt can have:

- **title**: Display name
- **description**: Short description
- **category**: Grouping (coding, writing, analysis, etc.)
- **tags**: Array of tags for filtering
- **systemTemplate**: The system prompt (supports `{{variable}}` placeholders)
- **userTemplate**: Optional user message template
- **variablesSchema**: Define input fields with types, defaults, and validation
- **examples**: Sample inputs for documentation

## Homelab Deployment with Tailscale

For secure access to your prompt library from anywhere:

1. Install Tailscale on your server: https://tailscale.com/download
2. Run the Docker container as shown above
3. Access your prompt library via your Tailscale network IP

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key | At least one |
| `ANTHROPIC_API_KEY` | Anthropic API key | provider key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI API key | is required |
| `DATA_DIR` | Directory for SQLite database | No (defaults to cwd) |

## Tech Stack

- [Next.js 15](https://nextjs.org/) - React framework
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [SQLite](https://sqlite.org/) + [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Database
- [Vercel AI SDK](https://sdk.vercel.ai/) - LLM integration
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Tailwind CSS](https://tailwindcss.com/) - Styling

## License

MIT

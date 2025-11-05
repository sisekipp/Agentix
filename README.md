# Agentix

A powerful platform for building, testing, and deploying agentic workflows with a visual interface.

## Features

- **Visual Workflow Builder**: Build complex AI agent workflows with an intuitive drag-and-drop interface
- **Multi-Tenancy**: Support for Organizations and Teams
- **Workflow Versioning**: Version control for workflows with rollback capabilities
- **Multiple LLM Providers**: Support for OpenAI, Anthropic, Google, and more
- **Workflow Dev Kit Integration**: Durable and resilient workflow execution
- **Testing & Deployment**: Test workflows before deploying to production

## Tech Stack

- **Frontend**: Next.js 15 with App Router, TypeScript, Tailwind CSS
- **UI Components**: Shadcn UI
- **Database**: PostgreSQL with Drizzle ORM
- **AI SDK**: Vercel AI SDK with multi-provider support
- **Workflow Runtime**: Workflow Dev Kit
- **Containerization**: Docker & Docker Compose

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for local development)
- PostgreSQL (if not using Docker)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/agentix.git
cd agentix
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your database credentials and API keys.

4. Start the database and application with Docker:
```bash
docker-compose up -d
```

Alternatively, if you have PostgreSQL running locally:

```bash
# Generate and run database migrations
npm run db:generate
npm run db:push

# Start the development server
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Database Management

```bash
# Generate migrations
npm run db:generate

# Run migrations
npm run db:migrate

# Push schema directly to database (development only)
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio
```

## Project Structure

```
agentix/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   │   └── ui/          # Shadcn UI components
│   ├── lib/             # Utilities and shared code
│   │   └── db/          # Database schema and connection
│   ├── hooks/           # Custom React hooks
│   ├── types/           # TypeScript type definitions
│   └── config/          # Configuration files
├── drizzle/             # Database migrations
├── public/              # Static assets
└── docker-compose.yml   # Docker configuration
```

## Database Schema

The application uses the following main entities:

- **Organizations**: Top-level tenants
- **Teams**: Groups within organizations
- **Users**: Team members with roles
- **Workflows**: Workflow definitions
- **Workflow Versions**: Versioned workflow configurations
- **Workflow Deployments**: Deployment history and status
- **Workflow Executions**: Execution logs and results
- **LLM Providers**: Configured AI model providers
- **Tools**: Available tools for workflows

## Environment Variables

See `.env.example` for required environment variables:

- `DATABASE_URL`: PostgreSQL connection string
- `NEXT_PUBLIC_APP_URL`: Application URL
- `OPENAI_API_KEY`: OpenAI API key (optional)
- `ANTHROPIC_API_KEY`: Anthropic API key (optional)
- `GOOGLE_API_KEY`: Google AI API key (optional)

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Remove all data (caution!)
docker-compose down -v
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

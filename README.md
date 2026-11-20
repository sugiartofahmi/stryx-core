# Stryx

Multi-purpose web scraping engine designed to fetch fully hydrated HTML content across modern web targets, adapting automatically between direct HTTP and headless browser execution.

---

## Quickstart

### Prerequisites

- Node.js 20+
- pnpm 9+

### Installation

```bash
git clone https://github.com/sugiartofahmi/stryx-core.git
cd stryx-core
pnpm install
pnpm build
```

### Usage

```bash
pnpm cli <url> [options]
```

#### Options

| Flag | Description | Default |
|---|---|---|
| `--output <file>` | Destination path for the saved HTML document | `./output/<domain-slug>.html` |
| `--timeout <ms>` | Maximum execution timeout in milliseconds | `30000` |

#### Examples

```bash
# Job search
pnpm cli "https://www.linkedin.com/jobs/search/?currentJobId=4490988268&keywords=fullstack"
pnpm cli "https://remoteok.com/remote-fullstack-jobs"
pnpm cli "https://glints.com/id/opportunities/jobs/explore?keyword=fullstack"
pnpm cli "https://www.indeed.com/jobs?q=fullstack"
pnpm cli "https://id.jobstreet.com/id/job-search/fullstack-jobs/"

# Communities and discussion threads
pnpm cli "https://www.reddit.com/r/programming/comments/"
pnpm cli "https://github.com/facebook/react/issues/1000"
pnpm cli "https://www.hackerrank.com/challenges/simple-array-sum/forum"
pnpm cli "https://www.ashbyhq.com"
```

---

## Verified Targets

Summary of target platforms verified with full content extraction:

| Platform | Target Endpoint | Content Type | Payload Size | Result |
|---|---|---|---|---|
| **LinkedIn** | `linkedin.com/jobs/search` | Job listings & search results | 314 KB | Success |
| **RemoteOK** | `remoteok.com/remote-dev-jobs` | Engineering job cards | 58 KB | Success |
| **Glints** | `glints.com/opportunities` | Career postings & company data | 1.04 MB | Success |
| **Indeed** | `indeed.com/jobs` | Job cards & search pagination | 1.10 MB | Success |
| **JobStreet** | `id.jobstreet.com/jobs` | Regional tech listings | 1.00 MB | Success |
| **Nodeflair** | `nodeflair.com/jobs` | Tech salary & job cards | 137 KB | Success |
| **Reddit** | `reddit.com/r/.../comments` | Community threads & user comments | 126 KB | Success |
| **GitHub** | `github.com/.../issues` | Issue discussions & comment tree | 252 KB | Success |
| **HackerRank** | `hackerrank.com/challenges/...` | Problem statements & solutions | 516 KB | Success |
| **Ashby** | `ashbyhq.com` | Careers & directory pages | 226 KB | Success |

---

## Extraction Evidence

Rendered page states captured during automated test runs:

<p align="center">
  <img src="docs/assets/evidence/linkedin.png" alt="LinkedIn Content" width="49%" />
  <img src="docs/assets/evidence/glints.png" alt="Glints Content" width="49%" />
</p>
<p align="center">
  <img src="docs/assets/evidence/indeed.png" alt="Indeed Content" width="49%" />
  <img src="docs/assets/evidence/jobstreet.png" alt="JobStreet Content" width="49%" />
</p>
<p align="center">
  <img src="docs/assets/evidence/remoteok.png" alt="RemoteOK Content" width="85%" />
</p>

---

## Project Structure

```text
stryx/
├── stryx-cli/         # Command-line interface runner
├── stryx-core/        # Multi-purpose orchestration engine
├── stryx-domain/      # Shared interfaces and data contracts
├── stryx-transport/   # Direct network client
├── stryx-browser/     # Browser rendering client
├── stryx-detector/    # Page state analyzer
├── stryx-solver/      # Adaptive resolution room
└── stryx-cache/       # Session and cookie persistence
```

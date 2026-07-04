# Contributing to free-code

Terima kasih atas ketertarikan Anda untuk berkontribusi pada free-code! Berikut panduan untuk memulai.

## Quick Start

### Prerequisites

- **Bun** >= 1.3.11 ([install bun](https://bun.sh))
- **Git**
- API key dari provider yang didukung (Anthropic, OpenAI, atau lainnya)

### 1. Fork & Clone

```bash
# Fork via GitHub web
git clone https://github.com/USERNAME/free-code.git
cd free-code
```

### 2. Install & Build

```bash
bun install
bun run build:dev:full
./cli-dev.exe
```

### 3. Development Loop

```bash
bun run build:dev:full
./cli-dev.exe -p "test your changes"
```

---

## Cara Berkontribusi

### 1. Fix Broken Flags (Paling Mudah)

Lihat `FEATURES.md`. Ada 34 feature flags yang gagal bundle karena file hilang. Yang paling mudah diperbaiki:

- Flag dengan "Easy Reconstruction Path" di `FEATURES.md`
- Biasanya hanya perlu buat file wrapper atau asset

Cara cek:
```bash
bun run ./scripts/build.ts --feature=ULTRAPLAN
```

### 2. Tambah Provider API Baru

Fork `src/services/api/` dan buat adapter baru. Contoh yang sudah ada:
- `codex-fetch-adapter.ts` (OpenAI Codex)
- `vertex-fetch-adapter.ts` (Google Vertex)

### 3. Fix Bugs

Cek issue terbuka di GitHub, terutama:
- **#40** - Windows support
- **#38** - Resubmit tool result
- **#37** - Repeating shell results

### 4. Enhancements

- Tambah CLI flags baru
- Tingkatkan UI/UX
- Optimasi performance

---

## Build Commands

| Command | Output | Features |
|---|---|---|
| `bun run build` | `./cli` | Default (VOICE_MODE only) |
| `bun run build:dev` | `./cli-dev` | Dev build |
| `bun run build:dev:full` | `./cli-dev` | All 54 experimental flags |
| `bun run compile` | `./dist/cli` | Compiled binary |

### Custom Feature Flags

```bash
bun run ./scripts/build.ts --feature=ULTRAPLAN --feature=ULTRATHINK
bun run ./scripts/build.ts --dev --feature=BRIDGE_MODE
```

---

## Code Style

- **TypeScript** untuk semua kode
- Gunakan `const` jika memungkinkan
- Jangan tambah dependency baru tanpa diskusi
- Ikuti pola kode yang sudah ada di `src/`
- Gunakan `bun` sebagai runtime

## Commit Message

Format:
```
<type>: <description>

[optional body]

Fixes #<issue_number>
```

Contoh:
```
feat: add DeepSeek v4 provider support
fix: resolve issue #40 Windows installer path
docs: add PowerShell install instructions
```

---

## Submitting Changes

1. Buat branch baru dari `main`
2. Commit dengan message yang jelas
3. Push ke fork Anda
4. Buka Pull Request (PR) ke `freecodexyz/free-code`
5. Tambah deskripsi yang jelas untuk PR

---

## Topik yang Dibutuhkan

- **Windows Support** - Installer PowerShell, path handling
- **Provider Support** - DeepSeek, Mistral, Kimi, Ollama
- **Feature Flags** - Rekonstruksi 34 flag yang rusak
- **Performance** - Optimasi build time dan runtime
- **Bug Fixes** - Tool result handling, bash classifier

---

## Questions?

Buka issue di GitHub atau hubungi maintainer.

# Validation Layer

Avenor features an ecosystem-agnostic **Validation Layer** that acts as the compiler quality gate. After a patch is generated, Avenor attempts to install dependencies and compile the workspace locally to verify the fix does not break repository builds.

---

## How It Works

The Validation Layer functions through three core steps:

```
[Local Workspace Path]
         │
         ▼
 1. Detect Ecosystem (detectProject.ts) ──► Node, Maven, Gradle, Cargo, Poetry, etc.
         │
         ▼
 2. Execute Build Command (runBuild.ts)  ──► Executed in a sandboxed shell process
         │
         ▼
 3. Output Validation (validateRepository.ts) ──► Returns duration, output, and success status
```

---

## 1. Project Detection (`detectProject.ts`)

Avens detects the codebase ecosystem by checking for key files in the repository root directory:

| Ecosystem / Project Type | Root Indicator File |
| :--- | :--- |
| **Node.js (npm)** | `package.json` |
| **Maven (Java)** | `pom.xml` |
| **Gradle (Java/Kotlin)** | `build.gradle` or `build.gradle.kts` |
| **Rust (Cargo)** | `Cargo.toml` |
| **Go** | `go.mod` |
| **Python (Poetry)** | `poetry.lock` |
| **Python (Pipenv)** | `Pipfile` |
| **Python (Requirements)** | `requirements.txt` |

If no matching indicators are found, the detection layer defaults to `"unknown"`.

---

## 2. Build Execution (`runBuild.ts`)

Based on the detected ecosystem, Avenor executes commands to install dependencies and run the build:

| Project Type | Dependency Installation | Build/Compilation Command |
| :--- | :--- | :--- |
| **Node.js (npm)** | `npm install` | `npm run build` |
| **Maven** | *N/A (Included in build)* | `mvn clean compile` |
| **Gradle** | *N/A (Included in build)* | `./gradlew build -x test` or `gradle build -x test` |
| **Rust (Cargo)** | *N/A (Included in build)* | `cargo build` |
| **Go** | `go mod download` | `go build ./...` |
| **Python (Poetry)** | `poetry install` | `poetry run pytest` (if configuration exists) |
| **Python (Pipenv)** | `pipenv install` | `pipenv run pytest` |
| **Python (Requirements)** | `pip install -r requirements.txt` | `pytest` |

### Command Constraints & Timeouts
* **Process Spawning**: Commands are run using `exec` from `child_process`.
* **Execution Timeout**: Commands are capped with a strict timeout (e.g. 5 minutes) to prevent runaway execution or hang issues in background worker threads.
* **Error Catching**: Both stderr and stdout outputs are collected, merged, and returned for logging/analysis.

---

## 3. Validation Orchestrator (`validateRepository.ts`)

Binds project detection and command execution together. It returns a structured `ValidationResult` payload:

```typescript
export type ValidationResult = {
    projectType: ProjectType;
    buildPassed: boolean;
    buildOutput: string;
    buildDurationMs: number;
    commandUsed: string;
};
```

This output is either stored as a success log (if the build passed) or passed directly into the **Build Fix Agent** as error context to guide the automated fix loop.

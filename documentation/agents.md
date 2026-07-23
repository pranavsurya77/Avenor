# AI Agents

Avenor relies on three specialized AI agents to solve repository issues. These agents run within a sandboxed interactive loop, utilizing defined repository tools.

---

## The Interactive Agent Loop (`agentRunner.ts`)

The **Agent Runner** manages the execution context of the agents. It:
1. Formulates the system prompt containing instructions and a list of available tools.
2. Formulates the user prompt containing issue descriptions, file paths, and optional user answers.
3. Initiates a loop (up to `maxIterations`, which dynamically scales based on environment variables) calling OpenRouter completions.
4. Executes function calls (tools) outputted by the model locally inside the cloned workspace directory.
5. Captures and feeds tool outputs back to the model's message history.
6. Handles **Context Token Optimization**: When message history exceeds a threshold, it prunes long contents of older tool responses (retaining only the first 200 characters and appending a truncation indicator) to prevent token overflow.
7. Checks if a terminating tool is called:
   * `submit_fix`: Ends the loop and returns the generated Unified Diff patch.
   * `ask_user`: Pauses the loop and passes the clarifying question back to the orchestrator.

---

## Agent Definitions

```mermaid
graph LR
    Issues[GitHub Issues] --> FileLocator[File Locator Agent]
    FileLocator -->|Relevant Files| IssueFixer[Issue Fix Agent]
    IssueFixer -->|Patch| BuildValidation[Build Validation]
    BuildValidation -->|Compilation Error Logs| BuildFixer[Build Fix Agent]
    BuildFixer -->|Secondary Patch| PullRequest[Raise Pull Request]
```

### 1. File Locator Agent (`file-locater.agent.ts`)
This agent takes the raw issues list and repository file tree, and identifies which files are relevant to the issue.
* **Goal**: Minimize the context size for the Issue Fix Agent by filtering down the repository tree to a small array of file paths.
* **Input**: Repo file list and issue descriptions.
* **Output**: Array of file paths (e.g. `["src/utils/math.ts", "package.json"]`).

### 2. Issue Fix Agent (`issue-fix.agent.ts`)
The main issue resolver. It uses the file locator's files as a starting point but has full access to the codebase using tools.
* **Goal**: Analyze the issue details and produce a Unified Diff patch that resolves the issue.
* **Available Tools**:
  * `read_file` — Reads content of a file (optional lines parameter).
  * `read_multiple_files` — Reads multiple files concurrently (saves API turns).
  * `search_codebase` — Searches text queries recursively across codebase files.
  * `list_directory` — Explores directory trees.
  * `find_references` — Finds usages/imports of specific symbols.
  * `ask_user` — Asks user clarifying questions.
  * `submit_fix` — Submits a unified diff patch string.

### 3. Build Fix Agent (`build-fix.agent.ts`)
Spawns only when a patch has been generated but local compilation fails.
* **Goal**: Fix compilation/build errors introduced by the initial fix.
* **Input**: Compilation error outputs, build duration, command used, target files, and repository path.
* **Mechanism**: Runs the same interactive loop to analyze error logs, inspect source code files, and submit a secondary diff patch to fix the compilation issues.

# API Reference

This document provides a reference of the REST API endpoints exposed by **Avenor** on port `8000`.

---

## Authentication Endpoints (`/auth` or `/api/auth`)

### 1. Register User
Creates a new account in Avenor.
* **Method & URL**: `POST /auth/register`
* **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword",
    "name": "John Doe"
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "message": "User registered successfully",
    "userId": "cmr..."
  }
  ```

### 2. Login User
Authenticates a user and sets a JWT access token in the cookies.
* **Method & URL**: `POST /auth/login`
* **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Login successful",
    "user": {
      "id": "cmr...",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
  ```

---

## Repository Endpoints (`/github`)

### 1. Get User Repositories
Fetches a list of public and private repositories that the authenticated user has access to.
* **Method & URL**: `GET /github/repos`
* **Headers**: Requires authentication token cookie.
* **Success Response (200 OK)**:
  ```json
  [
    {
      "id": 1234567,
      "name": "Rate-Limit-Service",
      "full_name": "user/Rate-Limit-Service",
      "owner": "user",
      "private": false,
      "default_branch": "main",
      "html_url": "https://github.com/user/Rate-Limit-Service",
      "description": "A rate limiting utility"
    }
  ]
  ```

### 2. Clean Repository Clone
Deletes the local disk workspace clone for a specific repository.
* **Method & URL**: `DELETE /github/repos/:owner/:repo/clean`
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Repository clone cleaned successfully."
  }
  ```

---

## Pipeline Endpoints (`/pipeline`)

### 1. Trigger Pipeline Analysis
Enqueues a background job to clone the repository, analyze issues, and submit fixes.
* **Method & URL**: `POST /pipeline/repos/:owner/:repo/:branch?`
* **Success Response (202 Accepted)**:
  ```json
  {
    "message": "Pipeline analysis job queued successfully",
    "jobId": "12",
    "statusUrl": "/pipeline/jobs/12",
    "data": {
      "owner": "user",
      "repo": "Rate-Limit-Service",
      "branch": "main"
    }
  }
  ```

### 2. Check Pipeline Job Status
Retrieves status, progress, logs, and results for a specific BullMQ pipeline job.
* **Method & URL**: `GET /pipeline/jobs/:jobId`
* **Success Response (200 OK)**:
  ```json
  {
    "jobId": "12",
    "state": "completed",
    "progress": 100,
    "data": {
      "owner": "user",
      "repo": "Rate-Limit-Service",
      "branch": "main",
      "prismaJobId": "cmr..."
    },
    "result": {
      "workingBranch": "ai-maintenance-1784808726659",
      "issues": [...],
      "relevantFiles": ["src/index.js"],
      "fixes": {
        "userInputRequired": false,
        "patch": "--- a/src/index.js\n...",
        "explanation": "Fixed index issue"
      },
      "validation": {
        "projectType": "npm",
        "buildPassed": true,
        "buildDurationMs": 2500,
        "commandUsed": "npm run build"
      },
      "pullRequest": {
        "id": 987654321,
        "number": 4,
        "title": "Fix: Rate limit error",
        "html_url": "https://github.com/user/Rate-Limit-Service/pull/4"
      }
    },
    "failedReason": null,
    "timestamp": 1784808726600,
    "finishedOn": 1784808729100
  }
  ```

### 3. Reply and Resume Pipeline
Submits a user response to a question raised by the AI agent, resuming a paused job.
* **Method & URL**: `POST /pipeline/jobs/:jobId/reply`
* **Request Body**:
  ```json
  {
    "answer": "Yes, please update the dependency version to 2.1.0."
  }
  ```
* **Success Response (202 Accepted)**:
  ```json
  {
    "message": "User response received, pipeline resumed",
    "jobId": "13",
    "statusUrl": "/pipeline/jobs/13",
    "previousJobId": "12",
    "data": {
      "owner": "user",
      "repo": "Rate-Limit-Service",
      "branch": "main",
      "userAnswer": "Yes, please update the dependency version to 2.1.0."
    }
  }
  ```

---

## Webhook Endpoints (`/webhooks`)

### 1. GitHub Webhook Listener
Receives payload triggers from GitHub Apps (e.g. when an issue is opened) to initiate automatic fixes.
* **Method & URL**: `POST /webhooks`
* **Headers**: Requires standard GitHub webhook signature headers if secret protection is enabled.

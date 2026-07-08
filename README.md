# GitHub Profile Scraper API

A lightweight, fast, and zero-config Cloudflare Worker that provides clean GitHub user profiles and repository data.

> **Zero dependencies • Public API friendly • CORS enabled**

---

## Features
```
- Fetch complete GitHub user profiles
- Get recent repositories (sorted by last updated)
- Dedicated repos endpoint (up to 100 repos)
- Clean and consistent JSON responses
- Built-in CORS support
- Lightweight & fast (runs on Cloudflare Edge)
```
---

## Endpoints

### 1. Profile Information
```
GET` /info?user=<username>
```

---

## Deployment
```
Copy the code from Github-info-api.js
Go to Cloudflare Workers
Create a new Worker
Paste the code and deploy

No environment variables or configuration needed.
```

---



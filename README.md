# WorkPilot AI — AI Workforce Control Plane

WorkPilot is a cloud-first portfolio project inspired by the operating model of modern AI-agent workspaces. It gives a small team a control plane to define a company goal, organize specialized AI agents, assign work, run AI tasks, and keep a human approval step before outcomes are marked complete.

## What it does

- Define a company goal and operating context
- Organize specialized AI agents: CEO, Support, Product, Developer, Marketing
- Create and assign tasks to agents
- Run controlled AI execution using Gemini
- Move completed agent work into a human review state
- Approve or reject AI output
- Keep an activity log of task and agent events
- Reuse the Support Agent for grounded knowledge answers and ticket intelligence

## Product model

```text
Company Goal
     ↓
Agent Workforce
     ↓
Task Queue → AI Execution → Human Review
     ↓                    ↘
Completed Outcome       Activity Log
```

The goal is not to clone Paperclip. WorkPilot is a smaller, original implementation that demonstrates the core product idea: **AI agents need an operations layer for goals, work, accountability, and review.**

## Current stack

- Next.js + React + TypeScript
- Supabase Postgres for companies, agents, tasks, approvals, activity, and support knowledge
- Gemini Developer API (`gemini-3.7-flash`) for AI execution
- Vercel for deployment
- GitHub for source control

## Architecture

```text
Browser
  ↓
Next.js UI
  ├── /api/workpilot     → workspace, task creation, approvals
  ├── /api/run-agent     → controlled Gemini task execution
  ├── /api/ask           → grounded knowledge assistant
  └── /api/tickets       → support ticket intelligence
          ↓
     Supabase Postgres
          ↓
   Gemini Developer API
```

## Portfolio positioning

This project demonstrates practical AI implementation skills across:

- AI solution design
- SaaS workflow modeling
- LLM integration
- Knowledge-grounded generation
- Human-in-the-loop governance
- AI agent operations
- Cloud deployment
- Product-oriented UX

## Cost / deployment note

The project is designed around a zero-budget, cloud-only development workflow. It does not require local database or Docker installation. Gemini free-tier limits apply.

## Security note

The current demo uses permissive prototype RLS policies so the public portfolio demo can operate without authentication. It is **not production-ready for private customer data**. A production version should add Supabase Auth, company/user scoping, stricter RLS policies, rate limiting, audit controls, and secret-management hardening.

# WorkPilot AI — AI Workforce Control Plane

WorkPilot is a cloud-first portfolio project for operating a small AI workforce. It lets a team define a company goal, create specialized agents, delegate and assign work, execute Gemini-powered tasks, retain agent memory, require human approval, and inspect activity and execution telemetry.

## Product flow

```text
Company Goal → Agents → Delegation / Tasks → Gemini Execution
                                      ↓
                               Agent Memory
                                      ↓
                               Human Review
                                  ↙      ↘
                             Approved   Rejected
                                  ↓
                            Activity Log
```

## Included

- Company identity, description and editable goal
- Agent builder with role and system instructions
- CEO-style delegation into the task queue
- Task assignment, priorities and lifecycle: todo → running → review → done/blocked
- Gemini execution with company goal, agent instructions, knowledge and recent agent memory
- Human approval / rejection gate
- Persistent agent memory from completed work
- Execution telemetry: model, token counts, duration and estimated cost
- Hourly heartbeat configuration records for agent readiness
- Knowledge ingestion: paste FAQs, SOPs, policies or product notes; automatic text chunking
- Grounded knowledge Q&A with source names
- AI support-ticket classification and suggested responses
- Activity timeline for governance and traceability

## Stack

- Next.js + React + TypeScript
- Supabase Postgres
- Gemini Developer API (`gemini-3.7-flash`)
- Vercel
- GitHub

## Cloud-only workflow

Everything is designed to run in the cloud. No Docker, local database or local package installation is required for the portfolio workflow.

## Important production boundary

This is a portfolio/demo control plane, not a production multi-tenant SaaS yet. The demo intentionally uses permissive RLS policies and does not require authentication. Before handling real customer data, add Supabase Auth, tenant/user ownership columns, strict RLS, server-side authorization, rate limiting, file storage with validation, encrypted secrets, background job execution, real scheduler/heartbeat workers, and semantic/vector retrieval.

## Future integrations

The architecture is ready to add Jira, Zendesk, Slack, email and n8n adapters. Those integrations should be introduced only after authentication and tenant isolation are implemented.

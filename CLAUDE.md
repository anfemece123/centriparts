# CLAUDE.md

## Project
This project is a complete ecommerce platform built with:
- React
- Vite
- TypeScript
- Redux Toolkit
- Supabase

## Main goals
- Keep the project highly structured and scalable
- Use feature-based architecture
- Keep code easy to maintain
- Avoid overengineering
- Prefer clear and predictable patterns

## Rules
- Always analyze existing project structure before creating new files
- Do not introduce unnecessary libraries
- Use TypeScript strictly
- Keep business logic out of UI components
- Prefer reusable services and typed modules
- Use Redux Toolkit for global state when needed
- Keep Supabase access encapsulated in service files
- Do not put direct Supabase calls scattered across components
- Create small, maintainable files
- Follow consistent naming conventions
- Avoid massive components
- Prefer composition over duplication

## Folder philosophy
- `modules/` contains feature-based modules
- `shared/` contains reusable UI and utilities
- `services/` contains integrations and data access
- `store/` contains Redux store setup
- `types/` contains shared domain types
- `lib/` contains external client initialization such as Supabase

## Coding style
- Prefer functional React components
- Prefer explicit types
- Avoid `any`
- Keep components focused
- Separate page, component, service, type, and state logic clearly

## Workflow
- Before coding, explain the plan
- Then implement step by step
- Show which files will be created or modified
- Avoid making broad unrelated changes

## UI rules
- Use Tailwind CSS
- All visible UI text must be in Spanish
- Code must remain in English
- Keep the interface highly organized
- Use a professional ecommerce/admin visual style
- Prefer clean spacing and strong hierarchy
- Avoid noisy or overly decorative interfaces
- Prioritize clarity, trust, and usability
- Reuse UI patterns consistently
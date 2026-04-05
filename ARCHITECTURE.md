# ARCHITECTURE.md

## Proposed frontend structure

src/
  app/
  lib/
  modules/
  services/
  shared/
  store/
  types/

## Module structure example

modules/
  auth/
    components/
    pages/
    services/
    types/
    slice.ts
  products/
    components/
    pages/
    services/
    types/
    slice.ts

## Principles
- Feature-based organization
- Shared logic extracted to services
- Reusable UI in shared
- Centralized external clients in lib
- Minimal coupling between modules

## Data access
Supabase access should be abstracted behind service files.
Components should not directly own backend logic.

## State
Redux Toolkit will be used for global app state where appropriate.
Local UI state should remain local unless shared.
# Trimmed staff

The shop side of Trimmed: the owner, front desk and barbers.
Customers book on the separate booking site; both apps use the same Supabase project.

The database schema, its access rules and its tests live in the booking site's repo
(`supabase/migrations/`). This app only calls those database functions.

## Stack

React, TypeScript, Vite, Tailwind CSS v4, Supabase (Auth, Postgres with row-level security). Hosted on Vercel.

## Run it

```bash
npm install
cp .env.example .env.local   # then fill in the project URL and publishable key
npm run dev                  # real database
npm run dev:sample           # sample data, no database (development only)
```

In sample mode, sign in with any email that starts with `owner@` or `desk@`.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

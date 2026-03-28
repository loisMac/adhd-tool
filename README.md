# Calm Space Toolkit

Calm Space is a React + TypeScript + Vite toolkit with gentle, low-pressure tools for focus, planning, and daily work boundaries.

## Scripts

- `npm run dev` starts the local dev server.
- `npm run build` creates a production build.
- `npm run preview` previews the built site.

## Visitor Analytics (Optional)

This project supports optional Plausible analytics. Nothing is tracked unless you set the domain.

1. Create a `.env` file in the project root.
2. Add your site domain:

```bash
VITE_PLAUSIBLE_DOMAIN=yourdomain.com
```

3. Run/build as normal.

If `VITE_PLAUSIBLE_DOMAIN` is not set, no analytics script is loaded.

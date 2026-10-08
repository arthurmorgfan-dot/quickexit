# QuickExit

A responsive public landing page for the QuickExit crypto trading concept: **Trade it. Profit. Send it home.**

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. For a production preview, run `npm run build` followed by `npm start`.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Structure

- `src/app/page.tsx` assembles the landing page.
- `src/app/globals.css` contains the design tokens, styles, responsive layouts, and reduced-motion rules.
- `src/app/layout.tsx` sets metadata and loads locally hosted Geist fonts.
- `src/components/landing/` contains individual page sections.
- `src/components/ui/` contains the reusable brand and CTA components.

Next.js App Router, React, TypeScript, and Lucide icons. Styling uses plain CSS, with no runtime styling dependency or external font request. The local Geist font files come from the installed Next.js distribution.

The interactive preview supports investment amounts, euro or percentage profit targets, optional protection, and an auto-exit switch. Its progress and euro amounts update locally. The action button explains the selected mock trade without submitting data. Mobile navigation, FAQ disclosures, and linked prototype notices are functional.

This is a product concept only. All market figures are mock data. There is no authentication, trading backend, payment processing, or partner integration. Get Started and Start Trading lead to the preview; Sign in leads to the availability notice. Privacy and Terms describe this prototype rather than a future live service.

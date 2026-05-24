# maFood Implementation Plan

## 1. Project Setup
1. Initialize Next.js 14 project with TypeScript
2. Install all required dependencies:
   - Next.js 14 (App Router)
   - Tailwind CSS with two design systems
   - shadcn/ui with custom radius settings
   - React Hook Form + Zod for all forms
   - TanStack Query v5 for server state
   - TanStack Table v8 for all backoffice tables
   - Zustand for client state
   - Framer Motion for animations
   - Recharts for analytics
   - @dnd-kit/sort0able for PDV reordering

## 2. Backend Implementation (Supabase setup)
1. Set up Supabase project with PostgreSQL
2. Run database SQL migrations
3. Configure RLS and Realtime
4. Set up Supabase Auth and configure middleware for route protection

## 3. Core Libraries Implementation
1. Set up Asaas API wrapper
2. Implement pricing engine hook
3. Create API routes for:
   - pricing calculation
   - order creation
   - coupon validation
   - Pix payment
   - Asaas webhooks
   - credit card payments

## 4. Frontend Development - Client Interface (PWA Mobile-first)
1. Implement marketplace for venues
2. Create PDV pages
3. Build checkout flow (Pix and credit card)
4. Implement order tracking with realtime updates
5. Build order history page
6. Implement coupon system in checkout

## 5. PDV Panel (Tablet-first)
1. Build Kanban board for order management
2. Implement product management (pause vs out of stock)
3. Realtime notifications and WebSocket updates

## 6. Admin Interface (Desktop)
1. Dashboard with KPIs
2. Order management system
3. PDV management with drag-and-drop
4. Product management
5. Coupon management
6. Financial reports

## 7. Deployment
1. PWA configuration
2. Service worker setup
3. Vercel deployment
4. Sentry integration
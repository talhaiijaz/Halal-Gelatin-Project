# Halal Gelatin CRM!

A modern, real-time CRM system for managing gelatin manufacturing operations, built with Next.js 14, Convex, and Tailwind CSS.

## ✅ Implementation Status

**All features have been successfully implemented:**
- ✅ Dashboard with quick actions and real-time stats
- ✅ Client management (Local, International, All)
- ✅ Order management with multi-step creation
- ✅ Finance module (Invoices, Payments, Reports)
- ✅ Delivery tracking with status management
- ✅ Real-time data synchronization across all modules
- ✅ Loading skeletons and empty states
- ✅ CSV export for all data tables
- ✅ Confirmation dialogs for delete actions
- ✅ Mobile responsive design

## Features

- 📊 **Real-time Dashboard** - Live updates for orders, clients, and payments
- 👥 **Client Management** - Track local and international clients
- 📦 **Order Management** - Create and track orders with auto-calculated totals
- 💰 **Finance Module** - Invoice generation, payment recording, and financial reporting
- 🚚 **Delivery Tracking** - Monitor shipments and delivery status
- 📱 **Mobile Responsive** - Works seamlessly on all devices
- 🔄 **Real-time Sync** - Instant updates across all connected clients using Convex

## Tech Stack

- **Frontend**: Next.js 14 (App Router)
- **Backend**: Convex (Real-time database)
- **Styling**: Tailwind CSS
- **State Management**: Convex reactive queries
- **UI Components**: Custom components with Lucide icons

## Prerequisites

- Node.js 18+ and npm/yarn
- Git
- A Convex account (free tier available at [convex.dev](https://convex.dev))

## Installation

1. **Clone the repository**
```bash
git clone https://github.com/usmanumer1/halalgelatincrm.git
cd halalgelatincrm
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up Convex**
```bash
npx convex dev
```
This will:
- Prompt you to log in to Convex (or create an account)
- Create a new Convex project or connect to an existing one
- Generate your Convex functions and start the Convex development server

4. **Configure environment variables**

Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_CONVEX_URL=<your-convex-development-url>
```
The Convex URL will be displayed in your terminal after running `npx convex dev`.

## Development

### Running Locally

1. **Start Convex development server** (in one terminal)
```bash
npx convex dev
```

2. **Start Next.js development server** (in another terminal)
```bash
npm run dev
```

3. **Access the application**
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Development Workflow

- The Convex dev server watches for changes in the `convex/` directory
- Next.js dev server hot-reloads on any file changes
- All data mutations are instantly synced across all connected clients

### Testing Real-time Features

To test real-time synchronization:
1. Open the app in multiple browser tabs
2. Create/update an order in one tab
3. Observe instant updates in other tabs
4. Record a payment from the Finance section
5. See the invoice status update immediately everywhere

## Production Deployment

### Deploy to Convex (Production)

1. **Deploy Convex functions**
```bash
npx convex deploy
```

2. **Get production Convex URL**
After deployment, copy the production URL displayed in the terminal.

3. **Update environment variables for production**
```env
NEXT_PUBLIC_CONVEX_URL=<your-convex-production-url>
```

### Deploy to Vercel (Recommended for Next.js)

1. **Push to GitHub**
```bash
git add .
git commit -m "Initial commit"
git push
```

2. **Import to Vercel**
- Go to [vercel.com](https://vercel.com)
- Import your GitHub repository
- Add environment variable: `NEXT_PUBLIC_CONVEX_URL` with your production Convex URL
- Deploy

3. **Alternative: Deploy via CLI**
```bash
npm i -g vercel
vercel
```

### Deploy to Other Platforms

#### Netlify
```bash
npm run build
# Deploy the .next folder
```

#### Self-Hosting
```bash
npm run build
npm run start
```

## Project Structure

```
halalGelatin/
├── app/                    # Next.js 14 App Router
│   ├── (app)/             # Authenticated app routes
│   │   ├── dashboard/     # Dashboard page
│   │   ├── clients/       # Client management
│   │   ├── orders/        # Order management
│   │   ├── finance/       # Finance module
│   │   └── deliveries/    # Delivery tracking
│   ├── components/        # React components
│   │   ├── clients/       # Client-specific components
│   │   ├── orders/        # Order-specific components
│   │   └── layout/        # Layout components
│   └── globals.css        # Global styles
├── convex/                # Convex backend
│   ├── _generated/        # Auto-generated Convex files
│   ├── clients.ts         # Client mutations/queries
│   ├── orders.ts          # Order mutations/queries
│   ├── invoices.ts        # Invoice mutations/queries
│   └── schema.ts          # Database schema
├── public/                # Static assets
└── package.json          # Dependencies

```

## Available Scripts

```bash
# Development
npm run dev          # Start Next.js dev server
npx convex dev      # Start Convex dev server

# Production
npm run build       # Build for production
npm run start       # Start production server
npx convex deploy   # Deploy Convex functions

# Linting
npm run lint        # Run ESLint
```

## Database Schema

The Convex database includes the following tables:

- **clients** - Customer information (name, contact, type, status)
- **orders** - Order details with auto-generated order numbers
- **orderItems** - Individual items within orders
- **invoices** - Auto-generated invoices with payment tracking
- **payments** - Payment records linked to invoices
- **deliveries** - Delivery status and tracking

## Key Features Implementation

### Real-time Synchronization
All data operations use Convex mutations and subscriptions for instant updates across all connected clients. No manual refresh needed!

### Order Creation Flow
1. Select client from existing database
2. Add multiple order items with auto-calculated totals
3. Set delivery information
4. Review and confirm
5. Auto-generates order number (ORD-YYYY-XXXX format)
6. Creates invoice automatically

### Payment Recording
1. Navigate to Finance > Invoices
2. Click payment icon on any due invoice
3. Enter payment details
4. Invoice status updates automatically:
   - `due` → `partially_paid` → `paid`
5. Outstanding balance updates in real-time

### CSV Export
Available for:
- Client lists
- Order reports
- Invoice summaries
- Payment records

## Troubleshooting

### Common Issues

1. **Convex connection errors**
   - Ensure Convex dev server is running
   - Check NEXT_PUBLIC_CONVEX_URL is correct
   - Try `npx convex dev --once` to reinitialize

2. **Build errors**
   - Clear `.next` folder: `rm -rf .next`
   - Clear node_modules: `rm -rf node_modules && npm install`

3. **Real-time updates not working**
   - Check browser console for WebSocket errors
   - Ensure Convex subscriptions are active
   - Verify network connectivity

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is proprietary software for internal use.

## Support

For issues and questions, please contact the development team or create an issue in the GitHub repository.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [Convex](https://convex.dev/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Icons by [Lucide](https://lucide.dev/)

---

**Note**: This is an internal B2B system. Authentication has been removed for simplified internal use. For production deployment with external access, consider implementing proper authentication.
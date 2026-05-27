# HomePlate 🍲

**HomePlate** is a food delivery marketplace that connects customers with homemade chefs. Customers post food orders with a budget, and chefs compete for those orders through a live bidding system. Once a bid is accepted, the chef prepares and delivers the food, gets paid via an in-app wallet, and the customer can leave a review.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Features](#features)
- [User Roles & Flows](#user-roles--flows)
- [API Reference](#api-reference)
- [WebSocket Events](#websocket-events)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Mobile Frontend Setup](#mobile-frontend-setup)
  - [Web Frontend Setup](#web-frontend-setup)
- [Environment Variables](#environment-variables)
- [Screenshots](#screenshots)

---

## Overview

HomePlate is a three-sided marketplace:

- **Customers** describe what food they want, set a max budget, and choose a preferred delivery time.
- **Chefs** browse open orders and place competitive bids with a proposed price and delivery estimate.
- **Admins** monitor platform activity and earn a 5% commission on every completed order.

Real-time communication (new bids, order status changes, chat) is powered by Django Channels over WebSockets with Redis as the channel layer backend.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Django 5.2 + Django REST Framework 3.16 |
| Real-time | Django Channels 4.3 + channels_redis 4.3 |
| ASGI Server | Daphne 4.2 |
| Database | SQLite (dev) |
| Cache / Channel Layer | Redis 6 |
| Mobile App | React Native 0.81 + Expo 54 + Expo Router 6 |
| Web App | React.js (Create React App) |
| Auth | DRF Token Authentication |
| HTTP Client | Axios |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Mobile App (Expo)                  │
│  Customer Dashboard │ Chef Dashboard │ Admin Panel   │
└──────────────────────────┬──────────────────────────┘
                           │ HTTP (REST) + WebSocket
┌──────────────────────────▼──────────────────────────┐
│              Django Backend (Daphne/ASGI)            │
│                                                      │
│  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │  REST API    │  │  Django Channels (WebSocket) │  │
│  │  (DRF)       │  │  OrderConsumer               │  │
│  │              │  │  ChatConsumer                │  │
│  │  /accounts/  │  │  NotificationConsumer        │  │
│  │  /api/       │  └──────────────┬───────────────┘  │
│  └──────┬───────┘                 │                  │
│         │                   ┌─────▼──────┐           │
│         └──────────────────►│   Redis    │           │
│                             │  (Channels)│           │
│  ┌──────────────────────┐   └────────────┘           │
│  │  SQLite Database     │                            │
│  │  CustomUser, Chef,   │                            │
│  │  Customer, Order,    │                            │
│  │  Bid, ChatMessage,   │                            │
│  │  Wallet, Transaction,│                            │
│  │  Review, Notification│                            │
│  └──────────────────────┘                            │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│  Web Frontend (React.js) — account activation pages │
└─────────────────────────────────────────────────────┘
```

---

## Features

### Core Marketplace
- **Order Creation** — Customers post food orders with a title, description, max budget, delivery address, and preferred delivery time (must be at least 2 hours in the future).
- **Competitive Bidding** — Multiple chefs can bid on each open order with a proposed price and estimated delivery time.
- **Bid Management** — Customers review all incoming bids and accept one; all other bids are automatically declined.
- **Order Lifecycle** — `open → accepted → preparing → delivered → completed / cancelled`

### Real-time Updates
- Live WebSocket connection on app launch (auto-reconnects every 3 seconds on disconnect).
- Customers are notified instantly when a new bid arrives.
- Chefs are notified when their bid is accepted.
- Both parties are updated as the order status progresses.

### Chat
- Per-order real-time chat between customer and chef via WebSocket.
- Messages are persisted to the database.

### Wallet & Payments
- Every user automatically gets a wallet on registration.
- When a customer marks an order as complete, funds are split:
  - **95%** credited to the chef's wallet.
  - **5%** credited to the admin/platform wallet as commission.
- Chefs can view their wallet balance and full transaction history.

### Reviews & Ratings
- After completing an order, customers rate the chef (0–5 stars) and leave an optional comment.
- Chef ratings are aggregated and displayed on the Top Chefs leaderboard.

### Top Chefs Leaderboard
- Publicly accessible list of top 20 chefs ranked by average rating and success rate.
- Each chef profile shows specialty, bio, total reviews, completed orders, and success rate.

### Admin Dashboard
- Overview of total platform commission earned.
- Total number of commission transactions.
- List of recent commission entries with chef details and amounts.

### Account Activation
- New users receive an email verification link.
- Activation is handled via a dedicated endpoint that redirects to the React web frontend.

---

## User Roles & Flows

### Customer
1. Sign up (user type: `customer`) and verify email.
2. Log in — redirected to Customer Dashboard.
3. Create a food order (title, description, budget, address, delivery time).
4. View incoming bids on the order detail screen.
5. Accept a bid — the order is assigned to that chef.
6. Chat with the chef via the in-app chat.
7. Once the chef marks the order delivered, tap **Mark as Complete** to release payment.
8. Rate the chef and submit an optional comment.

### Chef
1. Sign up (user type: `chef`) and log in.
2. Browse all open orders on the Chef Dashboard.
3. Filter orders: Open Orders / Bid Placed / Preparing / Delivering / Closed Orders.
4. Place a bid on an order with a proposed price and delivery estimate.
5. If the bid is accepted, prepare the order.
6. Tap **Fulfill Order** to mark it as delivered.
7. Earnings are credited to the wallet automatically when the customer completes the order.
8. View wallet balance and transaction history.
9. Track performance on the Statistics screen (bids today, earnings today, overall success rate).

### Admin
1. Created via Django's `createsuperuser` command.
2. Log in to the mobile app — redirected to the Admin Dashboard.
3. View total commission earned and number of transactions.
4. Detailed commission records are also available in the Django admin panel at `/admin/`.

---

## API Reference

Base URL: `http://localhost:8000/`

### Authentication — `/accounts/`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `accounts/signup/` | None | Register a new user (customer or chef) |
| POST | `accounts/login/` | None | Login and receive an auth token |
| POST | `accounts/logout/` | Token | Invalidate the current token |
| GET | `accounts/activate/<uidb64>/<token>/` | None | Activate account from email link |

### Orders — `/api/`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `api/orders/create/` | Customer | Create a new food order |
| GET | `api/orders/my/` | Customer | List the customer's own orders |
| GET | `api/orders/open/` | Chef | List all open orders available to bid on |
| GET | `api/orders/` | Chef | List all orders |
| GET | `api/orders/<id>/` | Authenticated | Get order details |
| POST | `api/orders/<id>/fulfill/` | Chef | Mark order as delivered |
| POST | `api/orders/<id>/complete/` | Customer | Mark order as complete and release payment |

### Bids

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `api/orders/<order_id>/bid/` | Chef | Place a bid on an order |
| GET | `api/orders/<order_id>/bids/` | Customer | List all bids on a specific order |
| POST | `api/bids/<bid_id>/accept/` | Customer | Accept a bid |
| GET | `api/bids/my-bids/` | Chef | List the chef's own bids |

### Chat

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `api/chat/` | Authenticated | List the user's chat conversations |
| POST | `api/chat/send/` | Authenticated | Send a chat message |
| GET | `api/chat/<order_id>/` | Authenticated | Get all messages for an order |

### Chefs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `api/chefs/top/` | None | Get the top 20 chefs leaderboard |
| GET | `api/chefs/<chef_id>/` | None | Get a chef's public profile and reviews |
| GET | `api/chef/stats/` | Chef | Get the chef's own performance statistics |

### Wallet & Reviews

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `api/wallet/` | Authenticated | Get wallet balance and transactions |
| POST | `api/orders/<order_id>/review/` | Customer | Submit a rating and review for the chef |

### Admin

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `api/admin-dashboard/` | Authenticated | Get platform commission and transaction stats |

### Notifications

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `api/notifications/` | Authenticated | List the user's notifications |

---

## WebSocket Events

The app maintains a persistent WebSocket connection to `ws://localhost:8000/ws/orders/?token=<auth_token>`.

### Events Received by Client

| Event | Direction | Description |
|---|---|---|
| `order_created` | All | A new order was posted |
| `order_accepted` | All | A bid was accepted and the order is now assigned |
| `order_preparing` | All | Chef is preparing the order |
| `order_delivered` | All | Chef marked the order as delivered |
| `order_completed` | All | Customer marked the order as complete |
| `bid_placed` | Customer | A chef placed a new bid on the customer's order |
| `bid_accepted` | Chef | The chef's bid was accepted (sent to that chef only) |
| `review_created` | All | A new review was submitted |
| `review_updated` | All | An existing review was updated |

### Chat WebSocket

Per-order chat room: `ws://localhost:8000/ws/chat/<order_id>/`

Payload sent by client:
```json
{
  "message": "Hello, when will the food be ready?",
  "sender": 1,
  "receiver": 2
}
```

---

## Project Structure

```
homeplate/
├── backend/                        # Django backend
│   ├── accounts/                   # User models, auth views, serializers
│   │   ├── models.py               # CustomUser, Customer, Chef, Order, Bid,
│   │   │                           # ChatMessage, Review, Wallet, Transaction, Notification
│   │   ├── views.py                # register, login, logout, activate_account
│   │   ├── serializers.py          # Registration and login serializers
│   │   └── urls.py                 # /accounts/* routes
│   ├── api/                        # Business logic API
│   │   ├── views.py                # Order, bid, chat, wallet, review, chef endpoints
│   │   ├── consumers.py            # WebSocket consumers (Order, Chat, Notification)
│   │   ├── signals.py              # DB signals → WebSocket broadcasts
│   │   ├── permissions.py          # IsCustomer, IsChef, IsAdmin permission classes
│   │   ├── serializers.py          # All API serializers
│   │   ├── utils.py                # credit_chef_wallet (95/5 split)
│   │   ├── routing.py              # WebSocket URL routing
│   │   └── urls.py                 # /api/* routes
│   ├── backend/                    # Django project config
│   │   ├── settings.py             # INSTALLED_APPS, Redis channel layers, auth, email
│   │   ├── urls.py                 # Root URL config
│   │   ├── asgi.py                 # ASGI entry point (HTTP + WebSocket)
│   │   └── routing.py              # Protocol router (HTTP vs WebSocket)
│   ├── requirements.txt
│   └── manage.py
│
├── mobile-frontend/                # React Native + Expo app
│   ├── app/
│   │   ├── index.js                # Splash screen + auth redirect
│   │   ├── login.js                # Login screen
│   │   ├── signup.js               # Signup screen
│   │   ├── account-not-activated.js
│   │   ├── create-order/           # Order creation form
│   │   ├── customer-dashboard/     # Customer home + order detail
│   │   ├── chef-dashboard/         # Chef home, order detail, bid modal,
│   │   │                           # statistics screen, wallet screen
│   │   ├── admin-dashboard/        # Admin commission overview
│   │   ├── top-chefs/              # Leaderboard + chef profile
│   │   └── chat-box/               # Chat list + per-order chat
│   ├── contexts/
│   │   └── WebSocketContext.js     # Global WS connection + auto-reconnect
│   ├── utils/
│   │   ├── api.js                  # Axios instance with token interceptor
│   │   ├── auth.js                 # AsyncStorage helpers for token/user
│   │   ├── global.js               # POLL_INTERVAL constant
│   │   └── theme.js                # App color palette
│   └── package.json
│
└── web-frontend/                   # React.js web app
    └── src/
        ├── pages/                  # ActivationSuccess, ActivationFailed,
        │                           # ActivationPending, Login, Home,
        │                           # ChefDashboard, CustomerDashboard
        └── components/             # LoginForm, SignupForm, ChefSignup,
                                    # CustomerSignup
```

---

## Getting Started

### Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.10+ |
| pip / virtualenv | latest |
| Redis | 6+ (must be running on `localhost:6379`) |
| Node.js | 18+ |
| npm | 9+ |
| Expo CLI | installed globally (`npm install -g expo-cli`) |
| Android emulator or Expo Go app | for mobile testing |

> **Redis is required.** The WebSocket layer will not function without a running Redis instance.
> Install via `sudo apt install redis-server` (Linux) or `brew install redis` (macOS), then start with `redis-server`.

---

### Backend Setup

```bash
# 1. Clone the repository
git clone https://github.com/ahsanm7911/homeplate.git
cd homeplate/backend

# 2. Create and activate a virtual environment
pip install virtualenv
virtualenv env
source env/bin/activate        # Linux/macOS
# env\Scripts\activate         # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables
#    Create a .env file in the backend/ directory:
```

Create `backend/.env` with:

```env
EMAIL_HOST_USER=your_gmail_address@gmail.com
EMAIL_HOST_PASSWORD=your_gmail_app_password
```

> Use a [Gmail App Password](https://support.google.com/accounts/answer/185833) — not your regular Gmail password.

```bash
# 5. Apply database migrations
python manage.py makemigrations
python manage.py migrate

# 6. Create the admin/superuser account
python manage.py createsuperuser
# Enter email and password when prompted

# 7. Start Redis (in a separate terminal)
redis-server

# 8. Start the backend server
python manage.py runserver
```

The backend runs at **http://localhost:8000**.  
Verify it is running by visiting the admin panel at **http://localhost:8000/admin/**.

---

### Mobile Frontend Setup

```bash
cd homeplate/mobile-frontend

# Install dependencies
npm install

# Start the Expo development server
npm start
# or for Android only:
npm run android
# or for iOS:
npm run ios
```

- On **Android emulator**: the app connects to the backend at `http://10.0.2.2:8000/` (emulator's localhost alias).
- On **web** (`npm run web`): the app connects to `http://localhost:8000/`.
- On a **physical device**: update `baseURL` in `utils/api.js` and `BASE_URL` in `contexts/WebSocketContext.js` to your machine's local IP address (e.g., `http://192.168.1.x:8000/`).

---

### Web Frontend Setup

The web frontend handles account activation pages (activation success/failure) and was the original signup/login interface before the mobile app was built.

```bash
cd homeplate/web-frontend

# Install dependencies
npm install

# Start the development server
npm start
```

The web frontend runs at **http://localhost:3000**.  
Account activation emails link back to this server (`/activation-success`, `/activation-failed`).

---

## Environment Variables

The backend reads from a `.env` file placed in the `backend/` directory.

| Variable | Description |
|---|---|
| `EMAIL_HOST_USER` | Gmail address used to send account activation emails |
| `EMAIL_HOST_PASSWORD` | Gmail App Password (not your regular password) |

> **Note:** The current `settings.py` uses `EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'`, which prints emails to the terminal instead of sending them. To send real emails, change this to `'django.core.mail.backends.smtp.EmailBackend'`.

---

## Screenshots

| Login Page |
|---|
| ![Login Page](./login-page.PNG) |

| Environment Variables Example |
|---|
| ![Env Example](./env-example.PNG) |

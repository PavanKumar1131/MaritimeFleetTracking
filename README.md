# ⚓ Maritime Fleet Tracking System

A comprehensive real-time maritime fleet monitoring platform built with Node.js and vanilla JavaScript. Track ships and submarines, visualize sea routes, monitor weather conditions, and manage alerts for your entire fleet.

![Node.js](https://img.shields.io/badge/Node.js-v16+-green)
![MySQL](https://img.shields.io/badge/MySQL-8.0-blue)
![Express](https://img.shields.io/badge/Express-5.x-lightgrey)


## ✨ Features

### 🚢 Real-Time Vessel Tracking
- Live vessel positions on interactive Leaflet.js map
- Support for multiple vessel types (Cargo, Naval, Submarine, Tanker)
- Location history trails and movement tracking
- Speed, heading, and engine health monitoring

### 🌊 Submarine Depth Monitoring
- Real-time depth and pressure tracking
- Depth history visualization with charts
- Pressure monitoring and safety alerts

### 🗺️ Sea Route Visualization
- Polyline routes displayed on interactive maps
- Color-coded routes based on risk level (Low/Medium/High)
- Weather severity indicators along routes
- Waypoint management system

### 📊 Analytics & Reporting
- Fleet composition breakdown charts
- Engine health radar visualization
- Fuel consumption and speed comparison graphs
- Alert statistics and trends

### 🌤️ Weather Integration
- Real-time weather data for vessel locations
- Storm warnings and visibility alerts
- OpenWeatherMap API support (with mock fallback)

### 🔐 Security & Access Control
- Role-based access control (RBAC)
- Three user roles: Admin, Operator, Viewer
- JWT token-based authentication
- bcrypt password hashing

### 📁 Data Import/Export
- CSV and JSON file uploads for vessels and routes
- Downloadable templates and data export


## 🛠️ Tech Stack

| Frontend | Backend |
|----------|---------|
| HTML5, CSS3, JavaScript | Node.js + Express.js |
| Leaflet.js (Maps) | MySQL Database |
| Chart.js (Analytics) | JWT + bcrypt (Auth) |
| Custom Dark Theme | multer (File uploads) |


## 📁 Project Structure

```
maritime-fleet-tracking/
├── frontend/
│   ├── assets/
│   │   ├── css/main.css          # Dark maritime theme
│   │   └── js/                   # Frontend modules
│   ├── components/sidebar.html
│   └── pages/                    # HTML pages
│       ├── login.html
│       ├── dashboard.html
│       ├── fleet-map.html
│       ├── vessels.html
│       ├── routes.html
│       ├── analytics.html
│       ├── alerts.html
│       └── admin-panel.html
│
├── backend/
│   ├── server.js                 # Express entry point
│   ├── config/db.js              # MySQL configuration
│   ├── controllers/              # Business logic
│   ├── middleware/               # Auth middleware
│   ├── models/                   # Data models
│   ├── routes/                   # API routes
│   └── database/
│       ├── init-db.js            # DB initialization
│       └── schema.sql            # Database schema
│
├── Maritime-Fleet-API.postman_collection.json
└── README.md
```


## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MySQL (8.0 or higher)
- npm

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/PavanKumar1131/Maritime-Fleet-Tracking.git
cd Maritime-Fleet-Tracking

# 2. Install dependencies
cd backend
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 4. Initialize database with demo data
npm run init-db

# 5. Start the server
npm start
```

### Access the Application
- **Application:** http://localhost:5000
- **Login Page:** http://localhost:5000/pages/login.html
- **API Docs:** http://localhost:5000/api


## 👥 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@maritime.com | admin123 |
| Operator | operator@maritime.com | operator123 |
| Viewer | viewer@maritime.com | viewer123 |


## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register` | Register new user (Admin) |
| GET | `/api/auth/users` | List all users (Admin) |
| PUT | `/api/auth/users/:id` | Update user (Admin) |
| DELETE | `/api/auth/users/:id` | Delete user (Admin) |

### Vessels
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vessels` | Get all vessels |
| GET | `/api/vessels/:id` | Get vessel by ID |
| GET | `/api/vessels/stats` | Get fleet statistics |
| POST | `/api/vessels` | Create vessel (Admin) |
| PUT | `/api/vessels/:id` | Update vessel (Admin) |
| DELETE | `/api/vessels/:id` | Delete vessel (Admin) |
| PATCH | `/api/vessels/:id/metrics` | Update metrics (Operator+) |

### Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/routes` | Get all routes |
| GET | `/api/routes/:id` | Get route by ID |
| POST | `/api/routes` | Create route (Admin) |
| PUT | `/api/routes/:id` | Update route (Admin) |
| DELETE | `/api/routes/:id` | Delete route (Admin) |

### Alerts & Weather
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alerts` | Get all alerts |
| GET | `/api/alerts/active` | Get active alerts |
| PUT | `/api/alerts/:id/resolve` | Resolve alert |
| GET | `/api/weather/vessel/:id` | Get vessel weather |

### Live Tracking
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tracking/live` | Real-time vessel positions |
| GET | `/api/tracking/submarines` | Get all submarines |
| GET | `/api/tracking/submarines/:id/depth` | Get depth history |
| GET | `/api/tracking/history/:id` | Get location history |

### File Upload/Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload/vessels` | Upload vessels (CSV/JSON) |
| POST | `/api/upload/routes` | Upload routes (CSV/JSON) |
| GET | `/api/upload/export/vessels` | Export vessels |
| GET | `/api/upload/export/routes` | Export routes |


## 👤 User Roles & Permissions

| Role | Permissions |
|------|-------------|
| **Admin** | Full system access - manage users, vessels, routes, view all analytics |
| **Operator** | Update vessel metrics/locations, manage alerts, view analytics |
| **Viewer** | Read-only access to dashboards, maps, and reports |


## 🗄️ Database Schema

| Table | Description |
|-------|-------------|
| `users` | User accounts with roles |
| `vessels` | Ship and submarine information |
| `vessel_locations` | Location history (lat/lng/speed) |
| `routes` | Sea route definitions |
| `route_waypoints` | Route coordinate points |
| `engine_logs` | Engine health and fuel tracking |
| `submarine_depth_logs` | Depth and pressure monitoring |
| `alerts` | System alerts and warnings |


## 🔧 Environment Variables

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=maritime_fleet
DB_PORT=3306
JWT_SECRET=your_secure_secret_key
WEATHER_API_KEY=your_openweathermap_key  # optional
```


## 🧪 Testing with Postman

1. Import `Maritime-Fleet-API.postman_collection.json` into Postman
2. Run the "Login (Admin)" request first
3. Token is automatically saved to collection variables
4. All authenticated requests use the saved token


## 📸 Screenshots

*Screenshots of the application:*
- Login Page
- Dashboard Overview
- Fleet Map with vessel positions
- Analytics Charts
- Admin Panel

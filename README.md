# ⚓ Maritime Fleet Tracking System

A comprehensive real-time maritime fleet monitoring platform built with Node.js and vanilla JavaScript. Track ships and submarines, visualize sea routes, monitor weather conditions, and receive intelligent alerts for your entire fleet.


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
- Specialized submarine dashboard

### 🗺️ Sea Route Visualization
- Polyline routes displayed on interactive maps
- Color-coded routes based on risk level (Low/Medium/High)
- Weather severity indicators along routes
- Waypoint management system

### 📊 Analytics & Reporting
- Fleet composition breakdown charts
- Engine health radar visualization
- Fuel consumption tracking
- Speed comparison graphs
- Route risk distribution analysis
- Alert statistics and trends

### 🌤️ Weather Integration
- Real-time weather data for vessel locations
- Weather forecasts along planned routes
- Storm warnings and visibility alerts
- OpenWeatherMap API support (with mock fallback)

### 🔐 Security & Access Control
- Role-based access control (RBAC)
- Three user roles: Admin, Operator, Viewer
- JWT token-based authentication (24-hour expiry)
- bcrypt password hashing

### 📁 Data Import/Export
- CSV and JSON file uploads for vessels and routes
- Downloadable templates for proper formatting
- Data export for backup and reporting


## 🛠️ Tech Stack

### Frontend
- **HTML5/CSS3** - Structure and styling
- **JavaScript (Vanilla)** - Client-side logic
- **Leaflet.js** - Interactive maps
- **Chart.js** - Analytics visualization
- **Custom Dark Theme** - Maritime-inspired UI

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MySQL** - Relational database
- **JWT** - Authentication tokens
- **bcrypt** - Password hashing
- **multer** - File upload handling

### Architecture
- REST API architecture
- MVC pattern structure
- Role-based access control
- 8 normalized database tables


## 📁 Project Structure

```
maritime-fleet-tracking/
├── frontend/
│   ├── assets/
│   │   ├── css/
│   │   │   └── main.css           # Dark maritime theme
│   │   ├── images/
│   │   └── js/
│   │       ├── admin-dashboard.js # Admin functionality
│   │       ├── admin-panel.js     # User management
│   │       ├── analytics.js       # Charts and reports
│   │       ├── auth.js            # Authentication
│   │       ├── map.js             # Leaflet map logic
│   │       ├── operator-dashboard.js
│   │       ├── routes.js          # Route management
│   │       ├── vessels.js         # Vessel management
│   │       └── viewer-dashboard.js
│   ├── components/
│   │   └── sidebar.html           # Navigation sidebar
│   └── pages/
│       ├── login.html             # Authentication page
│       ├── dashboard.html         # Main dashboard
│       ├── fleet-map.html         # Interactive map
│       ├── vessels.html           # Vessel management
│       ├── routes.html            # Route planning
│       ├── analytics.html         # Charts & reports
│       ├── alerts.html            # Alert management
│       └── admin-panel.html       # Admin settings
│
├── backend/
│   ├── server.js                  # Express server entry
│   ├── config/
│   │   └── db.js                  # MySQL configuration
│   ├── controllers/
│   │   ├── alertController.js     # Alert logic
│   │   ├── authController.js      # Authentication
│   │   ├── routeController.js     # Route management
│   │   ├── trackingController.js  # Live tracking
│   │   ├── uploadController.js    # File uploads
│   │   ├── vesselController.js    # Vessel CRUD
│   │   └── weatherController.js   # Weather API
│   ├── database/
│   │   ├── init-db.js             # DB initialization
│   │   └── schema.sql             # Database schema
│   ├── middleware/
│   │   └── authMiddleware.js      # JWT verification
│   ├── models/
│   │   ├── routeModel.js
│   │   ├── userModel.js
│   │   └── vesselModel.js
│   ├── routes/
│   │   ├── alertRoutes.js
│   │   ├── authRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── routeRoutes.js
│   │   ├── trackingRoutes.js
│   │   ├── uploadRoutes.js
│   │   ├── vesselRoutes.js
│   │   └── weatherRoutes.js
│   └── package.json
│
├── Maritime-Fleet-API.postman_collection.json
├── package.json
└── README.md
```


## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MySQL (8.0 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/maritime-fleet-tracking.git
cd maritime-fleet-tracking
```

2. **Backend Setup**
```bash
cd backend
npm install

# Create .env file
echo "DB_HOST=localhost" > .env
echo "DB_USER=root" >> .env
echo "DB_PASSWORD=your_password" >> .env
echo "DB_NAME=maritime_fleet" >> .env
echo "DB_PORT=3306" >> .env
echo "JWT_SECRET=your_jwt_secret" >> .env
echo "PORT=5000" >> .env

# Initialize database with demo data
npm run init-db

# Start the server
npm start
```

3. **Access the Application**
```
Open browser: http://localhost:5000
Login page: http://localhost:5000/pages/login.html
API docs: http://localhost:5000/api
```

### Running the Application

**Development Mode**
```bash
cd backend
npm run dev
# Server runs on http://localhost:5000
```

**Production Mode**
```bash
cd backend
npm start
```


## 👥 Demo Credentials

Default demo accounts are available for testing:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@maritime.com | admin123 |
| Operator | operator@maritime.com | operator123 |
| Viewer | viewer@maritime.com | viewer123 |


## 📡 API Documentation

### Authentication Endpoints

#### Login
```
POST /api/auth/login
Body: { email, password }
Response: { success, token, user }
```

#### Register User (Admin only)
```
POST /api/auth/register
Headers: Authorization: Bearer <token>
Body: { name, email, password, role }
```

#### Get All Users (Admin only)
```
GET /api/auth/users
Headers: Authorization: Bearer <token>
```

#### Update User (Admin only)
```
PUT /api/auth/users/:id
Headers: Authorization: Bearer <token>
Body: { name, email, role }
```

#### Delete User (Admin only)
```
DELETE /api/auth/users/:id
Headers: Authorization: Bearer <token>
```

### Vessel Endpoints

#### Get All Vessels
```
GET /api/vessels
```

#### Get Vessel by ID
```
GET /api/vessels/:id
```

#### Get Fleet Statistics
```
GET /api/vessels/stats
```

#### Create Vessel (Admin only)
```
POST /api/vessels
Headers: Authorization: Bearer <token>
Body: { name, type, latitude, longitude, speed, engine_health }
```

#### Update Vessel (Admin only)
```
PUT /api/vessels/:id
Headers: Authorization: Bearer <token>
Body: { name, type, status, engine_health }
```

#### Delete Vessel (Admin only)
```
DELETE /api/vessels/:id
Headers: Authorization: Bearer <token>
```

#### Update Vessel Metrics (Operator+)
```
PATCH /api/vessels/:id/metrics
Headers: Authorization: Bearer <token>
Body: { engine_health, fuel_level, speed }
```

#### Update Vessel Location (Operator+)
```
POST /api/vessels/:id/location
Headers: Authorization: Bearer <token>
Body: { latitude, longitude, speed, direction }
```

### Route Endpoints

#### Get All Routes
```
GET /api/routes
```

#### Get Route by ID
```
GET /api/routes/:id
```

#### Get Route Statistics
```
GET /api/routes/stats
```

#### Create Route (Admin only)
```
POST /api/routes
Headers: Authorization: Bearer <token>
Body: { route_name, vessel_id, coordinates, risk_level, description }
```

#### Update Route (Admin only)
```
PUT /api/routes/:id
Headers: Authorization: Bearer <token>
Body: { route_name, coordinates, risk_level }
```

#### Delete Route (Admin only)
```
DELETE /api/routes/:id
Headers: Authorization: Bearer <token>
```

### Alert Endpoints

#### Get All Alerts
```
GET /api/alerts
```

#### Get Active Alerts
```
GET /api/alerts/active
```

#### Get Alert Statistics
```
GET /api/alerts/stats
```

#### Create Alert
```
POST /api/alerts
Body: { vessel_id, type, severity, message }
```

#### Resolve Alert
```
PUT /api/alerts/:id/resolve
Headers: Authorization: Bearer <token>
```

### Weather Endpoints

#### Get Weather by Coordinates
```
GET /api/weather/coords?lat=40.7128&lon=-74.0060
```

#### Get Vessel Weather
```
GET /api/weather/vessel/:id
```

#### Get Route Weather
```
GET /api/weather/route/:id
```

### Live Tracking Endpoints

#### Get Live Vessel Positions
```
GET /api/tracking/live
```

#### Get All Submarines
```
GET /api/tracking/submarines
```

#### Get Submarine Depth History
```
GET /api/tracking/submarines/:id/depth
```

#### Update Submarine Depth
```
POST /api/tracking/submarines/:id/depth
Body: { depth, pressure }
```

#### Get Location History
```
GET /api/tracking/history/:id
```

### File Upload Endpoints

#### Upload Vessels (CSV/JSON)
```
POST /api/upload/vessels
Content-Type: multipart/form-data
Body: file
```

#### Upload Routes (CSV/JSON)
```
POST /api/upload/routes
Content-Type: multipart/form-data
Body: file
```

#### Export Vessels
```
GET /api/upload/export/vessels
```

#### Export Routes
```
GET /api/upload/export/routes
```

#### Get CSV Templates
```
GET /api/upload/templates/vessel
GET /api/upload/templates/route
```


## 👤 User Roles & Permissions

### Admin
- Full system access
- User management (create, update, delete)
- Vessel management (create, update, delete)
- Route management (create, update, delete)
- View all analytics and reports

### Operator
- View all vessels and routes
- Update vessel metrics and locations
- Manage alerts
- View analytics and reports
- Cannot create/delete vessels or manage users

### Viewer
- Read-only access
- View dashboards and maps
- View reports and analytics
- Cannot modify any data


## 🗄️ Database Schema

The system uses 8 normalized MySQL tables:

| Table | Description |
|-------|-------------|
| `users` | User accounts with roles (Admin/Operator/Viewer) |
| `vessels` | Ship and submarine information |
| `vessel_locations` | Location history (lat/lng/speed/direction) |
| `routes` | Sea route definitions |
| `route_waypoints` | Route coordinate points |
| `engine_logs` | Engine health and fuel tracking |
| `submarine_depth_logs` | Depth and pressure monitoring |
| `alerts` | System alerts and warnings |


## 🎨 Theme & Styling

The application features a dark maritime theme:
- **Primary Color**: Deep Navy (#1a237e)
- **Accent Color**: Ocean Blue (#0288d1)
- **Background**: Dark slate (#0d1117)
- **Text**: Light gray (#e6e6e6)
- **Borders**: Subtle gray (#30363d)


## 🔧 Environment Variables

### Backend (.env)
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=maritime_fleet
DB_PORT=3306
JWT_SECRET=your_secure_secret_key
PORT=5000
WEATHER_API_KEY=your_openweathermap_key (optional)
```


## 🧪 Testing with Postman

1. Import `Maritime-Fleet-API.postman_collection.json` into Postman
2. Run the "Login (Admin)" request first
3. Token is automatically saved to collection variables
4. All authenticated requests use the saved token


##  Screenshots

*Add screenshots of your application here*

- Login Page
- Dashboard Overview
- Fleet Map with vessel positions
- Submarine depth tracking
- Analytics charts
- Admin panel


## 📜 License

ISC License

---

Made with ⚓ for Maritime Fleet Management

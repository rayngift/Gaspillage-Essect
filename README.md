#  CampusSave

### Reducing Food Waste, One Campus at a Time.

CampusSave is a digital platform designed to reduce food waste around university campuses by connecting students with local businesses offering surplus food at discounted prices.

The platform allows students to discover affordable food offers, reserve meals and contribute to a more sustainable environment, while helping local merchants reduce food waste and increase their visibility.

---

##  Project Objectives

- Reduce food waste around university campuses.
- Provide students with affordable food options.
- Connect local merchants with potential customers.
- Encourage sustainable consumption.
- Reward environmentally friendly actions through EcoPoints.
- Promote a circular and responsible food economy.

##  Main Features

###  Student Interface
- User registration and authentication.
- Browse available food offers.
- Discover nearby partner shops.
- Reserve discounted meals.
- Track reservations and orders.
- Access QR Code pickup tickets.
- Track EcoPoints and environmental impact.

###  Merchant Interface
- Manage business information.
- Publish discounted food offers.
- Manage food quantities and availability.
- Track incoming reservations.
- Manage order pickup status.

###  Admin Interface
- Manage student and merchant accounts.
- Validate partner shops.
- Monitor offers and reservations.
- Manage user roles.
- Monitor platform statistics.

##  Technologies

| Technology | Purpose |
|---|---|
| React 19 | Web frontend |
| TypeScript | Type-safe development |
| Vite | Frontend development and build |
| Tailwind CSS | Interface styling |
| Lucide React | Icons |
| Motion | UI animations |
| Firebase Authentication | User authentication |
| Cloud Firestore | Database |
| Node.js / Express | Planned backend API |
| Firebase Admin SDK | Planned secure server-side Firebase access |
| Flutter | Mobile application |

##  Project Architecture

CampusSave is designed as a multi-platform application sharing the same Firebase project and backend.

```text
CampusSave/
│
├── frontend/                 # React Web Application
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── assets/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── mobile/                   # Flutter Mobile Application
│
├── backend/                  # Planned Express API
│
└── firebase/                 # Firebase configuration
```

*Note: This represents the intended project organization. Some backend and mobile components are still under development.*

##  Database Structure

CampusSave uses Cloud Firestore with four main collections:

| Collection | Description |
|---|---|
| `users` | User profiles, roles and EcoPoints |
| `shops` | Partner business information |
| `offers` | Discounted food offers and surprise baskets |
| `orders` | Reservations, payments and pickup information |

### User Roles

- `etudiant` – Student
- `commercant` – Merchant
- `admin` – Administrator

##  Installation & Setup

### Prerequisites

Make sure you have installed:

- Node.js
- npm
- Git
- Visual Studio Code

### 1. Clone the repository

```bash
git clone https://github.com/rayngift/campussave-essect.git
```

### 2. Navigate to the frontend

```bash
cd campussave-essect/frontend
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure Firebase

Configure your Firebase project and provide the required Firebase client configuration.

Enable the required Firebase Authentication providers and configure Cloud Firestore.

### 5. Start the development server

Make sure the frontend package.json contains:

```json
"dev": "vite"
```

Then run:

```bash
npm run dev
```

### 6. Build for production

```bash
npm run build
```

##  Security

CampusSave follows a backend-oriented security architecture.

- Firebase Authentication is used for user identity.
- Firestore security rules restrict direct client database access.
- The planned Express backend will verify Firebase authentication tokens.
- Role-based access control (RBAC) will protect operations according to user roles.
- Firebase Admin SDK will handle trusted server-side database operations.

**Important:** Direct Firestore access is currently restricted by the project's security rules. Full frontend-backend integration is part of the development roadmap.

##  Development Roadmap

- [x] Initialize React frontend.
- [x] Configure the Firebase project.
- [x] Define Firestore data models.
- [x] Establish project structure.
- [ ] Complete React-Firebase integration.
- [ ] Develop Node.js / Express backend.
- [ ] Implement authentication middleware.
- [ ] Implement role-based access control.
- [ ] Develop Users, Shops, Offers and Orders APIs.
- [ ] Integrate Flutter with the shared backend.
- [ ] Implement and test payment integration.
- [ ] Complete testing and deployment.

##  Project Team

CampusSave is developed as a collaborative project.

- **Web Development:** React and TypeScript.
- **Mobile Development:** Flutter.
- **Backend Development:** Node.js and Express.
- **Database Management:** Firebase Cloud Firestore.

##  Our Mission

We believe that food should never go to waste when it can make a difference.

CampusSave aims to transform surplus food into opportunities for students, businesses and the environment.

**Save Food. Save Money. Save the Planet. **

---

*CampusSave – A smarter and more sustainable campus community.*

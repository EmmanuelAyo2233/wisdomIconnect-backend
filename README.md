# 🧠 Wisdom Connect API

The **Wisdom Connect API** powers the backend of _Wisdom Connect_ — a platform that connects users with mentors (elders), enables session bookings, shares traditional knowledge, and builds a community of wisdom and growth.

---

## 🌐 Features

-   ✅ User Profiles (mentors and mentees)
-   💬 Messaging with connections
-   📅 Booking sessions with mentors
-   🧓 Mentor registration & management
-   📚 Topic exploration & expert playbooks
-   🛎️ Notifications for events and messages
-   ✍️ Feedback on completed sessions

---

## 🛠️ Tech Stack

-   **Node.js**, **Express.js**
-   **Sequelize ORM**, **MySQL/MariaDB/Sqlite**
-   **JWT Auth** (HTTP-only cookies)
-   **Cloudinary/ImageKit** (Image uploads)
-   **dotenv**, **cookie-parser**, **CORS**, etc.

---

## 📁 Project Structure

```
📦 wisdom-connect-api
├── 📁 config
├── 📁 controllers
├── 📁 migration
├── 📁 models
├── 📁 routes
├── 📁 utils
├── .env.sample copy and rename it to .env
├── .sequelizerc
├── server.js
|── package.json => Check here for db migration and creation
|── swagger.yaml
└── README.md
```

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/wisdom-connect-api.git
cd wisdom-connect-api
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root directory:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASS=yourpassword
DB_NAME=wisdom_connect
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
```

### 4. Start the server

Make sure you have nodemon installed globally using

```bash
npm install nodemon -g

npm run dev
```

---

## 📘 Example API Endpoints

### 👤 Authentication

```
POST /api/v1/auth/register
POST /api/v1/auth/login
```

### 👤 User

```
GET /api/v1/user/me
PATCH /api/v1/user/me/update
PATCH /api/v1/user/me/picture
DELETE /api/v1/user/me/delete

```

### 📅 Mentees => Get, Book, Rechedule, Cancel, Delete Appointment with Mentors

```
GET /api/v1/mentors/
GET /api/v1/mentors/:id
POST /api/v1/mentors/:id/book
PATCH /api/v1/mentors/:id/reschedule
PATCH /api/v1/mentors/:id/cancel
DELETE /api/v1/mentors/:id/delete
```

### 📅 Mentors => Get, Reschedule, confirm, cancel, delete Appointment

```
GET /api/v1/appointments/
PATCH /api/v1/appointments/:id/confirm
PATCH /api/v1/appointments/:id/reschedule
PATCH /api/v1/appointments/:id/cancel
PATCH /api/v1/appointments/:id/delete
```

### Post => Create, Update, Delete

```
GET /api/v1/post
GET /api/v1/post/:id
POST /api/v1/post
PATCH /api/v1/post/:id
DELETE /api/v1/post/:id
```

### Comment => Create, Update, Delete

```
GET /api/v1/comment
GET /api/v1/comment/:id
POST /api/v1/comment
PATCH /api/v1/comment/:id
DELETE /api/v1/comment/:id
```

### ChatAcess => View,

```
GET /api/v1/chat
```

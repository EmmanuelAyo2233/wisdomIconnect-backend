# Wisdom Connect Backend API Documentation

## Overview

Wisdom Connect is a platform that connects mentees with mentors for knowledge sharing, session booking, messaging, and community building. The backend API is built with Node.js and Express.js, using Sequelize ORM for database interactions with MySQL. It includes JWT-based authentication, real-time chat via Socket.io, image uploads to Cloudinary, email notifications, and more.

## Features

- User registration and authentication (mentors, mentees, admins)
- Mentor profiles and approval system
- Appointment booking and management
- Real-time chat between users
- Post and comment system
- Notification system
- Admin panel for management
- Image uploads
- Email sending

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL with Sequelize ORM
- **Authentication**: JWT with HTTP-only cookies
- **Real-time**: Socket.io
- **Image Storage**: Cloudinary
- **Email**: Nodemailer with Sendinblue
- **Validation**: Express-validator
- **Security**: Helmet, CORS
- **Documentation**: Swagger UI
- **Testing**: Jest

## Project Structure

```
wisdomIconnect-backend/
├── config/
│   ├── config.js          # Database configuration
│   ├── db.js              # Database connection
│   ├── reuseablePackages.js # Common imports
│   └── socket.js          # Socket configuration
├── controllers/           # Business logic
│   ├── adminController.js
│   ├── appointments.js
│   ├── authcontrollers.js
│   ├── availabilityController.js
│   ├── chatcontroller.js
│   ├── commentcontroller.js
│   ├── emailcontroller.js
│   ├── menteescontroller.js
│   ├── mentorController.js
│   ├── notificatioController.js
│   ├── postcontroller.js
│   └── usercontroller.js
├── middlewares/
│   └── authentication.js  # JWT auth middleware
├── migrations/            # Sequelize migrations
├── models/                # Sequelize models
│   ├── appointment.js
│   ├── availability.js
│   ├── chataccess.js
│   ├── chatmessage.js
│   ├── comment.js
│   ├── index.js
│   ├── mentee.js
│   ├── mentor.js
│   ├── notification.js
│   ├── post.js
│   └── user.js
├── routes/                # API routes
│   ├── admin.js
│   ├── appointments.js
│   ├── auth.js
│   ├── availability.js
│   ├── chat.js
│   ├── comment.js
│   ├── index.js
│   ├── mentees.js
│   ├── mentor.js
│   ├── notificationRoutes.js
│   ├── post.js
│   └── user.js
├── test/
│   └── user.test.js
├── utils/
│   ├── cloudinary.js
│   ├── email.js
│   ├── generateaccesscode.js
├── .env                   # Environment variables
├── package.json
├── server.js              # Main server file
├── vercel.json            # Vercel deployment config
└── README.md
```

## Installation and Setup

### Prerequisites

- Node.js (v14 or higher)
- MySQL or MariaDB

### 1. Clone the Repository

```bash
git clone <repository-url>
cd wisdomIconnect-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
PORT=5000
API_URL=/api/v1
FRONTEND_URL=http://localhost:3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=wisdomiconnect_db
DB_PORT=3306
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
EMAIL_HOST=smtp-relay.sendinblue.com
EMAIL_PORT=587
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_sendinblue_api_key
SENDINBLUE_API_KEY=your_sendinblue_api_key
```

### 4. Database Setup

- Create a MySQL database with the name specified in DB_NAME.
- Run migrations:

```bash
npm run dev:migrate
```

For production:

```bash
npm run pro:migrate
```

### 5. Start the Server

For development:

```bash
npm run dev
```

For production:

```bash
npm start
```

The server will run on `http://localhost:5000`
Swagger documentation: `http://localhost:5000/docs`

## Database Schema

The application uses Sequelize ORM with MySQL. Below is the schema for each model.

### User

Represents a user in the system (mentor, mentee, or admin).

**Fields:**

- `id`: INTEGER, Primary Key, Auto Increment
- `firstName`: STRING, Not Null
- `lastName`: STRING, Not Null
- `email`: STRING, Not Null, Unique
- `password`: STRING, Not Null (hashed)
- `role`: ENUM('mentor', 'mentee', 'admin'), Not Null
- `profilePicture`: STRING (URL)
- `bio`: TEXT
- `isVerified`: BOOLEAN, Default false
- `createdAt`: DATE
- `updatedAt`: DATE

**Associations:**

- HasOne Mentor
- HasOne Mentee
- HasMany Post
- HasMany Comment
- HasMany Appointment
- HasMany ChatMessage (as sender)
- HasMany Notification

### Mentor

Profile for mentors.

**Fields:**

- `id`: INTEGER, Primary Key, Auto Increment
- `userId`: INTEGER, Foreign Key to User
- `expertise`: JSON (array of strings)
- `experience`: TEXT
- `languages`: JSON (array of strings)
- `hourlyRate`: DECIMAL(10,2)
- `availability`: JSON
- `bio`: TEXT
- `profilePicture`: STRING
- `isApproved`: BOOLEAN, Default false
- `createdAt`: DATE
- `updatedAt`: DATE

**Associations:**

- BelongsTo User
- HasMany Appointment
- HasMany Availability
- HasMany ChatAccess

### Mentee

Profile for mentees.

**Fields:**

- `id`: INTEGER, Primary Key, Auto Increment
- `userId`: INTEGER, Foreign Key to User
- `interests`: JSON
- `goals`: TEXT
- `createdAt`: DATE
- `updatedAt`: DATE

**Associations:**

- BelongsTo User

### Appointment

Booking sessions between mentees and mentors.

**Fields:**

- `id`: INTEGER, Primary Key, Auto Increment
- `userId`: INTEGER, Foreign Key to User (mentee)
- `mentorId`: INTEGER, Foreign Key to Mentor
- `date`: DATE
- `time`: TIME
- `duration`: INTEGER (minutes)
- `status`: ENUM('pending', 'confirmed', 'completed', 'cancelled')
- `notes`: TEXT
- `createdAt`: DATE
- `updatedAt`: DATE

**Associations:**

- BelongsTo User
- BelongsTo Mentor

### Availability

Mentor's available time slots.

**Fields:**

- `id`: INTEGER, Primary Key, Auto Increment
- `mentorId`: INTEGER, Foreign Key to Mentor
- `day`: STRING
- `startTime`: TIME
- `endTime`: TIME
- `isAvailable`: BOOLEAN, Default true
- `createdAt`: DATE
- `updatedAt`: DATE

**Associations:**

- BelongsTo Mentor

### ChatAccess

Access control for chats.

**Fields:**

- `id`: INTEGER, Primary Key, Auto Increment
- `mentorId`: INTEGER, Foreign Key to Mentor
- `menteeId`: INTEGER, Foreign Key to User (mentee)
- `accessGranted`: BOOLEAN, Default false
- `createdAt`: DATE
- `updatedAt`: DATE

**Associations:**

- BelongsTo Mentor
- BelongsTo User (mentee)

### ChatMessage

Messages in chat.

**Fields:**

- `id`: INTEGER, Primary Key, Auto Increment
- `senderId`: INTEGER, Foreign Key to User
- `receiverId`: INTEGER, Foreign Key to User
- `message`: TEXT
- `timestamp`: DATE
- `isRead`: BOOLEAN, Default false
- `createdAt`: DATE
- `updatedAt`: DATE

**Associations:**

- BelongsTo User (sender)
- BelongsTo User (receiver)

### Post

Posts by users.

**Fields:**

- `id`: INTEGER, Primary Key, Auto Increment
- `userId`: INTEGER, Foreign Key to User
- `title`: STRING
- `content`: TEXT
- `image`: STRING
- `createdAt`: DATE
- `updatedAt`: DATE

**Associations:**

- BelongsTo User
- HasMany Comment

### Comment

Comments on posts.

**Fields:**

- `id`: INTEGER, Primary Key, Auto Increment
- `userId`: INTEGER, Foreign Key to User
- `postId`: INTEGER, Foreign Key to Post
- `content`: TEXT
- `createdAt`: DATE
- `updatedAt`: DATE

**Associations:**

- BelongsTo User
- BelongsTo Post

### Notification

Notifications for users.

**Fields:**

- `id`: INTEGER, Primary Key, Auto Increment
- `userId`: INTEGER, Foreign Key to User
- `type`: STRING
- `message`: TEXT
- `isRead`: BOOLEAN, Default false
- `createdAt`: DATE
- `updatedAt`: DATE

**Associations:**

- BelongsTo User

## API Endpoints

The API base URL is `/api/v1` (configurable via API_URL).

All endpoints return JSON responses.

Authentication is required for most endpoints, using JWT in HTTP-only cookies.

### Authentication

#### POST /api/v1/auth/register

Register a new user.

**Request Body:**

```json
{
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "password": "string",
  "role": "mentor" | "mentee"
}
```

**Response:**

```json
{
  "message": "User registered successfully",
  "user": { ... }
}
```

#### POST /api/v1/auth/login

Login user.

**Request Body:**

```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**

```json
{
  "message": "Login successful",
  "user": { ... }
}
```

Sets JWT cookie.

#### POST /api/v1/auth/logout

Logout user.

Clears JWT cookie.

#### GET /api/v1/auth/me

Get current user info.

Requires auth.

**Response:**

```json
{
  "user": { ... }
}
```

### Users

#### GET /api/v1/user/profile

Get user profile.

Requires auth.

#### PUT /api/v1/user/profile

Update user profile.

Requires auth.

**Request Body:**

```json
{
  "firstName": "string",
  "lastName": "string",
  "bio": "string",
  "profilePicture": "string"
}
```

### Mentors

#### GET /api/v1/mentors

Get all approved mentors.

#### GET /api/v1/mentors/:id

Get mentor by ID.

#### POST /api/v1/mentors

Create mentor profile (for mentors).

Requires auth, role mentor.

**Request Body:**

```json
{
  "expertise": ["string"],
  "experience": "string",
  "languages": ["string"],
  "hourlyRate": 50.0,
  "bio": "string"
}
```

#### PUT /api/v1/mentors/:id

Update mentor profile.

Requires auth, own profile or admin.

### Mentees

#### GET /api/v1/mentees/profile

Get mentee profile.

Requires auth.

#### PUT /api/v1/mentees/profile

Update mentee profile.

Requires auth.

### Appointments

#### GET /api/v1/appointments

Get user's appointments.

Requires auth.

#### POST /api/v1/appointments

Book an appointment.

Requires auth.

**Request Body:**

```json
{
  "mentorId": 1,
  "date": "2023-10-01",
  "time": "10:00",
  "duration": 60,
  "notes": "string"
}
```

#### PUT /api/v1/appointments/:id

Update appointment.

Requires auth, own appointment or mentor.

#### DELETE /api/v1/appointments/:id

Cancel appointment.

Requires auth.

### Availability

#### GET /api/v1/availability/:mentorId

Get mentor's availability.

#### POST /api/v1/availability

Add availability slot.

Requires auth, mentor.

**Request Body:**

```json
{
  "day": "Monday",
  "startTime": "09:00",
  "endTime": "17:00"
}
```

#### PUT /api/v1/availability/:id

Update availability.

Requires auth, mentor.

#### DELETE /api/v1/availability/:id

Delete availability.

Requires auth, mentor.

### Chat

#### GET /api/v1/chat/messages/:userId

Get chat messages with a user.

Requires auth.

#### POST /api/v1/chat/messages

Send message.

Requires auth.

**Request Body:**

```json
{
  "receiverId": 2,
  "message": "Hello"
}
```

Real-time via Socket.io.

### Posts

#### GET /api/v1/post

Get all posts.

#### GET /api/v1/post/:id

Get post by ID.

#### POST /api/v1/post

Create post.

Requires auth.

**Request Body:**

```json
{
  "title": "string",
  "content": "string",
  "image": "string"
}
```

#### PUT /api/v1/post/:id

Update post.

Requires auth, own post.

#### DELETE /api/v1/post/:id

Delete post.

Requires auth, own post.

### Comments

#### GET /api/v1/comment/:postId

Get comments for a post.

#### POST /api/v1/comment

Create comment.

Requires auth.

**Request Body:**

```json
{
  "postId": 1,
  "content": "string"
}
```

#### PUT /api/v1/comment/:id

Update comment.

Requires auth, own comment.

#### DELETE /api/v1/comment/:id

Delete comment.

Requires auth, own comment.

### Notifications

#### GET /api/v1/notifications

Get user's notifications.

Requires auth.

#### PUT /api/v1/notifications/:id/read

Mark notification as read.

Requires auth.

### Admin

#### GET /api/v1/admin/users

Get all users.

Requires auth, admin.

#### PUT /api/v1/admin/users/:id/approve

Approve mentor.

Requires auth, admin.

#### DELETE /api/v1/admin/users/:id

Delete user.

Requires auth, admin.

## Authentication System

The application uses JWT (JSON Web Tokens) for authentication.

- Tokens are stored in HTTP-only cookies for security.
- Expiration: 7 days (configurable).
- Middleware `authentication.js` checks for valid token on protected routes.
- Roles: mentor, mentee, admin.
- Some routes require specific roles.

## Database Configuration

Configured in `config/config.js` for development, test, production.

Uses environment variables for credentials.

Connection in `config/db.js`.

## Real-time Features

- Chat: Uses Socket.io for real-time messaging.
- Configured in `controllers/chatcontroller.js` and `config/socket.js`.
- Namespace: /chat

## Image Uploads

Uses Cloudinary.

Configured in `utils/cloudinary.js`.

## Email

Uses Nodemailer with Sendinblue.

Configured in `utils/email.js`.

## Testing

Run tests with:

```bash
npm test
```

Migrations for test DB:

```bash
npm run test:migrate
```

## Deployment

Configured for Vercel in `vercel.json`.

For other platforms, ensure environment variables are set.

## Contributing

[Add contribution guidelines]

## License

[Add license]

This documentation covers the entire backend. For more details, check the code or Swagger docs at /docs.

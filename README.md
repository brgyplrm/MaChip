# MaChip: RFID-Based Identification & Attendance System

**MaChip** is a modern office automation solution designed to streamline attendance tracking and access control in logistics hubs. By replacing manual logs with RFID/NFC technology and biometric verification, it ensures data integrity, prevents fraud, and complies with international shipping standards (CTPAT).

---

## 📋 Project Overview

Developed as a research-driven project at the **Polytechnic University of the Philippines, San Juan Campus**, MaChip leverages a mixed-method research design to reduce administrative burdens and eliminate "buddy punching."

### Core Objectives
*   **Security:** Adheres to the CIA (Confidentiality, Integrity, Availability) triad.
*   **Efficiency:** Automated payroll generation based on real-time attendance logs.
*   **Compliance:** Meets international security standards for logistics and forwarding.

---

## 🏗️ Project Structure

The project is split into a **React (Vite) Frontend** and a **Node.js (Express) Backend**, following modular and MVC architectural patterns.

### 💻 Frontend (`/frontend`)
Organized for scalability and clear separation of concerns.

| Directory/File | Description |
| :--- | :--- |
| `src/assets/` | Static assets: images, logos, fonts, and SVGs. |
| `src/components/` | Reusable UI components (Sidebar, Navbar, Table, Toast, Modals). |
| `src/pages/` | Route-specific views (Home, Payroll, User Management). |
| `src/utils/` | Shared helper logic: data formatters, constants, and export logic. |
| `src/hooks/` | Custom React hooks for shared logic. |
| `src/services/` | API interaction layer for centralized backend communication. |
| `src/context/` | Global state management (Auth, Theme). |
| `App.jsx` | Main application router and protected route definitions. |
| `Main.jsx` | Application entry point. |

#### Naming Conventions
*   **PascalCase:** Used for all JSX files (Pages and Components).
    *   *Example:* `PayrollManagement.jsx`, `DetailsPayroll.jsx`.
*   **camelCase:** Used for utility and helper files.
    *   *Example:* `datatableSource.jsx`, `formatUserId.js`.

---

### ⚙️ Backend (`/backend`)
Follows the **MVC (Model-View-Controller)** pattern for structured data flow.

| Directory | Description |
| :--- | :--- |
| `src/models/` | Sequelize blueprints for database tables (User, Attendance, Payroll). |
| `src/controllers/` | Business logic for processing requests and generating responses. |
| `src/routes/` | API endpoint definitions (RESTful). |
| `src/middleware/` | Request interceptors for authentication, security, and file uploads. |
| `src/config/` | Database and environment configurations. |
| `src/utils/` | Backend utilities (Holiday scrapers, system time management). |
| `app.js` | Main server initialization and middleware mounting. |
| `uploads/` | Local storage for user-uploaded files (Profile pics, documents). |

---

## 🛠️ Technical Stack

### Software
*   **Frontend:** React, Vite, Material UI (MUI), SCSS.
*   **Backend:** Node.js, Express.js.
*   **Database:** MySQL with Sequelize ORM.
*   **Testing:** Postman Collections (located in `.postman/`).

### Hardware (Scanner Unit)
*   **Microcontroller:** ESP32.
*   **RFID Module:** MFRC522 (13.56 MHz).
*   **Connectivity:** ENC28J60 Ethernet Module (Wired LAN for stability).
*   **Firmware:** Arduino C/C++.

---

## 🚀 Getting Started

### Prerequisites
*   **Node.js** (v16.x or higher)
*   **MySQL Server**
*   **Arduino IDE** (for hardware deployment)

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/machip.git
    cd machip
    ```

2.  **Reset and Install Dependencies:**
    Runs the cleanup and installs all necessary packages for both frontend and backend.
    ```bash
    npm run reset
    ```

3.  **Environment Variables:**
    Configure your `.env` files in both the root and `backend/` directories with your MySQL credentials.

4.  **Run the Application:**
    Starts both the backend and frontend in development mode.
    ```bash
    npm run dev
    ```

---

## 👥 Authors
*   **Palermo, Borgy Misael K.** - Lead Researcher
*   **Lapido, Jhanna Lou R.** - Researcher
*   **Pinto, Kathleen I.** - Researcher
*   **Tomas, Cydoel M.** - Researcher
*   **Morales, Trecia** - Researcher

---

## ⚖️ License
This project is developed for academic research purposes. Source code is provided under the **MIT License**.

> **Note:** This system is designed for local network use to ensure maximum security for corporate attendance data.

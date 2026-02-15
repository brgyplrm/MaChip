MAChip: A Microchip-Based Identification System for Centralized Access Control and Attendance Monitoring

MAChip is a research-driven office automation solution designed to modernize attendance tracking at high-traffic logistics hubs. It replaces manual paper-based logs with a robust, two-factor authentication (2FA) workflow combining RFID/NFC technology and biometric fingerprint verification.
📋 Research Overview

    Institution: Polytechnic University of the Philippines, San Juan Campus.

    Research Design: Mixed Method Research Design (Qualitative Interviews + Quantitative Surveys).

    Theoretical Framework: Anchored on the Information Security Triad (CIA) and Socio-Technical Systems (STS) Theory.

    Objectives: To reduce administrative burden, prevent attendance fraud ("buddy punching"), and ensure compliance with international shipping standards (CTPAT).

🛠️ Technical Stack
Backend & Admin Server

    Runtime: Node.js

    Web Framework: Express.js

    Database: MySQL with Sequelize (ORM)

    Security: Bcrypt for data hashing and local IP whitelisting.

Hardware (Scanner Unit)

    Microcontroller: ESP32

    RFID Module: MFRC522 (13.56 MHz)

    Network: ENC28J60 Ethernet Module (Wired LAN for stability)

    Firmware: Arduino C/C++.

🚀 Getting Started
Prerequisites

    Node.js (v16.x or higher)

    MySQL Server (Local Instance)

    Arduino IDE (for ESP32 firmware deployment).

Installation

    Clone the repository:
    Bash

    git clone https://github.com/yourusername/machip.git

    Install backend dependencies:
    Bash

    npm install

    Setup environment variables:
    Create a .env file based on .env.example and add your local MySQL credentials.

    Deploy Firmware:
    Flash the firmware/scanner.ino to your ESP32 device using the Arduino IDE.

👥 Authors

    Palermo, Borgy Misael K. - Researcher

    Lapido, Jhanna Lou R. - Researcher

    Pinto, Kathleen I. - Researcher

    Tomas, Cydoel M. - Researcher

    Morales, Trecia - Researcher

⚖️ License

This project is for academic research purposes. Source code is provided under the MIT License.

Note: This system is designed for offline/local network use only to ensure the security of corporate attendance data.

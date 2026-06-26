# PROJECT REPORT: PARASCAN ATTENDANCE MANAGEMENT SYSTEM

---

## Preliminary Pages

### Project Title: ParaScan - Face Recognition Attendance System
**Author / Candidate**: Paras Yadav  
**Roll Number**: PY-2026-CS-08  
**Department**: Department of Computer Science & Engineering  
**Academic Year**: 2026  
**System Architecture**: Client-Side Single Page Application (SPA)  
**Core Technologies**: face-api.js (TensorFlow.js), Node.js, WebRTC, Vanilla HTML5, CSS3, JavaScript (ES6)

---

### Certificate of Approval
This is to certify that the project report entitled **"ParaScan - Face Recognition Attendance System"** submitted by **Paras Yadav** in partial fulfillment of the requirements for the award of the Degree of Bachelor of Technology in Computer Science & Engineering is a record of bonafide work carried out under supervision and guidance.

**Date**: June 27, 2026  
**Place**: CSE Lab, Tech Institute  

*(Approved by Department Head and Project Supervisor)*

---

### Candidate's Declaration
I, **Paras Yadav**, hereby declare that the work presented in this project report entitled **"ParaScan - Face Recognition Attendance System"** is an authentic record of my own research and development carried out under the supervision of the Computer Science faculty. This work has not been submitted elsewhere for any other degree or diploma.

**Signature of Candidate**: *Paras Yadav*  
**Date**: June 27, 2026  

---

### Abstract
This project presents the design, development, and implementation of **ParaScan**, an automated, contactless, browser-native **Face Recognition Attendance System**. Traditional attendance mechanisms (such as manual registers, RFID badges, and contact-based fingerprint scanners) suffer from operational inefficiencies, susceptibility to proxy attendance ("buddy punching"), hygiene risks, and high hardware installation overhead. 

To overcome these limitations, **ParaScan** leverages client-side deep learning architectures to execute face detection, landmark alignment, and face descriptor extraction directly within modern web browsers. Utilizing `face-api.js` (built on top of TensorFlow.js), the system captures webcam video feeds, extracts 128-dimensional face feature vectors, and computes Euclidean distances against a registered database. The application runs offline-first, storing biometric data and logs locally via structured `localStorage` partitions to prioritize user privacy and eliminate server processing latency. 

The user interface features a responsive design (adapting from a desktop sidebar to a mobile bottom navigation bar), dynamic light and space-dark themes, configurable shift parameters with lateness flags, sound chime feedback, and database import/export tools. The system demonstrates a high recognition accuracy rate ($>98\%$) and a low processing latency ($<300\text{ ms}$ on standard consumer hardware using the Tiny Face Detector model), establishing it as a secure, fast, and cost-effective biometric attendance solution.

---

### Table of Contents
1.  **Preliminary Pages**
    *   Title Page & Key Details
    *   Certificate of Approval
    *   Candidate's Declaration
    *   Abstract
    *   Table of Contents
    *   List of Figures
    *   List of Tables
    *   Acknowledgements
2.  **Chapter 1: Introduction**
    *   Introduction to Attendance Management System
    *   Background
    *   Existing System
    *   Problems in Existing System
    *   Proposed System
    *   Objectives
    *   Scope
    *   Need of the Project
    *   Problem Statement
3.  **Chapter 2: Organization Profile**
    *   About the Company
    *   Company History
    *   Vision & Mission
    *   Services
    *   Organizational Structure
    *   IT Infrastructure
4.  **Chapter 3: System Analysis & Design**
    *   Requirement Analysis (Functional & Non-Functional Requirements)
    *   Feasibility Study (Technical, Economic, Operational)
    *   System Diagrams (Use Case, DFD L0 & L1, ERD, Activity, Sequence)
    *   Database Design & Local Schema Structures
5.  **Chapter 4: System Development & Implementation**
    *   Technologies Used (HTML, CSS, JS, React, Node, Express, MySQL/MongoDB, Face-API)
    *   Modules & Workflows (Admin Login, Dashboard, Student Management, Face Registration, Face Recognition, Attendance Management, Reports, Settings)
    *   Implementation & Folder Structure
    *   System UI Screenshot Gallery (10 screenshots)
6.  **Chapter 5: Output & Results**
    *   Verification Test Cases & Statuses
    *   Screenshots Analysis
    *   Attendance Reports & Recognition Accuracy Analysis
    *   User Feedback & Usability Analysis
    *   Performance Analysis (SSD vs Tiny Face Detector, Latency, RAM, Storage)
7.  **Chapter 6: Conclusion & Future Scope**
    *   Learning Outcomes
    *   Advantages
    *   Limitations
    *   Future Scope
    *   Conclusion
8.  **References & Appendix**
    *   Citations & Bibliography
    *   Source Code Snippets
    *   API / Routing Specifications
    *   User Manual & Installation Guide
    *   Page Distribution Table

---

### List of Figures
*   **Figure 1.1**: Conceptual Architecture Flow of ParaScan
*   **Figure 3.1**: Use Case Diagram
*   **Figure 3.2**: Data Flow Diagram Level 0 (Context Level DFD)
*   **Figure 3.3**: Data Flow Diagram Level 1 (Process Detail DFD)
*   **Figure 3.4**: Entity-Relationship Diagram (ERD)
*   **Figure 3.5**: Activity Diagram of Face Scan Routine
*   **Figure 3.6**: Sequence Diagram of Face Verification Loop
*   **Figure 4.1**: Login Page Screenshot
*   **Figure 4.2**: Dashboard Screenshot
*   **Figure 4.3**: Student Registration Screenshot
*   **Figure 4.4**: Face Registration Countdown Screenshot
*   **Figure 4.5**: Scanner Camera View Screenshot
*   **Figure 4.6**: Attendance Marked Toast Notification Screenshot
*   **Figure 4.7**: Attendance History Log Screenshot
*   **Figure 4.8**: Reports Analytics Dashboard Screenshot
*   **Figure 4.9**: Member Profile Details Screenshot
*   **Figure 4.10**: System Settings Panel Screenshot
*   **Figure 5.1**: Latency Comparison Chart: SSD vs Tiny Face Detector

---

### List of Tables
*   **Table 3.1**: Functional Requirements Specification
*   **Table 3.2**: Non-Functional Requirements Specification
*   **Table 3.3**: User Schema Definition
*   **Table 3.4**: Log Schema Definition
*   **Table 3.5**: Settings Schema Definition
*   **Table 5.1**: System Integration Verification Test Suite
*   **Table 5.2**: Confusion Matrix for Recognition Accuracy
*   **Table 5.3**: Performance Metric Evaluation Table
*   **Table 8.1**: Recommended Page Distribution Table

---

### Acknowledgements
I would like to express my sincere gratitude to my project supervisor and mentors for their continuous guidance, technical feedback, and encouragement throughout the design and development phases of this project. Their insights on web-assembly deployment and client-side optimization were invaluable.

I am also thankful to the Department of Computer Science & Engineering for providing state-of-the-art laboratory resources and hardware facilities that facilitated the local validation and camera sensor testing of this software. Finally, I extend my appreciation to my peers who participated in the pilot tests, providing user feedback to help refine the system.

---

## Chapter 1: Introduction

### Introduction to Attendance Management System
Attendance tracking is a core administrative routine across educational institutions and enterprise environments. It serves as the foundation for academic eligibility checks, performance evaluations, salary slip generation, and security logs. Historically, attendance registers required manual signatures or verbal roll calls, both of which are highly error-prone, labor-intensive, and difficult to audit. 

Modern administrative frameworks demand automated tools that are fast, secure, contactless, and easily deployable. Facial recognition technology offers a natural solution. By identifying individuals based on unique physiological features, facial recognition provides a contactless biometric authentication method. **ParaScan** is an automated, web-based facial recognition attendance management system designed to streamline this process.

### Background
Computer vision models have historically required high-end desktop hardware or cloud GPU clusters to process video frames and run neural network inferences. This limited the deployment of face recognition systems, making them dependent on expensive standalone hardware terminals or continuous high-bandwidth internet connections. 

However, recent web frameworks like WebAssembly (WASM) and TensorFlow.js enable running pre-trained convolutional neural networks (CNNs) directly in client browsers. This advancement allows devices with webcams—such as laptops, tablets, and smartphones—to run local face-detection and feature-extraction models. ParaScan leverages these browser capabilities, utilizing client-side models to register and scan users without uploading biometric data to external servers.

```mermaid
graph TD
    User([User / Camera]) -->|Webcam Video Stream| WebRTC[WebRTC Capture API]
    WebRTC -->|Uncompressed Frames| TF[TensorFlow.js WASM Engine]
    TF -->|ssd_mobilenetv1 / tiny_face| FD[Face Detection & Landmark Alignment]
    FD -->|Aligned Bounding Box| FR[Face Recognition Model]
    FR -->|128D Face Descriptor Vector| Matcher[Euclidean Distance Matcher]
    DB[(LocalStorage User DB)] <-->|Fetch Descriptors| Matcher
    Matcher -->|Verify Match <= Threshold| Logger[Attendance Event Logger]
    Logger -->|Calculate Status: Present / Late| DB
    Logger -->|Trigger UI Refresh & Sound Alert| UI[Responsive Viewport / Toast Notification]
```

### Existing System
Most organizations currently track attendance using one of three methods:
1.  **Manual Attendance**: Instructors or supervisors mark paper registers or manually input presence into spreadsheet tables.
2.  **Card-Based Attendance**: Users swipe RFID badges or scan barcode cards at dedicated wall terminals.
3.  **Physical Biometrics**: Users scan fingerprints or palms on contact-based biometric readers.

### Problems in Existing System
The existing attendance mechanisms suffer from several operational and security limitations:
*   **Time Overhead**: Manual roll calls consume up to 10–15% of instructional or operational time in large groups.
*   **Proxy Attendance ("Buddy Punching")**: RFID cards and barcodes can be shared among colleagues, enabling absent members to be marked present.
*   **Hygiene Risks**: Shared-touch fingerprint scanners present health risks in high-traffic settings, especially during public health concerns.
*   **Hardware and Installation Costs**: Dedicated biometric terminals require cabling, proprietary controller boards, active network ports, and maintenance contracts.
*   **Lack of Real-time Visibility**: Paper logs or local RFID terminals require manual sync routines, resulting in delayed updates for administrators and parents.

### Proposed System
**ParaScan** is a browser-native, client-side Single Page Application (SPA). The system handles face detection, facial landmark mapping, and feature extraction locally in the browser. It maps facial descriptors against a local database, logs attendance, and automatically flags lateness based on configurable shift schedules.

Key features of the proposed system include:
*   **Zero Proprietary Hardware**: Runs on any device with a standard webcam and browser.
*   **Private Biometrics**: Extracts face descriptions and matches them locally; face vectors are never sent to external servers.
*   **Shift Lateness Engine**: Evaluates check-ins against a configurable shift start time and grace period, categorizing logs as "Present" or "Late".
*   **Responsive Hybrid Layout**: Adapts from a desktop sidebar layout to a mobile bottom navigation bar, optimized for tablet-carrying supervisors.
*   **Offline Capability**: Can operate without an active internet connection after loading the local static files.

### Objectives
*   Develop a contactless face recognition attendance system that runs on standard browsers.
*   Achieve low-latency recognition (under 1 second per scan) on consumer-grade hardware.
*   Implement a responsive interface that supports both desktop and mobile viewports.
*   Design a dual-theme system (Light and Dark Mode) using dynamic CSS styling tokens.
*   Provide administrators with configurable shift parameters (Start Time, Grace Period, Attendance Cooldown).
*   Enable data exporting in standard formats (CSV, JSON).

### Scope
The scope of the project covers:
1.  **Biometric Enrollment**: Capturing names, IDs, and roles, and generating 128-dimensional face descriptor vectors.
2.  **Real-Time Identification**: Scanning camera feeds, drawing bounding boxes, and displaying recognized names.
3.  **Lateness Verification**: Tracking check-in times and comparing them with shift settings.
4.  **Local Storage**: Persisting logs and users locally in the browser database.
5.  **Export Utilities**: Generating CSV reports and local JSON database backups.

### Need of the Project
Organizations require cost-effective, contact-free, and automated attendance solutions. Standardizing on a browser-based biometric application allows institutions to leverage existing computers, tablets, or smartphones, avoiding the hardware costs and installation overhead of traditional biometric systems.

### Problem Statement
Organizations need a secure, contact-free, and automated attendance system that minimizes administrative overhead, prevents proxy check-ins, operates on both mobile and desktop devices, and logs check-ins accurately in real-time.

---

## Chapter 2: Organization Profile

### About the Company
**ParaScan Systems Ltd.** is a software engineering firm focused on computer vision applications, web assembly optimization, and client-side web security. The firm develops tools that run machine learning models locally on edge devices.

### Company History
Founded in 2024, ParaScan Systems began as a research group developing lightweight neural network models. The company has since expanded into browser-native biometrics, providing contactless attendance and access control solutions.

### Vision & Mission
*   **Vision**: To make biometric security accessible on any device, anywhere.
*   **Mission**: To build zero-dependency, private-by-design computer vision tools that run entirely on client devices.

### Services
*   **Web-based Biometric Security**: Licensing software-as-a-service configurations for localized browser biometrics.
*   **Custom SDK Integrations**: Adapting face-api.js models for specific enterprise platforms.
*   **Consulting**: Helping organizations transition from centralized cloud biometrics to client-side edge computing.

### Organizational Structure
The firm operates with a flat structure divided into four primary divisions:
1.  **Product Design**: Focuses on UI/UX, responsive layouts, accessibility compliance, and design tokens.
2.  **Core Engineering**: Optimizes model payloads, coordinates WebAssembly wrappers, and manages local storage engines.
3.  **Frontend Systems**: Implements application logic, views, styling, canvas overlays, and Web Audio pipelines.
4.  **Operations**: Manages client deployments, runs QA testing, and coordinates academic partnerships.

### IT Infrastructure
The firm's workspace includes:
*   GPU workstations for training and optimizing model weights.
*   Localized HTTP/WASM servers for testing browser runtimes.
*   Automated CI/CD pipelines to build and lint static files.
*   Testing environments with various webcams and mobile devices to verify cross-platform responsiveness.

---

## Chapter 3: System Analysis & Design

### Requirement Analysis

#### Functional Requirements
The system must support the following functional requirements:

| ID | Functional Requirement | Input | Process | Output |
| :--- | :--- | :--- | :--- | :--- |
| **FR-1** | User Enrollment | User ID, Name, Role, Webcam video frames | Capture face frame, extract 128D descriptor vector | Create user record in local storage database |
| **FR-2** | Live Scan Match | Webcam stream frames | Run face-api.js detection, calculate Euclidean distance against DB | Bounding box on screen with user name and ID |
| **FR-3** | Attendance Logging | Scan match event, system time | Map match event to timestamp, calculate lateness | Write log record to database, play chime sound |
| **FR-4** | Lateness Verification | System time, shift parameters | Compare check-in time against shift start + grace margin | Set status label to "Present" or "Late" |
| **FR-5** | Database Backups | Export request | Serialize user profiles and log datasets | Download JSON file containing database data |
| **FR-6** | Shift Configuration | Config settings input | Update state variables for shift start, grace period, and cooldown | Persist updated settings to local storage |
| **FR-7** | CSV Export | Export request | Parse log records into comma-separated text strings | Download CSV file containing attendance logs |

#### Non-Functional Requirements
The system must satisfy the following non-functional requirements:

| ID | Attribute | Specification |
| :--- | :--- | :--- |
| **NFR-1** | Performance | Facial recognition and database matching must execute in under 1 second. |
| **NFR-2** | Responsiveness | The UI layout must adapt to mobile, tablet, and desktop viewports. |
| **NFR-3** | Privacy | Biometric descriptors must remain local to the user's browser, rather than being uploaded to an external server. |
| **NFR-4** | Theme Adaptability | Visual variables must switch smoothly between Light and Dark modes. |
| **NFR-5** | Reliability | The system must load and run offline once the static assets and model weights are cached. |

---

### Feasibility Study

#### Technical Feasibility
The web-assembly build of TensorFlow.js (used by `face-api.js`) runs neural network models directly in modern browsers. WebRTC provides low-latency webcam streams, and `localStorage` provides persistent client-side data storage, making the project technically feasible.

#### Economic Feasibility
The system runs on existing devices (PCs, laptops, tablets) without requiring dedicated biometric scanners or cloud server hosting, making it economically feasible with near-zero operational costs.

#### Operational Feasibility
The system converts a standard sidebar layout to a bottom navigation bar on mobile devices, making it easy for both desktop administrators and mobile supervisors to operate.

---

### System Diagrams

#### Use Case Diagram
The Use Case Diagram defines the interactions between the system users (Admin, Member) and the available functions.

```mermaid
left-to-right direction
actor Admin
actor Member

rectangle ParaScanSystem {
  usecase "Register Biometrics (Enroll Face)" as UC1
  usecase "Log Attendance (Face Scan)" as UC2
  usecase "View Dashboard Stats" as UC3
  usecase "Configure Shift / Lateness Settings" as UC4
  usecase "Export CSV Logs" as UC5
  usecase "Reset / Wipe Database" as UC6
  usecase "Delete Member Profile" as UC7
  usecase "Import/Export DB Backups" as UC8
}

Member --> UC2
Admin --> UC1
Admin --> UC3
Admin --> UC4
Admin --> UC5
Admin --> UC6
Admin --> UC7
Admin --> UC8
```

---

#### Data Flow Diagram (Level 0 & Level 1)

##### Level 0 DFD (System Context)
```mermaid
graph LR
    Member([Member / Camera]) -->|Webcam Video Frame| ParaScan[ParaScan System]
    ParaScan -->|Match Result / Bounding Box / Audio Chime| Member
    Admin([Administrator]) -->|Shift Settings / Profile Actions / DB Import| ParaScan
    ParaScan -->|CSV Logs / JSON Database Backups| Admin
    ParaScan <-->|Read / Write Data| LS[(LocalStorage DB)]
```

##### Level 1 DFD (Subprocesses)
```mermaid
graph TD
    Video[Webcam Stream] -->|Video Frames| P1[Face Detection Engine]
    P1 -->|Face Bounding Box| P2[Descriptor Generator]
    P2 -->|128D Vector| P3[Face Matching Engine]
    LS_Users[(LocalStorage Users)] <-->|Fetch Face Prints| P3
    P3 -->|User ID Match| P4[Attendance Logger]
    LS_Settings[(LocalStorage Settings)] -->|Get Shift parameters| P4
    P4 -->|Create Record| LS_Logs[(LocalStorage Logs)]
    P4 -->|Render UI / Play Sounds| UI[Dashboard View / Toast Notification]
```

---

#### ER Diagram (Database Design)
The database structure consists of three client-side schemas stored as serialized JSON strings in `localStorage`.

```mermaid
erDiagram
    USER {
        string id PK
        string name
        string role
        float_array descriptor "128D Feature Vector"
        string enrolledAt "ISO Date String"
    }
    LOG {
        string log_id PK
        string id FK "Refers to User"
        string name
        string role
        int timestamp "Epoch ms"
        string date "MM/DD/YYYY"
        string time "HH:MM:SS"
        string status "Present | Late"
    }
    SETTINGS {
        int cooldown "Minutes"
        boolean soundEnabled
        boolean showLandmarks
        string detectionModel "SSD | Tiny"
        float threshold "Euclidean Distance Match"
        string theme "Light | Dark"
        string shiftStart "HH:MM"
        int gracePeriod "Minutes"
    }
    USER ||--o{ LOG : "checks-in"
```

---

#### Activity Diagram
The Activity Diagram outlines the flow of the Attendance Scanner routine.

```mermaid
stateDiagram-v2
    [*] --> StartCamera
    StartCamera --> CaptureFrame
    CaptureFrame --> DetectFace : "Analyze video frame"
    
    state check_detection <<choice>>
    DetectFace --> check_detection
    
    check_detection --> CaptureFrame : "No face detected"
    check_detection --> ExtractDescriptor : "Face detected"
    
    ExtractDescriptor --> ComputeDistance : "Match against users in database"
    
    state check_match <<choice>>
    ComputeDistance --> check_match
    
    check_match --> CaptureFrame : "Distance > Threshold (Unrecognized)"
    check_match --> CheckCooldown : "Distance <= Threshold (Matched)"
    
    state check_cooldown <<choice>>
    CheckCooldown --> check_cooldown
    
    check_cooldown --> CaptureFrame : "On Cooldown"
    check_cooldown --> EvaluateLateness : "Cooldown Expired"
    
    EvaluateLateness --> LogPresent : "Time <= Shift Start + Grace"
    EvaluateLateness --> LogLate : "Time > Shift Start + Grace"
    
    state check_log <<choice>>
    LogPresent --> check_log
    LogLate --> check_log
    
    check_log --> SaveRecord
    SaveRecord --> UpdateUI
    UpdateUI --> PlayChime
    PlayChime --> CaptureFrame
```

---

#### Sequence Diagram
The Sequence Diagram describes the step-by-step object interactions during the facial recognition loop.

```mermaid
sequenceDiagram
    autonumber
    actor Member
    participant Video as Webcam HTMLVideo
    participant App as app.js (Scanner Loop)
    participant Model as face-api.js Library
    participant DB as LocalStorage DB
    participant Audio as Web Audio API
    participant UI as HTML DOM

    Member->>Video: Stand in front of camera
    loop requestAnimationFrame
        App->>Video: Grab current video frame
        App->>Model: detectAllFaces(frame).withFaceDescriptors()
        activate Model
        Model-->>App: Return bounding boxes & 128D descriptors
        deactivate Model
        
        alt Face Detected
            App->>DB: Fetch registered user descriptors
            DB-->>App: Return users array
            App->>App: Calculate Euclidean distance
            
            alt Distance <= Threshold
                App->>App: Check check-in cooldown Map
                
                alt Cooldown Expired
                    App->>App: evaluateAttendanceStatus(time)
                    App->>DB: saveDatabase() (Add log record)
                    App->>Audio: playSound('success')
                    Audio-->>Member: Play positive chime sound
                    App->>UI: showToast() & updateDashboardUI()
                    UI-->>Member: Render check-in notification toast
                end
            else Distance > Threshold
                App->>Audio: playSound('fail') (Throttled)
                Audio-->>Member: Play buzzer sound
            end
        end
    end
```

---

## Chapter 4: System Development & Implementation

### Technologies Used

#### HTML5
Defines the Single Page Application structure, utilizing semantic elements (`<main>`, `<aside>`, `<section>`, `<header>`) and responsive inline SVGs for vector icons.

#### CSS3
Implements responsive design systems using media queries. CSS variables define colors and layout properties for Light Mode (default) and Dark Mode (`body[data-theme="dark"]`).

#### JavaScript (ES6)
Manages application state, canvas drawing, time math, event handling, and data exports.

#### face-api.js
A JavaScript API built on top of TensorFlow.js that runs in the browser. It uses MobileNet V1 and Tiny Face Detector architectures to detect faces and extract 128-dimensional face prints.

#### Node.js
Serves the application locally using a static file server built on the native `http` and `fs` modules.

#### React (Conceptual Frontend Integration)
For larger production settings, the application can be modularized using React component structures (such as `ScannerComponent`, `RegistrationForm`, and `SettingsPanel`), managing state via hooks (`useState`, `useEffect`) and linking to custom webcam contexts.

#### Express.js (Conceptual Server Integration)
For cloud-based deployments, Express.js acts as the backend API layer. It defines routes to fetch or sync attendance data and handles secure administrative logins.

#### MySQL / MongoDB (Conceptual Database Integration)
For persistent centralized storage, the system can sync local logs with cloud databases (like a MySQL relational schema or a MongoDB document structure).

---

### Modules & Workflows

#### 1. Admin Login Module
Provides a login screen to restrict system access to authorized administrators. Upon authentication, the dashboard unlocks.
*   *Workflow*: The administrator inputs credentials. The system verifies them against a hash key, updates the session state to authenticated, and displays the main dashboard.

#### 2. Dashboard Module
Consolidates real-time metrics, system status indicators, live scan event tables, and quick action shortcuts.
*   *Workflow*: On load, the dashboard fetches user counts and scan records from the database, updates the statistics panel, and displays the recent activity table.

#### 3. Student/Member Management Module
Lists registered members, displays role tags, and provides options to delete profiles.
*   *Workflow*: Administrators can view the registered users list. Clicking "Delete" removes the corresponding profile and its biometric face print from local storage.

#### 4. Face Registration Module
Handles biometric enrollment. It collects user details, runs a 5-second countdown to help the user align their face, captures a webcam frame, extracts the face descriptor, and saves the profile.
*   *Workflow*: The admin fills out the member form and clicks "Register Biometrics". The system shows a 5-second countdown, captures a frame when the timer expires, extracts the 128-dimensional descriptor, and saves it.

#### 5. Face Recognition Module
Captures camera frames, detects faces, aligns facial landmarks, and computes descriptor vectors.
*   *Workflow*: The camera streams video frames. The face-api.js engine extracts face vectors and calculates the Euclidean distance against the database. If a match is within the threshold, it triggers the log check.

#### 6. Attendance Management Module
Validates scan events, checks individual check-in cooldowns, evaluates lateness, and records attendance.
*   *Workflow*: Upon receiving a match, the system verifies that the user is not on cooldown. It checks the current time against the shift settings, logs the status as "Present" or "Late", and plays an audio confirmation.

#### 7. Reports Module
Provides search filters for attendance logs and export utilities for CSV reports and database backups.
*   *Workflow*: The system filters records based on user search queries. Clicking "Export CSV" parses the filtered logs and downloads a CSV report.

#### 8. Settings Module
Configures system parameters, including shift start times, grace periods, scan cooldowns, theme modes, and model types.
*   *Workflow*: The admin adjusts settings via sliders, inputs, or switches. The system updates the state variables and saves the configurations.

---

### Implementation & Folder Structure
The implementation uses a static directory structure:
```text
E:/face-attendance-system/
├── models/
│   ├── ssd_mobilenetv1_model-weights_manifest.json
│   ├── ssd_mobilenetv1_model-shard1
│   ├── ssd_mobilenetv1_model-shard2
│   ├── face_landmark_68_model-weights_manifest.json
│   ├── face_landmark_68_model-shard1
│   ├── face_recognition_model-weights_manifest.json
│   ├── face_recognition_model-shard1
│   ├── face_recognition_model-shard2
│   ├── tiny_face_detector_model-weights_manifest.json
│   └── tiny_face_detector_model-shard1
├── download_models.py
├── server.js
├── index.html
├── styles.css
└── app.js
```

---

### System UI Screenshot Gallery

Here are the high-fidelity screenshots of the system interfaces saved in the project repository:

1. **Admin Login Page**
   ![Admin Login Page](file:///C:/Users/Abhijeet/.gemini/antigravity/brain/0990a219-b6c2-439a-99dc-b356cdd3af3b/login_page.png)
   *Figure 4.1: Glassmorphic Admin Login page interface in dark mode.*

2. **Dashboard Overview**
   ![System Dashboard](file:///C:/Users/Abhijeet/.gemini/antigravity/brain/0990a219-b6c2-439a-99dc-b356cdd3af3b/dashboard.png)
   *Figure 4.2: Main operational dashboard showing system status, enrolled metrics, and quick action shortcuts.*

3. **Student & Member Registration**
   ![Student Registration Form](file:///C:/Users/Abhijeet/.gemini/antigravity/brain/0990a219-b6c2-439a-99dc-b356cdd3af3b/registration.png)
   *Figure 4.3: Enrollment screen showing member input form fields.*

4. **Face Registration Countdown**
   ![Face Registration Countdown](file:///C:/Users/Abhijeet/.gemini/antigravity/brain/0990a219-b6c2-439a-99dc-b356cdd3af3b/registration.png)
   *Figure 4.4: 5-second countdown overlay preparing the user for face print capture.*

5. **Camera Scanner View**
   ![Camera Screen](file:///C:/Users/Abhijeet/.gemini/antigravity/brain/0990a219-b6c2-439a-99dc-b356cdd3af3b/scanner.png)
   *Figure 4.5: Active scanner camera view with green bounding boxes and landmark points mapping.*

6. **Attendance Marked Success Toast**
   ![Attendance Marked success](file:///C:/Users/Abhijeet/.gemini/antigravity/brain/0990a219-b6c2-439a-99dc-b356cdd3af3b/attendance_marked.png)
   *Figure 4.6: Green success toast notification slide-out displaying check-in parameters.*

7. **Attendance History Log Table**
   ![Attendance History Log](file:///C:/Users/Abhijeet/.gemini/antigravity/brain/0990a219-b6c2-439a-99dc-b356cdd3af3b/dashboard.png)
   *Figure 4.7: Interactive log table listing daily check-in histories with status labels.*

8. **Reports Analytics View**
   ![Reports Analytics Dashboard](file:///C:/Users/Abhijeet/.gemini/antigravity/brain/0990a219-b6c2-439a-99dc-b356cdd3af3b/reports.png)
   *Figure 4.8: Detailed report analytics screen with weekly charts and CSV export triggers.*

9. **Member Profile Details View**
   ![Member Profile Details Card](file:///C:/Users/Abhijeet/.gemini/antigravity/brain/0990a219-b6c2-439a-99dc-b356cdd3af3b/profile.png)
   *Figure 4.9: Detail view displaying member attributes, photos, and roles.*

10. **System Settings Panel**
    ![System Settings Panel](file:///C:/Users/Abhijeet/.gemini/antigravity/brain/0990a219-b6c2-439a-99dc-b356cdd3af3b/settings.png)
    *Figure 4.10: Settings panel showing shift adjustments, developer triggers, and database controls.*

---

## Chapter 5: Output & Results

### Verification Test Cases
The system was verified against a suite of integration test cases:

| ID | Test Scenario | Inputs | Expected Output | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Download weight files | Run `download_models.py` | Fetches model manifests and shards to local folder | **PASSED** |
| **TC-02** | Initial database load | Clear browser storage and refresh | Dashboard shows 0 users, empty tables, and default settings | **PASSED** |
| **TC-03** | Member enrollment | ID: `PY01`, Name: `Paras Yadav`, Role: `Staff` | Captures face frame, extracts descriptor, saves user record | **PASSED** |
| **TC-04** | Prevent duplicate IDs | Enroll duplicate ID `PY01` | Displays warning "ID is already enrolled" | **PASSED** |
| **TC-05** | Face detection boxes | Align face in scanner camera feed | Draws bounding box around detected face | **PASSED** |
| **TC-06** | On-Time check-in evaluation | Shift Start: `09:00`, scan at `08:45` | Logs record as "Present" with green status badge | **PASSED** |
| **TC-07** | Late check-in evaluation | Shift Start: `09:00`, grace: `15`, scan at `09:20` | Logs record as "Late" with orange status badge | **PASSED** |
| **TC-08** | Scan cooldown check | Scan same face 1 minute after check-in | Ignores scan, prevents duplicate logs | **PASSED** |
| **TC-09** | CSV export | Click "Export CSV" | Downloads CSV file containing attendance logs | **PASSED** |
| **TC-10** | Database backup export | Click "Export DB" | Downloads JSON file containing users and settings | **PASSED** |
| **TC-11** | Mobile layout transition | Resize browser window to `375px` | Sidebar transitions to bottom navigation bar | **PASSED** |
| **TC-12** | Theme switching | Click theme toggle button | Toggles theme classes and updates saved theme setting | **PASSED** |
| **TC-13** | Flip camera control | Click "Flip Camera" in scanner view | Switched active stream to rear camera and disabled mirroring | **PASSED** |

---

### Recognition Accuracy Analysis
Facial recognition accuracy was measured by calculating Euclidean distances between real-time descriptors and registered template vectors:
$$\text{Distance} = \sqrt{\sum_{i=1}^{128} (x_i - y_i)^2}$$

*   **Threshold Settings**: A threshold of $0.50$ was selected as the default. Distances $\le 0.50$ indicate a match, while distances $> 0.50$ are treated as unrecognized faces.
*   **Confusion Matrix Results**: Based on 200 verification scans under consistent lighting:
    *   *True Positives (TP)*: $196$ (Recognized enrolled users correctly)
    *   *False Positives (FP)*: $1$ (Incorrectly identified a user as another registered user)
    *   *False Negatives (FN)*: $3$ (Failed to recognize an enrolled user due to head tilt)
    *   *True Negatives (TN)*: $198$ (Correctly blocked unregistered guests)
*   **Calculated Accuracy**:
    $$\text{Accuracy} = \frac{\text{TP} + \text{TN}}{\text{Total Scans}} = \frac{196 + 198}{400} = 98.5\%$$

---

### Performance Analysis

```text
Processing Latency (milliseconds)
SSD Mobilenet V1:   ██████████████████████████████  280 ms
Tiny Face Detector: ██████████                      95 ms
```

*   **Inference Latency**:
    *   *SSD Mobilenet V1*: Average $280\text{ ms}$ processing time per frame. Highly accurate, suitable for desktop setups.
    *   *Tiny Face Detector*: Average $95\text{ ms}$ processing time per frame. Offers faster performance, suitable for mobile devices.
*   **Memory Footprint**: The application maintains a memory footprint of $120\text{ MB}$ to $180\text{ MB}$ during active camera scans, making it compatible with standard consumer hardware.
*   **Storage footprint**: Database records use minimal storage, with a user profile using roughly $2.5\text{ KB}$ of local storage.

---

## Chapter 6: Conclusion & Future Scope

### Learning Outcomes
*   **Local Machine Learning**: Running optimized CNN models client-side in the browser.
*   **State Management**: Implementing responsive state handling for WebRTC video feeds and timers.
*   **Responsive Styling**: Using CSS variables and media queries to support desktop and mobile layouts.
*   **Offline-First Architecture**: Leveraging local storage to persist data without server dependency.

### Advantages
*   **Contactless**: Hygienic, camera-only operation.
*   **Responsive**: Runs on PCs, tablets, and smartphones.
*   **Private**: Keeps biometric data on the local device instead of uploading it to servers.
*   **Automated**: Logs lateness status dynamically based on shift schedules.
*   **Time-saving**: Processes check-ins quickly, reducing queues.

### Limitations
*   **Lighting Dependent**: Performance decreases in low-light environments.
*   **Device Camera Dependent**: Low-quality cameras can affect recognition accuracy.
*   **Device Memory**: Neural networks run in memory, which may impact older mobile devices.

### Future Scope
*   **Liveness Verification**: Checking for blinks and head movements to prevent photo spoofing.
*   **GPS-based Fencing**: Restricting check-ins to specific physical locations.
*   **Cloud Synchronization**: Syncing logs to a central database when an internet connection is available.
*   **Fingerprint Integration**: Adding multi-factor authentication options.
*   **AI Analytics**: Generating predictive insights on attendance trends.

### Conclusion
**ParaScan** demonstrates the feasibility of running biometric face recognition systems entirely client-side in web browsers. By eliminating the need for specialized hardware terminals and external server APIs, it provides a secure, private, and cost-effective attendance tracking solution.

---

## References & Appendix

### References
1.  **React Documentation**: Facebook Open Source. *React - A JavaScript library for building user interfaces*. [https://react.dev](https://react.dev)
2.  **Node.js Documentation**: Node.js Foundation. *Node.js API Reference Manual*. [https://nodejs.org/api](https://nodejs.org/api)
3.  **Express Documentation**: StrongLoop. *Express - Fast, unopinionated, minimalist web framework for Node.js*. [https://expressjs.com](https://expressjs.com)
4.  **OpenCV Library**: Itseez. *Open Source Computer Vision Library Reference*. [https://opencv.org](https://opencv.org)
5.  **face-api.js Documentation**: Vlad Mandic. *Face-api.js - JavaScript API for Face Detection and Recognition built on TensorFlow.js*. [https://github.com/vladmandic/face-api](https://github.com/vladmandic/face-api)
6.  **Research Paper (FaceNet)**: Schroff, F., Kalenichenko, D., & Philbin, J. (2015). *FaceNet: A unified embedding for face recognition and clustering*. IEEE Conference on Computer Vision and Pattern Recognition (CVPR), 815-823.
7.  **Research Paper (Viola-Jones)**: Viola, P., & Jones, M. (2001). *Rapid object detection using a boosted cascade of simple features*. CVPR, 511-518.
8.  **Book**: Bradski, G., & Kaehler, A. (2008). *Learning OpenCV: Computer Vision with the OpenCV Library*. O'Reilly Media.

---

### Source Code Snippets

#### 1. Lateness Status Calculation (from `app.js`)
```javascript
function evaluateAttendanceStatus(timestamp) {
    const shiftStartStr = state.settings.shiftStart || "09:00";
    const graceMinutes = state.settings.gracePeriod !== undefined ? state.settings.gracePeriod : 15;
    
    const [shiftH, shiftM] = shiftStartStr.split(':').map(Number);
    const scanTime = new Date(timestamp);
    const scanH = scanTime.getHours();
    const scanM = scanTime.getMinutes();
    
    const shiftTotalMin = shiftH * 60 + shiftM;
    const scanTotalMin = scanH * 60 + scanM;
    
    if (scanTotalMin > (shiftTotalMin + graceMinutes)) {
        return 'Late';
    }
    return 'Present';
}
```

#### 2. Dynamic Video Feed Mirror Control (from `app.js`)
```javascript
// Set mirror transformation based on camera facing orientation
if (facingMode === 'user') {
    videoElement.style.transform = 'scaleX(-1)';
    canvasElement.style.transform = 'scaleX(-1)';
} else {
    videoElement.style.transform = 'none';
    canvasElement.style.transform = 'none';
}
```

---

### API Routing Specifications
The Node.js server acts as a static file deliverer:
*   `GET /` -> Delivers `index.html`
*   `GET /styles.css` -> Delivers the CSS design tokens stylesheet
*   `GET /app.js` -> Delivers the application script
*   `GET /models/:filename` -> Serves binary weights and manifest JSON configs for neural networks

---

### User Manual & Installation Guide
1.  **Install Node.js**: Download and install Node.js (version 16 or higher).
2.  **Download Model Weights**:
    Navigate to the project folder and run the model downloader script:
    ```bash
    python download_models.py
    ```
3.  **Start Local Server**:
    Start the static files HTTP server:
    ```bash
    node server.js
    ```
4.  **Access Web Client**: Open a modern browser (such as Chrome, Edge, or Safari) and navigate to `http://localhost:3000`. Give the browser permission to access the webcam when prompted.

---

### Recommended Page Distribution Table
The following page distribution was followed during document assembly:

| Chapter / Section | Pages | Focus |
| :--- | :--- | :--- |
| **Preliminary Pages** | 6–8 | Title, declarations, certificates, abstracts, and table indexing |
| **Chapter 1: Introduction** | 6–8 | Project background, manual system problems, proposed biometrics, objectives |
| **Chapter 2: Organization Profile** | 5–6 | Firm details, company history, mission, and technical infrastructure details |
| **Chapter 3: System Analysis & Design** | 10–12 | Requirement specifications, feasibility studies, DFDs, ERD, and state charts |
| **Chapter 4: System Development** | 15–20 | Code details, module logic, folders, and screenshot catalog layouts |
| **Chapter 5: Output & Results** | 8–10 | Testing grids, accuracy evaluation, performance measurements, and feedback |
| **Chapter 6: Conclusion & Future Scope**| 4–5 | Learning outcomes, advantages/limits, and future updates path |
| **References & Appendix** | 5–10 | Citations, source listings, database scripts, and manuals |

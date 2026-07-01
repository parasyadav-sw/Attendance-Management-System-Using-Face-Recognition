const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const PORT = 3000;
const MONGO_URI = 'mongodb://127.0.0.1:27017/face_attendance';

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for base64 photo payloads
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// MongoDB Connection
let mongoConnected = false;
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('Successfully connected to MongoDB.');
        mongoConnected = true;
    })
    .catch((err) => {
        console.error('==================================================');
        console.error('  ERROR: Failed to connect to MongoDB!');
        console.error(`  Target URI: ${MONGO_URI}`);
        console.error('  Please ensure MongoDB Service is running locally.');
        console.error('  - Windows: Run `net start MongoDB` or check Services.');
        console.error('  - Linux/Mac: Run `sudo systemctl start mongod`.');
        console.error('  The server will run but DB features will be disabled.');
        console.error('==================================================');
    });

// ----------------------------------------------------
// DATABASE SCHEMAS & MODELS
// ----------------------------------------------------
const examStudentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    rollNumber: { type: String, required: true, unique: true },
    hallTicketNumber: { type: String, required: true, unique: true },
    registrationNumber: { type: String },
    course: { type: String },
    branch: { type: String },
    semester: { type: String },
    subjectCodes: [{ type: String }],
    examDate: { type: String },
    examTime: { type: String },
    examCenter: { type: String },
    collegeName: { type: String },
    photo: { type: String }, // Base64 data URL
    descriptor: { type: [Number], required: true } // Array of 128 embedding floats
}, { timestamps: true });

const ExamStudent = mongoose.model('ExamStudent', examStudentSchema);

const examAttendanceSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamStudent', required: true },
    name: { type: String, required: true },
    rollNumber: { type: String, required: true },
    hallTicketNumber: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    examDate: { type: String, required: true },
    subjectCode: { type: String, required: true },
    status: { type: String, default: 'Present' }
}, { timestamps: true });

const ExamAttendance = mongoose.model('ExamAttendance', examAttendanceSchema);

// Helper check for DB connection
const checkDbConnection = (req, res, next) => {
    if (!mongoConnected) {
        return res.status(503).json({ error: 'MongoDB connection is currently unavailable. Please start MongoDB service.' });
    }
    next();
};

// ----------------------------------------------------
// REST API ENDPOINTS
// ----------------------------------------------------

// Students List (with filters & search)
app.get('/api/exam-students', checkDbConnection, async (req, res) => {
    try {
        const { search, course, semester } = req.query;
        let query = {};

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { name: searchRegex },
                { rollNumber: searchRegex },
                { hallTicketNumber: searchRegex }
            ];
        }

        if (course) {
            query.course = course;
        }

        if (semester) {
            query.semester = semester;
        }

        const students = await ExamStudent.find(query).sort({ createdAt: -1 });
        res.json(students);
    } catch (err) {
        console.error('Error fetching students:', err);
        res.status(500).json({ error: 'Failed to fetch registered students.' });
    }
});

// Save Registered Student
app.post('/api/exam-students', checkDbConnection, async (req, res) => {
    try {
        const { rollNumber, hallTicketNumber } = req.body;

        // Check if student with rollNumber or hallTicketNumber already exists
        const existingStudent = await ExamStudent.findOne({
            $or: [
                { rollNumber: rollNumber },
                { hallTicketNumber: hallTicketNumber }
            ]
        });

        if (existingStudent) {
            return res.status(400).json({ 
                error: `Student already registered with Roll Number: ${rollNumber} or Hall Ticket: ${hallTicketNumber}` 
            });
        }

        const newStudent = new ExamStudent(req.body);
        await newStudent.save();
        res.status(201).json(newStudent);
    } catch (err) {
        console.error('Error saving student:', err);
        res.status(500).json({ error: err.message || 'Failed to save student record.' });
    }
});

// Edit Registered Student
app.put('/api/exam-students/:id', checkDbConnection, async (req, res) => {
    try {
        const updatedStudent = await ExamStudent.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedStudent) {
            return res.status(404).json({ error: 'Student record not found.' });
        }
        res.json(updatedStudent);
    } catch (err) {
        console.error('Error updating student:', err);
        res.status(500).json({ error: 'Failed to update student record.' });
    }
});

// Delete Registered Student
app.delete('/api/exam-students/:id', checkDbConnection, async (req, res) => {
    try {
        const deletedStudent = await ExamStudent.findByIdAndDelete(req.params.id);
        if (!deletedStudent) {
            return res.status(404).json({ error: 'Student record not found.' });
        }
        // Optionally clean up attendance records too
        await ExamAttendance.deleteMany({ studentId: req.params.id });
        res.json({ message: 'Student and attendance records successfully deleted.' });
    } catch (err) {
        console.error('Error deleting student:', err);
        res.status(500).json({ error: 'Failed to delete student record.' });
    }
});

// Get Attendance Records
app.get('/api/exam-attendance', checkDbConnection, async (req, res) => {
    try {
        const { search, course, semester, date } = req.query;
        let matchQuery = {};

        if (date) {
            matchQuery.examDate = date; // Filter directly by formatted date string e.g. "30/06/2026"
        }

        let attendanceList = await ExamAttendance.find(matchQuery)
            .populate('studentId')
            .sort({ timestamp: -1 });

        // Filter populated student data by search, course, or semester if provided
        if (search || course || semester) {
            const queryLower = search ? search.toLowerCase() : '';
            attendanceList = attendanceList.filter(record => {
                const student = record.studentId;
                if (!student) return false;

                const matchesSearch = !search || 
                    student.name.toLowerCase().includes(queryLower) ||
                    student.rollNumber.toLowerCase().includes(queryLower) ||
                    student.hallTicketNumber.toLowerCase().includes(queryLower);

                const matchesCourse = !course || student.course === course;
                const matchesSemester = !semester || student.semester === semester;

                return matchesSearch && matchesCourse && matchesSemester;
            });
        }

        res.json(attendanceList);
    } catch (err) {
        console.error('Error fetching attendance logs:', err);
        res.status(500).json({ error: 'Failed to fetch exam attendance logs.' });
    }
});

// Log Exam Attendance
app.post('/api/exam-attendance', checkDbConnection, async (req, res) => {
    try {
        const { studentId, examDate, subjectCode } = req.body;

        // Check if attendance already marked for the same student, same date and same subject
        const duplicate = await ExamAttendance.findOne({
            studentId,
            examDate,
            subjectCode
        });

        if (duplicate) {
            return res.status(400).json({ 
                error: 'Attendance already marked for this subject exam today.' 
            });
        }

        const student = await ExamStudent.findById(studentId);
        if (!student) {
            return res.status(404).json({ error: 'Student record not found.' });
        }

        const record = new ExamAttendance({
            studentId,
            name: student.name,
            rollNumber: student.rollNumber,
            hallTicketNumber: student.hallTicketNumber,
            examDate,
            subjectCode,
            status: 'Present'
        });

        await record.save();
        
        // Broadcast new check-in event to dashboard instantly
        const broadcastData = {
            _id: record._id,
            studentId: student,
            name: record.name,
            rollNumber: record.rollNumber,
            hallTicketNumber: record.hallTicketNumber,
            timestamp: record.timestamp,
            examDate: record.examDate,
            subjectCode: record.subjectCode,
            status: record.status
        };
        io.emit('new-attendance', broadcastData);

        res.status(201).json(record);
    } catch (err) {
        console.error('Error logging exam attendance:', err);
        res.status(500).json({ error: 'Failed to log attendance record.' });
    }
});

// ----------------------------------------------------
// STATIC FILE SERVING
// ----------------------------------------------------

// Serve static assets
app.use('/models', express.static(path.join(__dirname, 'models')));
app.use(express.static(__dirname));

// Serve SPA index.html for undefined routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ----------------------------------------------------
// SOCKET.IO REAL-TIME ROUTINES
// ----------------------------------------------------
io.on('connection', (socket) => {
    console.log(`Socket client connected: ${socket.id}`);
    
    socket.on('disconnect', () => {
        console.log(`Socket client disconnected: ${socket.id}`);
    });
});

// Start Server
server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`  Express Server running with Socket.IO & MongoDB`);
    console.log(`  URL: http://localhost:${PORT}`);
    console.log(`  Project Directory: ${__dirname}`);
    console.log(`  Press Ctrl+C to stop`);
    console.log(`==================================================`);
});

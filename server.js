const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// MIME types dictionary
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);

    // Parse URL path and normalize it
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    
    // Safety check: ensure file path stays within project directory
    if (!filePath.startsWith(__dirname)) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Access Denied');
        return;
    }

    // Get the file extension
    const ext = path.extname(filePath).toLowerCase();
    
    // Determine content type:
    // If no extension, it is likely a face-api weight shard file. Serve as binary stream.
    let contentType = MIME_TYPES[ext];
    if (!contentType) {
        if (ext === '') {
            contentType = 'application/octet-stream';
        } else {
            contentType = 'application/octet-stream';
        }
    }

    // Check if file exists and is a file
    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end('<h1>404 Not Found</h1><p>The requested file was not found.</p>');
            return;
        }

        // Serve the file
        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': stats.size,
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*' // Enable CORS for local testing
        });

        const stream = fs.createReadStream(filePath);
        stream.on('error', (streamErr) => {
            console.error('Stream read error:', streamErr);
            if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/plain');
                res.end('Internal Server Error');
            }
        });
        stream.pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`  Face Recognition Attendance System Server Running`);
    console.log(`  URL: http://localhost:${PORT}`);
    console.log(`  Project Directory: ${__dirname}`);
    console.log(`  Press Ctrl+C to stop`);
    console.log(`==================================================`);
});

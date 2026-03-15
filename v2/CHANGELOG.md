# Changelog

All updates, conversations, and file changes for FutureScore AI project.

## Version 2.0.0 (Node.js) - March 15, 2026
- Converted from Python Flask to Node.js Express
- Updated dependencies to package.json
- Changed server entry to server.js
- Updated Vercel config for Node.js
- Backed up Version 1 in v1/ folder
- Added EJS for templates
- Maintained all features: upload, analyze, rate limiting
- Organized: Moved all V1 files to v1/ folder, V2 files to root
- Removed Flutter mobile_app folder
- Initialized git repo, added GitHub remote, committed V2
- Fixed vercel.json: Removed legacy builds, used functions for Node.js deployment

## Version 1.0.0 (Python Flask) - Initial
- Created Flask app with Groq AI integration
- Features: Resume analysis, file upload, career roadmap
- Deployed on Vercel
- Files: app.py, requirements.txt, templates/index.html, etc.

## Conversations and Updates
- User requested mobile app, initially suggested Flutter
- Switched to PWA idea due to complexity
- User insisted on Node.js conversion for simplicity
- Backed up v1, converted to v2 Node.js
- Organized into v1/ and v2/ folders
- Pushed V2 to GitHub successfully
- All files updated accordingly
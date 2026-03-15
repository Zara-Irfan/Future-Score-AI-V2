# FutureScore AI Mobile App

A Flutter mobile app for AI-powered resume analysis using the FutureScore AI backend.

## Features
- Input resume and job description text
- Upload resume/job files (PDF, DOCX, TXT)
- Analyze with AI for ATS score, strengths, improvements, and career roadmap
- Free and open-source

## Setup
1. Install Flutter SDK from https://flutter.dev/docs/get-started/install (free)
2. Install Android Studio or VS Code with Flutter extension (free)
3. Clone or copy this project
4. Run `flutter pub get` in the mobile_app directory
5. Ensure the backend Flask app is running on localhost:5000 (run `python app.py` in the main project)
6. For mobile emulator, change the URL to `http://10.0.2.2:5000` in main.dart
7. Run `flutter run` to start the app

## Building APK
- `flutter build apk` to build for Android
- `flutter build ios` for iOS (requires macOS)

## Dependencies
- flutter
- http
- file_picker

## Notes
- This app connects to the local Flask backend. For production, update the URL to your deployed backend.
- As a student project, all tools are free.
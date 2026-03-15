import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:file_picker/file_picker.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FutureScore AI Mobile',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: const HomePage(),
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final TextEditingController _resumeController = TextEditingController();
  final TextEditingController _jobController = TextEditingController();
  String _result = '';
  bool _loading = false;

  Future<void> _uploadFile(bool isResume) async {
    FilePickerResult? result = await FilePicker.platform.pickFiles();
    if (result != null) {
      PlatformFile file = result.files.first;
      var request = http.MultipartRequest('POST', Uri.parse('http://localhost:5000/upload'));
      request.fields['field'] = isResume ? 'resume' : 'job_desc';
      request.files.add(await http.MultipartFile.fromPath('file', file.path!));
      var response = await request.send();
      if (response.statusCode == 200) {
        var responseData = await response.stream.bytesToString();
        var data = jsonDecode(responseData);
        setState(() {
          if (isResume) {
            _resumeController.text = data['text'];
          } else {
            _jobController.text = data['text'];
          }
        });
      } else {
        setState(() {
          _result = 'Upload failed: ${response.statusCode}';
        });
      }
    }
  }

  Future<void> _analyze() async {
    setState(() {
      _loading = true;
      _result = '';
    });
    try {
      final response = await http.post(
        Uri.parse('http://localhost:5000/analyze'),  // Change to your deployed URL if needed
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'resume': _resumeController.text,
          'job_desc': _jobController.text,
        }),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _result = data['result'];
        });
      } else {
        setState(() {
          _result = 'Error: ${response.body}';
        });
      }
    } catch (e) {
      setState(() {
        _result = 'Error: $e';
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('FutureScore AI'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _resumeController,
                    decoration: const InputDecoration(labelText: 'Resume Text'),
                    maxLines: 3,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.upload_file),
                  onPressed: () => _uploadFile(true),
                  tooltip: 'Upload Resume File',
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _jobController,
                    decoration: const InputDecoration(labelText: 'Job Description Text'),
                    maxLines: 3,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.upload_file),
                  onPressed: () => _uploadFile(false),
                  tooltip: 'Upload Job File',
                ),
              ],
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loading ? null : _analyze,
              child: _loading ? const CircularProgressIndicator() : const Text('Analyze'),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: SingleChildScrollView(
                child: Text(_result),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
from flask import Flask, render_template, request, jsonify, send_file
from livereload import Server
import csv
import os
from datetime import datetime

app = Flask(__name__)

# Database file
DB_FILE = 'students.csv'
ATTENDANCE_FILE = 'attendance.csv'

# Initialize CSV files if they don't exist
def init_db():
    if not os.path.exists(DB_FILE):
        with open(DB_FILE, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'name', 'email', 'year', 'section', 'created_at'])
    
    if not os.path.exists(ATTENDANCE_FILE):
        with open(ATTENDANCE_FILE, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'student_id', 'student_name', 'year', 'section', 'date', 'status', 'notes'])

init_db()

# Helper functions
def get_next_id(filename):
    try:
        with open(filename, 'r') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            if rows:
                return max(int(row['id']) for row in rows) + 1
            return 1
    except:
        return 1

def read_students():
    students = []
    with open(DB_FILE, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            students.append(row)
    return students

def read_attendance():
    attendance = []
    with open(ATTENDANCE_FILE, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            attendance.append(row)
    return attendance

# Routes
@app.route('/')
def landing():
    return render_template('landing.html')

@app.route('/index')
def index():
    return render_template('index.html')

@app.route('/api/students', methods=['GET'])
def get_students():
    students = read_students()
    return jsonify(students)

@app.route('/api/students', methods=['POST'])
def create_student():
    data = request.json
    student_id = get_next_id(DB_FILE)
    
    with open(DB_FILE, 'a', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            student_id,
            data['name'],
            data['email'],
            data['year'],
            data['section'],
            datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        ])
    
    return jsonify({'message': 'Student created successfully', 'id': student_id}), 201

@app.route('/api/students/<int:student_id>', methods=['PUT'])
def update_student(student_id):
    data = request.json
    students = read_students()
    
    updated = False
    for student in students:
        if int(student['id']) == student_id:
            student['name'] = data['name']
            student['email'] = data['email']
            student['year'] = data['year']
            student['section'] = data['section']
            updated = True
            break
    
    if updated:
        with open(DB_FILE, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['id', 'name', 'email', 'year', 'section', 'created_at'])
            writer.writeheader()
            writer.writerows(students)
        return jsonify({'message': 'Student updated successfully'})
    
    return jsonify({'message': 'Student not found'}), 404

@app.route('/api/students/<int:student_id>', methods=['DELETE'])
def delete_student(student_id):
    students = read_students()
    students = [s for s in students if int(s['id']) != student_id]
    
    with open(DB_FILE, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'name', 'email', 'year', 'section', 'created_at'])
        writer.writeheader()
        writer.writerows(students)
    
    return jsonify({'message': 'Student deleted successfully'})

@app.route('/api/attendance', methods=['GET'])
def get_attendance():
    date_filter = request.args.get('date')
    year_filter = request.args.get('year')
    section_filter = request.args.get('section')
    attendance = read_attendance()
    
    if date_filter:
        attendance = [a for a in attendance if a['date'] == date_filter]
    if year_filter:
        attendance = [a for a in attendance if a['year'] == year_filter]
    if section_filter:
        attendance = [a for a in attendance if a['section'] == section_filter]
    
    return jsonify(attendance)

@app.route('/api/attendance', methods=['POST'])
def mark_attendance():
    data = request.json
    attendance_id = get_next_id(ATTENDANCE_FILE)
    
    with open(ATTENDANCE_FILE, 'a', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            attendance_id,
            data['student_id'],
            data['student_name'],
            data['year'],
            data['section'],
            data.get('date', datetime.now().strftime('%Y-%m-%d')),
            data['status'],
            data.get('notes', '')
        ])
    
    return jsonify({'message': 'Attendance marked successfully', 'id': attendance_id}), 201


@app.route('/api/attendance/<int:attendance_id>', methods=['DELETE'])
def delete_attendance(attendance_id):
    attendance = read_attendance()
    attendance = [a for a in attendance if int(a['id']) != attendance_id]
    
    with open(ATTENDANCE_FILE, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'student_id', 'student_name', 'year', 'section', 'date', 'status', 'notes'])
        writer.writeheader()
        writer.writerows(attendance)
    
    return jsonify({'message': 'Attendance record deleted successfully'})

@app.route('/api/export/students')
def export_students():
    return send_file(DB_FILE, as_attachment=True, download_name='bsit_students_export.csv')

@app.route('/api/export/attendance')
def export_attendance():
    return send_file(ATTENDANCE_FILE, as_attachment=True, download_name='bsit_attendance_export.csv')
    

if __name__ == '__main__':
    # Enable livereload for development
    server = Server(app.wsgi_app)
    
    # Watch for changes in templates
    server.watch('templates/*.html')
    
    # Watch for changes in static files
    server.watch('static/css/*.css')
    server.watch('static/js/*.js')
    
    # Watch Python files
    server.watch('*.py')
    
    server.serve(port=5000, host='localhost')
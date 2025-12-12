from flask import Flask, render_template, request, jsonify, send_file
from flask_socketio import SocketIO, emit
import csv
import os
from datetime import datetime, timedelta
from collections import defaultdict

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-this-in-production'
socketio = SocketIO(app, cors_allowed_origins="*")

# Database files
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

# Broadcast data updates
def broadcast_data_update(update_type):
    """Broadcast to all connected clients that data has changed"""
    socketio.emit('data_updated', {
        'type': update_type,
        'timestamp': datetime.now().isoformat()
    })

# WebSocket events
@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('connection_response', {'data': 'Connected to server'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

# Routes
@app.route('/')
def landing():
    return render_template('landing.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/students')
def students_page():
    return render_template('students.html')

@app.route('/attendance')
def attendance_page():
    return render_template('attendance.html')

@app.route('/reports')
def reports_page():
    return render_template('reports.html')

# API Endpoints
@app.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    students = read_students()
    attendance = read_attendance()
    
    # Calculate stats
    total_students = len(students)
    today = datetime.now().strftime('%Y-%m-%d')
    today_attendance = [a for a in attendance if a['date'] == today]
    
    present_today = len([a for a in today_attendance if a['status'] == 'Present'])
    absent_today = len([a for a in today_attendance if a['status'] == 'Absent'])
    late_today = len([a for a in today_attendance if a['status'] == 'Late'])
    
    # Year level distribution
    year_distribution = defaultdict(int)
    for student in students:
        year_distribution[student['year']] += 1
    
    # Section distribution
    section_distribution = defaultdict(int)
    for student in students:
        section_distribution[student['section']] += 1
    
    # Weekly attendance trend (last 7 days)
    weekly_trend = []
    for i in range(6, -1, -1):
        date = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
        day_attendance = [a for a in attendance if a['date'] == date]
        present = len([a for a in day_attendance if a['status'] == 'Present'])
        weekly_trend.append({
            'date': date,
            'present': present
        })
    
    return jsonify({
        'total_students': total_students,
        'present_today': present_today,
        'absent_today': absent_today,
        'late_today': late_today,
        'year_distribution': dict(year_distribution),
        'section_distribution': dict(section_distribution),
        'weekly_trend': weekly_trend
    })

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
    
    # Broadcast update
    broadcast_data_update('student_created')
    
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
        
        # Broadcast update
        broadcast_data_update('student_updated')
        
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
    
    # Broadcast update
    broadcast_data_update('student_deleted')
    
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
    
    # Broadcast update
    broadcast_data_update('attendance_marked')
    
    return jsonify({'message': 'Attendance marked successfully', 'id': attendance_id}), 201

@app.route('/api/attendance/<int:attendance_id>', methods=['DELETE'])
def delete_attendance(attendance_id):
    attendance = read_attendance()
    attendance = [a for a in attendance if int(a['id']) != attendance_id]
    
    with open(ATTENDANCE_FILE, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'student_id', 'student_name', 'year', 'section', 'date', 'status', 'notes'])
        writer.writeheader()
        writer.writerows(attendance)
    
    # Broadcast update
    broadcast_data_update('attendance_deleted')
    
    return jsonify({'message': 'Attendance record deleted successfully'})

@app.route('/api/export/students')
def export_students():
    return send_file(DB_FILE, as_attachment=True, download_name='bsit_students_export.csv')

@app.route('/api/export/attendance')
def export_attendance():
    return send_file(ATTENDANCE_FILE, as_attachment=True, download_name='bsit_attendance_export.csv')

if __name__ == '__main__':
    # Use socketio.run instead of app.run
    socketio.run(app, debug=True, host='localhost', port=5000)
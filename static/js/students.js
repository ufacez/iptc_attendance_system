let students = [];
let editingStudentId = null;
let currentFilters = { year: '', section: '' };

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setCurrentDate();
    loadStudents();
});

function setCurrentDate() {
    const today = new Date();
    document.getElementById('current-date').textContent = today.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

// Cross-tab sync: Trigger update in other tabs
function triggerCrossTabUpdate() {
    const updateInfo = {
        type: 'student',
        timestamp: Date.now()
    };
    
    localStorage.setItem('bsit_data_updated', JSON.stringify(updateInfo));
    
    setTimeout(() => {
        localStorage.removeItem('bsit_data_updated');
    }, 100);
}

// Cross-tab sync: Listen for updates from other tabs
window.addEventListener('storage', (e) => {
    if (e.key === 'bsit_data_updated') {
        const updateInfo = JSON.parse(e.newValue);
        console.log('Update detected from another tab:', updateInfo);
        
        loadStudents();
        showNotification('Data synchronized from another tab', 'success');
    }
});

// Load students
async function loadStudents() {
    try {
        const response = await fetch('/api/students');
        students = await response.json();
        renderStudentsBySection();
    } catch (error) {
        console.error('Error loading students:', error);
        showNotification('Error loading students', 'error');
    }
}

// Render students grouped by year and section
function renderStudentsBySection() {
    const container = document.getElementById('students-by-section');
    
    // Filter students
    let filteredStudents = students;
    if (currentFilters.year) {
        filteredStudents = filteredStudents.filter(s => s.year === currentFilters.year);
    }
    if (currentFilters.section) {
        filteredStudents = filteredStudents.filter(s => s.section === currentFilters.section);
    }
    
    if (filteredStudents.length === 0) {
        container.innerHTML = `
            <div class="content-card">
                <div class="card-body">
                    <div class="empty-state">
                        <div class="empty-state-icon"><i class="bi bi-people"></i></div>
                        <div class="empty-state-text">No students found</div>
                    </div>
                </div>
            </div>
        `;
        return;
    }
    
    // Group by year
    const years = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Irregular'];
    const grouped = {};
    
    years.forEach(year => {
        const yearStudents = filteredStudents.filter(s => s.year === year);
        if (yearStudents.length > 0) {
            const sections = {};
            yearStudents.forEach(student => {
                if (!sections[student.section]) {
                    sections[student.section] = [];
                }
                sections[student.section].push(student);
            });
            grouped[year] = sections;
        }
    });
    
    // Render grouped students
    let html = '';
    Object.entries(grouped).forEach(([year, sections]) => {
        html += `
            <div class="content-card" style="margin-bottom: 20px;">
                <div class="card-header">
                    <h3 class="card-title">${year}</h3>
                    <span class="badge badge-secondary">${Object.values(sections).flat().length} students</span>
                </div>
                <div class="card-body" style="padding: 0;">
        `;
        
        Object.entries(sections).forEach(([section, sectionStudents]) => {
            html += `
                <div style="border-bottom: 1px solid var(--border); padding: 20px 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h4 style="font-size: 16px; font-weight: 600; color: var(--text-dark);">
                            Section ${section}
                        </h4>
                        <span class="badge badge-info">${sectionStudents.length} students</span>
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Created At</th>
                                    <th style="text-align: center;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
            `;
            
            sectionStudents.forEach(student => {
                html += `
                    <tr>
                        <td><span class="badge badge-secondary">#${student.id}</span></td>
                        <td style="font-weight: 500;">${student.name}</td>
                        <td>${student.email}</td>
                        <td>${new Date(student.created_at).toLocaleDateString()}</td>
                        <td style="text-align: center;">
                            <button class="btn btn-sm" style="background: var(--info); color: white; margin-right: 6px;" onclick="viewAttendanceHistory(${student.id})">
                                <i class="bi bi-eye"></i> View
                            </button>
                            <button class="btn btn-edit btn-sm" onclick="editStudent(${student.id})">
                                <i class="bi bi-pencil-square"></i> Edit
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="deleteStudent(${student.id})">
                                <i class="bi bi-trash"></i> Delete
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// View attendance history for a student
async function viewAttendanceHistory(studentId) {
    const student = students.find(s => s.id == studentId);
    if (!student) return;
    
    try {
        const response = await fetch('/api/attendance');
        const allAttendance = await response.json();
        
        const studentAttendance = allAttendance.filter(a => a.student_id == studentId);
        
        // Sort by date (newest first)
        studentAttendance.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Calculate statistics
        const totalRecords = studentAttendance.length;
        const presentCount = studentAttendance.filter(a => a.status === 'Present').length;
        const absentCount = studentAttendance.filter(a => a.status === 'Absent').length;
        const lateCount = studentAttendance.filter(a => a.status === 'Late').length;
        const excusedCount = studentAttendance.filter(a => a.status === 'Excused').length;
        const attendanceRate = totalRecords > 0 ? ((presentCount + lateCount) / totalRecords * 100).toFixed(1) : 0;
        
        // Show modal
        document.getElementById('history-student-name').textContent = student.name;
        document.getElementById('history-student-info').textContent = `${student.year} - ${student.section}`;
        document.getElementById('history-total-records').textContent = totalRecords;
        document.getElementById('history-present').textContent = presentCount;
        document.getElementById('history-absent').textContent = absentCount;
        document.getElementById('history-late').textContent = lateCount;
        document.getElementById('history-excused').textContent = excusedCount;
        document.getElementById('history-attendance-rate').textContent = `${attendanceRate}%`;
        
        // Set rate color
        const rateElement = document.getElementById('history-attendance-rate');
        if (attendanceRate >= 90) {
            rateElement.style.color = 'var(--success)';
        } else if (attendanceRate >= 75) {
            rateElement.style.color = 'var(--warning)';
        } else {
            rateElement.style.color = 'var(--danger)';
        }
        
        // Render attendance records
        const tbody = document.getElementById('history-tbody');
        if (studentAttendance.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 40px; color: var(--text-gray);">
                        No attendance records found for this student
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = studentAttendance.map(record => `
                <tr>
                    <td>${new Date(record.date).toLocaleDateString('en-US', { 
                        weekday: 'short',
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                    })}</td>
                    <td>
                        <span class="badge ${getStatusBadgeClass(record.status)}">
                            ${getStatusIcon(record.status)} ${record.status}
                        </span>
                    </td>
                    <td>${record.notes || '-'}</td>
                </tr>
            `).join('');
        }
        
        document.getElementById('history-modal').style.display = 'block';
    } catch (error) {
        console.error('Error loading attendance history:', error);
        showNotification('Error loading attendance history', 'error');
    }
}

function closeHistoryModal() {
    document.getElementById('history-modal').style.display = 'none';
}

function getStatusBadgeClass(status) {
    const classes = {
        'Present': 'badge-success',
        'Absent': 'badge-danger',
        'Late': 'badge-warning',
        'Excused': 'badge-info'
    };
    return classes[status] || 'badge-secondary';
}

function getStatusIcon(status) {
    const icons = {
        'Present': '<i class="bi bi-check-circle-fill"></i>',
        'Absent': '<i class="bi bi-x-circle-fill"></i>',
        'Late': '<i class="bi bi-clock-fill"></i>',
        'Excused': '<i class="bi bi-file-text-fill"></i>'
    };
    return icons[status] || '';
}

// Filter functions
function filterStudents() {
    currentFilters.year = document.getElementById('filter-year').value;
    currentFilters.section = document.getElementById('filter-section').value;
    renderStudentsBySection();
}

function resetFilters() {
    document.getElementById('filter-year').value = '';
    document.getElementById('filter-section').value = '';
    currentFilters = { year: '', section: '' };
    renderStudentsBySection();
}

// Modal functions
function showAddStudentModal() {
    editingStudentId = null;
    document.getElementById('modal-title').textContent = 'Add New Student';
    document.getElementById('student-id').value = '';
    document.getElementById('student-name').value = '';
    document.getElementById('student-email').value = '';
    document.getElementById('student-year').value = '';
    document.getElementById('student-section').value = '';
    document.getElementById('student-modal').style.display = 'block';
}

function editStudent(id) {
    const student = students.find(s => s.id == id);
    if (!student) return;
    
    editingStudentId = id;
    document.getElementById('modal-title').textContent = 'Edit Student';
    document.getElementById('student-id').value = student.id;
    document.getElementById('student-name').value = student.name;
    document.getElementById('student-email').value = student.email;
    document.getElementById('student-year').value = student.year;
    document.getElementById('student-section').value = student.section;
    document.getElementById('student-modal').style.display = 'block';
}

function closeModal() {
    document.getElementById('student-modal').style.display = 'none';
}

// Save student
async function saveStudent(event) {
    event.preventDefault();
    
    const name = document.getElementById('student-name').value;
    const email = document.getElementById('student-email').value;
    const year = document.getElementById('student-year').value;
    const section = document.getElementById('student-section').value;
    
    try {
        if (editingStudentId) {
            const response = await fetch(`/api/students/${editingStudentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, year, section })
            });
            
            if (response.ok) {
                showNotification('Student updated successfully');
                loadStudents();
                closeModal();
                triggerCrossTabUpdate();
            }
        } else {
            const response = await fetch('/api/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, year, section })
            });
            
            if (response.ok) {
                showNotification('Student created successfully');
                loadStudents();
                closeModal();
                triggerCrossTabUpdate();
            }
        }
    } catch (error) {
        console.error('Error saving student:', error);
        showNotification('Error saving student', 'error');
    }
}

// Delete student
async function deleteStudent(id) {
    if (!confirm('Are you sure you want to delete this student?')) return;
    
    try {
        const response = await fetch(`/api/students/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Student deleted successfully');
            loadStudents();
            triggerCrossTabUpdate();
        }
    } catch (error) {
        console.error('Error deleting student:', error);
        showNotification('Error deleting student', 'error');
    }
}

// Notification
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const icon = notification.querySelector('.notification-icon');
    const messageEl = notification.querySelector('.notification-message');
    
    icon.innerHTML = type === 'error' ? '<i class="bi bi-x-circle-fill"></i>' : '<i class="bi bi-check-circle-fill"></i>';
    messageEl.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Close modal on outside click
window.onclick = function(event) {
    const studentModal = document.getElementById('student-modal');
    const historyModal = document.getElementById('history-modal');
    
    if (event.target == studentModal) {
        closeModal();
    }
    if (event.target == historyModal) {
        closeHistoryModal();
    }
}
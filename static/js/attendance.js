let students = [];
let attendanceRecords = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setCurrentDate();
    setTodayDate();
    loadStudents();
    loadAttendance();
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

function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('attendance-date').value = today;
}

// Cross-tab sync: Trigger update in other tabs
function triggerCrossTabUpdate() {
    const updateInfo = {
        type: 'attendance',
        timestamp: Date.now()
    };
    
    // Set to trigger storage event in other tabs
    localStorage.setItem('bsit_data_updated', JSON.stringify(updateInfo));
    
    // Clear after a moment
    setTimeout(() => {
        localStorage.removeItem('bsit_data_updated');
    }, 100);
}

// Cross-tab sync: Listen for updates from other tabs
window.addEventListener('storage', (e) => {
    if (e.key === 'bsit_data_updated') {
        const updateInfo = JSON.parse(e.newValue);
        console.log('Update detected from another tab:', updateInfo);
        
        // Reload attendance and students data
        loadStudents();
        loadAttendance();
        showNotification('Data synchronized from another tab', 'success');
    }
});

// Load students
async function loadStudents() {
    try {
        const response = await fetch('/api/students');
        students = await response.json();
        updateStudentDropdown();
    } catch (error) {
        console.error('Error loading students:', error);
        showNotification('Error loading students', 'error');
    }
}

function updateStudentDropdown() {
    filterQuickStudents();
}

function filterQuickStudents() {
    const select = document.getElementById('quick-student');
    const yearFilter = document.getElementById('quick-filter-year').value;
    const sectionFilter = document.getElementById('quick-filter-section').value;
    
    let filteredStudents = students;
    
    if (yearFilter) {
        filteredStudents = filteredStudents.filter(s => s.year === yearFilter);
    }
    
    if (sectionFilter) {
        filteredStudents = filteredStudents.filter(s => s.section === sectionFilter);
    }
    
    select.innerHTML = '<option value="">-- Select Student --</option>' + 
        filteredStudents.map(s => `
            <option value="${s.id}" 
                    data-name="${s.name}" 
                    data-year="${s.year}" 
                    data-section="${s.section}">
                ${s.name} - ${s.year} ${s.section}
            </option>
        `).join('');
}

// Load attendance
async function loadAttendance() {
    try {
        const response = await fetch('/api/attendance');
        attendanceRecords = await response.json();
        renderAttendanceTable();
    } catch (error) {
        console.error('Error loading attendance:', error);
        showNotification('Error loading attendance', 'error');
    }
}

// Filter attendance
async function filterAttendance() {
    const date = document.getElementById('filter-date').value;
    const year = document.getElementById('filter-year').value;
    const section = document.getElementById('filter-section').value;
    
    let url = '/api/attendance?';
    if (date) url += `date=${date}&`;
    if (year) url += `year=${year}&`;
    if (section) url += `section=${section}&`;
    
    try {
        const response = await fetch(url);
        attendanceRecords = await response.json();
        renderAttendanceTable();
    } catch (error) {
        console.error('Error filtering attendance:', error);
        showNotification('Error filtering attendance', 'error');
    }
}

function resetFilters() {
    document.getElementById('filter-date').value = '';
    document.getElementById('filter-year').value = '';
    document.getElementById('filter-section').value = '';
    loadAttendance();
}

// Render attendance table
function renderAttendanceTable() {
    const tbody = document.getElementById('attendance-tbody');
    const recordCount = document.getElementById('record-count');
    
    recordCount.textContent = `${attendanceRecords.length} records`;
    
    if (attendanceRecords.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="padding: 40px; text-align: center;">
                    <div class="empty-state">
                        <div class="empty-state-icon"><i class="bi bi-check-circle"></i></div>
                        <div class="empty-state-text">No attendance records found</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = attendanceRecords.map(record => `
        <tr>
            <td><span class="badge badge-secondary">#${record.id}</span></td>
            <td style="font-weight: 500;">${record.student_name}</td>
            <td><span class="badge badge-secondary">${record.year}</span></td>
            <td><span class="badge badge-secondary">${record.section}</span></td>
            <td>${new Date(record.date).toLocaleDateString()}</td>
            <td>
                <span class="badge ${getStatusBadgeClass(record.status)}">
                    ${getStatusIcon(record.status)} ${record.status}
                </span>
            </td>
            <td>${record.notes || '-'}</td>
            <td style="text-align: center;">
                <button class="btn btn-danger btn-sm" onclick="deleteAttendance(${record.id})">
                    <i class="bi bi-trash"></i> Delete
                </button>
            </td>
        </tr>
    `).join('');
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

// Quick mark attendance
async function quickMarkAttendance(status) {
    const select = document.getElementById('quick-student');
    const studentId = select.value;
    
    if (!studentId) {
        showNotification('Please select a student', 'error');
        return;
    }
    
    const option = select.options[select.selectedIndex];
    const studentName = option.dataset.name;
    const year = option.dataset.year;
    const section = option.dataset.section;
    const date = document.getElementById('attendance-date').value;
    
    try {
        const response = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_id: studentId,
                student_name: studentName,
                year: year,
                section: section,
                date: date,
                status: status,
                notes: ''
            })
        });
        
        if (response.ok) {
            showNotification(`Marked ${studentName} as ${status}`);
            loadAttendance();
            select.value = '';
            
            // Trigger update in other tabs
            triggerCrossTabUpdate();
        }
    } catch (error) {
        console.error('Error marking attendance:', error);
        showNotification('Error marking attendance', 'error');
    }
}

// Delete attendance
async function deleteAttendance(id) {
    if (!confirm('Are you sure you want to delete this attendance record?')) return;
    
    try {
        const response = await fetch(`/api/attendance/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Attendance record deleted successfully');
            loadAttendance();
            
            // Trigger update in other tabs
            triggerCrossTabUpdate();
        }
    } catch (error) {
        console.error('Error deleting attendance:', error);
        showNotification('Error deleting attendance', 'error');
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
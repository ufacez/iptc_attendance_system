let students = [];
let attendanceRecords = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setCurrentDate();
    loadData();
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

// Load all data
async function loadData() {
    try {
        const [studentsRes, attendanceRes] = await Promise.all([
            fetch('/api/students'),
            fetch('/api/attendance')
        ]);
        
        students = await studentsRes.json();
        attendanceRecords = await attendanceRes.json();
        
        updateStatistics();
        updateYearStats();
        updateSectionStats();
    } catch (error) {
        console.error('Error loading data:', error);
        showNotification('Error loading data', 'error');
    }
}

// Update statistics
function updateStatistics() {
    const totalStudents = students.length;
    const totalRecords = attendanceRecords.length;
    
    document.getElementById('total-students').textContent = totalStudents;
    document.getElementById('total-records').textContent = totalRecords;
    
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = attendanceRecords.filter(r => r.date === today);
    
    const present = todayRecords.filter(r => r.status === 'Present').length;
    const absent = todayRecords.filter(r => r.status === 'Absent').length;
    
    document.getElementById('present-today').textContent = present;
    document.getElementById('absent-today').textContent = absent;
}

// Update year level statistics
function updateYearStats() {
    const yearStats = {};
    students.forEach(s => {
        yearStats[s.year] = (yearStats[s.year] || 0) + 1;
    });
    
    const yearStatsDiv = document.getElementById('year-stats');
    
    if (Object.keys(yearStats).length === 0) {
        yearStatsDiv.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-text">No student data available</div>
            </div>
        `;
        return;
    }
    
    yearStatsDiv.innerHTML = Object.entries(yearStats)
        .sort((a, b) => {
            const order = { '1st Year': 1, '2nd Year': 2, '3rd Year': 3, '4th Year': 4, 'Irregular': 5 };
            return (order[a[0]] || 999) - (order[b[0]] || 999);
        })
        .map(([year, count]) => {
            const percentage = ((count / students.length) * 100).toFixed(1);
            return `
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-weight: 600; color: var(--text-dark);">${year}</span>
                        <span style="color: var(--text-gray);">${count} students (${percentage}%)</span>
                    </div>
                    <div style="height: 8px; background: var(--bg-light); border-radius: 4px; overflow: hidden;">
                        <div style="height: 100%; background: linear-gradient(90deg, var(--primary), var(--secondary)); width: ${percentage}%; transition: width 0.3s;"></div>
                    </div>
                </div>
            `;
        }).join('');
}

// Update section statistics
function updateSectionStats() {
    const sectionStats = {};
    students.forEach(s => {
        sectionStats[s.section] = (sectionStats[s.section] || 0) + 1;
    });
    
    const sectionStatsDiv = document.getElementById('section-stats');
    
    if (Object.keys(sectionStats).length === 0) {
        sectionStatsDiv.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-text">No student data available</div>
            </div>
        `;
        return;
    }
    
    sectionStatsDiv.innerHTML = Object.entries(sectionStats)
        .sort((a, b) => b[1] - a[1])
        .map(([section, count]) => {
            const percentage = ((count / students.length) * 100).toFixed(1);
            return `
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-weight: 600; color: var(--text-dark);">Section ${section}</span>
                        <span style="color: var(--text-gray);">${count} students (${percentage}%)</span>
                    </div>
                    <div style="height: 8px; background: var(--bg-light); border-radius: 4px; overflow: hidden;">
                        <div style="height: 100%; background: linear-gradient(90deg, var(--info), var(--primary)); width: ${percentage}%; transition: width 0.3s;"></div>
                    </div>
                </div>
            `;
        }).join('');
}

// Export functions
function exportStudents() {
    window.location.href = '/api/export/students';
    showNotification('Downloading students CSV...');
}

function exportAttendance() {
    window.location.href = '/api/export/attendance';
    showNotification('Downloading attendance CSV...');
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
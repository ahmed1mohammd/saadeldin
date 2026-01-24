document.addEventListener("DOMContentLoaded", function () {
    // Get studentData and token
    const studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
    const apiToken = localStorage.getItem('apiToken') || studentData.api_token;

    // Elements
    const nameEl = document.getElementById('profile-name');
    const fullnameEl = document.getElementById('profile-fullname');
    const studentNumberEl = document.getElementById('profile-student-number');
    const parentMobileEl = document.getElementById('profile-parent-mobile');
    const academicYearEl = document.getElementById('profile-academic-year');
    const governorateEl = document.getElementById('profile-governorate');

    if (!apiToken) {
        // Not logged in, redirect to login
        localStorage.removeItem('studentData');
        window.location.href = 'login.html';
        return;
    }

    tenantFetch('https://api-platfrom.ro-s.net/api/student/get_profile', {
        headers: {
            'Authorization': 'Bearer ' + apiToken,
            'Accept': 'application/json'
        }
    })
        .then(res => {
            if (res.status === 401) {
                throw new Error('Unauthorized');
            }
            return res.json();
        })
        .then(data => {
            if (!data || !data.student) {
                // Session expired → logout directly
                tenantFetch('https://api-platfrom.ro-s.net/api/student/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + apiToken,
                        'Accept': 'application/json'
                    }
                }).finally(() => {
                    localStorage.removeItem('studentData');
                    Swal.fire({
                        title: 'انتهت صلاحية الجلسة',
                        text: 'تم تسجيل الخروج تلقائيًا، برجاء تسجيل الدخول مرة أخرى.',
                        icon: 'warning',
                        background: 'rgb(78, 194, 192)',
                        confirmButtonColor: '#FFD700'
                    }).then(() => {
                        window.location.href = 'login.html';
                    });
                });
                return;
            }

            const student = data.student;
            nameEl.textContent = student.name || '...';
            fullnameEl.textContent = student.name || '...';
            studentNumberEl.textContent = student.student_number || '...';
            parentMobileEl.textContent = student.parent_phone || '...';
            governorateEl.textContent = student.governorate || '...';

            // Fetch grades and display grade name
            tenantFetch('https://api-platfrom.ro-s.net/api/grades')
                .then(res => res.json())
                .then(grades => {
                    const found = Array.isArray(grades)
                        ? grades.find(g => g.id == student.study_level_id)
                        : (grades.data || []).find(g => g.id == student.study_level_id);
                    academicYearEl.textContent = found ? found.name : student.study_level_id || '...';
                })
                .catch(() => {
                    academicYearEl.textContent = student.study_level_id || '...';
                });
        })
        .catch(() => {
            // Network or other error → logout
            localStorage.removeItem('studentData');
            window.location.href = 'login.html';
        });

    // Logout button logic
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            const studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
            const apiToken = studentData.api_token;
            if (!apiToken) {
                window.location.href = 'login.html';
                return;
            }
            tenantFetch('https://api-platfrom.ro-s.net/api/student/logout', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + apiToken,
                    'Accept': 'application/json'
                }
            })
                .finally(() => {
                    localStorage.removeItem('studentData');
                    window.location.href = 'login.html';
                });
        });
    }
});

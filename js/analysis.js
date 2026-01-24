document.addEventListener("DOMContentLoaded", function () {
    // Get studentData and token
    const studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
    const apiToken = studentData.api_token;

    if (!apiToken) {
        // Not logged in, redirect to login
        window.location.href = 'login.html';
        return;
    }

    // Elements for statistics
    const videosCountEl = document.getElementById('videos-count');
    const examsCountEl = document.getElementById('exams-count');
    const passedExamsEl = document.getElementById('passed-exams');
    const failedExamsEl = document.getElementById('failed-exams');
    const averageScoreEl = document.getElementById('average-score');
    const dotProgressEl = document.getElementById('dotProgress');

    // Initialize statistics
    let totalVideos = 0;
    let totalExams = 0;
    let passedExams = 0;
    let failedExams = 0;
    let totalScore = 0;
    let scoreCount = 0;

    // Fetch courses to count videos and quizzes
    tenantFetch('https://api-platfrom.ro-s.net/api/get-courses', {
        headers: {
            'Authorization': 'Bearer ' + apiToken,
            'Accept': 'application/json'
        }
    })
        .then(res => res.json())
        .then(async (coursesData) => {
            if (coursesData.success && coursesData.courses) {
                const courses = coursesData.courses;
                const quizChecks = [];

                // Count videos and collect quiz checks
                courses.forEach(course => {
                    if (course.lectures) {
                        course.lectures.forEach(lecture => {
                            if (lecture.content) {
                                lecture.content.forEach(item => {
                                    if (item.type && item.type.toLowerCase().includes('video')) {
                                        totalVideos++;
                                    } else if (item.type === 'quiz') {
                                        quizChecks.push({
                                            course_id: course.id,
                                            lecture_id: lecture.id,
                                            quiz_title: item.quiz_title
                                        });
                                    }
                                });
                            }
                        });
                    }
                });

                totalExams = quizChecks.length;

                // Check attempts for each quiz
                const attemptPromises = quizChecks.map(quiz =>
                    tenantFetch('https://api-platfrom.ro-s.net/api/check-attempt', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'Authorization': 'Bearer ' + apiToken
                        },
                        body: JSON.stringify({
                            course_id: quiz.course_id,
                            lecture_id: quiz.lecture_id
                        })
                    })
                        .then(res => res.json())
                        .then(data => {
                            if (data.success && data.attempt_exists) {
                                const score = parseFloat(data.percentage);
                                totalScore += score;
                                scoreCount++;

                                if (score >= 50) { // Using 50% as passing score based on exam.js
                                    passedExams++;
                                } else {
                                    failedExams++;
                                }
                            }
                            return data;
                        })
                        .catch(error => {
                            console.error('Error checking attempt:', error);
                            return null;
                        })
                );

                // Wait for all checks to complete
                await Promise.all(attemptPromises);

                // Update counters with animation
                animateCounter(videosCountEl, totalVideos);
                animateCounter(examsCountEl, totalExams);
                animateCounter(passedExamsEl, passedExams);
                animateCounter(failedExamsEl, failedExams);

                // Calculate and display average score
                const averageScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;
                averageScoreEl.textContent = averageScore + '%';

                // Update dot progress based on average score
                updateDotProgress(averageScore);
            }
        })
        .catch(error => {
            console.error('Error fetching courses:', error);
            Swal.fire({
                title: 'خطأ في الاتصال',
                text: 'تحقق من اتصالك بالإنترنت وحاول مرة أخرى.',
                icon: 'error',
                background: 'rgb(78, 194, 192)',
                confirmButtonColor: '#FFD700'
            });
        });

    // Counter animation function
    function animateCounter(element, target, duration = 2000) {
        if (!element) return;

        let start = 0;
        const increment = target / (duration / 16);

        const timer = setInterval(() => {
            start += increment;
            if (start >= target) {
                element.textContent = Math.floor(target);
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(start);
            }
        }, 16);
    }

    // Update dot progress indicator
    function updateDotProgress(percentage) {
        if (!dotProgressEl) return;

        const totalDots = 10;
        const filledDots = Math.round((percentage / 100) * totalDots);

        // Clear existing dots
        dotProgressEl.innerHTML = '';

        // Generate new dots
        for (let i = 0; i < totalDots; i++) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            dotProgressEl.appendChild(dot);
        }

        // Animate dots
        setTimeout(() => {
            const dots = dotProgressEl.querySelectorAll('.dot');
            dots.forEach((dot, index) => {
                setTimeout(() => {
                    if (index < filledDots) {
                        dot.classList.add('filled');
                    }
                }, index * 100);
            });
        }, 1000);
    }

    // Update charts with real data
    function updateCharts(stats) {
        // Update left chart (Exams completion)
        if (window.leftChart) {
            const completionRate = stats.exam_completion_rate || 75;
            window.leftChart.data.datasets[0].data = [completionRate, 100 - completionRate];
            window.leftChart.update();
        }

        // Update right chart (Videos watched)
        if (window.rightChart) {
            const videoProgress = stats.video_completion_rate || 65;
            window.rightChart.data.datasets[0].data = [videoProgress, 100 - videoProgress];
            window.rightChart.update();
        }
    }
});

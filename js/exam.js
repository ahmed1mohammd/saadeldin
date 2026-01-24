function initPreloader() {
  const preloader = document.getElementById("preloader");
  if (preloader) {
    preloader.classList.add("hidden");
  }
}
window.addEventListener("load", initPreloader);

// Function to get query parameters from URL
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

const courseId = getQueryParam('course_id');
const lectureId = getQueryParam('lecture_id');
const title = decodeURIComponent(getQueryParam('title'));
const contentType = getQueryParam('type') || 'quiz'; // الافتراضي هو كويز

const allQuestionsContainer = document.querySelector(".all-question");

async function fetchAndDisplayQuestions() {
  const token = localStorage.getItem('apiToken');
  if (!token) {
    Swal.fire({
      title: 'خطأ',
      text: 'يجب عليك تسجيل الدخول أولاً.',
      icon: 'error',
      confirmButtonText: 'حسناً'
    }).then(() => {
      window.location.href = 'login.html';
    });
    return;
  }

  try {
    const checkAttemptResponse = await tenantFetch('https://api-platfrom.ro-s.net/api/check-attempt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        course_id: courseId,
        lecture_id: lectureId
      })
    });

    const attemptResult = await checkAttemptResponse.json();

    if (checkAttemptResponse.ok && attemptResult.success) {
      // Only treat an attempt as completed if backend provides a completed_at timestamp.
      // Some responses may set attempt_exists=true for in-progress attempts; those
      // should not block the student from starting the exam.
      console.log('Attempt check result:', attemptResult);
      if (attemptResult.attempt_exists && attemptResult.completed_at) {
        document.querySelector('.exam-container').style.display = 'none';
        const percentage = attemptResult.percentage;
        Swal.fire({
          title: 'لقد أكملت هذا الاختبار بالفعل!',
          html: `
          <p>نتيجتك السابقة:</p>
          <p>النتيجة: ${attemptResult.score} من ${attemptResult.total_questions}</p>
          <div class="progress-exam">
            <div class="progress-bar" role="progressbar" style="width: ${percentage}%" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">
              ${percentage}%
            </div>
          </div>
          <p>تاريخ الإكمال: ${attemptResult.completed_at}</p>
        `,
          icon: 'info',
          confirmButtonText: 'العودة'
        }).then(() => {
          window.history.back();
        });
        allQuestionsContainer.innerHTML = '<p class="text-center">لقد قمت بحل هذا الامتحان من قبل.</p>';
        return;
      }
    } else if (checkAttemptResponse.status !== 404 && !attemptResult.success) {
      console.error('Error checking quiz attempt:', attemptResult);
      Swal.fire({
        title: 'خطأ',
        text: attemptResult.message || 'حدث خطأ أثناء التحقق من محاولاتك السابقة.',
        icon: 'error',
        confirmButtonText: 'حسناً'
      });
      return;
    }

    const response = await tenantFetch('https://api-platfrom.ro-s.net/api/courses');
    const coursesRaw = await response.json();
    const courseList = Array.isArray(coursesRaw) ? coursesRaw : (coursesRaw.data || coursesRaw.courses || []);
    const course = courseList.find(c => c.id == courseId);
    if (course) {
      const lecture = course.lectures.find(l => l.id == lectureId);
      if (lecture && lecture.content) {
        const contentItem = lecture.content.find(item => {
          if (item.type !== contentType) return false;
          // دعم جميع أنواع العناوين
          const possibleTitles = [item.quiz_title, item.assignment_title, item.title];
          return possibleTitles.some(t => t && t.trim() === title.trim());
        });

        if (contentItem) {
          let questions = [];
          if (contentType === 'assignment') {
            if (Array.isArray(contentItem.assignment_questions)) {
              questions = questions.concat(contentItem.assignment_questions.filter(q => q && Object.keys(q).length > 0));
            }
          } else {
            if (Array.isArray(contentItem.quiz_questions)) {
              questions = questions.concat(contentItem.quiz_questions.filter(q => q && Object.keys(q).length > 0));
            }
            if (Array.isArray(contentItem.manualQuestions)) {
              questions = questions.concat(contentItem.manualQuestions.filter(q => q && Object.keys(q).length > 0));
            }
            if (Array.isArray(contentItem.bankQuestions)) {
              questions = questions.concat(contentItem.bankQuestions.filter(q => q && Object.keys(q).length > 0));
            }
          }
          // إذا لم توجد أي أسئلة
          if (!questions || questions.length === 0) {
            allQuestionsContainer.innerHTML = '<p class="text-center">لا توجد أسئلة لهذا الامتحان.</p>';
            return;
          }
          const duration = contentType === 'assignment' ? 30 : (contentItem.duration && Number(contentItem.duration) > 0 ? Number(contentItem.duration) : 30);
          const itemTitle = contentType === 'assignment' ? contentItem.assignment_title : (contentItem.quiz_title || contentItem.title);

          displayQuestions(questions);
          initializeExam(questions.length, duration, lecture.title, itemTitle);
        } else {
          allQuestionsContainer.innerHTML = '<p class="text-center">لا يوجد امتحان لهذه المحاضرة.</p>';
        }
      } else {
        allQuestionsContainer.innerHTML = '<p class="text-center">لا يوجد امتحان لهذه المحاضرة.</p>';
      }
    } else {
      allQuestionsContainer.innerHTML = '<p class="text-center">الكورس غير موجود.</p>';
    }

  } catch (error) {
    console.error('Error:', error);
    allQuestionsContainer.innerHTML = '<p class="text-center">حدث خطأ. يرجى المحاولة مرة أخرى.</p>';
    Swal.fire({
      title: 'خطأ',
      text: 'حدث خطأ في الشبكة. يرجى المحاولة مرة أخرى.',
      icon: 'error',
      confirmButtonText: 'حسناً'
    });
  }
}

function displayQuestions(questions) {
  allQuestionsContainer.innerHTML = '';
  questions.forEach((question, index) => {
    let options = [];
    let correctAnswer = null;
    // MCQ
    if (question.options && Array.isArray(question.options)) {
      options = question.options.map((opt, i) => {
        if (typeof opt === 'string') return { text: opt, id: i };
        if (opt.text) return { text: opt.text, id: opt.id ?? i };
        if (opt.image) return { text: '', image: opt.image, id: opt.id ?? i };
        return { text: opt, id: i };
      });
      if (question.correctAnswers && Array.isArray(question.correctAnswers)) {
        correctAnswer = { id: question.correctAnswers[0] };
      } else if (question.correct_answer) {
        correctAnswer = { id: options.findIndex(opt => opt.text === question.correct_answer) };
      } else if (options.find(opt => opt.is_correct)) {
        correctAnswer = options.find(opt => opt.is_correct);
      }
    }
    // TF
    else if (question.type === 'TF' && Array.isArray(question.options)) {
      options = question.options.map((opt, i) => ({ text: typeof opt === 'string' ? opt : (opt.text || opt), id: i }));
      if (question.correctAnswers && Array.isArray(question.correctAnswers)) {
        correctAnswer = { id: question.correctAnswers[0] };
      }
    }
    // بنكي
    else if (question.type === 'MCQ' && Array.isArray(question.options)) {
      options = question.options.map((opt, i) => ({ text: opt, id: i }));
      if (question.correct_answer) {
        correctAnswer = { id: options.findIndex(opt => opt.text === question.correct_answer) };
      }
    }
    // إذا لم توجد خيارات، تجاهل السؤال
    if (!options || options.length === 0) return;
    const questionElement = document.createElement('div');
    questionElement.className = 'questios';
    questionElement.innerHTML = `
      <div class="exam-question" data-answer="${correctAnswer ? correctAnswer.id : ''}">
        <div class="question-image">
          ${question.image ? `<img src="${question.image}" alt="السؤال ${index + 1}" />` : ''}
        </div>
        <div class="question-arabic">
          <p><span>🤔 </span>${question.text || question.question || ''}</p>
        </div>
        <div class="fullscreen-container">
          <div class="radio-group-container">
            ${options.map(option => `
              <label class="radio-label" style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                <input type="radio" name="q${index}" value="${option.id}" class="radio-input" />
                <span class="radio-custom"></span>
                ${option.image ? `<img src="${option.image}" alt="اختيار" style="width:100px; height:auto;" />` : `<span class="radio-text-arabic">${option.text}</span>`}
              </label>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    allQuestionsContainer.appendChild(questionElement);
  });
}

function initializeExam(totalQuestions, duration, lectureTitle, quizTitle) {
  let currentQuestion = 0;
  // Validate duration param and ensure a positive numeric value (minutes)
  if (!Number.isFinite(duration) || Number(duration) <= 0) {
    duration = 30; // fallback to 30 minutes
  }
  let totalTime = Number(duration) * 60; // duration in minutes
  let isExamFinished = false;

  const allQuestions = document.getElementById("totalQuestions");
  const questions = document.querySelectorAll(".exam-question");
  const nextBtn = document.getElementById("nextBtn");
  const prevBtn = document.getElementById("prevBtn");
  const timerEl = document.getElementById("timer");
  const finishedMsg = document.getElementById("finishedMsg");
  const questionGrid = document.getElementById("questionGrid");
  const finishBtn = document.getElementById("finishBtn");

  const skippedEl = document.getElementById("skipped");
  const solvedEl = document.getElementById("solved");
  const currentEl = document.getElementById("current");

  let answers = Array(totalQuestions).fill(null);
  let correctAnswers = Array(totalQuestions).fill(null);

  const alarmSound = new Audio("media/sound/alarm.mp3");
  let alarmPlayed = false;

  allQuestions.innerHTML = totalQuestions;

  function showResult() {
    const container = document.createElement("div");
    container.className = "result-progress";
    const correctCount = correctAnswers.filter((c) => c === true).length;
    const percentage = Math.floor((correctCount / totalQuestions) * 100);

    container.innerHTML = `
      <p class="text-center">عاش عليك يا بطل👌</p>
      <div class="progress-exam">
        <div class="progress-bar" role="progressbar" style="width: ${percentage}%" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">
          ${percentage}%
        </div>
      </div>
    `;

    finishedMsg.appendChild(container);
    finishedMsg.style.display = "block";

    questions.forEach((q, i) => {
      if (correctAnswers[i] === true) {
        q.classList.add("correct-answer");
      } else {
        q.classList.add("uncorrect-answer");
      }
    });

    const gridButtons = questionGrid.querySelectorAll("button");
    gridButtons.forEach((btn, i) => {
      btn.classList.remove("grid-unanswered", "grid-answered", "grid-current");

      if (correctAnswers[i] === true) {
        btn.classList.add("grid-correct");
      } else {
        btn.classList.add("grid-wrong");
      }

      btn.addEventListener("click", () => {
        gridButtons.forEach((btn, i) => {
          if (correctAnswers[i] === true) {
            btn.classList.add("grid-correct");
          } else {
            btn.classList.add("grid-wrong");
          }
        });

        btn.classList.add("grid-current");

        questions.forEach((q, qIdx) => {
          q.style.display = qIdx === i ? "block" : "none";
          q.classList.remove("correct-answer", "uncorrect-answer");

          if (qIdx === i) {
            if (correctAnswers[i]) {
              q.classList.add("correct-answer");
            } else {
              q.classList.add("uncorrect-answer");
            }
          }
        });

        currentQuestion = i;
        updateStats();
      });
    });

    questions.forEach((questionEl, i) => {
      const labels = questionEl.querySelectorAll("label");

      labels.forEach((label) => {
        const input = label.querySelector("input");
        input.disabled = true;

        const correctAnswer = questionEl.getAttribute("data-answer");

        if (correctAnswers[i] === true) {
          if (input.value === correctAnswer) {
            label.classList.add("show-correct");
          }
        } else {
          if (input.value === correctAnswer) {
            label.classList.add("show-correct");
          } else if (input.value === answers[i]) {
            label.classList.add("show-wrong");
          }
        }
      });
    });
  }

  async function endExam(withDelay = false) {
    clearInterval(countdown);
    isExamFinished = true;
    questions.forEach((q) => (q.style.display = "none"));
    document.querySelector(".question-nav").style.display = "none";
    finishBtn.style.display = "none";
    timerEl.textContent = "الأمتحان خلص يا بطل 💪";

    const correctCount = correctAnswers.filter((c) => c === true).length;
    const studentDataString = localStorage.getItem('studentData');
    const studentData = studentDataString ? JSON.parse(studentDataString) : null;
    const studentId = studentData ? studentData.id : null;
    const token = localStorage.getItem('apiToken');

    if (!studentId || !token) {
      Swal.fire({
        title: 'خطأ',
        text: 'يجب عليك تسجيل الدخول أولاً.',
        icon: 'error',
        confirmButtonText: 'حسناً'
      }).then(() => {
        window.location.href = 'login.html';
      });
      return;
    }

    // استخراج quiz_id من الكويز الحالي
    let quizId = null;
    try {
      const response = await tenantFetch('https://api-platfrom.ro-s.net/api/courses');
      const coursesRaw = await response.json();
      const courseList = Array.isArray(coursesRaw) ? coursesRaw : (coursesRaw.data || coursesRaw.courses || []);
      const course = courseList.find(c => c.id == courseId);
      if (course) {
        const lecture = course.lectures.find(l => l.id == lectureId);
        if (lecture && lecture.content) {
          const contentItem = lecture.content.find(item => {
            if (item.type !== 'quiz') return false;
            const possibleTitles = [item.quiz_title, item.title];
            return possibleTitles.some(t => t && t.trim() === title.trim());
          });
          if (contentItem) {
            quizId = contentItem.id || contentItem.quiz_id || null;
          }
        }
      }
    } catch (e) {
      quizId = null;
    }

    const attemptData = {
      student_id: studentId,
      course_id: parseInt(courseId),
      lecture_id: lectureId,
      lecture_title: lectureTitle,
      quiz_title: title, // استخدام العنوان الموحد من الرابط مباشرة
      quiz_id: quizId,
      score: correctCount,
      total_questions: totalQuestions,
      answers: JSON.stringify(answers),
    };

    try {
      const response = await tenantFetch('https://api-platfrom.ro-s.net/api/quiz-attempts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(attemptData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const percentage = result.data && typeof result.data.percentage !== 'undefined'
          ? result.data.percentage
          : Math.floor((correctCount / totalQuestions) * 100);
        Swal.fire({
          title: 'انتهى الاختبار!',
          html: `
                    <p>عاش عليك يا بطل👌</p>
                    <p>نتيجتك هي: ${correctCount} من ${totalQuestions}</p>
                    <div class="progress-exam">
                        <div class="progress-bar" role="progressbar" style="width: ${percentage}%" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">
                            ${percentage}%
                        </div>
                    </div>
                `,
          icon: 'success',
          confirmButtonText: 'حسناً'
        }).then(() => {
          window.location.href = `course-page.html?id=${courseId}&exam_success=true&lecture_id=${lectureId}`;
        });
      } else {
        Swal.fire({
          title: 'خطأ',
          text: result.message || 'حدث خطأ أثناء حفظ نتيجتك.',
          icon: 'error',
          confirmButtonText: 'حسناً'
        }).then(() => {
          showResult();
        });
      }
    } catch (error) {
      console.error('Error submitting quiz attempt:', error);
      Swal.fire({
        title: 'خطأ',
        text: 'حدث خطأ في الشبكة. سيتم عرض نتيجتك المحلية.',
        icon: 'error',
        confirmButtonText: 'حسناً'
      }).then(() => {
        showResult();
      });
    }
  }

  const countdown = setInterval(() => {
    let minutes = Math.floor(totalTime / 60);
    let seconds = totalTime % 60;

    timerEl.textContent = `${String(seconds).padStart(2, "0")} : ${String(
      minutes
    ).padStart(2, "0")}`;

    if (totalTime === 7 && !alarmPlayed) {
      alarmSound.play();
      alarmPlayed = true;
    }

    totalTime--;

    if (totalTime < 0) {
      endExam(false);
    }
  }, 1000);

  function showQuestion(index) {
    questions.forEach((q, i) => {
      q.parentElement.style.display = 'none';
      q.classList.remove("active");
      if (i === index) {
        q.parentElement.style.display = 'block';
        q.classList.add("active");
      }
    });
    updateStats();
    highlightGrid();
  }

  nextBtn.addEventListener("click", () => {
    if (currentQuestion < questions.length - 1) {
      currentQuestion++;
      showQuestion(currentQuestion);
    }
  });
  prevBtn.addEventListener("click", () => {
    if (currentQuestion > 0) {
      currentQuestion--;
      showQuestion(currentQuestion);
    }
  });

  finishBtn.addEventListener("click", () => {
    endExam(true);
  });

  for (let i = 1; i <= totalQuestions; i++) {
    const btn = document.createElement("button");
    btn.classList.add("grid-unanswered");
    btn.textContent = i;
    btn.addEventListener("click", () => {
      currentQuestion = i - 1;
      showQuestion(currentQuestion);
    });
    questionGrid.appendChild(btn);
  }

  function updateStats() {
    const answeredCount = answers.filter((a) => a !== null).length;
    if (solvedEl) solvedEl.textContent = answeredCount;
    if (skippedEl) skippedEl.textContent = totalQuestions - answeredCount;
    if (currentEl) currentEl.textContent = currentQuestion + 1;
  }

  function highlightGrid() {
    const gridButtons = questionGrid.querySelectorAll("button");
    gridButtons.forEach((btn, index) => {
      btn.className = "";
      if (!isExamFinished) {
        if (index === currentQuestion && answers[index] !== null) {
          btn.classList.add("grid-current", "grid-answered");
        } else if (index === currentQuestion) {
          btn.classList.add("grid-current");
        } else if (answers[index] !== null) {
          btn.classList.add("grid-answered");
        } else {
          btn.classList.add("grid-unanswered");
        }
      }
    });
  }

  questions.forEach((questionEl, questionIndex) => {
    const labels = questionEl.querySelectorAll("label");
    labels.forEach((label) => {
      const input = label.querySelector("input");

      input.addEventListener("change", () => {
        labels.forEach((lbl) => lbl.classList.remove("selected"));

        answers[questionIndex] = input.value;

        const correctAnswer = questionEl.getAttribute("data-answer");
        correctAnswers[questionIndex] = input.value === correctAnswer;

        updateStats();
        highlightGrid();
      });
    });
  });

  showQuestion(currentQuestion);
}

fetchAndDisplayQuestions();

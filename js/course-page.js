const API_URL = 'https://api-platfrom.ro-s.net/api/courses';
const PROFILE_API_URL = 'https://api-platfrom.ro-s.net/api/student/get_profile';

let coursesData = [];
let studentProfile = null;
let isUserSubscribed = false; // متغير لحفظ حالة الاشتراك
let studentProgress = {}; // متغير لحفظ تقدم الطالب
let selectedCourseGlobal = null; // متغير للكورس المحدد

document.addEventListener("DOMContentLoaded", async function () {
  await checkSubscriptionStatus();
  await fetchStudentProfile();
  await fetchCoursesData(); 
  initializeEventListeners();

  const urlParams = new URLSearchParams(window.location.search);
  const examSuccess = urlParams.get('exam_success');
  const completedLectureId = urlParams.get('lecture_id');

  if (examSuccess === 'true' && completedLectureId) {
    Swal.fire({
      title: 'تم الانتهاء من الاختبار!',
      text: 'تم تحديث حالة المحاضرة.',
      icon: 'success',
      confirmButtonText: 'حسناً'
    });
    history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }
});

// دالة للتحقق من حالة الاشتراك
async function checkSubscriptionStatus() {
  try {
    const studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
    const apiToken = studentData.api_token;

    const urlParams = new URLSearchParams(window.location.search);
    const courseId = parseInt(urlParams.get('id'));

    if (!apiToken || !courseId) {
      // إذا لم يكن المستخدم مسجلاً دخوله، أظهر زر الاشتراك
      const container = document.getElementById('subscriptionContainer');
      container.innerHTML = `
        <a href="#" class="subscription">اشترك دلوقتي</a>
      `;
      isUserSubscribed = false;
      return;
    }

    const response = await tenantFetch('https://api-platfrom.ro-s.net/api/get-courses', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + apiToken,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (data && data.success) {
      const coursesList = data.courses.data || data.courses;
      if (Array.isArray(coursesList)) {
        isUserSubscribed = coursesList.some(course => course.id === courseId);
      } else {
        isUserSubscribed = false;
      }

      const container = document.getElementById('subscriptionContainer');
      if (isUserSubscribed) {
        container.innerHTML = `
          <a href="#" class="subscription-now">أنت مشترك بالفعل</a>
        `;
      } else {
        container.innerHTML = `
          <a href="#" class="subscription">اشترك دلوقتي</a>
        `;
      }
    }
  } catch (error) {
    isUserSubscribed = false;
  }
}

async function handleOnlinePayment(courseId) {
  Swal.fire({
    title: 'جاري تحميل طرق الدفع...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const apiToken = localStorage.getItem('apiToken');
    // Use your backend route to get payment methods
    const response = await tenantFetch('https://api-platfrom.ro-s.net/api/fawaterk/payment-methods', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}` // Authorize with your backend
      }
    });

    const result = await response.json();

    if (result.status === 'success' && result.data.length > 0) {
      let paymentMethodsHtml = result.data.map(method => `
                <button class="swal2-styled fawaterk-method-btn" data-payment-id="${method.paymentId}" style="margin: 5px;">
                    <img src="${method.logo}" alt="${method.name_ar}" style="width: 50px; vertical-align: middle; margin-left: 10px;">
                    ${method.name_ar}
                </button>
            `).join('');

      Swal.fire({
        title: 'اختر طريقة الدفع',
        html: `<div style="display: flex; flex-direction: column;">${paymentMethodsHtml}</div>`,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'إلغاء'
      });

      document.querySelectorAll('.fawaterk-method-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const paymentId = btn.dataset.paymentId;
          executeFawaterkPayment(courseId, paymentId);
        });
      });

    } else {
      throw new Error('No payment methods found or API error.');
    }
  } catch (error) {
    console.error('Error fetching Fawaterk payment methods:', error);
    Swal.fire('خطأ', 'لا يمكن تحميل طرق الدفع حالياً. حاول مرة أخرى.', 'error');
  }
}

async function executeFawaterkPayment(courseId, paymentMethodId) {
  Swal.fire({
    title: 'جاري تحضير عملية الدفع...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  const studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
  const apiToken = localStorage.getItem('apiToken');
  const nameParts = studentData.name.split(' ');
  const firstName = nameParts.shift();
  const lastName = nameParts.join(' ');

  const course = coursesData.find(c => c.id == courseId);

  if (!course) {
    Swal.fire('خطأ', 'لم يتم العثور على تفاصيل الكورس.', 'error');
    return;
  }

  const cartTotal = course.discount_price ? parseFloat(course.discount_price) : parseFloat(course.price);
  if (isNaN(cartTotal)) {
    Swal.fire('خطأ', 'سعر الكورس غير صحيح.', 'error');
    return;
  }

  const cartItem = {
    name: course.name,
    price: cartTotal,
    quantity: 1
  };

  try {
    // This should be your backend endpoint
    const response = await tenantFetch('https://api-platfrom.ro-s.net/api/fawaterk/execute-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiToken}` // Sending student token to your backend
      },
      body: JSON.stringify({
        payment_method_id: paymentMethodId,
        course_id: courseId,
        cartTotal: cartTotal,
        currency: "EGP",
        cartItems: [cartItem],
        // Your backend should get the price from the course_id
        // Send customer data for Fawaterk
        customer: {
          first_name: firstName,
          last_name: lastName,
          email: studentData.email,
          phone: studentData.student_number
        }
      })
    });

    const result = await response.json();

    if (result.status === 'success' && result.data.payment_data && result.data.payment_data.redirectTo) {
      // Redirect to Fawaterk payment page
      window.location.href = result.data.payment_data.redirectTo; //
    } else if (result.status === 'success' && result.data.payment_data && result.data.payment_data.fawryCode) {
      // Handle non-redirect payments like Fawry
      const fawryCode = result.data.payment_data.fawryCode;
      const expireDate = result.data.payment_data.expireDate;
      Swal.fire({
        title: 'كود الدفع من فوري',
        html: `
                    <p>استخدم هذا الكود للدفع في أقرب منفذ فوري.</p>
                    <p style="font-size: 2em; color: #e83e8c; font-weight: bold;">${fawryCode}</p>
                    <p>صالح حتى: ${expireDate}</p>
                `,
        icon: 'info'
      });
    } else if (result.status === 'success' && result.data.payment_data && result.data.payment_data.meezaQrCode) {
      // Handle Meeza payment
      const meezaRef = result.data.payment_data.meezaReference;
      const meezaQR = result.data.payment_data.meezaQrCode;

      Swal.fire({
        title: 'الدفع باستخدام ميزة',
        html: `
                    <p>امسح الـ QR Code التالي باستخدام محفظة ميزة الخاصة بك.</p>
                    <canvas id="meeza-qrcode-canvas" style="max-width: 100%;"></canvas>
                    <p style="margin-top: 15px;">أو استخدم الرقم المرجعي:</p>
                    <p style="font-size: 1.5em; color: #e83e8c; font-weight: bold;">${meezaRef}</p>
                `,
        icon: 'info',
        didOpen: () => {
          const canvas = document.getElementById('meeza-qrcode-canvas');
          if (canvas && typeof QRCode !== 'undefined') QRCode.toCanvas(canvas, meezaQR);
        }
      });
    } else {
      throw new Error(result.message || 'حدث خطأ غير متوقع.');
    }
  } catch (error) {
    console.error('Error executing Fawaterk payment:', error);
    Swal.fire('خطأ', error.message || 'فشلت عملية الدفع. حاول مرة أخرى.', 'error');
  }
}

// ربط حدث "اشترك دلوقتي!"
document.getElementById('subscriptionContainer').addEventListener('click', function (e) {
  const subscriptionButton = e.target.closest('.subscription');
  if (subscriptionButton && !isUserSubscribed) {
    e.preventDefault();

    const studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
    const apiToken = studentData.api_token;
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = parseInt(urlParams.get('id'));

    // التحقق من تسجيل الدخول
    if (!apiToken) {
      Swal.fire({
        title: 'يجب تسجيل الدخول أولاً',
        text: 'من فضلك سجل دخولك أولاً للاشتراك في الكورسات',
        icon: 'warning',
        confirmButtonText: 'تسجيل الدخول',
        showCancelButton: true,
        cancelButtonText: 'إلغاء',
        background: 'rgb(78, 194, 192)',
        confirmButtonColor: '#FFD700',
        cancelButtonColor: '#d33'
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href = 'login.html';
        }
      });
      return;
    }

    const selectedCourse = coursesData.find(c => c.id === courseId);
    const isFree = selectedCourse && (parseFloat(selectedCourse.price) === 0 || parseFloat(selectedCourse.discount_price) === 0);

    if (isFree) {
      handleFreeSubscription(courseId);
    } else {
      showSubscriptionCodePopup(courseId);
    }
  }
});

async function handleFreeSubscription(courseId) {
  Swal.fire({
    title: 'جاري الاشتراك...',
    text: 'لحظات ويتم تفعيل اشتراكك المجاني.',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
    const apiToken = studentData.api_token;

    const response = await tenantFetch(`https://api-platfrom.ro-s.net/api/free-subscribe/${courseId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    if (response.ok && data.success) {
      await Swal.fire('🎉 تم!', 'تم اشتراكك في الكورس بنجاح.', 'success');
      window.location.href = 'courses.html';
    } else {
      throw new Error(data.message || 'فشل الاشتراك في الكورس.');
    }
  } catch (error) {
    Swal.fire('خطأ', error.message, 'error');
  }
}

async function showSubscriptionCodePopup(courseId) {
  Swal.fire({
    title: 'ادخل كود الاشتراك',
    input: 'text',
    inputPlaceholder: 'أدخل الكود هنا',
    showCancelButton: true,
    confirmButtonText: 'تفعيل الكود',
    cancelButtonText: 'إلغاء',
    background: 'rgb(78, 194, 192)',
    confirmButtonColor: '#FFD700',
    cancelButtonColor: '#d33'
  }).then(async (result) => {
    if (result.isConfirmed && result.value) {
      const apiToken = localStorage.getItem('apiToken');
      try {
        const res = await tenantFetch(`https://api-platfrom.ro-s.net/api/coupon/redeem`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ code: result.value, course_id: courseId })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          Swal.fire({
            title: '🎉 تم الاشتراك بنجاح!',
            icon: 'success',
            confirmButtonText: 'اذهب للكورس',
            background: 'rgb(78, 194, 192)',
            confirmButtonColor: '#FFD700'
          }).then(() => {
            location.reload();
          });
        } else {
          Swal.fire({
            title: 'كود غير صالح',
            text: data.message || 'تأكد من الكود وحاول مرة أخرى',
            icon: 'error',
            background: 'rgb(78, 194, 192)',
            confirmButtonColor: '#FFD700'
          });
        }
      } catch (err) {
        Swal.fire({
          title: 'خطأ في الاتصال',
          text: 'تأكد من اتصالك بالإنترنت',
          icon: 'error',
          background: 'rgb(78, 194, 192)',
          confirmButtonColor: '#FFD700'
        });
      }
    }
  });
}

async function fetchStudentProfile() {
  try {
    const token = localStorage.getItem('apiToken') || localStorage.getItem('api_token') || '';
    const response = await tenantFetch(PROFILE_API_URL, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    const data = await response.json();
    studentProfile = data.student;
  } catch (error) {
    studentProfile = { student_number: 'STUDENT_NUMBER' };
  }
}

async function fetchStudentProgress(courseId, lectures) {
  const token = localStorage.getItem('apiToken');
  if (!token || !isUserSubscribed) return {};

  const progress = {};
  const promises = [];

  for (const lecture of lectures) {
    if (lecture.content && lecture.content.length > 0) {
      lecture.content.forEach(item => {
        if (item.type && item.type.toLowerCase() === 'quiz') {
          const quizId = item.id || item.quiz_id;
          const promise = tenantFetch('https://api-platfrom.ro-s.net/api/check-attempt', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              course_id: courseId,
              lecture_id: lecture.id,
              quiz_id: quizId
            })
          })
            .then(response => response.json())
            .then(result => {
              // ربط التقدم حسب lecture.id و quizId
              if (!progress[lecture.id]) progress[lecture.id] = {};
              if (result && result.success && result.attempt_exists && result.completed_at) {
                progress[lecture.id][quizId] = result;
              } else {
                progress[lecture.id][quizId] = {
                  attempt_exists: false
                };
              }
            })
            .catch(error => {
              if (!progress[lecture.id]) progress[lecture.id] = {};
              progress[lecture.id][quizId] = {
                attempt_exists: false
              };
            });
          promises.push(promise);
        }
      });
    }
  }

  await Promise.all(promises);
  return progress;
}


async function fetchCoursesData() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const courseIdParam = urlParams.get('id');

    if (!courseIdParam || isNaN(parseInt(courseIdParam))) {
      Swal.fire({
        title: '⚠️ لم يتم تحديد كورس',
        text: 'تأكد من الرابط وحاول مرة أخرى.',
        icon: 'warning',
        background: 'rgb(78, 194, 192)',
        confirmButtonColor: '#FFD700',
      });
      window.location.href = 'index.html';
      return;
    }

    const courseId = parseInt(courseIdParam);
    const response = await tenantFetch(API_URL);
    const jsonResponse = await response.json();
    const data = jsonResponse.data || jsonResponse;
    coursesData = data; // Store all courses data
    const selectedCourse = data.find(c => c.id == courseId);
    selectedCourseGlobal = selectedCourse;

    if (!selectedCourse) {
      Swal.fire({
        title: `⚠️ لم يتم العثور على الكورس`,
        text: `الكورس بالرقم ${courseId} غير موجود.`,
        icon: 'error',
        background: 'rgb(78, 194, 192)',
        confirmButtonColor: '#FFD700'
      });
      return;
    }

    // Check for lectures and render them, or show a message
    if (selectedCourse.lectures && selectedCourse.lectures.length > 0) {
      studentProgress = await fetchStudentProgress(courseId, selectedCourse.lectures);
      console.log("Student Progress after fetch:", studentProgress);
      renderCourses([selectedCourse], studentProgress);
    } else {
      // Even if no lectures, check if course is free to update button text
      const isFree = selectedCourse && (parseFloat(selectedCourse.price) === 0 || parseFloat(selectedCourse.discount_price) === 0);
      if (!isUserSubscribed && isFree) {
        const container = document.getElementById('subscriptionContainer');
        container.innerHTML = `
          <a href="#" class="subscription">اشترك الآن مجاناً</a>
        `;
      }

      const container = document.querySelector('#coursesContainer .col-md-12');
      container.innerHTML = `
        <div class="col-12 text-center mt-5">
          <div class="alert alert-secondary" style="padding: 2rem; border-radius: 15px;">
            <h4 class="alert-heading" style="font-family: 'DG-3asomy-Regular';">لا توجد خرائط!</h4>
            <p style="font-size: 18px;">لا توجد أي خرائط (محاضرات) متاحة لهذه المهمة في الوقت الحالي. تابعنا قريبًا!</p>
          </div>
        </div>
      `;
    }
    hideLoading();
  } catch (error) {
    console.error("Critical error in fetchCoursesData:", error);
    Swal.fire({
      title: '❌ خطأ في التحميل',
      text: 'حدث خطأ أثناء تحميل بيانات الكورس. حاول مرة أخرى.',
      icon: 'error',
      background: 'rgb(78, 194, 192)',
      confirmButtonColor: '#FFD700'
    });
  }
}

function hideLoading() {
  const loadingElement = document.getElementById('loadingIndicator');
  if (loadingElement) {
    loadingElement.style.display = 'none';
  }
}

function showError() {
  const container = document.querySelector('#coursesContainer .col-md-12');
  container.innerHTML = `
    <div style="text-align: center; padding: 20px; color: red;">
      <i class="fas fa-exclamation-triangle"></i> حدث خطأ في تحميل البيانات
    </div>
  `;
}

function renderCourses(courses, studentProgress) {
  const container = document.querySelector('#coursesContainer .col-md-12');

  container.innerHTML = '';
  let globalLock = false; // Initialize global lock

  courses.forEach((course, courseIndex) => {
    course.lectures.forEach((lecture, lectureIndex) => {
      let isLectureLocked = false; // This will be the final lock status for the current lecture

      console.log(`--- Lecture ${lectureIndex}: ${lecture.title} (ID: ${lecture.id}) ---`);
      console.log(`Initial isLectureLocked: ${isLectureLocked}`);

      if (!isUserSubscribed) {
        isLectureLocked = true; // Lock if not subscribed
        console.log(`Locked due to subscription. isLectureLocked: ${isLectureLocked}`);
      } else if (globalLock) {
        isLectureLocked = true; // Lock if a previous lecture caused a global lock
        console.log(`Locked due to globalLock. isLectureLocked: ${isLectureLocked}`);
      } else if (lectureIndex > 0) {
        const prevLecture = course.lectures[lectureIndex - 1];
        const prevLectureProgress = studentProgress[prevLecture.id];
        const prevLectureHasQuiz = prevLecture.content && prevLecture.content.some(item => item.type && item.type.toLowerCase().includes('quiz'));

        console.log(`Previous Lecture (ID: ${prevLecture.id}):`);
        console.log(`  Has Quiz: ${prevLectureHasQuiz}`);
        console.log(`  Progress:`, prevLectureProgress);

        // Check if previous lecture's quiz is completed and passed
        const isPrevLectureCompleted = !prevLectureHasQuiz || (prevLectureProgress && prevLectureProgress.attempt_exists && (prevLectureProgress.score >= prevLectureProgress.total_questions / 2));
        console.log(`  isPrevLectureCompleted: ${isPrevLectureCompleted}`);

        if (!isPrevLectureCompleted) {
          isLectureLocked = true;
          globalLock = true; // Set global lock if this lecture is locked due to an uncompleted quiz
          console.log(`Locked due to uncompleted previous lecture. isLectureLocked: ${isLectureLocked}, globalLock: ${globalLock}`);
        }
      }
      console.log(`Final isLectureLocked for Lecture ${lectureIndex}: ${isLectureLocked}`);

      const lectureHTML = createLectureAccordionHTML(course, lecture, courseIndex, lectureIndex, studentProgress, course.lectures, isLectureLocked); // Pass course and lecture
      container.insertAdjacentHTML('beforeend', lectureHTML);
    });
  });
}

function createLectureAccordionHTML(course, lecture, courseIndex, lectureIndex, studentProgress, allLectures, isLectureLocked) {
  // disabledClass for sub-toggles and buttons
  const subToggleDisabledClass = !isUserSubscribed || isLectureLocked ? 'disabled' : '';
  // lockIcon for sub-toggle titles
  const subToggleLockIcon = isLectureLocked ? '<i class="fas fa-lock restriction-lock"></i>' : '';

  let lectureContentHTML = '';
  if (lecture.content && lecture.content.length > 0) {
    lecture.content.forEach((item, contentIndex) => {
      // 🔹 إخفاء الكويزات لطلاب السنتر
      const studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
      if (studentData.student_type === 'center' && item.type === 'quiz') return;

      if (item.type === 'video') {
        let videoButtonHTML = '';
        // Only show video button if not locked AND user is subscribed
        if (!isLectureLocked && isUserSubscribed) {
          videoButtonHTML = `<a href="#" class="video-button button" data-course="${courseIndex}" data-lecture="${lectureIndex}" data-content-index="${contentIndex}">مشاهدة الفيديو</a>`;
        }

        const videoId = item.id;

        lectureContentHTML += `
                  <div class="accordion-sub-toggle ${subToggleDisabledClass}">
                    <span>
                      <i class="fas fa-video icon-video"></i>
                      ${item.video_title || item.title || 'فيديو'}
                      ${subToggleLockIcon}
                    </span>
                    ${videoButtonHTML}
                  </div>
                  <div class="accordion-sub-content">
                    <p>فيديو شرح المحاضرة</p>
                    <div class="video-views-progress" style="display: none; margin-top: 10px; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 5px; text-align: center; color: black;">
                        <span class="views-remaining" data-video-id="${videoId}"></span>
                    </div>
                  </div>
                `;
      } else if (item.type === 'quiz') {
        // ربط التقدم حسب quiz_id
        const quizId = item.id || item.quiz_id;
        const attempt = studentProgress[lecture.id] && studentProgress[lecture.id][quizId] ? studentProgress[lecture.id][quizId] : null;
        let examButtonHTML = '';

        // عرض النتيجة إذا كانت المحاولة تخص نفس الكويز أو إذا لم يرجع backend quiz_id لكن المحاولة متطابقة مع الكويز الحالي
        const isMatchingAttempt = attempt && attempt.attempt_exists && (
          (attempt.quiz_id && attempt.quiz_id == quizId) ||
          (!attempt.quiz_id && attempt.lecture_id == lecture.id && typeof attempt.score !== 'undefined' && typeof attempt.total_questions !== 'undefined')
        );
        if (isUserSubscribed && isMatchingAttempt) {
          const percentage = attempt.percentage;
          const attempt_count_key = `exam_attempt_count_${course.id}_${lecture.id}_${quizId}`;
          const attemptCount = parseInt(localStorage.getItem(attempt_count_key) || '0');

          // إذا كانت المحاولة مكتملة (completed_at موجود)، لا تعرض زر الامتحان أبداً
          if (attempt.completed_at) {
            examButtonHTML = `<span class="button exam-score">النتيجة: ${attempt.score} / ${attempt.total_questions}</span>`;
          } else if (percentage < 50 && attemptCount < 3) {
            examButtonHTML = `<a href="#" class="exam-button button" data-course="${courseIndex}" data-lecture="${lectureIndex}" data-content-index="${contentIndex}">إعادة الامتحان</a>`;
          } else {
            examButtonHTML = `<span class="button exam-score">النتيجة: ${attempt.score} / ${attempt.total_questions}</span>`;
          }
        } else {
          // Exam button should be disabled if lecture is locked or user not subscribed
          const examButtonDisabledClass = !isUserSubscribed || isLectureLocked ? 'disabled' : '';
          examButtonHTML = `<a href="#" class="exam-button button ${examButtonDisabledClass}" data-course="${courseIndex}" data-lecture="${lectureIndex}" data-content-index="${contentIndex}">بدأ الأمتحان</a>`;
        }

        // جمع كل الأسئلة من المصادر الثلاثة
        const quizQuestionsCount = Array.isArray(item.quiz_questions) ? item.quiz_questions.filter(q => q && Object.keys(q).length > 0).length : 0;
        const manualQuestionsCount = Array.isArray(item.manualQuestions) ? item.manualQuestions.filter(q => q && Object.keys(q).length > 0).length : 0;
        const bankQuestionsCount = Array.isArray(item.bankQuestions) ? item.bankQuestions.filter(q => q && Object.keys(q).length > 0).length : 0;
        const totalQuestionsCount = quizQuestionsCount + manualQuestionsCount + bankQuestionsCount;
        lectureContentHTML += `
                  <div class="accordion-sub-toggle ${subToggleDisabledClass}">
                    <span>
                      <i class="fas fa-clipboard icon-exam"></i> ${item.quiz_title || item.title || 'امتحان المحاضرة'}
                      ${subToggleLockIcon}
                    </span>
                    ${examButtonHTML}
                  </div>
                  <div class="accordion-sub-content">
                    <p>عدد الأسئلة: ${totalQuestionsCount}</p>
                  </div>
                `;
      // ...existing code...
      } else if (item.type === 'explanation_file' || item.type === 'file') {
        let fileButtonHTML = '';
        let filePath = item.url || item.explanation_file_path;
        if (filePath) {
          if (!filePath.startsWith("http")) {
            // Remove leading slash if exists to avoid double slashes
            const cleanPath = filePath.replace(/^\//, '');
            filePath = `http://127.0.0.1:8000/storage/${cleanPath}`;
          }
        } else {
          filePath = '#';
        }

        // Only show button if not locked AND user is subscribed
        if (!isLectureLocked && isUserSubscribed) {
          // Use target="_blank" to open in a new tab
          fileButtonHTML = `<a href="${filePath}" target="_blank" rel="noopener noreferrer" class="button file-button">تحميل الملف</a>`;
        }

        lectureContentHTML += `
                  <div class="accordion-sub-toggle ${subToggleDisabledClass}">
                    <span>
                      <i class="fas fa-file-pdf icon-file"></i> ${item.explanation_title || item.title || 'ملف شرح'}
                      ${subToggleLockIcon}
                    </span>
                    ${fileButtonHTML}
                  </div>
                  <div class="accordion-sub-content"></div>
                `;
      }
    });
  }

  let restrictionMessage = '';
  if (!isUserSubscribed) {
    restrictionMessage = '<div class="restriction-message"><i class="fas fa-lock"></i><p style="color: white;">يجب الاشتراك للوصول إلى محتوى الكورس</p></div>';
  } else if (isLectureLocked) {
    restrictionMessage = '<div class="restriction-message"><i class="fas fa-lock"></i><p style="color: white;">يجب إكمال المحاضرة السابقة أولاً للوصول إلى هذا المحتوى.</p></div>';
  }

  // No disabledClass, titleStyle, h2Style, or lockIcon on the main accordion-card/title
  return `
    <div class="accordion-card">
      <div class="accordion-title main-toggle" data-course="${courseIndex}" data-lecture="${lectureIndex}">
        <div class="title-text">
          <i class="fas fa-th-large icon-main"></i>
          <h2>${lecture.title}</h2>
        </div>
      </div>

      <div class="accordion-main-body" data-course="${courseIndex}" data-lecture="${lectureIndex}">
        ${lectureContentHTML}
        ${restrictionMessage}
      </div>
    </div>
  `;
}


function initializeEventListeners() {
  document.querySelectorAll(".main-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const mainBody = toggle.nextElementSibling;

      toggle.classList.toggle("open");
      mainBody.classList.toggle("open");
      mainBody.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  document.querySelectorAll(".accordion-sub-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      if (toggle.classList.contains('disabled')) return;
      toggle.classList.toggle("open");
      const content = toggle.nextElementSibling;
      content.classList.toggle("open");
      content.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  document.querySelectorAll(".video-button, .exam-button").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();

      if (this.classList.contains('disabled')) {
        if (!isUserSubscribed) {
          Swal.fire({
            title: 'غير مشترك',
            text: 'يجب عليك الاشتراك في الكورس أولاً للوصول إلى هذا المحتوى.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'اذهب للاشتراك',
            cancelButtonText: 'إلغاء'
          }).then((result) => {
            if (result.isConfirmed) {
              const courseId = selectedCourseGlobal?.id;
              if (courseId) showSubscriptionCodePopup(courseId);
            }
          });
        } else {
          Swal.fire({
            title: 'المحاضرة مقفلة',
            text: 'يجب عليك إتمام المحاضرة السابقة أولاً.',
            icon: 'warning',
            confirmButtonText: 'حسناً'
          });
        }
        return;
      }

      const courseIndex = this.dataset.course;
      const lectureIndex = this.dataset.lecture;
      const contentIndex = this.dataset.contentIndex;

      if (this.classList.contains('video-button')) {
        openVideo(courseIndex, lectureIndex, contentIndex);
      } else if (this.classList.contains('exam-button')) {
        openInteractiveContent(courseIndex, lectureIndex, contentIndex); // This was already correct
      }
    });
  });

  document.querySelectorAll(".close-video-btn").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      const courseIndex = this.dataset.course;
      closeVideo(courseIndex);
    });
  });

  document.querySelectorAll(".close-exam-btn").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      const courseIndex = this.dataset.course;
      closeExam(courseIndex);
    });
  });
}

// دالة لإظهار تنبيه الاشتراك
function showSubscriptionAlert(message) {
  alert(message + 'اضغط على "اشترك دلوقتي" للاشتراك في الكورس');

  const subscriptionContainer = document.getElementById('subscriptionContainer');
  if (subscriptionContainer) {
    subscriptionContainer.scrollIntoView({ behavior: "smooth", block: "center" });
    subscriptionContainer.classList.add('highlight');
    setTimeout(() => {
      subscriptionContainer.classList.remove('highlight');
    }, 3000);
  }
}
function getYouTubeVideoId(url) {
  if (!url) return null;
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const matches = url.match(regex);
  return matches ? matches[1] : null;
}

function openVideo(courseIndex, lectureIndex, contentIndex) {
  const course = selectedCourseGlobal;
  const lecture = course.lectures[lectureIndex];
  const contentItem = lecture.content[contentIndex];
  const apiToken = JSON.parse(localStorage.getItem('studentData') || '{}').api_token;

  const videoId = contentItem.id;

  if (!videoId) {
    console.error("Video content item is missing a unique 'id' property.", contentItem);
    Swal.fire('خطأ في الإعداد', 'معرف الفيديو غير موجود. لا يمكن تتبع المشاهدات.', 'error');
    return;
  }
  console.log('Sending course_id:', course.id);

  tenantFetch('https://api-platfrom.ro-s.net/api/video/play', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify({
      course_id: course.id,       // ← إرسال فقط ID الكورس

      video_id: videoId,
      video_url: contentItem.url || contentItem.video_url
    })
  })
    .then(response => response.json().then(data => ({ ok: response.ok, status: response.status, data })))
    .then(({ ok, status, data }) => {
      if (!ok) {
        console.log('Course data being sent:', course);

        throw new Error(data.message || `An error occurred: ${status}`);
      }

      const youtubeVideoId = getYouTubeVideoId(data.video_url);
      if (!youtubeVideoId) {
        console.error("Invalid YouTube URL received from backend:", data.video_url);
        return;
      }

      const videoPreview = document.getElementById(`videoPreview-${courseIndex}`);
      videoPreview.style.display = "block";
      videoPreview.classList.add("show", "space");
      videoPreview.scrollIntoView({ behavior: 'smooth', block: 'center' });

      if (window.loadYouTubeVideo) {
        window.loadYouTubeVideo(youtubeVideoId);
      }

      // Update the UI with the remaining views count
      const viewsSpan = document.querySelector(`.views-remaining[data-video-id="${videoId}"]`);
      if (viewsSpan) {
        const remaining = data.remaining_views;
        let viewsText = `عدد المشاهدات المتبقي: ${remaining}`;
        if (remaining <= 0) {
          viewsText = 'لقد استهلكت جميع محاولات المشاهدة';
        }
        viewsSpan.textContent = viewsText;
        viewsSpan.parentElement.style.display = 'block'; // Make the container visible
      }
    })
    .catch(error => {
      Swal.fire({
        title: 'لا يمكن تشغيل الفيديو',
        text: error.message,
        icon: 'error',
        confirmButtonText: 'حسناً'
      });
    });
}






function closeVideo(courseIndex) {
  const videoPreview = document.getElementById(`videoPreview-${courseIndex}`);
  if (window.customYoutubePlayer) {
    window.customYoutubePlayer.pause();
    window.customYoutubePlayer.stop();
  }
  videoPreview.style.display = "none";
  videoPreview.classList.remove("show", "space");
}

function closeExam(courseIndex) {
  const examPreview = document.getElementById(`examPreview-${courseIndex}`);
  examPreview.style.display = "none";
  examPreview.classList.remove("show", "space");
}

function openInteractiveContent(courseIndex, lectureIndex, contentIndex) {
  const course = selectedCourseGlobal;
  const lecture = course.lectures[lectureIndex];
  const contentItem = lecture.content[contentIndex];

  if (contentItem.type === 'quiz') {
    // دعم جميع مصادر الأسئلة
    const hasQuestions = (Array.isArray(contentItem.quiz_questions) && contentItem.quiz_questions.length > 0)
      || (Array.isArray(contentItem.manualQuestions) && contentItem.manualQuestions.length > 0)
      || (Array.isArray(contentItem.bankQuestions) && contentItem.bankQuestions.length > 0);
    if (!hasQuestions) {
      Swal.fire("⚠️", "لا توجد أسئلة متاحة لهذا الكويز", "warning");
      return;
    }
    window.location.href = `exam.html?course_id=${course.id}&lecture_id=${lecture.id}&title=${encodeURIComponent(contentItem.quiz_title || contentItem.title || '')}`;
  }
}

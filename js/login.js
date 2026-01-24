document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector("form");
  const studentNumberInput = document.getElementById("student-number");
  const passwordInput = document.getElementById("password");
  const errorMessage = document.getElementById("error-message");

  // توليد أو جلب device_id من localStorage
  let device_id = localStorage.getItem('device_id');
  if (!device_id) {
    device_id = crypto.randomUUID();
    localStorage.setItem('device_id', device_id);
  }

  const user_agent = navigator.userAgent;

  async function getIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (err) {
      console.error('Failed to get IP:', err);
      return '0.0.0.0'; // قيمة افتراضية لو فشل
    }
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    errorMessage.innerText = "";

    const studentNumber = studentNumberInput.value.trim();
    const password = passwordInput.value.trim();

    if (!studentNumber) {
      errorMessage.classList.add("error-message");
      errorMessage.innerText = "من فضلك اكتب رقمك.";
      return;
    }
    if (!password) {
      errorMessage.classList.add("error-message");
      errorMessage.innerText = "من فضلك اكتب كلمة السر.";
      return;
    }

    const submitButton = form.querySelector('input[type="submit"]');
    const originalButtonText = submitButton.value;
    submitButton.value = "جاري تسجيل الدخول...";
    errorMessage.classList.remove("error-message");
    submitButton.disabled = true;

    try {
      const ip = await getIP();

      const response = await fetch('https://api-platfrom.ro-s.net/api/student/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          student_number: studentNumber,
          password: password,
          device_id: device_id,
          user_agent: user_agent,
          ip: ip
        })
      });

      const data = await response.json();
      const apiToken = data.api_token || (data.student && data.student.api_token);

      if (response.ok && data.student && apiToken) {
        localStorage.setItem('studentData', JSON.stringify(data.student));
        localStorage.setItem('apiToken', apiToken);

        Swal.fire({
          html: '<p style="font-size: 22px; color: white; font-weight: bold;">انت دلوقتي داخل شبكة العمليات اجهز!</p>',
          icon: 'success',
          confirmButtonText: 'ابدأ بأول مهمه',
          background: '#810000',
          color: '#f3f3f3',
          confirmButtonColor: '#1B1717',
          confirmButtonTextColor: '#f3f3f3',
          customClass: {
            popup: 'swal-custom-popup',
            confirmButton: 'swal-confirm-button'
          }
        }).then(() => {
          window.location.href = 'courses.html';
        });

      } else {
        Swal.fire({
          title: 'خطأ في تسجيل الدخول',
          text: data.message || 'حدث خطأ في تسجيل الدخول',
          icon: 'error',
          confirmButtonText: 'حاول تاني',
          background: '#1B1717',
          color: '#f3f3f3',
          confirmButtonColor: '#1B1717',
          confirmButtonTextColor: '#f3f3f3',
          customClass: {
            popup: 'swal-custom-popup',
            confirmButton: 'swal-confirm-button'
          }
        });
      }

    } catch (error) {
      console.error('Error:', error);
      Swal.fire({
        title: 'خطأ في الاتصال',
        text: 'حدث خطأ في الاتصال بالخادم، حاول مرة أخرى',
        icon: 'error',
        confirmButtonText: 'حاول تاني',
        background: '#1B1717',
        color: '#f3f3f3',
        confirmButtonTextColor: '#f3f3f3',
        customClass: {
          popup: 'swal-custom-popup',
          confirmButton: 'swal-confirm-button'
        }
      });
    } finally {
      submitButton.value = originalButtonText;
      submitButton.disabled = false;
    }
  });
});

// كود لتبديل إظهار كلمة المرور
setTimeout(function () {
  document.querySelectorAll('.toggle-password').forEach(function (icon) {
    icon.onclick = function () {
      const target = document.getElementById(this.dataset.target);
      if (target.type === 'password') {
        target.type = 'text';
        this.className = 'fa-solid fa-eye-slash toggle-password';
      } else {
        target.type = 'password';
        this.className = 'fa-solid fa-eye toggle-password';
      }
    };
  });
}, 1000);

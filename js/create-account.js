document.addEventListener("DOMContentLoaded", function () {
  console.log("Create Account JS Loaded");
  function normalizeNumber(input) {
    return input.replace(
      /[٠١٢٣٤٥٦٧٨٩]/g,
      (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]
    );
  }

  const form = document.querySelector("form");
  const nameInput = document.getElementById("name");
  const phoneStudentInput = document.getElementById("phone-student");
  const phoneParentInput = document.getElementById("phone-parent");
  const passwordInput = document.querySelector("#password");
  const confirmPasswordInput = document.querySelector("#confirm-password");
  const errorMessage = document.getElementById("error-message");

  function updateHiddenInputs() {
    const dropdowns = document.querySelectorAll(".custom-dropdown");
    dropdowns.forEach((dropdown) => {
      const selected = dropdown.querySelector(".selected");
      const name = dropdown.dataset.name;
      const hiddenInput = document.getElementById("input-" + name);

      if (hiddenInput && selected.dataset.value) {
        hiddenInput.value = selected.dataset.value;
      }
    });
  }

  // Fetch Grades
  tenantFetch("https://api-platfrom.ro-s.net/api/grades")
    .then((response) => response.json())
    .then((data) => {
      const gradesList = document.getElementById("grades-list");
      gradesList.innerHTML = "";

      let grades = [];
      if (Array.isArray(data)) {
        grades = data;
      } else if (data.data && Array.isArray(data.data)) {
        grades = data.data;
      }

      grades.forEach((grade) => {
        const li = document.createElement("li");
        li.dataset.value = grade.id;
        li.textContent = grade.name;
        gradesList.appendChild(li);
      });

      // Re-attach event listeners after populating
      attachDropdownListeners();
    })
    .catch((error) => console.error("Error fetching grades:", error));

  function attachDropdownListeners() {
    document.querySelectorAll(".custom-dropdown").forEach((dropdown) => {
      const selected = dropdown.querySelector(".selected");
      const options = dropdown.querySelectorAll("li");

      // Remove old listener to prevent duplicates if function called multiple times? 
      // Better to just add listener to the new options.
      // We will just clear and re-add for simplicity or target specific ones.
      // But since we are doing this on load, it's fine.

      // Re-adding listener to 'selected' might duplicate it if not careful.
      // So let's separate the logic.

      // Only add click event to options, assuming selected's event is already there or handled below.
      options.forEach((option) => {
        option.addEventListener("click", () => {
          selected.textContent = option.textContent;
          selected.dataset.value = option.dataset.value;
          dropdown.classList.remove("active-select");

          const name = dropdown.dataset.name;
          const hiddenInput = document.getElementById("input-" + name);
          if (hiddenInput) {
            hiddenInput.value = option.dataset.value;
          }
        });
      });
    });
  }

  // Original Dropdown Logic - Modified to handle initial load
  document.querySelectorAll(".custom-dropdown").forEach((dropdown) => {
    const selected = dropdown.querySelector(".selected");

    selected.addEventListener("click", () => {
      document.querySelectorAll(".custom-dropdown").forEach((d) => {
        if (d !== dropdown) d.classList.remove("active-select");
      });
      dropdown.classList.toggle("active-select");
    });

    // Initial options (for governorate) default listener
    const options = dropdown.querySelectorAll("li");
    options.forEach((option) => {
      option.addEventListener("click", () => {
        selected.textContent = option.textContent;
        selected.dataset.value = option.dataset.value;
        dropdown.classList.remove("active-select");

        const name = dropdown.dataset.name;
        const hiddenInput = document.getElementById("input-" + name);
        if (hiddenInput) {
          hiddenInput.value = option.dataset.value;
        }
      });
    });
  });

  window.addEventListener("click", (e) => {
    if (!e.target.closest(".custom-dropdown")) {
      document
        .querySelectorAll(".custom-dropdown")
        .forEach((d) => d.classList.remove("active-select"));
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    updateHiddenInputs();
    errorMessage.innerText = "";

    const name = nameInput.value.trim();
    const phoneStudent = normalizeNumber(phoneStudentInput.value.trim());
    const phoneParent = normalizeNumber(phoneParentInput.value.trim());

    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const academicYear = document.getElementById("input-academicYear").value;
    const governorate = document.getElementById("input-governorate").value;

    if (name.length < 2) {
      errorMessage.innerText = "من فضلك اكتب اسمك كامل.";
      errorMessage.classList.add("error-message");
      return;
    }

    const phoneRegex = /^01[0-9]{9}$/;
    if (!phoneRegex.test(phoneStudent)) {
      errorMessage.innerText = "رقم الطالب غير صحيح.";
      errorMessage.classList.add("error-message");
      return;
    }

    if (!phoneRegex.test(phoneParent)) {
      errorMessage.innerText = "رقم ولي الأمر غير صحيح.";
      errorMessage.classList.add("error-message");
      return;
    }

    if (phoneParent === phoneStudent) {
      errorMessage.innerText = "لازم رقمك يكون مختلف عن رقم ولي الأمر.";
      errorMessage.classList.add("error-message");
      return;
    }

    if (!academicYear) {
      errorMessage.innerText = "من فضلك اختر السنة الدراسية.";
      errorMessage.classList.add("error-message");
      return;
    }
    if (!governorate) {
      errorMessage.innerText = "من فضلك اختر المحافظة.";
      errorMessage.classList.add("error-message");
      return;
    }

    if (password.length < 6) {
      errorMessage.innerText = "كلمة السر يجب أن تكون ٦ أحرف على الأقل.";
      errorMessage.classList.add("error-message");
      return;
    }

    if (password !== confirmPassword) {
      errorMessage.innerText = "كلمة السر وتأكيدها غير متطابقين.";
      errorMessage.classList.add("error-message");
      return;
    }

    errorMessage.classList.remove("error-message");

    const submitButton = form.querySelector('input[type="submit"]');
    const originalButtonText = submitButton.value;
    submitButton.value = "جاري إنشاء الحساب...";
    submitButton.disabled = true;

    const requestData = {
      name: name,
      student_number: phoneStudent,
      parent_mobile: phoneParent,
      academic_year: academicYear,
      governorate: governorate,
      password: password,
      password_confirmation: confirmPassword,
    };

    tenantFetch("https://api-platfrom.ro-s.net/api/student/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestData),
    })
      .then((res) =>
        res.json().then((data) => ({ status: res.status, body: data }))
      )
      .then(({ status, body }) => {
        if (status === 201 || status === 200) {
          const apiToken = body.api_token || (body.student && body.student.api_token);
          if (body && body.student && apiToken) {
            localStorage.setItem("studentData", JSON.stringify(body.student));
            localStorage.setItem("apiToken", apiToken);
            window.location.href = "courses.html";
            return;
          }

          Swal.fire({
            title: "تم إنشاء حسابك بنجاح 🎉",
            text: "أهلاً بيك! جاهز تبدأ؟",
            icon: "success",
            confirmButtonText: "ابدأ الآن",
            background: "#810000",
            color: "#f3f3f3",
            confirmButtonColor: "#1B1717",
            customClass: { popup: "swal-custom-popup" },
          }).then(() => {
            window.location.href = "login.html";
          });
        } else {
          const errorMsg =
            body.message || "حدث خطأ أثناء إنشاء حسابك، حاول مرة أخرى.";

          Swal.fire({
            title: "خطأ أثناء إنشاء الحساب",
            text: errorMsg,
            icon: "error",
            confirmButtonText: "إعادة المحاولة",
            background: "#4B5563",
            color: "#1B1717",
            confirmButtonColor: "#f3f3f3",
          });
        }
      })
      .catch((error) => {
        console.error("Fetch error:", error);

        Swal.fire({
          title: "مشكلة في الاتصال بالسيرفر",
          text: "حدثت مشكلة في الاتصال، حاول مرة أخرى.",
          icon: "error",
          confirmButtonText: "إعادة المحاولة",
          background: "#4B5563",
          color: "#1B1717",
          confirmButtonColor: "#f3f3f3",
        });
      })
      .finally(() => {
        submitButton.value = originalButtonText;
        submitButton.disabled = false;
      });
  });
});

setTimeout(function () {
  document.querySelectorAll(".toggle-password").forEach(function (icon) {
    icon.onclick = function () {
      const target = document.getElementById(this.dataset.target);
      if (target.type === "password") {
        target.type = "text";
        this.className = "fa-solid fa-eye-slash toggle-password";
      } else {
        target.type = "password";
        this.className = "fa-solid fa-eye toggle-password";
      }
    };
  });
}, 1000);

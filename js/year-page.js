
// Wait for tenantFetch to be available before running main logic
function waitForTenantFetchAndRun(fn) {
  if (typeof window.tenantFetch === 'function') {
    fn();
  } else {
    setTimeout(() => waitForTenantFetchAndRun(fn), 50);
  }
}

const urlParams = new URLSearchParams(window.location.search);
const gradeId = urlParams.get("grade_id");
const storageBaseUrl = "https://api-platfrom.ro-s.net/public/storage/";
const API_URL = "https://api-platfrom.ro-s.net/api/get-courses";

let acadymicYear = "السنة الدراسية"; // Ensure acadymicYear is defined

function main() {
  async function fetchYearCourses() {
    if (!gradeId) return;

    let filterCourses = [];
    let subscribedIds = [];

    // 1) جلب الكورسات
    try {
      const response = await tenantFetch(
        `https://api-platfrom.ro-s.net/api/courses?grade_id=${gradeId}`
      );
      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status}`);
      }

      const jsonResponse = await response.json();
      const courses = jsonResponse.data || jsonResponse; // Handle data wrapper

      if (Array.isArray(courses)) {
        filterCourses = courses.filter(course => (course.study_level_id == gradeId) || (course.grade && course.grade.id == gradeId) || (course.grade_id == gradeId));
        console.log("Filtered courses:", filterCourses);
      } else {
        console.error("Courses response is not an array:", courses);
      }

      // Update header dynamically if we have courses
      if (filterCourses.length > 0 && filterCourses[0].grade) {
        updateHeader(filterCourses[0].grade.name);
      }

    } catch (error) {
      console.error("Error fetching courses:", error);
    }

    // 2) جلب اشتراكات الطالب
    try {
      const apiToken = localStorage.getItem("apiToken");

      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      if (apiToken) {
        headers["Authorization"] = `bearer ${apiToken}`;
      }

      const response = await tenantFetch(API_URL, { method: "GET", headers });
      const studentData = await response.json();

      if (studentData.success === true) {
        subscribedIds = studentData.courses.map(course => course.id);
      }

    } catch (err) {
      console.error("Error fetching student courses:", err);
    }

    // 3) عرض الكورسات بعد تجهيز البيانات كلها
    displayCourses(filterCourses, subscribedIds);
  }

  fetchYearCourses();
}

waitForTenantFetchAndRun(main);


const speacialHeading = document.querySelector(".speacial-heading");

// Map IDs to Names based on your API
// ID 1 -> الصف الاول الاعدادي
// ID 2 -> الصف الثاني الاعدادي
// ID 3 -> الصف الثالث الاعدادي
// ID 4 -> الصف الاول الثانوي
// We can try to fetch the grade name dynamically if possible, but for now let's update this map.
const gradeMap = {
  1: "الصف الاول الاعدادي",
  2: "الصف الثاني الاعدادي",
  3: "الصف الثالث الاعدادي",
  4: "الصف الاول الثانوي",
  5: "الصف الثاني الثانوي",
  6: "الصف الثالث الثانوي"
};

if (gradeMap[gradeId]) {
  acadymicYear = gradeMap[gradeId];
} else {
  // Fallback or Try to get name from first course if available
  acadymicYear = "الصف الدراسي";
}

// Function to update header after fetching courses if we want to be dynamic
function updateHeader(gradeName) {
  if (gradeName) acadymicYear = gradeName;
  const cartonaHeading = `
                <h1>${acadymicYear}</h1>
  `;
  speacialHeading.innerHTML = cartonaHeading;
}

// Initial render
updateHeader();

function displayCourses(courses, subscribedIds) {
  const coursesContainer = document.getElementById("courses-containerr");

  if (courses.length == 0) {
    const noCourses = `
        <div class="col-12 text-center p-0 mt-5">
          <div class="alert alert-secondary" style="padding: 2rem; border-radius: 15px;">
            <h4 class="alert-heading" style="font-family: 'DG-3asomy-Regular';">لا توجد كورسات!</h4>
            <p class="pt-3" style="font-size: 18px;">لا توجد أي كورسات متاحة لــ ${acadymicYear}. تابعنا قريبًا!</p>
          </div>
        </div>
  `;
    coursesContainer.innerHTML = noCourses;
  } else {
    const allCourses = courses.map((course) => {
      // Format dates in Arabic
      const startDate = new Date(course.created_at).toLocaleDateString(
        "ar-EG-u-nu-arab",
        {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      );
      const updatedDate = new Date(course.updated_at).toLocaleDateString(
        "ar-EG-u-nu-arab",
        {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      );

      let imageUrl = "media/img/default-course.jpg";
      if (course.image) {
        if (course.image.startsWith("http")) {
          imageUrl = course.image;
        } else {
          imageUrl = `${storageBaseUrl}${course.image}`;
        }
      }
      console.log(course.image);
      return `
              
              
                  <div class="col-md-6 col-lg-4 card-course">
                <div class="course">
                  <img
                    src="${imageUrl}"
                    alt="${course.name}"
                    loading="lazy"
                  />
                  <div class="content-course">
                    <h4>${(course.title || course.name) + " - " + (course.grade ? course.grade.name : '')}</h4>
                    <p class="number-lect">${course.description}</p>
    
                    <div class="data-course">
    
                    ${(course.is_free == 1 || parseFloat(course.price) === 0)
          ? `<div class="price-free">كورس مجاني</div>`
          : course.discount_price != null
            ? `                      <div>
                            <div class="price"><span>${Math.floor(
              course.discount_price
            )}</span> جنيهاً</div>
                            <div class="price-del">بدلاً من <span>${Math.floor(
              course.price
            )}</span></div>
                          </div>`
            : subscribedIds.includes(Number(course.id))
              ? `            <div class="you-subscription">انت مشترك</div>
`
              : `
                          <div class="price"><span>${Math.floor(
                course.price
              )}</span> جنيهاً</div>`
        }
                      
    
                      <div class="info-course">
                        <p class="date-course">
                        ${startDate}
                          <svg
                            class="svg-inline--fa fa-folder-plus"
                            aria-hidden="true"
                            focusable="false"
                            data-prefix="fas"
                            data-icon="folder-plus"
                            role="img"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 512 512"
                            data-fa-i2svg=""
                          >
                            <path
                              fill="currentColor"
                              d="M512 416c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64L0 96C0 60.7 28.7 32 64 32l128 0c20.1 0 39.1 9.5 51.2 25.6l19.2 25.6c6 8.1 15.5 12.8 25.6 12.8l160 0c35.3 0 64 28.7 64 64l0 256zM232 376c0 13.3 10.7 24 24 24s24-10.7 24-24l0-64 64 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-64 0 0-64c0-13.3-10.7-24-24-24s-24 10.7-24 24l0 64-64 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l64 0 0 64z"
                            ></path></svg
                          ><!-- <i class="fa-solid fa-folder-plus"></i> Font Awesome fontawesome.com -->
                        </p>
                        <p class="update-course">
                          ${updatedDate}
                          <svg
                            class="svg-inline--fa fa-file-circle-plus fa-fade"
                            aria-hidden="true"
                            focusable="false"
                            data-prefix="fas"
                            data-icon="file-circle-plus"
                            role="img"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 576 512"
                            data-fa-i2svg=""
                          >
                            <path
                              fill="currentColor"
                              d="M0 64C0 28.7 28.7 0 64 0L224 0l0 128c0 17.7 14.3 32 32 32l128 0 0 38.6C310.1 219.5 256 287.4 256 368c0 59.1 29.1 111.3 73.7 143.3c-3.2 .5-6.4 .7-9.7 .7L64 512c-35.3 0-64-28.7-64-64L0 64zm384 64l-128 0L256 0 384 128zm48 96a144 144 0 1 1 0 288 144 144 0 1 1 0-288zm16 80c0-8.8-7.2-16-16-16s-16 7.2-16 16l0 48-48 0c-8.8 0-16 7.2-16 16s7.2 16 16 16l48 0 0 48c0 8.8 7.2 16 16 16s16-7.2 16-16l0-48 48 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-48 0 0-48z"
                            ></path></svg
                          ><!-- <i class="fa-solid fa-file-circle-plus fa-fade"></i> Font Awesome fontawesome.com -->
                        </p>
                      </div>
                    </div>
    
                    <div class="course-subscription">
                      <a href="/course-page.html?id=${course.id
        }" class="check">بص على الكورس</a>
                    </div>
                  </div>
                </div>
              </div>
        `;
    });

    coursesContainer.innerHTML = allCourses.join("");
  }
}

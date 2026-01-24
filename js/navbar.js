// Start dark mode
function initDarkMode() {
  const toggle = document.getElementById("toggle");
  const Changer = document.querySelectorAll(".changer");
  const body = document.querySelector("body");
  if (!toggle) return;

  let lightMode = JSON.parse(localStorage.getItem("lightMode")) || false;

  if (lightMode) {
    Changer.forEach(el => el.classList.add("change"));
    body.style.backgroundColor = "#fff";
  } else {
    Changer.forEach(el => el.classList.remove("change"));
    body.style.backgroundColor = "#000";
  }

  toggle.addEventListener("click", function () {
    lightMode = !lightMode;
    localStorage.setItem("lightMode", JSON.stringify(lightMode));
    Changer.forEach(el => el.classList.toggle("change"));
    body.style.backgroundColor = lightMode ? "#fff" : "#000";
  });
}

// End dark mode

// Start navbar hidden

function initNavbarScroll() {
  const navbar = document.querySelector(".nav-content");
  const scrollLine = document.querySelector(".scroll-line");
  if (!navbar || !scrollLine) return;

  window.addEventListener("scroll", () => {
    const scrollTop = window.scrollY;
    const scrollHeight = document.body.scrollHeight - window.innerHeight;
    const scrollPercent = (scrollTop / scrollHeight) * 100;

    scrollLine.style.width = `calc(${scrollPercent}% - 20px)`;

    // لو عايز تضيف شادو للناف بار لما يبدأ التمرير
    if (scrollTop > 50) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
  });
}

// End navbar hidden

// Start menu toggle
function initMenuToggle() {
  const bars = document.querySelector("#menu-toggle");
  const links = document.querySelector(".links");
  const spinner = document.querySelector(".parent-spinner");
  if (!bars || !links || !spinner) return;

  bars.addEventListener("click", function () {
    links.classList.toggle("active");
    bars.style.display = "none";
    spinner.style.display = "block";

    spinner.addEventListener("click", function () {
      links.classList.remove("active");
      bars.style.display = "flex";
      spinner.style.display = "none";
    });
  });
}


function createAccountIcon() {
  const iconCreateButton = document.querySelector("#icon-create-button");
  const btnLordIconCreate = document.querySelector(".create-account");

  if (!btnLordIconCreate || !iconCreateButton) return;

  btnLordIconCreate.addEventListener("mouseenter", () => {
    iconCreateButton.setAttribute("colors", "primary:#4B5563,secondary:#810000");
    console.log("hovered create");
  });

  btnLordIconCreate.addEventListener("mouseleave", () => {
    iconCreateButton.setAttribute("colors", "primary:#1B1717,secondary:#f3f3f3");
    console.log("leave create");
  });
}

function loginIcon() {
  const iconLoginButton = document.querySelector("#icon-login-button");
  const btnLordIconLogin = document.querySelector(".login-button");

  if (!btnLordIconLogin || !iconLoginButton) return;

  btnLordIconLogin.addEventListener("mouseenter", () => {
    iconLoginButton.setAttribute("colors", "primary:#4B5563,secondary:#4B5563");
    console.log("hovered login");
  });

  btnLordIconLogin.addEventListener("mouseleave", () => {
    iconLoginButton.setAttribute("colors", "primary:#fff,secondary:#fff");
    console.log("leave login");
  });
}


function createNewAccount() {
  const iconCreateButton = document.querySelector("#icon-create-new-account");
  const btnLordIconCreate = document.querySelector("#create-new-account");

  btnLordIconCreate.addEventListener("mouseenter", () => {
    iconCreateButton.setAttribute("colors", "primary:#4B5563,secondary:#810000");
    console.log("hovered create");
  });

  btnLordIconCreate.addEventListener("mouseleave", () => {
    iconCreateButton.setAttribute("colors", "primary:#1B1717,secondary:#f3f3f3");
    console.log("leave create");
  });
}


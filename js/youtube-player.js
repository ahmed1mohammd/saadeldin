let player;
let videoIdToLoad = null;
let hideTimeout;
let firstPlayDone = false;
let overlayTimeout;

function onYouTubeIframeAPIReady() {
  player = new YT.Player("darseli-player-player", {
    videoId: videoIdToLoad,
    playerVars: {
      playsinline: 1,
      controls: 0,
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
      autoplay: 0, // Start paused
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
    },
  });
}

window.loadYouTubeVideo = function (videoId) {
  videoIdToLoad = videoId;

  if (typeof YT === "undefined" || typeof YT.Player === "undefined") {
    // تحميل مكتبة يوتيوب لو مش جاهزة
    var tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  } else {
if (player && typeof player.cueVideoById === "function") {
  // ✅ تحميل الفيديو بدون تشغيل تلقائي
  player.cueVideoById(videoId);

  // ✅ إظهار الستارة بعد لحظات بسيطة لما الفيديو يكون جاهز
  const topOverlay = document.getElementById("darseli-player-topOverlay");
  if (topOverlay) {
    setTimeout(() => {
      topOverlay.style.display = "block";
      topOverlay.style.opacity = "1";
    }, 800); // ← مهلة بسيطة (نص ثانية إلى ثانية كافية)
  }
}
 else {
      // لو لسه مفيش بلاير، نعمله
      onYouTubeIframeAPIReady();
    }
  }
};


function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function onPlayerReady(event) {
  // event.target.playVideo();

  const watermarkElement = document.getElementById("darseli-player-watermark");
  try {
    const studentData = JSON.parse(localStorage.getItem("studentData"));
    if (studentData && studentData.student_number && watermarkElement) {
      watermarkElement.textContent = studentData.student_number;
      watermarkElement.style.opacity = "1";
    }
  } catch (error) {
    console.error("Could not load student data for watermark:", error);
  }

  const progress = document.getElementById("darseli-player-progress");
  const progressBar = document.getElementById("darseli-player-progressBar");
  const currentTime = document.getElementById("darseli-player-currentTime");
  const duration = document.getElementById("darseli-player-duration");
  const overlay = document.getElementById("darseli-player-overlay");
  const tooltipTime = document.getElementById("darseli-player-tooltipTime");
  const controls = document.getElementById("darseli-player-controls");
  const middleBtn = document.getElementById("darseli-player-middleBtn");
  const topOverlay = document.getElementById("darseli-player-topOverlay");

  const qualitySelect = document.getElementById("darseli-player-quality");

  function mapQuality(value) {
    switch (value) {
      case "auto":
        return "default";
      case "144p":
        return "small";
      case "240p":
        return "medium";
      case "360p":
        return "large";
      case "480p":
        return "hd480";
      case "720p":
        return "hd720";
      case "1080p":
        return "hd1080";
      default:
        return "default";
    }
  }

  function setQuality(value) {
    const quality = mapQuality(value);
    const available = player.getAvailableQualityLevels();
    if (available.includes(quality) || quality === "default") {
      player.setPlaybackQuality(quality);
    } else {
      console.log("الجودة غير متاحة:", quality);
    }
  }

  qualitySelect.addEventListener("change", (e) => {
    setQuality(e.target.value);
  });

  setTimeout(() => {
    if (player && typeof player.getDuration === "function") {
      duration.textContent = formatTime(player.getDuration());
      setQuality(qualitySelect.value);
    }
  }, 1000);

  const playerContainer = document.getElementById("darseli-player-container");
  const fullscreenBtn = document.getElementById("darseli-player-fullscreen");
  fullscreenBtn.onclick = () => {
    if (!document.fullscreenElement) {
      playerContainer.requestFullscreen().catch((err) => {
        console.log(`خطأ: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  playerContainer.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement) {
      playerContainer.classList.add("is-fullscreen");
    } else {
      playerContainer.classList.remove("is-fullscreen");
    }
    const state = player.getPlayerState();
    const event = { data: state };
    onPlayerStateChange(event);
    const controls = document.getElementById("darseli-player-controls");
    controls.style.opacity = "1";
  });

  controls.style.opacity = "1";
  topOverlay.style.opacity = "1";

  document
    .getElementById("darseli-player-container")
    .addEventListener("mousemove", () => {
      controls.style.opacity = "1";
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        if (player.getPlayerState() === YT.PlayerState.PLAYING)
          controls.style.opacity = "0";
      }, 4000);
    });

  setInterval(() => {
    if (player && typeof player.getCurrentTime === "function") {
      const current = player.getCurrentTime();
      const total = player.getDuration();
      if (total > 0) {
        const percent = (current / total) * 100;
        progress.style.width = percent + "%";
        currentTime.textContent = formatTime(current);
        if (duration.textContent === "0:00") {
          duration.textContent = formatTime(total);
        }
      }

      if (total > 0 && total - current <= 3) {
        overlay.style.transition = "background 0.5s ease, opacity 0.5s ease";
        overlay.style.background = "rgba(0,0,0)";
        overlay.style.opacity = "1";
      } else {
        overlay.style.transition = "background 0.5s ease, opacity 0.5s ease";
        overlay.style.background = "transparent";
        overlay.style.opacity = "0";
      }
    }
  }, 100);

  progressBar.addEventListener("mousemove", (e) => {
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const previewTime = percent * player.getDuration();
    tooltipTime.style.display = "block";
    tooltipTime.style.left = `${e.clientX - rect.left}px`;
    tooltipTime.textContent = formatTime(previewTime);
  });

  progressBar.addEventListener("mouseleave", () => {
    tooltipTime.style.display = "none";
  });

  document.getElementById("darseli-player-playPause").onclick = togglePlayPause;
  document.getElementById("darseli-player-rewind").onclick = () =>
    player.seekTo(player.getCurrentTime() - 10, true);
  document.getElementById("darseli-player-forward").onclick = () =>
    player.seekTo(player.getCurrentTime() + 10, true);
  document.getElementById("darseli-player-volume").oninput = (e) =>
    player.setVolume(e.target.value);
  document.getElementById("darseli-player-speed").onchange = (e) =>
    player.setPlaybackRate(parseFloat(e.target.value));

  const settingsBtn = document.getElementById("darseli-player-settingsBtn");
  const settingsMenu = document.getElementById("darseli-player-settingsMenu");
  settingsBtn.onclick = () => {
    settingsMenu.style.display =
      settingsMenu.style.display === "flex" ? "none" : "flex";
  };

  progressBar.addEventListener("click", (e) => {
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    player.seekTo(percent * player.getDuration(), true);
  });

  // إلغاء تأثير الضغط على overlay العادي
  // overlay.onclick = null;

  // عند الضغط على الزر الأوسط
  middleBtn.addEventListener("click", togglePlayPause);

  // عند الضغط على زر المسطرة
  document.addEventListener("keydown", (e) => {
    if (
      e.code === "Space" &&
      e.target.tagName !== "INPUT" &&
      e.target.tagName !== "TEXTAREA"
    ) {
      e.preventDefault();
      togglePlayPause();
    }
  });

  // عند الضغط على الستارة نفسها → تشغيل وإخفاء
  topOverlay.addEventListener("click", () => {
    player.playVideo();
    topOverlay.style.display = "none";
  });

  // التبديل بين التشغيل والإيقاف
function togglePlayPause() {
  const topOverlay = document.getElementById("darseli-player-topOverlay");

  if (player.getPlayerState() === YT.PlayerState.PLAYING) {
    // ⏸️ لو الفيديو بيشتغل → اعمل إيقاف مع ظهور الستارة
    topOverlay.style.display = "block";
    topOverlay.style.opacity = "1";

    // نلغي أي مؤقت سابق
    clearTimeout(overlayTimeout);

    // نوقف الفيديو فعليًا بعد لحظة بسيطة
    setTimeout(() => {
      player.pauseVideo();
    }, 10);
  } else {
    // ▶️ تشغيل الفيديو
    player.playVideo();

    // 🎯 في كل مرة نشغل الفيديو، نعتبرها كأنها أول مرة
    clearTimeout(overlayTimeout);
    topOverlay.style.display = "block";
    topOverlay.style.opacity = "1";

    overlayTimeout = setTimeout(() => {
      topOverlay.style.opacity = "0";
      setTimeout(() => {
        topOverlay.style.display = "none";
      }, 500);
    }, 4500); // ← تفضل ظاهرة 4.5 ثواني
  }
}

document
  .getElementById("overlay")
  .addEventListener("mousemove", () => {
    controls.style.opacity = "1";
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      if (player.getPlayerState() === YT.PlayerState.PLAYING)
        controls.style.opacity = "0";
    }, 4000);
  });


}

function onPlayerStateChange(e) {
  const controls = document.getElementById("darseli-player-controls");
  const middleBtn = document.getElementById("darseli-player-middleBtn");
  const topOverlay = document.getElementById("darseli-player-topOverlay");
  const bottomControls = document.querySelector(
    ".darseli-player-bottom-controls"
  );
  const playerContainer = document.getElementById("darseli-player-container");

if (e.data === YT.PlayerState.PLAYING) {
  controls.style.opacity = "1";
  middleBtn.style.opacity = "0";
  bottomControls.style.display = "flex"; // ✅ خليه يظهر طبيعي حتى في fullscreen
  clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => {
    controls.style.opacity = "0";
  }, 4000);
}
 else if (
    e.data === YT.PlayerState.PAUSED ||
    e.data === YT.PlayerState.ENDED ||
    e.data === YT.PlayerState.CUED ||
    e.data === YT.PlayerState.UNSTARTED
  ) {
    bottomControls.style.display = "flex";
    clearTimeout(hideTimeout);
    controls.style.opacity = "1";
    middleBtn.style.opacity = "1";
    topOverlay.style.opacity = "1";
  }

  document.getElementById("darseli-player-playPause").textContent =
    e.data === YT.PlayerState.PLAYING ? "pause" : "play_arrow";
  middleBtn.textContent =
    e.data === YT.PlayerState.PLAYING ? "pause" : "play_arrow";
}

window.customYoutubePlayer = {
  getPlayer: () => player,
  pause: () => {
    if (player && typeof player.pauseVideo === "function") {
      player.pauseVideo();
    }
  },
  stop: () => {
    if (player && typeof player.stopVideo === "function") {
      player.stopVideo();
    }
  },
};

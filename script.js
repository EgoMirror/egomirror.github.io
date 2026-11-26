const tasks = [
  ["pick_place", "Pick & Place"],
  ["pour_water", "Pour Water"],
  ["pack_vegetables", "Pack Vegetables"],
  ["fold_towel", "Fold Towel"],
  ["fold_clothes", "Fold Clothes"],
];

function selectButton(group, selected) {
  for (const button of group.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button === selected));
  }
}

function taskButtons(group, onSelect) {
  for (const [id, label] of tasks) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-pressed", String(id === tasks[0][0]));
    button.addEventListener("click", () => {
      if (button.getAttribute("aria-pressed") === "true") return;
      selectButton(group, button);
      onSelect(id, label);
    });
    group.append(button);
  }
}

function setSource(video, folder, task, stem) {
  video.pause();
  video.poster = `assets/posters/${stem}.webp`;
  video.src = `assets/videos/${folder}/${task}/${stem}.mp4`;
  video.load();
}

const ego = document.querySelector("#ego");
const generated = document.querySelector("#generated");
const paired = [ego, generated];
const playPair = document.querySelector("#pair-play");
const position = document.querySelector("#pair-position");
const pairTime = document.querySelector("#pair-time");
const pairStatus = document.querySelector("#pair-status");
const trials = document.querySelector("#demo-trials");
let demoTask = "pick_place";
let demoTrial = "01";
let playing = false;
let requestId = 0;

for (const video of paired) {
  video.controls = false;
  video.preload = "metadata";
  video.addEventListener("loadedmetadata", () => refreshTransport());
  video.addEventListener("error", () => {
    pausePair();
    pairStatus.textContent = "This video could not be loaded. Select a trial to try again.";
    pairStatus.hidden = false;
  });
}
document.querySelector("#pair-controls").hidden = false;
trials.hidden = false;

function timeLabel(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function refreshTransport(current = ego.currentTime) {
  const duration = Math.min(ego.duration, generated.duration);
  const ready = Number.isFinite(duration) && duration > 0;
  position.disabled = !ready;
  position.max = ready ? duration : 1;
  position.value = ready ? current : 0;
  pairTime.value = `${timeLabel(ready ? current : 0)} / ${timeLabel(ready ? duration : 0)}`;
}

function pausePair() {
  playing = false;
  requestId += 1;
  for (const video of paired) video.pause();
  playPair.textContent = "Play pair";
}

function openTrial() {
  pausePair();
  pairStatus.hidden = true;
  setSource(ego, "data_generation_videos", demoTask, `${demoTask}_binocular_ego_${demoTrial}`);
  setSource(generated, "data_generation_videos", demoTask, `${demoTask}_generated_${demoTrial}`);
  refreshTransport(0);
}

function seekPair(seconds) {
  for (const video of paired) video.currentTime = seconds;
  refreshTransport(seconds);
}

taskButtons(document.querySelector("#demo-tasks"), (task) => {
  demoTask = task;
  demoTrial = "01";
  selectButton(trials, trials.querySelector("[data-trial='01']"));
  openTrial();
});
trials.addEventListener("click", (event) => {
  const button = event.target.closest("[data-trial]");
  if (!button || button.dataset.trial === demoTrial) return;
  demoTrial = button.dataset.trial;
  selectButton(trials, button);
  openTrial();
});

playPair.addEventListener("click", async () => {
  if (playing) {
    pausePair();
    return;
  }
  if (ego.ended || generated.ended) seekPair(0);
  playing = true;
  playPair.textContent = "Pause pair";
  pairStatus.hidden = true;
  const token = ++requestId;
  try {
    await Promise.all(paired.map((video) => video.play()));
    if (requestId === token && Math.abs(ego.currentTime - generated.currentTime) > 0.08) {
      generated.currentTime = ego.currentTime;
    }
  } catch {
    if (requestId !== token) return;
    pausePair();
    pairStatus.textContent = "Playback could not start. Try playing the pair again.";
    pairStatus.hidden = false;
  }
});
position.addEventListener("input", () => seekPair(Number(position.value)));
ego.addEventListener("timeupdate", () => {
  if (playing && !ego.seeking && !generated.seeking && generated.readyState >= 2 &&
      Math.abs(ego.currentTime - generated.currentTime) > 0.12) {
    generated.currentTime = ego.currentTime;
  }
  if (!ego.seeking) refreshTransport();
});
for (const video of paired) {
  video.addEventListener("ended", () => {
    pausePair();
    refreshTransport(Math.min(ego.duration, generated.duration));
  });
}
refreshTransport();

const policyGrid = document.querySelector("#policy-grid");
const policy = [...policyGrid.querySelectorAll("video")];
let policyVisible = false;

function playPolicyVideos() {
  for (const video of policy) video.play().catch(() => {});
}

const policyObserver = new IntersectionObserver(([entry]) => {
  policyVisible = entry.isIntersecting;
  if (policyVisible) {
    playPolicyVideos();
  } else {
    for (const video of policy) video.pause();
  }
}, { threshold: 0.05 });
policyObserver.observe(policyGrid);

taskButtons(document.querySelector("#policy-tasks"), (task, label) => {
  for (const [i, video] of policy.entries()) {
    const trial = String(i + 1).padStart(2, "0");
    video.setAttribute("aria-label", `${label}, trial ${trial}`);
    setSource(video, "policy_execution_videos", task, `${task}_${trial}`);
  }
  if (policyVisible) playPolicyVideos();
});

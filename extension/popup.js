const API_BASE_URL = "http://127.0.0.1:8000";

const state = {
  mode: "topic",
  videos: [],
  selectedIds: new Set(),
  channel: null,
  currentQuery: "",
};

const elements = {
  backendStatus: document.querySelector("#backendStatus"),
  topicMode: document.querySelector("#topicMode"),
  channelMode: document.querySelector("#channelMode"),
  searchForm: document.querySelector("#searchForm"),
  queryLabel: document.querySelector("#queryLabel"),
  queryInput: document.querySelector("#queryInput"),
  limitInput: document.querySelector("#limitInput"),
  helperText: document.querySelector("#helperText"),
  channelChoices: document.querySelector("#channelChoices"),
  channelMessage: document.querySelector("#channelMessage"),
  channelsList: document.querySelector("#channelsList"),
  videosList: document.querySelector("#videosList"),
  resultCount: document.querySelector("#resultCount"),
  selectAllButton: document.querySelector("#selectAllButton"),
  clearButton: document.querySelector("#clearButton"),
  filePerVideoInput: document.querySelector("#filePerVideoInput"),
  downloadButton: document.querySelector("#downloadButton"),
  progress: document.querySelector("#progress"),
  progressFill: document.querySelector("#progressFill"),
  progressText: document.querySelector("#progressText"),
  message: document.querySelector("#message"),
};

function setBusy(isBusy) {
  elements.searchForm.querySelectorAll("input, button").forEach((item) => {
    item.disabled = isBusy;
  });
  elements.downloadButton.disabled = isBusy || state.selectedIds.size === 0;
}

function setMessage(text, kind = "") {
  elements.message.textContent = text;
  elements.message.className = `message ${kind}`.trim();
  elements.message.classList.toggle("hidden", !text);
}

function setProgress(text, completed = 0, total = 0) {
  elements.progress.classList.remove("hidden");
  elements.progressText.textContent = text;
  const percentage = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  elements.progressFill.style.width = `${percentage}%`;
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Some failures return non-JSON bodies.
  }

  if (!response.ok) {
    const detail = data && typeof data.detail === "string" ? data.detail : "Local backend request failed.";
    throw new Error(detail);
  }

  return data;
}

async function checkBackend() {
  try {
    const data = await requestJson("/health");
    elements.backendStatus.textContent = data.ok ? "Local backend ready" : "Backend issue";
    elements.backendStatus.className = data.ok ? "status ok" : "status bad";
  } catch {
    elements.backendStatus.textContent = "Backend offline";
    elements.backendStatus.className = "status bad";
    setMessage("Start the local app first: python3 setup_and_run.py", "error");
  }
}

function updateMode(mode) {
  state.mode = mode;
  state.videos = [];
  state.selectedIds = new Set();
  state.channel = null;
  elements.topicMode.classList.toggle("active", mode === "topic");
  elements.channelMode.classList.toggle("active", mode === "channel");
  elements.queryLabel.textContent = mode === "topic" ? "Topic" : "Channel URL, handle, or name";
  elements.queryInput.placeholder = mode === "topic" ? "acne skincare routine" : "https://www.youtube.com/@veritasium";
  elements.helperText.textContent =
    mode === "topic"
      ? "Search top YouTube results, select videos, then download a local transcript package."
      : "Resolve a channel, select it if needed, then load recent videos from the local backend.";
  elements.channelChoices.classList.add("hidden");
  renderVideos();
  updateSelectionState();
}

function formatNumber(value) {
  return typeof value === "number" ? value.toLocaleString("en-US") : null;
}

function videoMeta(video) {
  const parts = [
    video.channel_name,
    video.duration_text,
    video.upload_date,
    formatNumber(video.view_count) ? `${formatNumber(video.view_count)} views` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function renderVideos() {
  elements.videosList.className = state.videos.length ? "list" : "list empty";

  if (!state.videos.length) {
    elements.videosList.textContent = "Search a topic or channel to load videos.";
    return;
  }

  elements.videosList.textContent = "";
  for (const video of state.videos) {
    const row = document.createElement("label");
    row.className = "video";

    const main = document.createElement("div");
    main.className = "video-main";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.selectedIds.has(video.video_id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.selectedIds.add(video.video_id);
      } else {
        state.selectedIds.delete(video.video_id);
      }
      updateSelectionState();
    });

    const img = document.createElement("img");
    img.className = "thumb";
    img.alt = "";
    img.src = video.thumbnail_url || "";

    const copy = document.createElement("div");
    const title = document.createElement("div");
    title.className = "video-title";
    title.textContent = video.title || video.video_id;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = videoMeta(video);
    copy.append(title, meta);

    main.append(checkbox, img, copy);
    row.append(main);
    elements.videosList.append(row);
  }
}

function updateSelectionState() {
  elements.resultCount.textContent = `${state.selectedIds.size} selected`;
  elements.downloadButton.disabled = state.selectedIds.size === 0;
}

function selectedVideos() {
  return state.videos.filter((video) => state.selectedIds.has(video.video_id));
}

function renderChannels(candidates, message) {
  elements.channelChoices.classList.remove("hidden");
  elements.channelMessage.textContent = message || "";
  elements.channelsList.textContent = "";

  for (const channel of candidates) {
    const row = document.createElement("div");
    row.className = "channel";

    const inner = document.createElement("div");
    inner.className = "channel-row";

    const copy = document.createElement("div");
    const title = document.createElement("div");
    title.className = "channel-title";
    title.textContent = channel.name;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = [channel.handle, channel.subscriber_count_text, channel.video_count_text].filter(Boolean).join(" · ");
    copy.append(title, meta);

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Use";
    button.addEventListener("click", () => loadChannelVideos(channel));

    inner.append(copy, button);
    row.append(inner);
    elements.channelsList.append(row);
  }
}

async function searchTopic() {
  const query = elements.queryInput.value.trim();
  const limit = Number(elements.limitInput.value) || 25;
  if (!query) {
    setMessage("Enter a topic first.", "error");
    return;
  }

  state.currentQuery = query;
  setBusy(true);
  setMessage("");
  elements.progress.classList.add("hidden");

  try {
    const data = await requestJson("/api/videos/topic-search", {
      method: "POST",
      body: JSON.stringify({
        query,
        limit,
        enrich: false,
        auto_select_threshold: 80,
      }),
    });
    state.channel = {
      name: `Topic - ${query}`,
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    };
    state.videos = data.videos || [];
    state.selectedIds = new Set(state.videos.filter((video) => video.selected).map((video) => video.video_id));
    renderVideos();
    updateSelectionState();
    setMessage(`Loaded ${state.videos.length} topic videos.`);
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Could not search topic.", "error");
  } finally {
    setBusy(false);
  }
}

async function searchChannel() {
  const query = elements.queryInput.value.trim();
  if (!query) {
    setMessage("Enter a channel URL, handle, or name first.", "error");
    return;
  }

  state.currentQuery = query;
  setBusy(true);
  setMessage("");
  elements.progress.classList.add("hidden");

  try {
    const data = await requestJson("/api/channels/resolve", {
      method: "POST",
      body: JSON.stringify({ query, max_results: 10 }),
    });

    const candidates = data.candidates || [];
    if (data.selected_channel) {
      await loadChannelVideos(data.selected_channel);
    } else if (candidates.length === 1) {
      await loadChannelVideos(candidates[0]);
    } else if (candidates.length > 0) {
      renderChannels(candidates, data.message);
      setMessage("Select the matching channel.");
    } else {
      setMessage(data.message || "No channels found.", "error");
    }
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Could not resolve channel.", "error");
  } finally {
    setBusy(false);
  }
}

async function loadChannelVideos(channel) {
  setBusy(true);
  setMessage(`Loading videos from ${channel.name}...`);
  elements.channelChoices.classList.add("hidden");

  try {
    const pageSize = Math.min(100, Math.max(1, Number(elements.limitInput.value) || 50));
    const data = await requestJson("/api/videos/page", {
      method: "POST",
      body: JSON.stringify({
        channel_url: channel.url,
        page: 1,
        page_size: pageSize,
        enrich: true,
        include_total: true,
      }),
    });
    state.channel = channel;
    state.videos = data.videos || [];
    state.selectedIds = new Set(state.videos.map((video) => video.video_id));
    renderVideos();
    updateSelectionState();
    setMessage(`Loaded ${state.videos.length} videos from ${channel.name}.`);
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Could not load channel videos.", "error");
  } finally {
    setBusy(false);
  }
}

async function streamKnowledgeBase() {
  const videos = selectedVideos();
  if (!videos.length || !state.channel) {
    setMessage("Select at least one video first.", "error");
    return;
  }

  setBusy(true);
  setMessage("");
  setProgress("Starting transcript extraction...", 0, videos.length);

  try {
    const response = await fetch(`${API_BASE_URL}/api/videos/knowledge-base/stream?mode=download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel_name: state.channel.name,
        channel_url: state.channel.url,
        output_dir: "",
        include_comments: false,
        max_comments: 0,
        file_per_video: elements.filePerVideoInput.checked,
        videos: videos.map((video) => ({
          video_id: video.video_id,
          url: video.url,
          title: video.title,
        })),
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error("Could not create the knowledge base.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result = null;

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        const event = JSON.parse(line);
        if (event.type === "video_started") {
          setProgress(`Extracting ${event.video.title}`, event.completed, event.total);
        } else if (event.type === "video_done") {
          setProgress(`Extracted ${event.video.title}`, event.completed, event.total);
        } else if (event.type === "video_error") {
          setProgress(event.message, event.index, event.total);
        } else if (event.type === "done") {
          result = event.result;
          setProgress("Packaging download...", event.completed, event.total);
        }
      }

      if (done) {
        break;
      }
    }

    if (!result) {
      throw new Error("Backend did not return a final package.");
    }

    const available = result.transcript_summary?.available || 0;
    const missing =
      (result.transcript_summary?.blocked_by_youtube || 0) +
      (result.transcript_summary?.unavailable || 0);

    if (available === 0 && missing > 0) {
      throw new Error(result.warnings?.[0] || "No transcripts were downloaded.");
    }

    if (!result.download_url) {
      throw new Error("Backend did not return a download URL.");
    }

    const downloadUrl = `${API_BASE_URL}${result.download_url}`;
    await chrome.downloads.download({
      url: downloadUrl,
      filename: result.download_filename || "youtube-knowledge-base.zip",
      saveAs: false,
    });

    const warning = missing > 0 ? ` ${missing} selected videos were missing transcripts.` : "";
    setMessage(`Download started. ${available} transcript${available === 1 ? "" : "s"} extracted.${warning}`, missing > 0 ? "warn" : "");
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Could not download knowledge base.", "error");
  } finally {
    setBusy(false);
  }
}

elements.topicMode.addEventListener("click", () => updateMode("topic"));
elements.channelMode.addEventListener("click", () => updateMode("channel"));
elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.mode === "topic") {
    searchTopic();
  } else {
    searchChannel();
  }
});
elements.selectAllButton.addEventListener("click", () => {
  state.selectedIds = new Set(state.videos.map((video) => video.video_id));
  renderVideos();
  updateSelectionState();
});
elements.clearButton.addEventListener("click", () => {
  state.selectedIds = new Set();
  renderVideos();
  updateSelectionState();
});
elements.downloadButton.addEventListener("click", streamKnowledgeBase);

updateMode("topic");
checkBackend();

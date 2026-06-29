export function createDefaultAppUi({ document, window, colors, actions }) {
  const elements = queryDefaultElements(document);
  const state = {
    selectedColor: null,
    renderedColor: null,
    renderedName: null,
    renderedRoomId: null,
    toastTimer: 0
  };

  bindDefaultUi(elements, actions);

  return {
    sceneHost: elements.sceneHost,
    render(view) {
      state.selectedColor = view.selectedColor ?? state.selectedColor;
      document.body.dataset.uiChrome = view.uiMode ?? "default";
      elements.lobby.hidden = view.phase !== "lobby";
      elements.space.hidden = view.phase !== "room";

      const nextName = view.identity?.name ?? "";
      const nextRoomId = view.roomId ?? "";
      if (state.renderedName !== nextName) {
        setInputValue(elements.nameInput, nextName);
        state.renderedName = nextName;
      }
      if (state.renderedRoomId !== nextRoomId) {
        setInputValue(elements.roomInput, nextRoomId);
        state.renderedRoomId = nextRoomId;
      }
      elements.lobbyNote.textContent = view.lobbyNote ?? "";

      renderColorChoices({
        colorGrid: elements.colorGrid,
        colors,
        selectedColor: state.selectedColor,
        renderedColor: state.renderedColor,
        onSelectColor: actions.onSelectColor
      });
      state.renderedColor = state.selectedColor;

      elements.space.dataset.complete = String(Boolean(view.objective?.isComplete));
      elements.roomLabel.textContent = `Room ${view.roomId ?? ""}`;
      elements.roomTitle.textContent = view.identity?.name ?? "Lumen Space";
      elements.connectionStatus.textContent = view.status?.text ?? "Starting";
      elements.connectionStatus.dataset.state = view.status?.state ?? "pending";
      renderObjectiveGuide(elements, view.objective);
      renderCompletionOverlay(elements, view.objective);
      renderPeople(elements, view.participants ?? []);
      renderSoundControl(elements, view.sound);
    },
    setGenerateNameBusy(isBusy) {
      elements.generateNameButton.disabled = Boolean(isBusy);
    },
    focusName() {
      elements.nameInput.focus();
      elements.nameInput.select();
    },
    showToast(message) {
      elements.toast.textContent = message;
      elements.toast.hidden = false;
      window.clearTimeout(state.toastTimer);
      state.toastTimer = window.setTimeout(() => {
        elements.toast.hidden = true;
      }, 3_200);
    }
  };
}

export function createSceneOnlyAppUi({ document }) {
  const lobby = document.querySelector("#lobby");
  const space = document.querySelector("#space");
  const sceneHost = document.querySelector("#scene-host");
  const hiddenElements = [
    document.querySelector(".top-bar"),
    document.querySelector("#connection-status"),
    document.querySelector(".objective-panel"),
    document.querySelector(".people-panel"),
    document.querySelector(".action-bar"),
    document.querySelector("#toast")
  ].filter(Boolean);

  hideChrome();

  return {
    sceneHost,
    render(view) {
      document.body.dataset.uiChrome = view.uiMode ?? "scene-only";
      if (lobby) {
        lobby.hidden = true;
      }
      if (space) {
        space.hidden = view.phase !== "room";
      }
      hideChrome();
    },
    setGenerateNameBusy() {},
    focusName() {},
    showToast() {}
  };

  function hideChrome() {
    for (const element of hiddenElements) {
      element.hidden = true;
    }
  }
}

function queryDefaultElements(document) {
  return {
    lobby: document.querySelector("#lobby"),
    joinForm: document.querySelector("#join-form"),
    nameInput: document.querySelector("#name-input"),
    generateNameButton: document.querySelector("#generate-name-button"),
    roomInput: document.querySelector("#room-input"),
    colorGrid: document.querySelector("#color-grid"),
    lobbyNote: document.querySelector("#lobby-note"),
    createRoomButton: document.querySelector("#create-room-button"),
    space: document.querySelector("#space"),
    sceneHost: document.querySelector("#scene-host"),
    completionOverlay: document.querySelector("#completion-overlay"),
    completionTitle: document.querySelector("#completion-title"),
    completionText: document.querySelector("#completion-text"),
    completionScoreboardTitle: document.querySelector("#completion-scoreboard-title"),
    completionLeaders: document.querySelector("#completion-leaders"),
    completionStats: document.querySelector("#completion-stats"),
    stayButton: document.querySelector("#stay-button"),
    completionLeaveButton: document.querySelector("#completion-leave-button"),
    roomLabel: document.querySelector("#room-label"),
    roomTitle: document.querySelector("#room-title"),
    connectionStatus: document.querySelector("#connection-status"),
    objectivePanel: document.querySelector("#objective-panel"),
    objectiveKicker: document.querySelector(".objective-kicker"),
    objectiveTitle: document.querySelector("#objective-title"),
    objectiveText: document.querySelector("#objective-text"),
    objectiveProgress: document.querySelector("#objective-progress"),
    objectiveStars: document.querySelector("#objective-stars"),
    objectiveConstellations: document.querySelector("#objective-constellations"),
    peopleList: document.querySelector("#people-list"),
    peerCount: document.querySelector("#peer-count"),
    copyLinkButton: document.querySelector("#copy-link-button"),
    soundButton: document.querySelector("#sound-button"),
    leaveButton: document.querySelector("#leave-button"),
    toast: document.querySelector("#toast")
  };
}

function bindDefaultUi(elements, actions) {
  elements.nameInput.addEventListener("input", () => {
    actions.onNameEdited?.(elements.nameInput.value);
  });
  elements.generateNameButton.addEventListener("click", () => {
    actions.onGenerateName?.();
  });
  elements.createRoomButton.addEventListener("click", () => {
    actions.onCreateRoom?.();
  });
  elements.joinForm.addEventListener("submit", (event) => {
    event.preventDefault();
    actions.onJoinRoom?.({
      name: elements.nameInput.value,
      roomId: elements.roomInput.value
    });
  });
  elements.copyLinkButton.addEventListener("click", () => {
    actions.onCopyInvite?.();
  });
  elements.stayButton?.addEventListener("click", () => {
    actions.onStayInRoom?.();
  });
  elements.completionLeaveButton?.addEventListener("click", () => {
    actions.onLeaveRoom?.();
  });
  elements.soundButton.addEventListener("click", () => {
    actions.onToggleSound?.();
  });
  elements.leaveButton.addEventListener("click", () => {
    actions.onLeaveRoom?.();
  });
}

function setInputValue(input, value) {
  if (input.value !== value && input.ownerDocument.activeElement !== input) {
    input.value = value;
  }
}

function renderColorChoices({
  colorGrid,
  colors,
  selectedColor,
  renderedColor,
  onSelectColor
}) {
  if (renderedColor === selectedColor && colorGrid.childElementCount === colors.length) {
    return;
  }

  colorGrid.replaceChildren(
    ...colors.map((color) => {
      const button = colorGrid.ownerDocument.createElement("button");
      button.type = "button";
      button.className = "color-choice";
      button.style.setProperty("--choice-color", color);
      button.setAttribute("aria-label", `Use color ${color}`);
      button.setAttribute("aria-pressed", String(color === selectedColor));
      button.addEventListener("click", () => {
        onSelectColor?.(color);
      });
      return button;
    })
  );
}

function renderObjectiveGuide(elements, objective) {
  if (!elements.objectivePanel) {
    return;
  }

  const hasObjective = Boolean(objective);
  elements.objectivePanel.hidden = !hasObjective;
  if (!hasObjective) {
    return;
  }

  elements.objectiveTitle.textContent = objective.title;
  elements.objectivePanel.dataset.complete = String(Boolean(objective.isComplete));
  if (elements.objectiveKicker) {
    elements.objectiveKicker.textContent = objective.isComplete ? "Complete" : "Goal";
  }
  elements.objectiveText.textContent = objective.text;
  elements.objectiveProgress.style.setProperty(
    "--objective-progress",
    `${Math.round((objective.progress ?? 0) * 100)}%`
  );
  elements.objectiveStars.textContent = `${objective.openedStarCount}/${objective.totalStarCount}`;
  elements.objectiveConstellations.textContent =
    `${objective.revealedConstellationCount}/${objective.totalConstellationCount}`;
}

function renderCompletionOverlay(elements, objective) {
  const scoreboard = objective?.scoreboard;
  const isComplete = Boolean(objective?.isComplete && scoreboard);
  if (!elements.completionOverlay) {
    return;
  }

  elements.completionOverlay.hidden = !isComplete;
  if (!isComplete) {
    elements.completionLeaders?.replaceChildren();
    elements.completionStats?.replaceChildren();
    return;
  }

  if (elements.completionTitle) {
    elements.completionTitle.textContent = objective.title;
  }
  if (elements.completionText) {
    elements.completionText.textContent = objective.text;
  }
  if (elements.completionScoreboardTitle) {
    elements.completionScoreboardTitle.textContent = scoreboard.title ?? "Constellation leaders";
  }

  const document = elements.completionOverlay.ownerDocument;
  const leaders = Array.isArray(scoreboard.leaders) ? scoreboard.leaders : [];
  elements.completionLeaders?.replaceChildren(
    ...(leaders.length > 0
      ? leaders.map((leader) => createLeaderRow(document, leader))
      : [createEmptyLeaderRow(document)])
  );
  const stats = Array.isArray(scoreboard.stats) ? scoreboard.stats : [];
  elements.completionStats?.replaceChildren(
    ...stats.map((stat) => {
      const item = document.createElement("div");
      const label = document.createElement("dt");
      const value = document.createElement("dd");
      label.textContent = stat.label ?? "";
      value.textContent = stat.value ?? "";
      item.append(label, value);
      return item;
    })
  );
}

function createLeaderRow(document, leader) {
  const item = document.createElement("li");
  item.className = "completion-leader";
  item.innerHTML = `
    <span class="leader-rank"></span>
    <span class="leader-swatch" style="--leader-color: ${leader.color}"></span>
    <span class="leader-name"></span>
    <span class="leader-score"></span>
  `;
  item.querySelector(".leader-rank").textContent = `#${leader.rank}`;
  item.querySelector(".leader-name").textContent = leader.name;
  item.querySelector(".leader-score").textContent =
    `${leader.count} ${leader.count === 1 ? "constellation" : "constellations"}`;
  return item;
}

function createEmptyLeaderRow(document) {
  const item = document.createElement("li");
  item.className = "completion-leader completion-leader-empty";
  item.textContent = "Reveal credits are syncing.";
  return item;
}

function renderSoundControl(elements, sound) {
  const isAvailable = Boolean(sound?.available);
  const isEnabled = Boolean(sound?.enabled);
  elements.soundButton.hidden = !isAvailable;
  elements.soundButton.title = isEnabled ? "Mute lo-fi room music" : "Unmute lo-fi room music";
  elements.soundButton.setAttribute("aria-label", elements.soundButton.title);
  elements.soundButton.setAttribute("aria-pressed", String(isEnabled));
  const label = elements.soundButton.querySelector(".action-label");
  if (label) {
    label.textContent = isEnabled ? "Lo-Fi On" : "Lo-Fi Off";
  }
}

function renderPeople(elements, participants) {
  elements.peerCount.textContent = String(participants.length);
  elements.peopleList.replaceChildren(
    ...participants.map((participant) => {
      const row = document.createElement("li");
      row.className = "person-row";
      row.innerHTML = `
        <span class="person-swatch" style="--person-color: ${participant.color}"></span>
        <span class="person-name"></span>
        <span class="person-meta">${participant.isLocal ? "you" : participant.isBot ? "bot" : "live"}</span>
      `;
      row.querySelector(".person-name").textContent = participant.name;
      return row;
    })
  );
}
